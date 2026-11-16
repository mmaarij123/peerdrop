export const MEMORY_BYTES = 32 * 1024 ** 2;
export const RECEIVE_WINDOW = 1024 ** 2;

const transferName = /^locked-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const lockName = name => `peerdrop-transfer:${name}`;

async function removeAbandonedFiles(directory, locks) {
  for await (const [name, entry] of directory.entries()) {
    if (entry.kind !== 'file' || !transferName.test(name)) continue;
    await locks.request(lockName(name), { ifAvailable: true }, lock => {
      if (lock) return directory.removeEntry(name).catch(() => {});
    });
  }
}

export async function openReceiveStorage() {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle('peerdrop-transfers', { create: true });
  // Use a separate name prefix so cleanup never touches files from clients without locks.
  const locks = navigator.locks;
  const name = `${locks ? 'locked-' : ''}${crypto.randomUUID()}`;
  let release;
  if (locks) {
    const held = new Promise(resolve => { release = resolve; });
    await new Promise((resolve, reject) => {
      void locks.request(lockName(name), () => { resolve(); return held; }).catch(reject);
    });
  }
  const remove = () => directory.removeEntry(name).catch(() => {});
  try {
    if (locks) await removeAbandonedFiles(directory, locks).catch(() => {});
    const handle = await directory.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    let closing;
    let disposing;
    return {
      write: data => writer.write(data),
      async finish() {
        closing = writer.close();
        await closing;
        return handle.getFile();
      },
      dispose() {
        disposing ??= (async () => {
          try {
            await (closing ?? writer.abort()).catch(() => {});
            await remove();
          } finally { release?.(); }
        })();
        return disposing;
      },
    };
  } catch (error) {
    await remove();
    release?.();
    throw error;
  }
}
