import { renderFooter, renderHeader } from './chrome.js';
import type { DemoDefinition } from './demos/types.js';
import { getScenarioSource } from './demos/sources.js';
import { el, featureList, setText } from './dom.js';
import { serializeObj } from './export/obj.js';
import {
  formatCount,
  formatDuration,
  formatOptionList,
  formatPercent,
} from './format.js';
import { AtlasView } from './render/atlas-view.js';
import { UvView } from './render/uv-view.js';
import { Viewport, type DisplayMode } from './render/viewport.js';
import type { ScenarioClient } from './worker/client.js';
import type { ScenarioRun } from './worker/run-scenario.js';

type Tab = '3d' | 'uv' | 'atlas' | 'code';

const TABS: readonly Tab[] = ['3d', 'uv', 'atlas', 'code'];
const TAB_LABELS: Record<Tab, string> = {
  '3d': '3D',
  uv: 'UV',
  atlas: 'Atlas',
  code: 'Code',
};
const MODES: readonly DisplayMode[] = ['shaded', 'checker', 'charts', 'atlas'];
const MODE_LABELS: Record<DisplayMode, string> = {
  shaded: 'Shaded',
  checker: 'Checker',
  charts: 'Charts',
  atlas: 'Atlas texture',
};
const CHART_TYPE_NAMES = ['Planar', 'Ortho', 'LSCM', 'Piecewise', 'Invalid'];

export class DemoPage {
  readonly element: HTMLElement;

  private readonly demo: DemoDefinition;
  private readonly source: string;
  private readonly client: ScenarioClient;
  private readonly viewportHost: HTMLElement;
  private readonly panels: Record<Tab, HTMLElement>;
  private readonly tabs: Record<Tab, HTMLButtonElement>;
  private readonly modeButtons: Record<DisplayMode, HTMLButtonElement>;
  private readonly wireframeButton: HTMLButtonElement;
  private readonly atlasSelect: HTMLSelectElement;
  private readonly atlasPicker: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly recipeChart: HTMLElement;
  private readonly recipePack: HTMLElement;
  private readonly downloadObj: HTMLButtonElement;
  private readonly downloadAtlas: HTMLButtonElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly codeElement: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLElement;

  private viewport: Viewport | null = null;
  private uvView: UvView | null = null;
  private atlasView: AtlasView | null = null;
  private run: ScenarioRun | null = null;
  private activeTab: Tab = '3d';
  private displayMode: DisplayMode = 'shaded';
  private wireframe = false;
  private selectedAtlas = 0;
  private loadToken = 0;
  private highlighted = false;
  private disposed = false;

  constructor(demo: DemoDefinition, client: ScenarioClient) {
    this.demo = demo;
    this.source = getScenarioSource(demo.meta.id);
    this.client = client;

    this.element = el('div', 'page');
    const main = el('main', 'demo-layout');
    const stage = el('section', 'demo-stage');
    stage.setAttribute('aria-label', `${demo.meta.title} scenario`);

    const tabBar = el('div', 'demo-tabs');
    tabBar.setAttribute('role', 'tablist');
    tabBar.setAttribute('aria-label', 'Scenario views');

    this.tabs = {
      '3d': el('button', 'demo-tab is-active', TAB_LABELS['3d']),
      uv: el('button', 'demo-tab', TAB_LABELS.uv),
      atlas: el('button', 'demo-tab', TAB_LABELS.atlas),
      code: el('button', 'demo-tab', TAB_LABELS.code),
    };
    this.panels = {
      '3d': el('div', 'viewport-host'),
      uv: el('div', 'uv-host'),
      atlas: el('div', 'atlas-host'),
      code: el('div', 'code-host'),
    };

    for (const tab of TABS) {
      const button = this.tabs[tab];
      const panel = this.panels[tab];
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.id = `tab-${tab}`;
      button.setAttribute('aria-controls', `panel-${tab}`);
      button.setAttribute('aria-selected', String(tab === '3d'));
      button.tabIndex = tab === '3d' ? 0 : -1;
      panel.id = `panel-${tab}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${tab}`);
      panel.hidden = tab !== '3d';
      button.addEventListener('click', () => this.setTab(tab));
      button.addEventListener('keydown', (event) => this.onTabKey(event, tab));
      tabBar.append(button);
    }

    this.viewportHost = el('div', 'viewport-canvas-host');
    const viewportToolbar = el('div', 'viewport-toolbar');
    const modeGroup = el('div', 'mode-group');
    modeGroup.setAttribute('role', 'group');
    modeGroup.setAttribute('aria-label', '3D display mode');
    this.modeButtons = {
      shaded: el('button', 'mode-button is-active', MODE_LABELS.shaded),
      checker: el('button', 'mode-button', MODE_LABELS.checker),
      charts: el('button', 'mode-button', MODE_LABELS.charts),
      atlas: el('button', 'mode-button', MODE_LABELS.atlas),
    };
    for (const mode of MODES) {
      const button = this.modeButtons[mode];
      button.type = 'button';
      button.setAttribute('aria-pressed', String(mode === 'shaded'));
      button.addEventListener('click', () => this.setDisplayMode(mode));
      modeGroup.append(button);
    }
    this.wireframeButton = el('button', 'mode-button', 'Wireframe');
    this.wireframeButton.type = 'button';
    this.wireframeButton.setAttribute('aria-pressed', 'false');
    this.wireframeButton.addEventListener('click', () => {
      this.wireframe = !this.wireframe;
      this.wireframeButton.setAttribute(
        'aria-pressed',
        String(this.wireframe),
      );
      this.wireframeButton.classList.toggle('is-active', this.wireframe);
      this.viewport?.setWireframe(this.wireframe);
    });
    viewportToolbar.append(modeGroup, this.wireframeButton);
    this.panels['3d'].append(this.viewportHost, viewportToolbar);

    this.panels.uv.append(
      el(
        'p',
        'view-note',
        'Chart-colored UV layout. Each color is one chart; the border is the selected sub-atlas.',
      ),
    );

    this.panels.atlas.append(
      el(
        'p',
        'view-note',
        'Decoded atlas texel map. Chart colors, padding and bilinear safety texels are shown separately.',
      ),
    );

    const codeToolbar = el('div', 'code-toolbar');
    codeToolbar.append(el('span', 'code-filename', `${demo.meta.id}.ts`));
    this.copyButton = el('button', 'code-copy', 'Copy');
    this.copyButton.type = 'button';
    this.copyButton.addEventListener('click', () => {
      void this.copySource();
    });
    codeToolbar.append(this.copyButton);
    this.codeElement = el('code', 'hljs language-typescript');
    this.codeElement.textContent = this.source;
    const pre = el('pre', 'code-pre');
    pre.append(this.codeElement);
    this.panels.code.append(codeToolbar, pre);

    const stageBody = el('div', 'demo-stage-body');
    stageBody.append(
      this.panels['3d'],
      this.panels.uv,
      this.panels.atlas,
      this.panels.code,
    );
    this.status = el('div', 'status-overlay');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.progress = el('p', 'status-progress', '');
    stageBody.append(this.status);

    this.summary = el('div', 'demo-summary', 'Waiting for the first run…');
    this.atlasSelect = el('select', 'atlas-select');
    this.atlasSelect.disabled = true;
    this.atlasSelect.addEventListener('change', () => {
      this.selectedAtlas = Number(this.atlasSelect.value) || 0;
      this.updateSelectedAtlas();
    });
    this.atlasPicker = el('label', 'atlas-picker');
    this.atlasPicker.append(
      document.createTextNode('Sub-atlas'),
      this.atlasSelect,
    );
    const metaBar = el('div', 'demo-meta-bar');
    metaBar.append(this.summary, this.atlasPicker);

    stage.append(tabBar, stageBody, metaBar);

    const aside = el('aside', 'demo-aside');
    const back = el('a', 'back-link', 'Back to all scenarios');
    back.href = '#/';
    aside.append(
      back,
      el('p', 'eyebrow', 'Scenario'),
      el('h1', 'demo-title', demo.meta.title),
      el('p', 'demo-description', demo.meta.description),
      featureList(demo.meta.features),
    );
    const inputBadge = el('p', 'input-badge', `${demo.meta.input} mesh`);
    aside.append(inputBadge);

    const runPanel = el('section', 'aside-panel');
    runPanel.append(el('h2', 'aside-title', 'Run'));
    this.stats = el('dl', 'stats');
    runPanel.append(this.stats);

    const recipePanel = el('section', 'aside-panel');
    recipePanel.append(el('h2', 'aside-title', 'Recipe'));
    const chartLabel = el('p', 'recipe-label', 'Chart options');
    this.recipeChart = el('ul', 'recipe-list');
    const packLabel = el('p', 'recipe-label', 'Pack options');
    this.recipePack = el('ul', 'recipe-list');
    recipePanel.append(chartLabel, this.recipeChart, packLabel, this.recipePack);

    const downloadPanel = el('section', 'aside-panel');
    downloadPanel.append(el('h2', 'aside-title', 'Download'));
    this.downloadObj = el('button', 'button button-primary', 'OBJ with UVs');
    this.downloadObj.type = 'button';
    this.downloadObj.disabled = true;
    this.downloadObj.addEventListener('click', () => this.saveObj());
    this.downloadAtlas = el('button', 'button', 'Atlas PNG');
    this.downloadAtlas.type = 'button';
    this.downloadAtlas.disabled = true;
    this.downloadAtlas.addEventListener('click', () => {
      void this.atlasView?.download();
    });
    downloadPanel.append(this.downloadObj, this.downloadAtlas);

    aside.append(runPanel, recipePanel, downloadPanel);
    main.append(stage, aside);
    this.element.append(renderHeader(), main, renderFooter());

    this.renderRecipe();
  }

  mount(): void {
    try {
      this.viewport = new Viewport(this.viewportHost);
    } catch {
      this.viewportHost.append(
        el(
          'p',
          'viewport-unavailable',
          'WebGL is unavailable in this browser. The UV, Atlas, Code and download views still work.',
        ),
      );
      for (const mode of MODES) this.modeButtons[mode].disabled = true;
      this.wireframeButton.disabled = true;
    }

    this.uvView = new UvView(this.panels.uv);
    this.atlasView = new AtlasView(this.panels.atlas);
    this.load();
  }

  dispose(): void {
    this.disposed = true;
    this.loadToken += 1;
    this.viewport?.dispose();
    this.viewport = null;
    this.uvView?.dispose();
    this.uvView = null;
    this.atlasView?.dispose();
    this.atlasView = null;
  }

  private load(): void {
    if (this.disposed) return;
    const token = ++this.loadToken;
    this.run = null;
    this.selectedAtlas = 0;
    this.viewport?.clear();
    this.uvView?.clear();
    this.atlasView?.clear();
    this.stats.replaceChildren();
    this.summary.textContent = 'Unwrapping…';
    this.downloadObj.disabled = true;
    this.downloadAtlas.disabled = true;
    this.atlasSelect.disabled = true;
    this.atlasSelect.replaceChildren();
    this.showLoading();

    this.client
      .run(this.demo.meta.id, (category, percent) => {
        if (this.disposed || token !== this.loadToken) return;
        setText(this.progress, `${category} ${percent}%`);
      })
      .then((run) => {
        if (this.disposed || token !== this.loadToken) return;
        this.run = run;
        this.selectedAtlas = 0;
        this.viewport?.setRun(run);
        this.viewport?.setDisplayMode(this.displayMode);
        this.viewport?.setWireframe(this.wireframe);
        this.uvView?.setRun(run);
        this.atlasView?.setRun(run);
        this.renderStats(run);
        this.renderSummary(run);
        this.updateAtlasPicker(run);
        this.downloadObj.disabled = false;
        this.downloadAtlas.disabled = !run.image;
        this.modeButtons.atlas.disabled = !run.image;
        this.hideStatus();
      })
      .catch((error: unknown) => {
        if (this.disposed || token !== this.loadToken) return;
        this.summary.textContent = 'No run';
        this.showError(error);
      });
  }

  private setTab(tab: Tab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    for (const key of TABS) {
      const selected = key === tab;
      this.tabs[key].classList.toggle('is-active', selected);
      this.tabs[key].setAttribute('aria-selected', String(selected));
      this.tabs[key].tabIndex = selected ? 0 : -1;
      this.panels[key].hidden = !selected;
    }
    this.viewport?.setActive(tab === '3d');
    if (tab === 'uv') this.uvView?.redraw();
    if (tab === 'atlas') this.atlasView?.redraw();
    if (tab === 'code') void this.ensureHighlighted();
  }

  private async ensureHighlighted(): Promise<void> {
    if (this.highlighted) return;
    try {
      const { highlightSource } = await import('./render/code-view.js');
      if (this.disposed) return;
      this.codeElement.innerHTML = highlightSource(this.source);
      this.highlighted = true;
    } catch {
      // Keep the plain source if the highlighting chunk cannot load.
    }
  }

  private onTabKey(event: KeyboardEvent, tab: Tab): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = TABS.indexOf(tab);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + direction + TABS.length) % TABS.length]!;
    this.setTab(next);
    this.tabs[next].focus();
  }

  private setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
    for (const key of MODES) {
      const selected = key === mode;
      this.modeButtons[key].classList.toggle('is-active', selected);
      this.modeButtons[key].setAttribute('aria-pressed', String(selected));
    }
    this.viewport?.setDisplayMode(mode);
  }

  private updateSelectedAtlas(): void {
    this.viewport?.setAtlasIndex(this.selectedAtlas);
    this.uvView?.setAtlasIndex(this.selectedAtlas);
    this.atlasView?.setAtlasIndex(this.selectedAtlas);
  }

  private updateAtlasPicker(run: ScenarioRun): void {
    this.atlasSelect.replaceChildren();
    for (let i = 0; i < run.stats.atlasCount; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `Atlas ${i} · ${formatPercent(
        run.stats.utilization[i] ?? 0,
      )}`;
      this.atlasSelect.append(option);
    }
    this.atlasSelect.value = '0';
    this.atlasSelect.disabled = run.stats.atlasCount <= 1;
  }

  private renderStats(run: ScenarioRun): void {
    this.stats.replaceChildren();
    this.addStat('Resolution', `${run.stats.width} × ${run.stats.height}`);
    this.addStat('Charts', formatCount(run.stats.chartCount));
    this.addStat('Atlases', String(run.stats.atlasCount));
    this.addStat('Meshes', String(run.stats.meshCount));

    const utilization = el('ul', 'utilization-list');
    for (let i = 0; i < run.stats.utilization.length; i++) {
      utilization.append(
        el(
          'li',
          'utilization-item',
          `Atlas ${i}: ${formatPercent(run.stats.utilization[i]!)}`,
        ),
      );
    }
    this.addStat('Utilization', utilization);

    this.addStat('Texels / unit', run.stats.texelsPerUnit.toFixed(2));
    this.addStat(
      'Input',
      `${formatCount(run.stats.inputVertexCount)} vertices · ${formatCount(
        run.stats.inputFaceCount,
      )} faces`,
    );
    this.addStat(
      'Output',
      `${formatCount(run.stats.outputVertexCount)} vertices · ${formatCount(
        run.stats.outputIndexCount / 3,
      )} faces`,
    );

    const typeCounts = new Map<number, number>();
    for (const chart of run.charts) {
      typeCounts.set(chart.type, (typeCounts.get(chart.type) ?? 0) + 1);
    }
    const typeText = [...typeCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([type, count]) =>
          `${formatCount(count)} ${CHART_TYPE_NAMES[type] ?? `type ${type}`}`,
      )
      .join(' · ');
    this.addStat('Chart types', typeText || 'none');
    this.addStat('Duration', formatDuration(run.stats.durationMs));
  }

  private addStat(label: string, value: string | HTMLElement): void {
    const term = el('dt', 'stats-label', label);
    const detail = el('dd', 'stats-value');
    if (typeof value === 'string') detail.textContent = value;
    else detail.append(value);
    this.stats.append(term, detail);
  }

  private renderSummary(run: ScenarioRun): void {
    this.summary.textContent =
      `${formatCount(run.stats.chartCount)} charts · ` +
      `${run.stats.atlasCount} ${run.stats.atlasCount === 1 ? 'atlas' : 'atlases'} · ` +
      `${run.stats.width} × ${run.stats.height} · ` +
      formatDuration(run.stats.durationMs);
  }

  private renderRecipe(): void {
    this.renderOptionList(this.recipeChart, this.demo.chartOptions);
    this.renderOptionList(this.recipePack, this.demo.packOptions);
  }

  private renderOptionList(
    container: HTMLElement,
    options: object | undefined,
  ): void {
    const entries = formatOptionList(options);
    container.replaceChildren();
    if (entries.length === 0) {
      container.append(el('li', 'recipe-item is-muted', 'defaults'));
      return;
    }
    for (const entry of entries) {
      container.append(el('li', 'recipe-item', entry));
    }
  }

  private async copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.source);
      this.copyButton.textContent = 'Copied';
    } catch {
      this.copyButton.textContent = 'Copy failed';
    }
    setTimeout(() => {
      if (!this.disposed) this.copyButton.textContent = 'Copy';
    }, 1600);
  }

  private saveObj(): void {
    if (!this.run) return;
    const blob = new Blob([serializeObj(this.run)], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.run.demoId}.obj`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private showLoading(): void {
    this.status.className = 'status-overlay is-visible';
    const card = el('div', 'status-card');
    const label = el('span', 'status-label', 'Unwrapping the model…');
    card.append(el('span', 'status-spinner'), label, this.progress);
    this.progress.textContent = '';
    this.status.replaceChildren(card);
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.status.className = 'status-overlay is-visible is-error';
    const card = el('div', 'status-card');
    card.append(
      el('p', 'status-title', 'Unwrap failed'),
      el('p', 'status-message', message),
    );
    const retry = el('button', 'button button-primary', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', () => this.load());
    card.append(retry);
    this.status.replaceChildren(card);
  }

  private hideStatus(): void {
    this.status.className = 'status-overlay';
    this.status.replaceChildren();
  }
}
