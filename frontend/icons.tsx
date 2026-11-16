import * as React from 'react';
import { readFileSync } from 'node:fs';

const names = [
  'archive', 'arrow-right', 'arrow-up-right', 'cloud-upload', 'copy', 'cursor', 'download',
  'file', 'folder', 'image', 'laptop', 'moon', 'send', 'smartphone', 'sun', 'video',
] as const;
type IconName = typeof names[number];

function readIcon(name: IconName) {
  return readFileSync(new URL(`./icons/${name}.svg`, import.meta.url), 'utf8').trim();
}

const artwork = Object.fromEntries(names.map(name => [name, readIcon(name)])) as Record<IconName, string>;
let instance = 0;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  // Each copy needs its own gradient and filter IDs in the rendered document.
  const svg = artwork[name]
    .replaceAll(`peerdrop-${name}`, `peerdrop-icon-${++instance}`)
    .replace('width="96" height="96"', `width="${size}" height="${size}"`);
  return <span className="kubai-icon" data-icon={name} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
