# Asset provenance

## gazebo.obj

- **Source:** `thirdparty/xatlas/models/gazebo.obj`
- **Upstream:** <https://github.com/jpcy/xatlas>
- **Pinned commit:** `f700c7790aaa030e794b52ba7791a05c085faf0c`
- **License:** MIT
- **Copyright:** Copyright (c) 2018-2020 Jonathan Young

The model is embedded as a TypeScript string in `gazebo.ts` so the showcase
build and the Node validation suite do not depend on the submodule checkout.
The upstream MIT license is reproduced in `thirdparty/xatlas/LICENSE`.

## CesiumMilkTruck.glb

- **Source:** <https://github.com/KhronosGroup/glTF-Sample-Assets/tree/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/CesiumMilkTruck>
- **Model URL:** <https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/8f492390ddc7a2ae221a1369ef560589cf8c70fb/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb>
- **Pinned commit:** `8f492390ddc7a2ae221a1369ef560589cf8c70fb`
- **License:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode) (CC BY 4.0)
- **Copyright:** Copyright (c) 2017 Cesium
- **Source SHA-256:** `09371b34608116de5842d23abe260bf11acf3e1554daf334a647eb566eee5c49`

Only the indexed triangle geometry (positions and indices) is embedded, in
`milk-truck.ts`. Textures, materials, the animation and the Cesium logo texture
are not used. The committed module is generated from a local copy of the GLB;
the site build and Node tests never fetch the model:

```sh
node site/scripts/embed-glb.mjs /path/to/CesiumMilkTruck.glb \
  site/src/demos/assets/milk-truck.ts
```

The extraction script applies the glTF scene-node world transforms and
concatenates every triangle primitive. The wheel mesh is referenced by two
nodes, so the generated scene contains both wheel instances.
