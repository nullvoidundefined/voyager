import { accessSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

const required = [
  'index.js',
  'nodes.js',
  'messages.js',
  'events.js',
  'preferences.js',
];
for (const f of required) {
  try {
    accessSync(resolve(dist, f));
  } catch {
    console.error(`verify-build: missing dist/${f}`);
    process.exit(1);
  }
}

const mod = await import(resolve(dist, 'index.js'));
if (
  !Array.isArray(mod.ACCOMMODATION_OPTIONS) ||
  mod.ACCOMMODATION_OPTIONS.length === 0
) {
  console.error(
    'verify-build: ACCOMMODATION_OPTIONS missing or empty at runtime',
  );
  process.exit(1);
}

console.info('verify-build: OK');
