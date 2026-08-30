import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.astro-public');

const directories = [
  'assets',
  'data',
  'apps',
  'guestbook',
  'tools/travel',
  'tools/lunch',
  'tools/leave',
  'tools/qr',
  'tools/fingerprint',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const directory of directories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
    force: true,
  });
}

console.log(`Prepared ${directories.length} legacy paths for Astro.`);
