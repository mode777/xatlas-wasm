/**
 * xatlas-wasm browser example.
 *
 * Loads an OBJ model, generates a UV atlas via xatlas-wasm, and renders:
 *   - Left canvas:  3D wireframe (orthographic, mouse-drag rotation)
 *   - Right canvas: 2D UV chart overlay (colored per chart)
 */
import { parseOBJ } from './obj-loader.mjs';
import createXAtlas from '../lib/xatlas.mjs';

/* ── DOM refs ────────────────────────────────────────────────────── */

const canvas3D = document.getElementById('canvas3d');
const canvasUV = document.getElementById('canvasUv');
const ctx3D = canvas3D.getContext('2d');
const ctxUV = canvasUV.getContext('2d');

const fileInput = document.getElementById('fileInput');
const loadDefaultBtn = document.getElementById('loadDefault');
const statsEl = document.getElementById('stats');
const progressEl = document.getElementById('progress');

/* ── State ───────────────────────────────────────────────────────── */

let inputMesh = null;   // { positions, normals, uvs, indices }
let outputMesh = null;  // from atlas.getMesh(0)
let atlasInfo = null;   // { width, height, chartCount, atlasCount, utilization, meshCount }

// 3D rotation (Euler angles in radians)
let rotX = -0.4;
let rotY = 0.6;
let dragging = false;
let lastMouse = { x: 0, y: 0 };

/* ── xatlas singleton ────────────────────────────────────────────── */

let xatlas = null;

async function ensureXAtlas() {
  if (!xatlas) {
    xatlas = await createXAtlas();
  }
  return xatlas;
}

/* ── OBJ loading ─────────────────────────────────────────────────── */

async function loadOBJFromURL(url) {
  setStatus('Fetching model…');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.text();
}

function loadOBJFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ── Atlas generation ────────────────────────────────────────────── */

async function processModel(objText) {
  try {
    setStatus('Parsing OBJ…');
    inputMesh = parseOBJ(objText);

    const vertexCount = inputMesh.positions.length / 3;
    const faceCount = inputMesh.indices.length / 3;
    setStatus(`Parsed: ${vertexCount} vertices, ${faceCount} faces`);

    const xa = await ensureXAtlas();
    const atlas = xa.createAtlas();

    atlas.setProgressCallback((category, progress) => {
      const name = xa.progressCategoryString(category);
      progressEl.textContent = `${name} ${progress}%`;
      return true; // continue
    });

    setStatus('Adding mesh…');
    const opts = { positions: inputMesh.positions, indices: inputMesh.indices };
    if (inputMesh.normals) opts.normals = inputMesh.normals;
    if (inputMesh.uvs) opts.uvs = inputMesh.uvs;

    const err = atlas.addMesh(opts);
    if (err !== xa.AddMeshError.Success) {
      throw new Error('addMesh failed: ' + xa.addMeshErrorString(err));
    }

    setStatus('Generating atlas…');
    atlas.generate();

    // Gather results
    const utilization = [];
    for (let i = 0; i < atlas.atlasCount; i++) {
      utilization.push(atlas.getUtilization(i));
    }

    atlasInfo = {
      width: atlas.width,
      height: atlas.height,
      chartCount: atlas.chartCount,
      atlasCount: atlas.atlasCount,
      meshCount: atlas.meshCount,
      texelsPerUnit: atlas.texelsPerUnit,
      utilization,
    };

    outputMesh = atlas.getMesh(0);
    atlas.destroy();

    renderStats();
    render3D();
    renderUV();
    setStatus('Done');
    progressEl.textContent = '';
  } catch (e) {
    setStatus('Error: ' + e.message);
    console.error(e);
  }
}

/* ── Stats ───────────────────────────────────────────────────────── */

function renderStats() {
  if (!atlasInfo || !inputMesh || !outputMesh) return;

  const inVerts = inputMesh.positions.length / 3;
  const inFaces = inputMesh.indices.length / 3;
  const util = atlasInfo.utilization.map((u, i) => `  Atlas ${i}: ${(u * 100).toFixed(1)}%`).join('\n');

  statsEl.textContent = [
    `Resolution:      ${atlasInfo.width} × ${atlasInfo.height}`,
    `Charts:          ${atlasInfo.chartCount}`,
    `Atlases:         ${atlasInfo.atlasCount}`,
    `Utilization:`,
    util,
    `Input vertices:  ${inVerts}`,
    `Input faces:     ${inFaces}`,
    `Output vertices: ${outputMesh.vertexCount}`,
    `Output indices:  ${outputMesh.indexCount}`,
  ].join('\n');
}

function setStatus(msg) {
  progressEl.textContent = msg;
}

/* ── 3D wireframe rendering ──────────────────────────────────────── */

function render3D() {
  if (!inputMesh) return;

  const W = canvas3D.width;
  const H = canvas3D.height;
  ctx3D.clearRect(0, 0, W, H);

  const pos = inputMesh.positions;
  const idx = inputMesh.indices;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const scale = (Math.min(W, H) * 0.85) / extent;

  // Rotation matrices
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

  function project(i) {
    let x = pos[i * 3] - cx;
    let y = pos[i * 3 + 1] - cy;
    let z = pos[i * 3 + 2] - cz;
    // Rotate Y
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    // Rotate X
    const y1 = y * cosX - z1 * sinX;
    return [W / 2 + x1 * scale, H / 2 - y1 * scale];
  }

  ctx3D.strokeStyle = '#4a9eff';
  ctx3D.lineWidth = 0.5;
  ctx3D.beginPath();

  for (let i = 0; i < idx.length; i += 3) {
    const [ax, ay] = project(idx[i]);
    const [bx, by] = project(idx[i + 1]);
    const [cx2, cy2] = project(idx[i + 2]);
    ctx3D.moveTo(ax, ay); ctx3D.lineTo(bx, by);
    ctx3D.moveTo(bx, by); ctx3D.lineTo(cx2, cy2);
    ctx3D.moveTo(cx2, cy2); ctx3D.lineTo(ax, ay);
  }
  ctx3D.stroke();
}

/* ── 2D UV chart rendering ───────────────────────────────────────── */

// Generate distinct colors for charts
function chartColor(chartIndex, total) {
  const hue = (chartIndex * 137.508) % 360;  // golden angle spread
  return `hsl(${hue}, 70%, 55%)`;
}

function renderUV() {
  if (!outputMesh || !atlasInfo) return;

  const W = canvasUV.width;
  const H = canvasUV.height;
  ctxUV.clearRect(0, 0, W, H);

  // Draw atlas border
  ctxUV.strokeStyle = '#555';
  ctxUV.lineWidth = 1;
  ctxUV.strokeRect(0.5, 0.5, W - 1, H - 1);

  const aw = atlasInfo.width || 1;
  const ah = atlasInfo.height || 1;
  const scaleX = W / aw;
  const scaleY = H / ah;

  const verts = outputMesh.vertices;
  const indices = outputMesh.indices;

  // Draw filled triangles per chart
  ctxUV.globalAlpha = 0.5;
  for (let i = 0; i < indices.length; i += 3) {
    const v0 = verts[indices[i]];
    const v1 = verts[indices[i + 1]];
    const v2 = verts[indices[i + 2]];

    const chartIdx = v0.chartIndex;
    ctxUV.fillStyle = chartColor(chartIdx, atlasInfo.chartCount);

    ctxUV.beginPath();
    ctxUV.moveTo(v0.uv[0] * scaleX, H - v0.uv[1] * scaleY);
    ctxUV.lineTo(v1.uv[0] * scaleX, H - v1.uv[1] * scaleY);
    ctxUV.lineTo(v2.uv[0] * scaleX, H - v2.uv[1] * scaleY);
    ctxUV.closePath();
    ctxUV.fill();
  }

  // Draw wireframe on top
  ctxUV.globalAlpha = 1.0;
  ctxUV.strokeStyle = '#222';
  ctxUV.lineWidth = 0.5;
  ctxUV.beginPath();
  for (let i = 0; i < indices.length; i += 3) {
    const v0 = verts[indices[i]];
    const v1 = verts[indices[i + 1]];
    const v2 = verts[indices[i + 2]];

    const x0 = v0.uv[0] * scaleX, y0 = H - v0.uv[1] * scaleY;
    const x1 = v1.uv[0] * scaleX, y1 = H - v1.uv[1] * scaleY;
    const x2 = v2.uv[0] * scaleX, y2 = H - v2.uv[1] * scaleY;

    ctxUV.moveTo(x0, y0); ctxUV.lineTo(x1, y1);
    ctxUV.moveTo(x1, y1); ctxUV.lineTo(x2, y2);
    ctxUV.moveTo(x2, y2); ctxUV.lineTo(x0, y0);
  }
  ctxUV.stroke();
}

/* ── Mouse rotation for 3D canvas ────────────────────────────────── */

canvas3D.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastMouse = { x: e.clientX, y: e.clientY };
  canvas3D.setPointerCapture(e.pointerId);
});

canvas3D.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  rotY += dx * 0.01;
  rotX += dy * 0.01;
  lastMouse = { x: e.clientX, y: e.clientY };
  render3D();
});

canvas3D.addEventListener('pointerup', () => { dragging = false; });

/* ── Event wiring ────────────────────────────────────────────────── */

loadDefaultBtn.addEventListener('click', async () => {
  const text = await loadOBJFromURL('../thirdparty/xatlas/models/gazebo.obj');
  await processModel(text);
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    const text = await loadOBJFromFile(file);
    await processModel(text);
  } catch (e) {
    setStatus('Error reading file: ' + e.message);
  }
});

/* ── Kick off ────────────────────────────────────────────────────── */

setStatus('Ready. Load a model to begin.');
