# Spec Delta

## MODIFIED Requirements

### Requirement: Gallery lists the scenario catalog

The gallery SHALL list the six scenarios `gazebo`, `milk-truck`, `town-level`,
`uv-sphere`, `packing-lab` and `multi-atlas`. Each entry SHALL show a title, a
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

#### Scenario: Removed scenarios are not routable

- **WHEN** a visitor opens `#/p/cube` or `#/p/terrain`
- **THEN** the site shows the not-found page

### Requirement: Unwrapping runs in a worker

Unwrapping SHALL run in a Web Worker. The worker SHALL initialize the module,
report progress, add every scenario mesh, generate the atlas, copy every
`getMesh(i)` and `getImage()` result into transferable typed arrays, and destroy
the atlas before reporting completion.

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

#### Scenario: Every output mesh is copied

- **WHEN** a scenario adds more than one mesh
- **THEN** the worker copies each `getMesh(i)` result into the combined result arrays without dropping a mesh

### Requirement: Run statistics and recipe

The page SHALL display the atlas resolution, sub-atlas count, mesh count, chart
count, per-sub-atlas utilization, texels per unit, input vertex and face counts,
output vertex and index counts, run duration, and the chart and pack options
used. The values SHALL come from the run that produced the displayed mesh.

#### Scenario: Statistics match the run

- **WHEN** a run completes
- **THEN** the displayed counts, dimensions, utilization and duration match the returned run data

#### Scenario: Multi-atlas utilization

- **WHEN** the run produces more than one sub-atlas
- **THEN** each sub-atlas utilization is displayed

#### Scenario: Multi-mesh count

- **WHEN** the town-level scenario runs
- **THEN** the displayed mesh count is greater than one and matches the number of added meshes

#### Scenario: Recipe is visible

- **WHEN** a scenario page is shown
- **THEN** the chart and pack options used by that scenario are listed

### Requirement: Every catalog scenario is validated

The site test suite SHALL unwrap every catalog scenario against the built
artifact and SHALL fail when a scenario throws, `addMesh` fails, geometry is
empty or non-finite, a UV lies outside the atlas bounds, or `getImage()`
dimensions or data length disagree. The multi-atlas scenario SHALL assert more
than one sub-atlas. The town-level scenario SHALL assert more than one input
mesh and combined output counts.

#### Scenario: Valid catalog

- **WHEN** the validation suite runs
- **THEN** every scenario produces non-zero dimensions, vertices and indices with finite positions and UVs inside the atlas bounds

#### Scenario: Broken scenario fails CI

- **WHEN** a scenario throws, fails `addMesh` or unwraps to empty geometry
- **THEN** the suite fails and names the scenario

#### Scenario: Multi-atlas scenario is multi-atlas

- **WHEN** the multi-atlas scenario runs
- **THEN** `atlasCount` is greater than one and every sub-atlas is selectable

#### Scenario: Multi-mesh level is multi-mesh

- **WHEN** the town-level scenario runs
- **THEN** `meshCount` is greater than one and the combined output counts match the sum of every mesh's output

#### Scenario: Image mismatch fails CI

- **WHEN** `getImage()` dimensions or data length disagree with the atlas dimensions
- **THEN** the suite fails naming the scenario

## ADDED Requirements

### Requirement: Gallery uses no decorative preview artwork

The gallery SHALL NOT render decorative preview artwork, fabricated chart
sheets, model thumbnails or image placeholders. Gallery cards SHALL present
text metadata only.

#### Scenario: Gallery is text-only

- **WHEN** a visitor opens the site root
- **THEN** the gallery contains no preview image, chart-sheet illustration or thumbnail element

#### Scenario: Live views remain the preview

- **WHEN** a visitor opens a scenario
- **THEN** the live 3D, UV and Atlas views remain available

### Requirement: Realistic vehicle scenario

The `milk-truck` scenario SHALL unwrap the Cesium Milk Truck geometry embedded
from the Khronos glTF Sample Assets. The model SHALL load from a checked-in
asset module without a runtime network request, and the scenario SHALL identify
the input as an asset.

#### Scenario: Milk Truck unwraps

- **WHEN** the `milk-truck` scenario runs
- **THEN** it produces non-empty finite geometry with UVs inside the atlas bounds

#### Scenario: No runtime model fetch

- **WHEN** the site builds, tests or runs the scenario
- **THEN** it imports the embedded geometry and does not fetch the source GLB

#### Scenario: Attribution is present

- **WHEN** the asset notices are inspected
- **THEN** the Milk Truck source URL, pinned revision, CC BY 4.0 license and copyright are recorded

### Requirement: Multi-model town level scenario

The `town-level` scenario SHALL compose the MIT Gazebo, the Cesium Milk Truck
and generated town fabric into one level, and SHALL add at least two meshes to
the atlas. The combined result SHALL expose positions, UVs, chart IDs, atlas IDs
and indices for every mesh.

#### Scenario: Level unwraps as multiple meshes

- **WHEN** the `town-level` scenario runs
- **THEN** `meshCount` is greater than one and the combined geometry is non-empty and finite

#### Scenario: Every level mesh contributes output

- **WHEN** the level result is inspected
- **THEN** every added mesh has a non-empty `getMesh(i)` result and its indices are valid in the combined arrays

#### Scenario: Level metadata is complete

- **WHEN** the gallery renders
- **THEN** the town-level entry shows a title, description, feature labels and an asset input kind

### Requirement: Embedded assets are reproducible and attributed

The Cesium Milk Truck geometry SHALL be generated by a checked-in extraction
script from a pinned source revision and SHALL include source URL, commit,
license and copyright metadata. The generated asset module SHALL be committed so
the site build and Node tests do not fetch models.

#### Scenario: Provenance is complete

- **WHEN** the asset modules and `NOTICE.md` are inspected
- **THEN** each external model records its source URL, pinned commit, license and copyright

#### Scenario: Regeneration is reproducible

- **WHEN** the extraction script runs against the pinned source
- **THEN** it reproduces the committed vertex and triangle counts

#### Scenario: Build and tests use local assets

- **WHEN** the site is built or tested without network access
- **THEN** every scenario imports its geometry from a checked-in module
