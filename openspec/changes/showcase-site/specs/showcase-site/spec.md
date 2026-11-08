# Spec Delta

## Purpose

Provide a public, non-published browser showcase for xatlas-wasm that lets
visitors inspect UV unwrapping, chart layout, atlas packing and the source that
produced each result.

## ADDED Requirements

### Requirement: Separate, non-published consumer

The showcase SHALL live under `site/` as a private Vite + TypeScript
application. It SHALL consume `xatlas-wasm` from the local checkout
(`file:..`) and SHALL NOT be included in the published npm tarball. It SHALL
NOT change the package loader, the separate `xatlas.wasm` artifact contract or
the `SINGLE_FILE` setting.

#### Scenario: Local package dependency

- **WHEN** the site dependencies are installed
- **THEN** `xatlas-wasm` resolves from the local package and no registry copy is fetched

#### Scenario: Tarball excludes the site

- **WHEN** the package tarball is inspected
- **THEN** it contains no `site/` files and no showcase-only dependency

### Requirement: Deployment from the tested artifact

The Pages workflow SHALL publish the showcase from the `xatlas-wasm-dist`
artifact produced by a successful main-branch Build WASM run. It SHALL NOT
rebuild the wasm or install `xatlas-wasm` from the npm registry.

#### Scenario: Successful main build deploys

- **WHEN** the Build WASM workflow completes successfully on `main`
- **THEN** Pages downloads that run's artifact, builds the site with `SITE_BASE=/xatlas-wasm/`, and deploys it

#### Scenario: Failed build does not deploy

- **WHEN** the Build WASM workflow fails or is not a main-branch push
- **THEN** no new showcase deployment is published

#### Scenario: Registry is not required

- **WHEN** the site is installed and built in CI
- **THEN** `xatlas-wasm` resolves from the downloaded local artifact and no registry fetch occurs

### Requirement: Gallery lists the scenario catalog

The gallery SHALL list the six scenarios `gazebo`, `cube`, `uv-sphere`,
`terrain`, `packing-lab` and `multi-atlas`. Each entry SHALL show a title, a
short description, feature labels and its input kind, and SHALL link to a
stable route.

#### Scenario: Gallery renders

- **WHEN** a visitor opens the site root
- **THEN** all six catalog scenarios appear with their metadata

#### Scenario: Deep link opens a scenario

- **WHEN** a visitor opens a scenario route directly
- **THEN** that scenario's page loads with its 3D view and metadata

#### Scenario: Unknown route shows not found

- **WHEN** a visitor opens a route that is not in the catalog
- **THEN** the site shows a not-found page instead of a blank view

### Requirement: Scenario page provides four views

Each scenario page SHALL provide 3D, UV, Atlas and Code views. The 3D view
SHALL be the default and SHALL support orbit, zoom and resizing. The UV view
SHALL render chart-colored triangles within the atlas bounds. The Atlas view
SHALL render the decoded texel map for the selected sub-atlas. The Code view
SHALL show the exact scenario module source read-only.

#### Scenario: Default view

- **WHEN** a scenario page loads
- **THEN** the 3D view is selected and the unwrapped model is displayed

#### Scenario: UV view

- **WHEN** the visitor selects the UV view
- **THEN** the chart-colored layout and atlas bounds are displayed

#### Scenario: Atlas view with an image

- **WHEN** the visitor selects the Atlas view and the run requested `createImage`
- **THEN** the decoded texel map for the selected sub-atlas is displayed

#### Scenario: Atlas view without an image

- **WHEN** the visitor selects the Atlas view and the run did not request an image
- **THEN** the view explains that no atlas image was produced

#### Scenario: Code view matches execution

- **WHEN** the visitor selects the Code view
- **THEN** the displayed source is the scenario module the worker executed

#### Scenario: Returning to 3D

- **WHEN** the visitor switches back from another view to 3D
- **THEN** the existing mesh is shown without a new unwrap run

#### Scenario: Orbit, zoom and resize

- **WHEN** the visitor drags, scrolls or resizes the viewport
- **THEN** the camera orbits, zooms or updates its aspect without distorting the model

### Requirement: 3D display modes

The 3D view SHALL support neutral shading, a checker texture driven by the
generated UVs, flat per-chart colors, the decoded atlas texture for the
selected sub-atlas, and a wireframe overlay. Changing the display mode SHALL
NOT re-run unwrapping.

#### Scenario: Checker mode

- **WHEN** the visitor enables checker mode
- **THEN** the model shows a repeating checker texture mapped through the generated UVs

#### Scenario: Chart-color mode

- **WHEN** the visitor enables chart-color mode
- **THEN** each chart has a distinct flat color and chart seams are visible

#### Scenario: Atlas-texture mode

- **WHEN** the visitor enables atlas-texture mode
- **THEN** the selected sub-atlas image is applied to its faces

#### Scenario: Wireframe overlay

- **WHEN** the visitor toggles the wireframe overlay
- **THEN** triangle edges appear and disappear without changing the geometry

#### Scenario: Mode changes do not re-run

- **WHEN** the visitor changes the display mode
- **THEN** the run statistics and mesh data remain those of the current unwrap

### Requirement: Unwrapping runs in a worker

Unwrapping SHALL run in a Web Worker. The worker SHALL initialize the module,
report progress, add the scenario mesh, generate the atlas, copy `getMesh()`
and `getImage()` results into transferable typed arrays, and destroy the atlas
before reporting completion.

#### Scenario: Page remains responsive

- **WHEN** a scenario is unwrapping
- **THEN** the page remains interactive and progress updates are visible

#### Scenario: Worker error is visible

- **WHEN** a scenario throws, `addMesh` returns a non-success code, or the worker fails
- **THEN** the page shows an error naming the failure instead of a blank viewport

#### Scenario: Atlas is destroyed after a run

- **WHEN** a run completes or fails
- **THEN** the worker has released the atlas and a subsequent run starts cleanly

#### Scenario: Progress is reported

- **WHEN** chart computation or packing reports progress
- **THEN** the page displays the current category and percentage

### Requirement: Run statistics and recipe

The page SHALL display the atlas resolution, sub-atlas count, chart count,
per-sub-atlas utilization, texels per unit, input vertex and face counts,
output vertex and index counts, run duration, and the chart and pack options
used. The values SHALL come from the run that produced the displayed mesh.

#### Scenario: Statistics match the run

- **WHEN** a run completes
- **THEN** the displayed counts, dimensions, utilization and duration match the returned run data

#### Scenario: Multi-atlas utilization

- **WHEN** the run produces more than one sub-atlas
- **THEN** each sub-atlas utilization is displayed

#### Scenario: Recipe is visible

- **WHEN** a scenario page is shown
- **THEN** the chart and pack options used by that scenario are listed

### Requirement: Downloads match the displayed run

The page SHALL offer an OBJ download for the displayed output mesh containing
positions, UVs and faces, and an atlas PNG download for the selected sub-atlas
when an atlas image exists. Downloaded content SHALL match the displayed run.

#### Scenario: OBJ download

- **WHEN** the visitor downloads the output mesh as OBJ
- **THEN** the file parses and its vertex and face counts match the displayed output mesh

#### Scenario: Atlas PNG download

- **WHEN** the visitor downloads the atlas image for a sub-atlas
- **THEN** the PNG dimensions match that sub-atlas

#### Scenario: No atlas image available

- **WHEN** the run did not produce an atlas image
- **THEN** the atlas PNG download is disabled or absent

### Requirement: Every catalog scenario is validated

The site test suite SHALL unwrap every catalog scenario against the built
artifact and SHALL fail when a scenario throws, `addMesh` fails, geometry is
empty or non-finite, a UV lies outside the atlas bounds, or `getImage()`
dimensions or data length disagree. The multi-atlas scenario SHALL assert more
than one sub-atlas.

#### Scenario: Valid catalog

- **WHEN** the validation suite runs
- **THEN** every scenario produces non-zero dimensions, vertices and indices with finite positions and UVs inside the atlas bounds

#### Scenario: Broken scenario fails CI

- **WHEN** a scenario throws, fails `addMesh` or unwraps to empty geometry
- **THEN** the suite fails and names the scenario

#### Scenario: Multi-atlas scenario is multi-atlas

- **WHEN** the multi-atlas scenario runs
- **THEN** `atlasCount` is greater than one and every sub-atlas is selectable

#### Scenario: Image mismatch fails CI

- **WHEN** `getImage()` dimensions or data length disagree with the atlas dimensions
- **THEN** the suite fails naming the scenario

### Requirement: Production build emits the wasm asset

A production build with `SITE_BASE=/xatlas-wasm/` SHALL emit a static site
whose JavaScript references a hashed `xatlas.wasm` asset. The post-build check
SHALL fail when the asset is missing or unreferenced. The deployed site SHALL
initialize `createXAtlas()` without custom loader options.

#### Scenario: Base-path build

- **WHEN** the site is built with `SITE_BASE=/xatlas-wasm/`
- **THEN** the generated entry and asset URLs use that base path

#### Scenario: Wasm asset is emitted and referenced

- **WHEN** the production build completes
- **THEN** a `.wasm` asset exists in the output and the JavaScript bundle references it

#### Scenario: Default loader is used

- **WHEN** the deployed site initializes the module
- **THEN** it fetches the hashed wasm asset without passing `locateFile` or `wasmBinary`

#### Scenario: Missing wasm asset fails the build check

- **WHEN** the wasm asset is missing or unreferenced in the output
- **THEN** the post-build check exits non-zero

### Requirement: CI validates the showcase on push and pull request

The Build WASM workflow SHALL include a site job that depends on the wasm
build, downloads the same run's `xatlas-wasm-dist` artifact, installs the site,
and runs typecheck, tests and a production build with the Pages base path. A
site failure SHALL fail the workflow.

#### Scenario: Pull request validation

- **WHEN** a pull request changes the site or the package
- **THEN** the site job runs and fails on a type, test or build error

#### Scenario: Artifact reuse

- **WHEN** the site job runs
- **THEN** it uses the artifact from the same workflow run and does not rebuild the wasm

#### Scenario: Main-branch gate

- **WHEN** the main-branch build succeeds
- **THEN** the site job passes before the Pages deployment starts
