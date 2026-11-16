import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { chromium } from 'playwright';
import { makeServer } from '../build/server.js';
import { readConfig } from '../build/config.js';

const mode = process.argv[2] ?? 'direct';
if (!['direct', 'relay'].includes(mode)) throw new Error('Use direct or relay');
const relay = mode === 'relay';
// All browser contexts share one local IP. The Node integration suite checks the normal rate limits.
const config = { ...readConfig({}), inviteMs: 10_000, activeMs: 90_000, joinLimit: 100 };
const externalOrigin = process.env.PEERDROP_TEST_ORIGIN;
if (relay && !externalOrigin) {
  const { turnUrls, turnSecret } = readConfig({ ...process.env, FORCE_RELAY: 'true' });
  Object.assign(config, { turnUrls, turnSecret, forceRelay: true });
}
const app = externalOrigin ? undefined : await makeServer(config);
const origin = externalOrigin ?? await app.listen({ host: '127.0.0.1', port: 0 });
if (app) config.origins = [origin];
let browser;

async function scenario(name, run, options = {}) {
  const senderContext = await browser.newContext({ acceptDownloads: true });
  const receiverContext = await browser.newContext({ acceptDownloads: true });
  const unexpected = [];
  try {
    const sender = await senderContext.newPage();
    const receiver = await receiverContext.newPage();
    for (const page of [sender, receiver]) {
      page.setDefaultTimeout(20_000);
      page.on('pageerror', error => unexpected.push(error.message));
    }
    if (options.slow) {
      // A slow file source lets us interrupt a genuine transfer after bytes arrive.
      await sender.addInitScript(() => {
        const originalSlice = File.prototype.slice;
        File.prototype.slice = function (...args) {
          const part = originalSlice.apply(this, args);
          const read = part.arrayBuffer.bind(part);
          part.arrayBuffer = async () => { await new Promise(resolve => setTimeout(resolve, 25)); return read(); };
          return part;
        };
      });
    }
    await run({ sender, receiver, receiverContext });
    assert.deepEqual(unexpected, []);
    console.log(`PASS ${name}`);
  } finally {
    await Promise.all([senderContext.close(), receiverContext.close()]);
  }
}

async function status(page, text) {
  await page.getByRole('heading', { name: text, exact: true }).waitFor();
}

async function invite(sender, bytes, name = 'peer-test.bin') {
  await sender.goto(origin);
  await sender.getByRole('link', { name: 'Send a file' }).click();
  await status(sender, 'Choose a file to send');
  await sender.getByLabel('Choose a file', { exact: true }).setInputFiles(typeof bytes === 'string' ? bytes : { name, mimeType: 'application/octet-stream', buffer: bytes });
  await sender.getByRole('button', { name: 'Create invite link' }).click();
  await status(sender, 'Waiting for receiver');
  return sender.getByLabel('Invite link').inputValue();
}

async function join(receiver, url) {
  await receiver.goto(url);
  await status(receiver, 'Accept this file?');
  assert.equal(new URL(receiver.url()).hash, '');
  assert.equal(await receiver.getByText('peer-test.bin', { exact: true }).isVisible(), true);
}

async function unavailable(page, url) {
  await page.goto('about:blank');
  await page.goto(url);
  await page.getByText('This invite has already been used.', { exact: false }).waitFor();
}

function expectNoDownload(page) {
  return page.locator('#save-file').evaluate(link => {
    if (!link.hidden || link.hasAttribute('href')) throw new Error('A partial download is available');
  });
}

async function complete({ sender, receiver }, bytes, expectedPath) {
  const url = await invite(sender, bytes);
  await join(receiver, url);
  await receiver.getByRole('button', { name: 'Accept', exact: true }).click();
  await sender.locator('#transfer-status').filter({ hasText: /^Delivered$/ }).waitFor({ timeout: 120_000 });
  await status(receiver, 'Ready to save');
  assert.equal(await sender.locator('#connection-path').textContent(), expectedPath);
  assert.equal(await receiver.locator('#connection-path').textContent(), expectedPath);
  assert.match(await sender.locator('#progress-label').textContent(), /^Bytes sent: .*100%/);
  assert.match(await receiver.locator('#progress-label').textContent(), /^Bytes received: .*100%/);
  const download = receiver.waitForEvent('download');
  await receiver.getByRole('link', { name: 'Save file' }).click();
  const saved = await download;
  assert.equal(saved.suggestedFilename(), 'peer-test.bin');
  if (typeof bytes === 'string') {
    async function digest(path) {
      const hash = createHash('sha256');
      for await (const part of createReadStream(path)) hash.update(part);
      return hash.digest('hex');
    }
    assert.equal(await digest(await saved.path()), await digest(bytes));
  } else {
    assert.deepEqual(await readFile(await saved.path()), bytes);
  }
  await unavailable(receiver, url);
}

try {
  browser = await chromium.launch({ executablePath: process.env.PEERDROP_BROWSER || undefined });
  await scenario(`${mode}: separate browser contexts, download matches byte for byte`, pair => complete(pair, randomBytes(2 * 1024 * 1024 + 19), relay ? 'Assisted connection' : 'Direct connection'));
  if (!relay && !externalOrigin) {
    await scenario('drop one file and download it byte for byte', async ({ sender, receiver }) => {
      await sender.goto(origin + '/send');
      await status(sender, 'Choose a file to send');
      const zone = sender.locator('#file-drop-zone');
      const input = sender.getByLabel('Choose a file', { exact: true });
      const create = sender.getByRole('button', { name: 'Create invite link' });
      const contents = 'Dropped into PeerDrop.';
      const drag = await sender.evaluateHandle(text => {
        const data = new DataTransfer();
        data.items.add(new File([text], 'peer-test.bin'));
        return data;
      }, contents);
      await zone.dispatchEvent('dragover', { dataTransfer: drag });
      assert.ok(await zone.evaluate(node => node.classList.contains('is-drag-over')));
      await zone.dispatchEvent('dragleave', { dataTransfer: drag });
      assert.ok(await create.isDisabled());
      assert.equal(await zone.evaluate(node => node.classList.contains('is-drag-over')), false);
      await sender.locator('#transfer-title').dispatchEvent('drop', { dataTransfer: drag });
      assert.ok(await create.isDisabled());
      await zone.dispatchEvent('drop', { dataTransfer: drag });
      assert.equal(await input.evaluate(node => node.files[0].name), 'peer-test.bin');
      assert.ok(await create.isEnabled());
      await drag.evaluate(data => data.items.add(new File(['second file'], 'second.bin')));
      await zone.dispatchEvent('drop', { dataTransfer: drag });
      await sender.getByRole('status').filter({ hasText: 'Drop one file at a time.' }).waitFor();
      assert.ok(await create.isDisabled());
      await drag.evaluate(data => data.items.remove(1));
      await zone.dispatchEvent('drop', { dataTransfer: drag });
      await create.click();
      await status(sender, 'Waiting for receiver');
      await join(receiver, await sender.getByLabel('Invite link').inputValue());
      await receiver.getByRole('button', { name: 'Accept', exact: true }).click();
      await status(sender, 'Delivered');
      await status(receiver, 'Ready to save');
      const download = receiver.waitForEvent('download');
      await receiver.getByRole('link', { name: 'Save file' }).click();
      assert.deepEqual(await readFile(await (await download).path()), Buffer.from(contents));
    });
    await scenario('theme follows the system and remembers a keyboard or pointer choice', async ({ sender }) => {
      const setting = () => sender.locator('html').getAttribute('data-theme');
      const toggle = sender.getByRole('button', { name: 'Dark mode' });
      await sender.setViewportSize({ width: 320, height: 740 });
      await sender.emulateMedia({ colorScheme: 'dark' });
      await sender.goto(origin);
      assert.equal(await setting(), 'dark');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.ok(await toggle.locator('.theme-sun').isVisible());
      await toggle.focus();
      await sender.keyboard.press('Space');
      assert.equal(await setting(), 'light');
      assert.ok(await toggle.locator('.theme-moon').isVisible());
      await sender.goto(origin + '/privacy');
      assert.equal(await setting(), 'light');
      await toggle.click();
      await sender.reload();
      assert.equal(await setting(), 'dark');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.ok(await sender.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    });
    await scenario('public footers, new guide, keyboard FAQ, and pointer preferences', async ({ sender, receiver }) => {
      for (const width of [320, 768, 1440]) {
        await sender.setViewportSize({ width, height: 900 });
        for (const path of ['/', '/send', '/how-it-works', '/privacy', '/terms']) {
          await sender.goto(origin + path);
          assert.ok(await sender.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${width} px`);
          const footer = sender.getByRole('contentinfo');
          assert.equal(await footer.getByText('Made by Maarij', { exact: true }).count(), 1);
          assert.equal(await footer.getByRole('link', { name: /How it works/ }).count(), 1);
          assert.equal(await footer.getByRole('link', { name: 'Back to top' }).count(), 0);
        }
      }

      await sender.goto(origin);
      assert.equal(await sender.locator('img.kubai-icon').count(), 0);
      assert.equal(await sender.locator('#transfer-preview .kubai-icon svg').count(), 3);
      const iconIds = await sender.locator('.kubai-icon svg [id]').evaluateAll(nodes => nodes.map(node => node.id));
      assert.ok(iconIds.length > 0);
      assert.equal(new Set(iconIds).size, iconIds.length);
      const cursor = sender.locator('.site-cursor');
      await sender.mouse.move(180, 210);
      await cursor.waitFor({ state: 'visible' });
      assert.equal(await cursor.locator('[data-icon="cursor"] svg').count(), 1);
      assert.equal(await sender.locator('html').evaluate(node => getComputedStyle(node).cursor), 'none');
      const sendLink = sender.getByRole('link', { name: 'Send a file' });
      await sendLink.hover();
      assert.ok(await cursor.evaluate(node => node.classList.contains('is-over-control')));
      await sender.keyboard.press('Tab');
      await cursor.waitFor({ state: 'hidden' });
      const question = sender.locator('#faq summary').first();
      await question.focus();
      await sender.keyboard.press('Enter');
      assert.ok(await question.evaluate(node => node.parentElement.open));
      await sender.keyboard.press('Space');
      assert.equal(await question.evaluate(node => node.parentElement.open), false);
      await sender.getByRole('contentinfo').getByRole('link', { name: 'How it works' }).click();
      await sender.getByRole('heading', { name: 'How PeerDrop works' }).waitFor();

      await receiver.emulateMedia({ reducedMotion: 'reduce' });
      await receiver.goto(origin);
      await receiver.mouse.move(180, 210);
      assert.equal(await receiver.locator('.site-cursor').isVisible(), false);
      assert.equal(await receiver.locator('.hero-copy').evaluate(node => getComputedStyle(node).animationName), 'none');
      await receiver.getByRole('link', { name: 'Send a file' }).click();
      const guide = receiver.waitForEvent('popup');
      await receiver.getByRole('contentinfo').getByRole('link', { name: /How it works/ }).click();
      await (await guide).waitForURL('**/how-it-works');
      assert.equal(new URL(receiver.url()).pathname, '/send');
    });
    await scenario('receiver waits for the sender readiness event before making an offer', async pair => {
      const { sender, receiver } = pair;
      let releaseReceiverRegistration;
      const receiverRegistered = new Promise(resolve => { releaseReceiverRegistration = resolve; });
      let readinessReleased = false;
      let offeredEarly = false;

      await sender.addInitScript(() => {
        const send = WebSocket.prototype.send;
        WebSocket.prototype.send = function (message) {
          if (new URL(this.url).pathname.startsWith('/ws/signaling/') && JSON.parse(String(message)).type === 'peer_ready') {
            window.releasePeerReadiness = () => send.call(this, message);
            return;
          }
          send.call(this, message);
        };
      });
      receiver.on('websocket', socket => {
        if (!new URL(socket.url()).pathname.endsWith('/filepizza/peerjs')) return;
        socket.on('framereceived', ({ payload }) => {
          if (JSON.parse(String(payload)).type === 'OPEN') releaseReceiverRegistration();
        });
        socket.on('framesent', ({ payload }) => {
          if (JSON.parse(String(payload)).type === 'OFFER' && !readinessReleased) offeredEarly = true;
        });
      });

      const url = await invite(sender, Buffer.from('wait for the sender'));
      await receiver.goto(url);
      await sender.waitForFunction(() => typeof window.releasePeerReadiness === 'function');
      const timeout = AbortSignal.timeout(10_000);
      await Promise.race([receiverRegistered, new Promise((_, reject) => {
        timeout.addEventListener('abort', () => reject(new Error('Receiver did not register with FilePizza')), { once: true });
      })]);
      // Give an eager receiver time to send an offer while sender readiness is held back.
      await receiver.waitForTimeout(300);
      assert.equal(offeredEarly, false);
      readinessReleased = true;
      await sender.evaluate(() => window.releasePeerReadiness());
      await status(receiver, 'Accept this file?');
      await receiver.getByRole('button', { name: 'Decline' }).click();
      await status(sender, 'Declined');
    });
    await scenario('receiver can reload before joining without losing the invite', async ({ sender, receiver }) => {
      let entered;
      const configRequested = new Promise(resolve => { entered = resolve; });
      let deferred;
      await receiver.route('**/api/config', route => {
        deferred = route;
        entered();
      }, { times: 1 });
      const url = await invite(sender, Buffer.from('sample'));
      await receiver.goto(url, { waitUntil: 'domcontentloaded' });
      await configRequested;
      assert.ok(new URL(receiver.url()).hash);
      await receiver.reload();
      await deferred.abort().catch(() => {});
      await status(receiver, 'Accept this file?');
      assert.equal(new URL(receiver.url()).hash, '');
      await receiver.getByRole('button', { name: 'Decline' }).click();
      await status(sender, 'Declined');
    });
    const largeDirectory = await mkdtemp(joinPath(tmpdir(), 'peerdrop-large-'));
    try {
      const largeFile = joinPath(largeDirectory, 'peer-test.bin');
      const block = randomBytes(1024 ** 2);
      await writeFile(largeFile, (async function* () {
        for (let index = 0; index < 101; index++) yield block;
        yield block.subarray(0, 23);
      })());
      await scenario('101 MiB disk-backed transfer, download hashes match', pair => complete(pair, largeFile, 'Direct connection'));
      await scenario('cancelled disk-backed transfer removes the temporary file', async ({ sender, receiver }) => {
        const url = await invite(sender, largeFile);
        await join(receiver, url);
        await receiver.getByRole('button', { name: 'Accept', exact: true }).click();
        await receiver.waitForFunction(() => Number(document.querySelector('progress').value) > 0);
        await receiver.getByRole('button', { name: 'Cancel transfer' }).click();
        await status(sender, 'Cancelled');
        await status(receiver, 'Cancelled');
        await expectNoDownload(receiver);
        await receiver.waitForFunction(async () => {
          const root = await navigator.storage.getDirectory();
          const directory = await root.getDirectoryHandle('peerdrop-transfers');
          return (await directory.keys().next()).done;
        });
      }, { slow: true });
    } finally {
      await rm(largeDirectory, { recursive: true, force: true });
    }
    await scenario('zero-byte download', pair => complete(pair, Buffer.alloc(0), 'Direct connection'));
    await scenario('decline and reject invite reuse', async ({ sender, receiver }) => {
      const url = await invite(sender, Buffer.from('sample'));
      await join(receiver, url);
      await receiver.getByRole('button', { name: 'Decline' }).click();
      await status(sender, 'Declined');
      await status(receiver, 'Declined');
      await expectNoDownload(receiver);
      await unavailable(receiver, url);
      await sender.getByRole('button', { name: 'Choose another file' }).click();
      await status(sender, 'Choose a file to send');
      assert.equal(await sender.getByLabel('Choose a file', { exact: true }).inputValue(), '');
      assert.equal(await sender.getByRole('button', { name: 'Create invite link' }).isDisabled(), true);
    });
    await scenario('temporary file cleanup preserves an active download in another tab', async ({ receiver, receiverContext }) => {
      const otherTab = await receiverContext.newPage();
      await Promise.all([receiver.goto(origin), otherTab.goto(origin)]);
      const activeFile = await receiver.evaluate(async () => {
        const { openReceiveStorage } = await import('/receive-storage.js');
        const storage = await openReceiveStorage();
        await storage.write(new Uint8Array([42]));
        return (await storage.finish()).name;
      });
      await otherTab.evaluate(async name => {
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle('peerdrop-transfers');
        const orphan = `locked-${crypto.randomUUID()}`;
        await directory.getFileHandle(orphan, { create: true });
        const { openReceiveStorage } = await import('/receive-storage.js');
        const storage = await openReceiveStorage();
        await storage.dispose();
        const names = [];
        for await (const key of directory.keys()) names.push(key);
        if (names.length !== 1 || names[0] !== name) throw new Error('Expected only the active temporary file');
      }, activeFile);
    });
    for (const action of ['sender cancels', 'receiver cancels', 'receiver tab closes']) {
      await scenario(`${action} mid-transfer`, async ({ sender, receiver, receiverContext }) => {
        const url = await invite(sender, randomBytes(4 * 1024 * 1024));
        await join(receiver, url);
        await receiver.getByRole('button', { name: 'Accept', exact: true }).click();
        await receiver.waitForFunction(() => Number(document.querySelector('progress').value) > 0);
        if (action === 'receiver tab closes') {
          await receiver.close();
          await status(sender, 'Transfer failed');
          const retry = await receiverContext.newPage();
          await unavailable(retry, url);
          await expectNoDownload(retry);
        } else {
          const page = action === 'sender cancels' ? sender : receiver;
          await page.getByRole('button', { name: 'Cancel transfer' }).click();
          await status(sender, 'Cancelled');
          await status(receiver, 'Cancelled');
          await expectNoDownload(receiver);
          await unavailable(receiver, url);
        }
        await sender.getByRole('button', { name: 'Create a fresh link' }).click();
        await status(sender, 'Waiting for receiver');
        assert.notEqual(await sender.getByLabel('Invite link').inputValue(), url);
      }, { slow: true });
    }
    await scenario('duplicate receiver cannot claim the slot', async ({ sender, receiver, receiverContext }) => {
      const url = await invite(sender, Buffer.from('sample'));
      await join(receiver, url);
      const duplicate = await receiverContext.newPage();
      await unavailable(duplicate, url);
      await status(receiver, 'Accept this file?');
      await sender.getByRole('button', { name: 'Cancel transfer' }).click();
      await status(receiver, 'Cancelled');
      await expectNoDownload(receiver);
    });
    await scenario('file above the previous size cap remains selectable and responsive', async ({ sender }) => {
      await sender.goto(origin);
      for (const width of [320, 768, 1440]) {
        await sender.setViewportSize({ width, height: 760 });
        assert.equal(await sender.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
      }
      await sender.goto(`${origin}/send`);
      await status(sender, 'Choose a file to send');
      for (const width of [1440, 768, 320]) {
        await sender.setViewportSize({ width, height: 760 });
        assert.equal(await sender.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
      }
      await sender.locator('#file-input').evaluate(input => {
        const payload = new Blob([new Uint8Array(1024 * 1024)]);
        const transfer = new DataTransfer();
        transfer.items.add(new File(Array(101).fill(payload), 'oversized.bin'));
        input.files = transfer.files;
        input.dispatchEvent(new Event('change'));
      });
      assert.equal(await sender.getByRole('button', { name: 'Create invite link' }).isEnabled(), true);
    });
    await scenario('unused link expires and sender can retry', async ({ sender, receiver }) => {
      const url = await invite(sender, Buffer.from('sample'));
      await status(sender, 'Expired');
      await receiver.goto(url);
      await receiver.getByText('This invite has expired.', { exact: false }).waitFor();
      await expectNoDownload(receiver);
      await sender.getByRole('button', { name: 'Create a fresh link' }).click();
      await status(sender, 'Waiting for receiver');
      assert.notEqual(await sender.getByLabel('Invite link').inputValue(), url);
    });
  }
} finally {
  await browser?.close();
  await app?.close();
}
