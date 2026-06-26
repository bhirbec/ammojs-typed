# ammojs-typed (bhirbec fork)

A self-contained, ready-to-use package of [Ammo.js](https://github.com/kripken/ammo.js)
(Bullet Physics → WASM) with TypeScript types and a **single `Ammo` namespace** entry — used as
both a runtime value and a type, like `import * as THREE from 'three'`.

This fork (of [giniedp/ammojs-typed](https://github.com/giniedp/ammojs-typed)) ships the WASM
build plus a generated ESM entry, so consumers just install it and import — no vendoring, no
hand-written wrapper, no build step on the consumer side.

## Usage

```ts
import * as Ammo from 'ammojs-typed';

new Ammo.btVector3(1, 2, 3);   // value (constructor)
let v: Ammo.btVector3;         // type
```

The WASM runtime is bootstrapped once via top-level `await` inside the package, so it is ready
before any importer runs — no `.then()` and no "undefined until loaded" footgun. Because of the
top-level await, the consumer's bundler must target **es2022 or newer** (e.g. Vite
`build.target: 'es2022'`).

The WASM binary is located via `new URL('./ammo.wasm.wasm', import.meta.url)`, so a bundler like
Vite fingerprints it and resolves an absolute, route-independent URL automatically — no
`locateFile` override and no static-copy step in the consumer. With Vite, exclude this package
from dep pre-bundling so the asset URL resolves correctly:

```ts
// vite.config.ts
optimizeDeps: { exclude: ['ammojs-typed'] }
```

### Install (git dependency)

```jsonc
// package.json
"dependencies": {
  "ammojs-typed": "github:bhirbec/ammojs-typed#v1.1.0"
}
```

Pin a tag (not a moving branch) for reproducible installs.

## What's in `ammo/`

| File | Source | Role |
|------|--------|------|
| `index.js` | generated (`gen-entry.js`) | runtime ESM entry — bootstraps WASM, re-exports the namespace as values |
| `index.d.ts` | generated (`gen-entry.js`) | type entry — each name re-exported as a value **and** a type |
| `ammo.wasm.js` | upstream + `patch-wasm.js` | emscripten loader (patched to be a clean ESM default export) |
| `ammo.wasm.wasm` | upstream | the WASM binary |
| `ammo.d.ts` | generated (`webidl-dts-gen`) | the `Ammo` namespace declarations |
| `ammo.idl` | upstream | WebIDL source the `.d.ts` is generated from |
| `ambient/ammo.d.ts` | generated | ambient/global variant of the types |

### Engine glue baked in

`index.js` patches `setEntityId(id)` / `getEntityId()` onto `btCollisionShape` and
`btPairCachingGhostObject` prototypes. This lets a host engine map a collision/raycast hit back to
its own entity. (Bullet's native `setUserPointer` was tried and proved unreliable, so a dedicated
prototype slot is used instead.) This is the one host-specific concession that keeps the package
self-contained for its consumer.

## Updating / refreshing the build

The committed `ammo/` artifacts are the known-good build. To refresh from upstream:

```bash
yarn install        # webidl-dts-gen (dev dependency)
yarn build          # download + patch:wasm + generate (d.ts + entry)
```

`yarn build` runs:
1. `download` — fetch `ammo.idl`, `ammo.wasm.js`, `ammo.wasm.wasm` from kripken/ammo.js (`curl -fL`,
   so HTTP errors fail loudly).
2. `patch:wasm` — strip the `this.Ammo = …` global-attach line (throws ESM strict-mode) and append
   `export default Ammo;`. Asserts exactly one match so an upstream footer change fails loudly.
3. `generate` — regenerate `ammo.d.ts` + `ambient/ammo.d.ts` (`webidl-dts-gen`) and the
   `index.js` / `index.d.ts` entry (`gen-entry.js`).

After refreshing, **review the diff and re-test in the consumer** — a newer upstream may change the
WASM binary or the generated type surface (e.g. enum representation). Then commit, push, and tag a
new version; consumers bump their `#<tag>` ref.

> Note: a fresh `yarn generate` may not reproduce the committed `.d.ts` byte-for-byte if the
> installed `webidl-dts-gen` differs from the version that produced it. The committed artifacts are
> the source of truth for consumers.

## Manual IDL adjustments

If regenerating from a fresh upstream `ammo.idl`, these historical tweaks may be needed (see the
upstream project): add `void setValue(float x, float y, float z);` to `btVector4`, and make
`btDbvtBroadphase` derive from `btBroadphaseInterface`.

## References

- https://github.com/kripken/ammo.js
- https://github.com/giniedp/ammojs-typed (upstream)
