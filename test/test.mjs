/**
 * Minimal functional test for xatlas-wasm.
 * Creates a simple quad mesh (4 vertices, 2 triangles), generates an atlas,
 * and verifies the output.
 *
 * Run: node test/test.mjs
 */
import createXAtlas from '../lib/xatlas.mjs';

async function main() {
  console.log('Initializing xatlas-wasm...');
  const xatlas = await createXAtlas();
  console.log('  OK');

  const atlas = xatlas.createAtlas();

  // Simple quad: two triangles
  // Positions (4 vertices, flat xyz)
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0,
  ]);

  // Indices (2 triangles)
  const indices = new Uint32Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  console.log('Adding mesh...');
  const error = atlas.addMesh({ positions, indices });
  if (error !== xatlas.AddMeshError.Success) {
    console.error('addMesh failed:', xatlas.addMeshErrorString(error));
    process.exit(1);
  }
  console.log('  OK');

  // Set progress callback
  atlas.setProgressCallback((category, progress) => {
    const name = xatlas.progressCategoryString(category);
    process.stdout.write(`\r  ${name} ${progress}%`);
    if (progress === 100) process.stdout.write('\n');
    return true;
  });

  console.log('Generating atlas...');
  atlas.generate();

  console.log(`  Width:          ${atlas.width}`);
  console.log(`  Height:         ${atlas.height}`);
  console.log(`  Atlas count:    ${atlas.atlasCount}`);
  console.log(`  Chart count:    ${atlas.chartCount}`);
  console.log(`  Mesh count:     ${atlas.meshCount}`);
  console.log(`  Texels/unit:    ${atlas.texelsPerUnit}`);

  for (let i = 0; i < atlas.atlasCount; i++) {
    console.log(`  Utilization[${i}]: ${(atlas.getUtilization(i) * 100).toFixed(1)}%`);
  }

  // Retrieve output mesh
  const mesh = atlas.getMesh(0);
  console.log(`\nOutput mesh 0:`);
  console.log(`  Vertices: ${mesh.vertexCount}`);
  console.log(`  Indices:  ${mesh.indexCount}`);
  console.log(`  Charts:   ${mesh.chartCount}`);

  // Print first few vertices
  const show = Math.min(mesh.vertexCount, 6);
  for (let i = 0; i < show; i++) {
    const v = mesh.vertices[i];
    console.log(`  v[${i}]: atlas=${v.atlasIndex} chart=${v.chartIndex} uv=[${v.uv[0].toFixed(2)}, ${v.uv[1].toFixed(2)}] xref=${v.xref}`);
  }

  // Validate
  let ok = true;
  if (atlas.width === 0 || atlas.height === 0) {
    console.error('FAIL: atlas dimensions are zero');
    ok = false;
  }
  if (mesh.vertexCount === 0) {
    console.error('FAIL: no output vertices');
    ok = false;
  }
  if (mesh.indexCount === 0) {
    console.error('FAIL: no output indices');
    ok = false;
  }

  atlas.destroy();

  if (ok) {
    console.log('\nAll checks passed.');
  } else {
    console.error('\nSome checks failed.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
