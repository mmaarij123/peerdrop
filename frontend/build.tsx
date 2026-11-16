import * as React from 'react';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home } from './home.js';
import { Guide } from './how-it-works.js';
import { Privacy } from './privacy.js';
import { Terms } from './terms.js';
import { Transfer } from './transfer.js';

const dist = new URL('../dist/', import.meta.url);
await mkdir(dist, { recursive: true });
const pages = [
  ['index', <Home />], ['transfer', <Transfer />], ['how-it-works', <Guide />],
  ['privacy', <Privacy />], ['terms', <Terms />],
] as const;
await Promise.all([
  copyFile(new URL('./icons/send.svg', import.meta.url), new URL('mark.svg', dist)),
  ...pages.map(([name, page]) => writeFile(new URL(`${name}.html`, dist), `<!doctype html>\n${renderToStaticMarkup(page)}\n`)),
]);
