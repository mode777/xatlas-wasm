# Plan: Fix browser compatibility of xatlas.mjs

**TL;DR:** Remove unconditional Node.js imports and use dynamic imports + environment detection so the module loads cleanly in both Node.js and browsers.

**Steps**

### Phase 1: Remove top-level Node.js imports
1. Remove the static `import { createRequire } from 'module'`, `import { fileURLToPath } from 'url'`, and `import { dirname, join } from 'path'` statements and the derived `__filename`/`__dirname` constants (lines 16-20)
2. Move these imports inside the Node.js branch of `createXAtlas()` using dynamic `import()` or inline logic

### Phase 2: Refactor `createXAtlas()` loader
3. In the Node.js branch (`typeof globalThis.process !== 'undefined'`), dynamically import `module`, `url`, and `path`, then use `createRequire` to load the `.cjs` glue — *depends on step 1*
4. In the browser branch, keep the dynamic `import('../dist/xatlas.cjs')` as-is (or switch to a relative URL with `locateFile`)
5. Consider strengthening the environment check (e.g. `typeof globalThis.process?.versions?.node !== 'undefined'`) to avoid false positives from bundlers that shim `process`

**Relevant files**
- [lib/xatlas.mjs](lib/xatlas.mjs) — lines 16-20 (remove static Node imports), lines 508-540 (refactor `createXAtlas()`)
- [CMakeLists.txt](CMakeLists.txt) — no changes needed, already targets `web,node`
- [test/test.mjs](test/test.mjs) — verify still works after changes

**Verification**
1. Run `node test/test.mjs` to confirm Node.js still works
2. Create a minimal HTML page that does `<script type="module">import createXAtlas from './lib/xatlas.mjs';</script>` and verify it loads without import errors in a browser (or use a bundler test)
3. Verify no remaining references to `module`, `url`, or `path` at the top level via grep

**Decisions**
- The `.cjs` Emscripten glue file already handles both environments — no build changes needed
- Scope: only [lib/xatlas.mjs](lib/xatlas.mjs); the `.d.ts` file has no runtime code and needs no changes
- Excluded: no changes to the C/WASM layer or build system

**Further Considerations**
1. **Bundler compatibility**: Some bundlers (Webpack, Vite) may try to resolve the dynamic `import()` of the `.cjs` file. You may want to add a `locateFile` default that works with common bundlers, or provide separate entry points (`"browser"` field in package.json). *Recommendation: add a `"browser"` export map entry in package.json for bundler-friendly resolution.*
2. **WASM file location in browsers**: In a browser, the `.wasm` file needs to be served at a known URL. The current `locateFile` option handles this, but documenting the default behavior (sibling to `.cjs`) would help users. *Recommendation: document in README.*
