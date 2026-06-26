// Patches the downloaded emscripten loader (ammo/ammo.wasm.js) so it works as an ESM module:
//
//   1. Remove the `this.Ammo = <token>;` global-attach line. Under ESM strict mode `this` is
//      undefined at module top level, so this line throws. The RHS token is minified and
//      build-dependent, so we match it loosely and ASSERT exactly one occurrence — if upstream
//      changes its footer, this fails loudly instead of silently mis-patching.
//   2. Append `export default Ammo;` so `import wasm from './ammo.wasm.js'` yields the bootstrap
//      function (which returns `Ammo.ready`, a promise resolving to the loaded instance).
//
// Idempotent: re-running after a fresh `download` is safe (step 2 is skipped if already present;
// step 1 allows zero matches once removed, but warns so a no-op re-patch is visible).
//
//   node scripts/patch-wasm.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '../ammo/ammo.wasm.js');
let src = readFileSync(file, 'utf8');

// --- Edit 1: strip the global-attach line ---
const attach = /this\.Ammo\s*=\s*[A-Za-z0-9_$]+\s*;/g;
const matches = src.match(attach) || [];
const alreadyExported = /\nexport default Ammo;\s*$/.test(src);

if (matches.length === 1) {
  src = src.replace(attach, '');
} else if (matches.length === 0 && alreadyExported) {
  console.warn('patch-wasm: no `this.Ammo=...` found and already exported — assuming already patched.');
} else if (matches.length === 0) {
  throw new Error(
    'patch-wasm: expected exactly one `this.Ammo=<token>;` but found none. ' +
      'Upstream ammo.wasm.js footer changed — review this script.',
  );
} else {
  throw new Error(
    `patch-wasm: expected exactly one \`this.Ammo=<token>;\` but found ${matches.length}. ` +
      'Upstream ammo.wasm.js footer changed — review this script.',
  );
}

// --- Edit 2: append the ESM default export (idempotent) ---
if (!/\nexport default Ammo;\s*$/.test(src)) {
  src = src.replace(/\s*$/, '') + '\n\nexport default Ammo;\n';
}

writeFileSync(file, src);
console.log(
  `patch-wasm: ammo/ammo.wasm.js patched (removed ${matches.length} global-attach line, ensured ESM default export).`,
);
