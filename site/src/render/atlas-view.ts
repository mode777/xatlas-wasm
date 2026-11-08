import type { ScenarioRun } from '../worker/run-scenario.js';
import { decodeAtlasRgba, type DecodedAtlas } from './atlas-image.js';
import { chartColorRgb } from './palette.js';

/** Canvas view of the raw atlas texel map, plus PNG download support. */
export class AtlasView {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly message: HTMLElement;
  private readonly legend: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private run: ScenarioRun | null = null;
  private atlasIndex = 0;
  private cache = new Map<number, DecodedAtlas>();
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'atlas-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute(
      'aria-label',
      'Decoded atlas texel map for the selected atlas',
    );
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('the atlas view needs a 2D canvas');
    this.context = context;

    this.message = document.createElement('p');
    this.message.className = 'atlas-empty-message';
    this.legend = document.createElement('ul');
    this.legend.className = 'atlas-legend';
    for (const [label, color] of [
      ['chart', `rgb(${chartColorRgb(0, 0.56).join(' ')})`],
      ['padding', `rgb(${chartColorRgb(0, 0.3).join(' ')})`],
      ['bilinear', `rgb(${chartColorRgb(0, 0.4).join(' ')})`],
      ['empty', 'transparent'],
    ] as const) {
      const item = document.createElement('li');
      item.className = 'atlas-legend-item';
      const swatch = document.createElement('span');
      swatch.className = `atlas-swatch atlas-swatch-${label}`;
      if (color !== 'transparent') swatch.style.background = color;
      item.append(swatch, document.createTextNode(label));
      this.legend.append(item);
    }

    container.append(this.canvas, this.message, this.legend);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.draw();
  }

  setRun(run: ScenarioRun): void {
    this.run = run;
    this.atlasIndex = 0;
    this.cache.clear();
    this.draw();
  }

  setAtlasIndex(index: number): void {
    if (this.atlasIndex === index) return;
    this.atlasIndex = index;
    this.draw();
  }

  clear(): void {
    this.run = null;
    this.cache.clear();
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
    this.message.remove();
    this.legend.remove();
  }

  async downloadPng(): Promise<Blob | null> {
    const decoded = this.decoded();
    if (!decoded) return null;
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const image = context.createImageData(decoded.width, decoded.height);
    image.data.set(decoded.rgba);
    context.putImageData(image, 0, 0);
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
  }

  async download(): Promise<void> {
    const blob = await this.downloadPng();
    if (!blob || !this.run) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.run.demoId}-atlas-${this.atlasIndex}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  private decoded(): DecodedAtlas | null {
    if (!this.run?.image) return null;
    const cached = this.cache.get(this.atlasIndex);
    if (cached) return cached;
    const decoded = decodeAtlasRgba(this.run.image, this.atlasIndex);
    this.cache.set(this.atlasIndex, decoded);
    return decoded;
  }

  private draw(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.context.clearRect(0, 0, width, height);

    const decoded = this.decoded();
    if (!decoded) {
      this.canvas.hidden = true;
      this.legend.hidden = true;
      this.message.hidden = false;
      this.message.textContent = this.run
        ? 'This run did not request an atlas image.'
        : 'Waiting for the first run…';
      return;
    }

    this.canvas.hidden = false;
    this.legend.hidden = false;
    this.message.hidden = true;

    const offscreen = document.createElement('canvas');
    offscreen.width = decoded.width;
    offscreen.height = decoded.height;
    const offContext = offscreen.getContext('2d');
    if (!offContext) return;
    const image = offContext.createImageData(decoded.width, decoded.height);
    image.data.set(decoded.rgba);
    offContext.putImageData(image, 0, 0);

    const padding = 28;
    const scale = Math.max(
      0.0001,
      Math.min(
        (width - padding * 2) / decoded.width,
        (height - padding * 2) / decoded.height,
      ),
    );
    const drawWidth = decoded.width * scale;
    const drawHeight = decoded.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    this.context.save();
    this.context.imageSmoothingEnabled = false;
    this.context.drawImage(offscreen, offsetX, offsetY, drawWidth, drawHeight);
    this.context.strokeStyle = 'rgba(214, 235, 232, 0.55)';
    this.context.lineWidth = 1;
    this.context.strokeRect(
      offsetX + 0.5,
      offsetY + 0.5,
      drawWidth - 1,
      drawHeight - 1,
    );
    this.context.restore();

    this.context.fillStyle = 'rgba(214, 235, 232, 0.78)';
    this.context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    this.context.fillText(
      `atlas ${this.atlasIndex} · ${decoded.width} × ${decoded.height}`,
      offsetX,
      Math.max(offsetY - 8, 14),
    );
  }
}
