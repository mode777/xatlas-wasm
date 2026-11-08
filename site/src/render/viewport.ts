import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ScenarioRun } from '../worker/run-scenario.js';
import {
  boundsOf,
  buildAtlasGeometry,
  buildFullGeometry,
} from './geometry.js';
import { createAtlasTexture, createCheckerTexture } from './textures.js';

export type DisplayMode = 'shaded' | 'checker' | 'charts' | 'atlas';

/**
 * A small studio viewport for the unwrapped mesh. It owns the renderer and
 * all display geometry; the worker result is never mutated.
 */
export class Viewport {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private readonly checkerTexture: THREE.CanvasTexture;
  private readonly shadedMaterial: THREE.MeshStandardMaterial;
  private readonly chartMaterial: THREE.MeshStandardMaterial;
  private readonly checkerMaterial: THREE.MeshStandardMaterial;
  private readonly atlasMaterial: THREE.MeshStandardMaterial;

  private mesh: THREE.Mesh | null = null;
  private run: ScenarioRun | null = null;
  private fullGeometry: THREE.BufferGeometry | null = null;
  private chartGeometry: THREE.BufferGeometry | null = null;
  private atlasGeometry: THREE.BufferGeometry | null = null;
  private atlasGeometryIndex = -1;
  private atlasTexture: THREE.DataTexture | null = null;
  private mode: DisplayMode = 'shaded';
  private atlasIndex = 0;
  private active = true;
  private frame = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'viewport-canvas';
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Orbitable view of the unwrapped model',
    );
    container.append(this.renderer.domElement);

    this.camera.position.set(3, 2.2, 3.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.2;

    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x243336, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd6d8, 0.65);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    this.checkerTexture = createCheckerTexture();
    this.shadedMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9d2c3,
      roughness: 0.68,
      metalness: 0.02,
    });
    this.chartMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.66,
      metalness: 0.02,
    });
    this.checkerMaterial = new THREE.MeshStandardMaterial({
      map: this.checkerTexture,
      roughness: 0.7,
      metalness: 0.0,
    });
    this.atlasMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.0,
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.start();
  }

  setRun(run: ScenarioRun): void {
    if (this.disposed) return;
    this.clear();

    this.run = run;
    this.atlasIndex = 0;
    this.fullGeometry = buildFullGeometry(run, false);
    this.chartGeometry = buildFullGeometry(run, true);
    this.mesh = new THREE.Mesh(this.fullGeometry, this.shadedMaterial);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.frameCamera(run);
    this.applyMaterial();
  }

  setDisplayMode(mode: DisplayMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyMaterial();
  }

  setAtlasIndex(index: number): void {
    if (this.atlasIndex === index) return;
    this.atlasIndex = index;
    if (this.mode === 'atlas') this.applyMaterial();
  }

  setWireframe(enabled: boolean): void {
    for (const material of [
      this.shadedMaterial,
      this.chartMaterial,
      this.checkerMaterial,
      this.atlasMaterial,
    ]) {
      material.wireframe = enabled;
      material.needsUpdate = true;
    }
  }

  clear(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    this.disposeGeometry(this.fullGeometry);
    this.disposeGeometry(this.chartGeometry);
    this.disposeGeometry(this.atlasGeometry);
    this.fullGeometry = null;
    this.chartGeometry = null;
    this.atlasGeometry = null;
    this.atlasGeometryIndex = -1;
    this.disposeAtlasTexture();
    this.run = null;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.resize();
      this.start();
    } else {
      this.stop();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    this.clear();
    this.controls.dispose();
    this.checkerTexture.dispose();
    this.shadedMaterial.dispose();
    this.chartMaterial.dispose();
    this.checkerMaterial.dispose();
    this.atlasMaterial.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private applyMaterial(): void {
    if (!this.mesh || !this.run) return;

    if (this.mode === 'atlas') {
      this.ensureAtlasGeometry();
      this.ensureAtlasTexture();
      this.mesh.geometry = this.atlasGeometry!;
      this.mesh.material = this.atlasMaterial;
    } else if (this.mode === 'charts') {
      this.mesh.geometry = this.chartGeometry!;
      this.mesh.material = this.chartMaterial;
    } else if (this.mode === 'checker') {
      this.mesh.geometry = this.fullGeometry!;
      this.mesh.material = this.checkerMaterial;
    } else {
      this.mesh.geometry = this.fullGeometry!;
      this.mesh.material = this.shadedMaterial;
    }
  }

  private ensureAtlasGeometry(): void {
    if (!this.run) return;
    if (this.atlasGeometry && this.atlasGeometryIndex === this.atlasIndex) return;
    this.disposeGeometry(this.atlasGeometry);
    this.atlasGeometry = buildAtlasGeometry(this.run, this.atlasIndex);
    this.atlasGeometryIndex = this.atlasIndex;
  }

  private ensureAtlasTexture(): void {
    if (!this.run?.image) return;
    this.disposeAtlasTexture();
    this.atlasTexture = createAtlasTexture(this.run.image, this.atlasIndex);
    this.atlasMaterial.map = this.atlasTexture;
    this.atlasMaterial.needsUpdate = true;
  }

  private frameCamera(run: ScenarioRun): void {
    const bounds = boundsOf(run);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.01);
    this.controls.target.copy(center);
    this.camera.position.set(
      center.x + radius * 1.65,
      center.y + radius * 1.05,
      center.z + radius * 2.1,
    );
    this.camera.near = Math.max(radius / 1000, 0.001);
    this.camera.far = Math.max(radius * 100, 100);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.15;
    this.controls.maxDistance = radius * 12;
    this.controls.update();
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private start(): void {
    if (this.frame || this.disposed || !this.active) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (): void => {
    this.frame = 0;
    if (this.disposed || !this.active) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  private disposeGeometry(geometry: THREE.BufferGeometry | null): void {
    geometry?.dispose();
  }

  private disposeAtlasTexture(): void {
    if (!this.atlasTexture) return;
    this.atlasMaterial.map = null;
    this.atlasMaterial.needsUpdate = true;
    this.atlasTexture.dispose();
    this.atlasTexture = null;
  }
}
