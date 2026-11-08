import * as THREE from 'three';
import type { ScenarioImage } from '../worker/run-scenario.js';
import { decodeAtlasRgba } from './atlas-image.js';

/** A small studio checker used to make UV distortion and seams visible. */
export function createCheckerTexture(): THREE.CanvasTexture {
  const size = 128;
  const squares = 8;
  const cell = size / squares;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('the checker texture needs a 2D canvas');

  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      context.fillStyle =
        (x + y) % 2 === 0 ? '#e7e1d4' : '#1d4c50';
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Build a texture from the decoded texel map of one sub-atlas. */
export function createAtlasTexture(
  image: ScenarioImage,
  atlasIndex: number,
): THREE.DataTexture {
  const decoded = decodeAtlasRgba(image, atlasIndex);
  const texture = new THREE.DataTexture(
    decoded.rgba,
    decoded.width,
    decoded.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  // decodeAtlasRgba returns top-down rows; flip them so UV v=0 samples the
  // bottom row of the original xatlas image.
  texture.flipY = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
