/**
 * Minimal functional test for xatlas-wasm.
 * Creates a simple quad mesh (4 vertices, 2 triangles), generates an atlas,
 * and verifies the output.
 *
 * Run: node test/test.mjs
 */
import createXAtlas from '../dist/index.mjs';

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

  function check(label, condition, detail) {
    if (condition) {
      console.log(`  PASS: ${label}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ''}`);
      ok = false;
    }
  }

  // getImage() must be null when createImage was not requested (default false)
  console.log('\nImage checks (default options):');
  const defaultImage = atlas.getImage();
  check('getImage() is null when createImage is false', defaultImage === null,
    `got ${defaultImage === null ? 'null' : typeof defaultImage}`);

  // Second atlas: same mesh, generate with createImage: true
  console.log('\nImage checks (createImage: true):');
  const atlas2 = xatlas.createAtlas();
  const error2 = atlas2.addMesh({ positions, indices });
  if (error2 !== xatlas.AddMeshError.Success) {
    console.error('addMesh (atlas2) failed:', xatlas.addMeshErrorString(error2));
    process.exit(1);
  }
  atlas2.generate({}, { createImage: true });

  const image = atlas2.getImage();
  check('getImage() is non-null', image !== null);
  if (image) {
    check('data is a Uint32Array', image.data instanceof Uint32Array);
    check('data.length === atlasCount * width * height',
      image.data.length === image.atlasCount * image.width * image.height,
      `${image.data.length} === ${image.atlasCount} * ${image.width} * ${image.height}`);
    check('width matches atlas.width', image.width === atlas2.width,
      `${image.width} === ${atlas2.width}`);
    check('height matches atlas.height', image.height === atlas2.height,
      `${image.height} === ${atlas2.height}`);

    // Scan the image for covered texels
    let coveredCount = 0;
    let sampleIndex = -1;
    let sampleValue = 0;
    let maxChartIndex = -1;
    for (let i = 0; i < image.data.length; i++) {
      const pixel = image.data[i];
      if ((pixel & xatlas.ImageHasChartIndexBit) !== 0) {
        coveredCount++;
        const chartIndex = pixel & xatlas.ImageChartIndexMask;
        if (chartIndex > maxChartIndex) maxChartIndex = chartIndex;
        if (sampleIndex === -1) {
          sampleIndex = i;
          sampleValue = pixel;
        }
      }
    }

    check('at least one pixel has ImageHasChartIndexBit', coveredCount > 0,
      `${coveredCount} covered texel(s)`);
    check('every covered chartIndex < atlas.chartCount',
      coveredCount > 0 && maxChartIndex < atlas2.chartCount,
      `max chartIndex ${maxChartIndex} < chartCount ${atlas2.chartCount}`);

    const decoded = xatlas.decodeImagePixel(sampleValue);
    check('decodeImagePixel chartIndex matches mask',
      decoded.chartIndex === (sampleValue & xatlas.ImageChartIndexMask),
      `chartIndex ${decoded.chartIndex}`);
    check('decodeImagePixel hasChartIndex is true on covered pixel',
      decoded.hasChartIndex === true);
    check('decodeImagePixel flags match raw bits',
      decoded.isBilinear === ((sampleValue & xatlas.ImageIsBilinearBit) !== 0) &&
      decoded.isPadding === ((sampleValue & xatlas.ImageIsPaddingBit) !== 0));
    check('decodeImagePixel constant values are exposed',
      xatlas.ImageChartIndexMask === 0x1FFFFFFF &&
      xatlas.ImageHasChartIndexBit === 0x80000000 &&
      xatlas.ImageIsBilinearBit === 0x40000000 &&
      xatlas.ImageIsPaddingBit === 0x20000000);

    // Copy must survive atlas destruction
    const expectedLength = image.data.length;
    atlas2.destroy();
    check('data.length unchanged after destroy()', image.data.length === expectedLength,
      `${image.data.length} === ${expectedLength}`);
    check('sampled pixel unchanged after destroy()',
      sampleIndex >= 0 && image.data[sampleIndex] === sampleValue,
      `index ${sampleIndex}: ${image.data[sampleIndex]} === ${sampleValue}`);
  } else {
    console.error('  SKIP: image content checks (getImage() returned null)');
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
