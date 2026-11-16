import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export async function startLocalTurn() {
  const secret = randomBytes(32).toString('hex');
  const executable = fileURLToPath(new URL('../build/peerdrop-turn.exe', import.meta.url));
  const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const output = createInterface({ input: child.stdout });
  const stop = () => child.stdin.end();
  child.stdin.on('error', () => {});
  child.on('error', () => {});
  try {
    const ready = Promise.race([
      new Promise<string>((resolve, reject) => {
        output.once('line', resolve);
        output.once('close', () => reject(new Error('Local relay closed')));
      }),
      new Promise<never>((_resolve, reject) => {
        AbortSignal.timeout(5000).addEventListener('abort', () => reject(new Error('Local relay timed out')));
      }),
    ]);
    child.stdin.write(`${secret}\n`);
    const line = await ready;
    const port = Number(line);
    if (!/^\d+$/.test(line) || port < 1 || port > 65535) throw new Error('Invalid relay port');
    return { secret, url: `turn:127.0.0.1:${port}?transport=tcp`, stop, child };
  } catch {
    child.kill();
    throw new Error('Local TURN could not start. Run npm run build:local-turn.');
  } finally {
    output.close();
  }
}
