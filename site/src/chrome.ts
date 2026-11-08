import { demos } from './demos/index.js';
import { el } from './dom.js';

const REPO_URL = 'https://github.com/mode777/xatlas-wasm';
const API_URL = `${REPO_URL}/blob/main/API.md`;

export function renderHeader(): HTMLElement {
  const header = el('header', 'site-header');

  const brand = el('a', 'brand');
  brand.href = '#/';
  brand.append(
    el('span', 'brand-main', 'xatlas'),
    el('span', 'brand-accent', '-wasm'),
  );

  const nav = el('nav', 'site-nav');
  nav.setAttribute('aria-label', 'Project links');
  const gallery = el('a', 'nav-link', 'Gallery');
  gallery.href = '#/';
  const api = el('a', 'nav-link', 'API');
  api.href = API_URL;
  const repo = el('a', 'nav-link', 'GitHub');
  repo.href = REPO_URL;
  nav.append(gallery, api, repo);

  header.append(brand, nav);
  return header;
}

export function renderFooter(): HTMLElement {
  const footer = el('footer', 'site-footer');
  footer.append(
    el('span', '', 'MIT-licensed xatlas kernel'),
    el('span', '', `${demos.length} scenarios · wasm in the browser`),
    el('span', '', 'Showcase · not part of the npm package'),
  );
  return footer;
}
