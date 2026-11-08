# AGENTS.md — xatlas-wasm

WebAssembly build of [xatlas](https://github.com/jpcy/xatlas), published as the
npm module `xatlas-wasm`. This file is the repository-specific workflow
contract; the workspace-global `AGENTS.md` still applies.

## Non-negotiable workflow

- All functional work happens as OpenSpec changes under
  `openspec/changes/<name>/` (`proposal.md`, `specs/`, `design.md`,
  `tasks.md`). Do not implement features, build changes or packaging changes
  ad hoc.
- Workflow: explore → propose → apply → archive. OpenCode commands live in
  `.opencode/commands/` (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`, …);
  shared skills live in `.agents/skills/` and `.opencode/skills/`.
- The first planned change is `baseline-specs`: capture the current behaviour
  in `openspec/specs/` before refactoring. It makes no production-code
  changes.
- The improvement backlog and measured audit evidence live in
  [`docs/improvements.md`](docs/improvements.md). Every proposal should cite
  the `XW-###` items it implements.
- Validate before committing any change:
  `openspec validate --all --strict`
- Work directly on `main` with concise imperative commit subjects. Do not
  create feature branches or PRs per change unless the user asks.
- **Never branch or use worktrees for this repository's work — always stay on
  `main` in `~/workspace/xatlas-wasm`.** If a session starts in a linked
  worktree or another checkout, move to the `main` checkout (or consolidate
  into it) before changing anything, and commit each change to `main` there.
- Once the push/PR build-and-test workflow lands, keep it green; it is the
  quality gate. The publish workflow is tag-gated and must verify the tag
  against `package.json`.

## Project constraints

- **Public contract:** `lib/xatlas.d.ts` and `API.md` must match runtime
  behaviour. No documented option may be unimplemented.
- **Package:** ESM-only, runtime-dependency-free, Node >= 16 (target >= 18) and
  modern browsers. Keep the public surface small.
- **Threading:** the kernel is compiled single-threaded
  (`XA_MULTITHREADED=0`). Worker support means running the whole module in a
  worker, not pthreads.
- **Upstream:** `thirdparty/xatlas` is a pinned git submodule. Do not edit it
  in-tree; wrapper/accessor changes belong in `src/xatlas_wasm.c` and `lib/`.
- **Build:** CMake + Emscripten. Build outputs go to `dist/` (gitignored);
  `build/` is gitignored. Target Emscripten **3.1.64** in CI and local builds.
- **Current baseline:** `xatlas-wasm@0.1.3` uses `SINGLE_FILE=1` (base64 wasm
  inside the JS bundle). Changing that is XW-001/XW-002 and must be proposed as
  an OpenSpec change, not done ad hoc.
- **Lifetime:** all wasm-backed objects must be explicitly released; any new
  API should follow the lifetime/ownership rules established by the
  `object-lifecycle` change.
- **Tests:** every behaviour change needs a test that fails without it. Loader
  and packaging changes must run the packed-package consumer test, not only
  `node test/test.mjs`.

## Commands

```sh
# Emscripten 3.1.64 must be active (source the emsdk env first).
npm ci
npm run configure
npm run build
npm test

# OpenSpec (or use: npx @fission-ai/openspec@latest ...)
openspec validate --all --strict
openspec list
```

## Documents to keep in sync

| Document | Rule |
|---|---|
| `README.md` | User-facing status, install/usage and current limitations; update when behaviour or package layout changes. |
| `API.md` | Public API contract; every documented option/return value must match the runtime and `lib/xatlas.d.ts`. |
| `BUILD.md` | Build, test, clean and OpenSpec commands; update when scripts or toolchain requirements change. |
| `docs/improvements.md` | Backlog and evidence; mark `XW-###` items implemented or record remaining work. |
| `openspec/` | Source of truth for specs and active changes; validate before every commit. |

## Repository map

| Path | Contents |
|---|---|
| `src/xatlas_wasm.c` | Thin C accessor layer exposed to JS |
| `lib/xatlas.mjs` | High-level JS wrapper |
| `lib/xatlas.d.ts` | Public TypeScript declarations |
| `thirdparty/xatlas` | Pinned upstream xatlas submodule |
| `test/test.mjs` | Current Node smoke test |
| `example/` | Browser example |
| `docs/improvements.md` | Audit, improvement backlog and proposed change sequence |
| `openspec/` | OpenSpec config, specs and changes (source of truth) |
