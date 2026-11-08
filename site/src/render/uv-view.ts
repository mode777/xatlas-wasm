import type { ScenarioRun } from '../worker/run-scenario.js';
import { chartColor } from './palette.js';
import {
  triangleAtlasId,
  triangleChartId,
  uvToCanvas,
} from './uv-layout.js';

/** 2D chart-colored layout of the atlas UVs. */
export class UvView {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private run: ScenarioRun | null = null;
  private atlasIndex = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'uv-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute(
      'aria-label',
      'Chart-colored UV layout for the selected atlas',
    );
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('the UV view needs a 2D canvas');
    this.context = context;
    container.append(this.canvas);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  setRun(run: ScenarioRun): void {
    this.run = run;
    this.atlasIndex = 0;
    this.draw();
  }

  setAtlasIndex(index: number): void {
    if (this.atlasIndex === index) return;
    this.atlasIndex = index;
    this.draw();
  }

  clear(): void {
    this.run = null;
    this.draw();
  }

  redraw(): void {
    this.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private draw(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const context = this.context;
    context.clearRect(0, 0, width, height);

    this.drawGrid(width, height);

    if (!this.run) {
      this.drawMessage(width, height, 'Waiting for the first run…');
      return;
    }

    const run = this.run;
    const atlasWidth = Math.max(run.stats.width, 1);
    const atlasHeight = Math.max(run.stats.height, 1);
    const padding = 28;
    const scale = Math.max(
      0.0001,
      Math.min(
        (width - padding * 2) / atlasWidth,
        (height - padding * 2) / atlasHeight,
      ),
    );
    const drawWidth = atlasWidth * scale;
    const drawHeight = atlasHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    const triangleCount = run.indices.length / 3;

    context.save();
    context.translate(offsetX, offsetY);

    context.globalAlpha = 0.58;
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      if (triangleAtlasId(run, triangle) !== this.atlasIndex) continue;
      this.traceTriangle(triangle, drawWidth, drawHeight);
      context.fillStyle = chartColor(triangleChartId(run, triangle), 0.56);
      context.fill();
    }

    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(5, 12, 13, 0.58)';
    context.lineWidth = 0.35;
    for (let triangle = 0; triangle < triangleCount; triangle++) {
      if (triangleAtlasId(run, triangle) !== this.atlasIndex) continue;
      this.traceTriangle(triangle, drawWidth, drawHeight);
      context.stroke();
    }

    context.strokeStyle = 'rgba(214, 235, 232, 0.55)';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, drawWidth - 1, drawHeight - 1);
    context.restore();

    context.fillStyle = 'rgba(214, 235, 232, 0.78)';
    context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(
      `atlas ${this.atlasIndex} · ${atlasWidth} × ${atlasHeight}`,
      offsetX,
      Math.max(offsetY - 8, 14),
    );
  }

  private traceTriangle(
    triangle: number,
    width: number,
    height: number,
  ): void {
    const run = this.run!;
    const a = run.indices[triangle * 3]!;
    const b = run.indices[triangle * 3 + 1]!;
    const c = run.indices[triangle * 3 + 2]!;
    const [ax, ay] = uvToCanvas(
      run.uvs[a * 2]!,
      run.uvs[a * 2 + 1]!,
      width,
      height,
    );
    const [bx, by] = uvToCanvas(
      run.uvs[b * 2]!,
      run.uvs[b * 2 + 1]!,
      width,
      height,
    );
    const [cx, cy] = uvToCanvas(
      run.uvs[c * 2]!,
      run.uvs[c * 2 + 1]!,
      width,
      height,
    );
    this.context.beginPath();
    this.context.moveTo(ax, ay);
    this.context.lineTo(bx, by);
    this.context.lineTo(cx, cy);
    this.context.closePath();
  }

  private drawGrid(width: number, height: number): void {
    const context = this.context;
    context.save();
    context.strokeStyle = 'rgba(160, 196, 194, 0.07)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= width; x += 32) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
    }
    for (let y = 0; y <= height; y += 32) {
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
    }
    context.stroke();
    context.restore();
  }

  private drawMessage(width: number, height: number, text: string): void {
    const context = this.context;
    context.fillStyle = 'rgba(214, 235, 232, 0.62)';
    context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'center';
    context.fillText(text, width / 2, height / 2);
    context.textAlign = 'start';
  }
}
