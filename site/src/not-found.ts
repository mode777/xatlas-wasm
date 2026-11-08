import { renderFooter, renderHeader } from './chrome.js';
import { el } from './dom.js';

export function renderNotFound(path: string): HTMLElement {
  const page = el('div', 'page');
  const main = el('main', 'not-found');
  main.append(
    el('p', 'eyebrow', '404'),
    el('h1', 'not-found-title', 'That scenario does not exist.'),
    el(
      'p',
      'not-found-text',
      `No showcase route matches "${path}". Pick a scenario from the gallery.`,
    ),
  );
  const back = el('a', 'button button-primary', 'Back to the gallery');
  back.href = '#/';
  main.append(back);
  page.append(renderHeader(), main, renderFooter());
  return page;
}
