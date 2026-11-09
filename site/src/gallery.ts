import { renderFooter, renderHeader } from './chrome.js';
import { demos } from './demos/index.js';
import { el, featureList } from './dom.js';

const ACCENTS = [
  '#0f6f74',
  '#b5522a',
  '#6c5ce7',
  '#a06a12',
  '#8a5d76',
  '#2a6f4e',
];

function demoCard(
  demo: (typeof demos)[number],
  index: number,
): HTMLElement {
  const card = el('a', 'demo-card');
  card.href = `#/p/${encodeURIComponent(demo.meta.id)}`;
  card.style.setProperty(
    '--card-accent',
    ACCENTS[index % ACCENTS.length] ?? ACCENTS[0]!,
  );

  const body = el('div', 'demo-card-body');
  const meta = el('div', 'demo-card-meta');
  meta.append(
    el('span', 'demo-card-ordinal', String(index + 1).padStart(2, '0')),
    el('span', 'demo-card-input', demo.meta.input),
  );
  body.append(
    meta,
    el('p', 'demo-card-kicker', demo.meta.features[0] ?? 'scenario'),
    el('h2', 'demo-card-title', demo.meta.title),
    el('p', 'demo-card-description', demo.meta.description),
    featureList(demo.meta.features),
  );

  card.append(body);
  return card;
}

export function renderGallery(): HTMLElement {
  const page = el('div', 'page');
  const main = el('main', 'gallery-main');

  const hero = el('section', 'hero');
  const copy = el('div', 'hero-copy');
  copy.append(
    el('p', 'eyebrow', 'Showcase'),
    el('h1', 'hero-title', 'UV unwrapping, in the browser.'),
    el(
      'p',
      'hero-lede',
      `${demos.length} meshes, one WebAssembly kernel. Cut them into charts, pack the charts into atlases, and inspect the result from every angle.`,
    ),
  );

  const facts = el('dl', 'hero-facts');
  for (const [label, value] of [
    ['kernel', 'xatlas'],
    ['output', 'UV + atlas'],
    ['runtime', 'WebAssembly'],
    ['scenarios', String(demos.length)],
  ] as const) {
    const group = el('div', 'hero-fact');
    group.append(el('dt', '', label), el('dd', '', value));
    facts.append(group);
  }
  copy.append(facts);
  hero.append(copy);

  const grid = el('section', 'demo-grid');
  grid.setAttribute('aria-label', 'Scenarios');
  for (const [index, demo] of demos.entries()) {
    grid.append(demoCard(demo, index));
  }

  const note = el('p', 'gallery-note');
  note.append(
    document.createTextNode(
      'Every scenario runs the real wasm build in a worker. Open a scenario to orbit the result, inspect the atlas texel map, or read the exact module that produced it. ',
    ),
  );
  const api = el('a', 'text-link', 'The API reference lives in the repository.');
  api.href = 'https://github.com/mode777/xatlas-wasm/blob/main/API.md';
  note.append(api);

  main.append(hero, grid, note);
  page.append(renderHeader(), main, renderFooter());
  return page;
}
