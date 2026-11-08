// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { DemoPage } from '../src/demo-page.js';
import { getDemo } from '../src/demos/index.js';
import { renderGallery } from '../src/gallery.js';
import { renderNotFound } from '../src/not-found.js';
import { parseRoute } from '../src/router.js';
import type { ScenarioClient } from '../src/worker/client.js';

describe('hash routing', () => {
  it('parses the gallery, scenario and not-found routes', () => {
    expect(parseRoute('#/')).toEqual({ kind: 'gallery' });
    expect(parseRoute('')).toEqual({ kind: 'gallery' });
    expect(parseRoute('#/p/gazebo')).toEqual({ kind: 'demo', id: 'gazebo' });
    expect(parseRoute('#/p/uv-sphere?x=1')).toEqual({
      kind: 'demo',
      id: 'uv-sphere',
    });
    expect(parseRoute('#/nope')).toEqual({
      kind: 'not-found',
      path: '/nope',
    });
  });
});

describe('gallery shell', () => {
  it('renders one card per catalog scenario', () => {
    const page = renderGallery();
    expect(page.querySelectorAll('.demo-card')).toHaveLength(6);
    expect(page.querySelector('.hero-title')?.textContent).toContain(
      'UV unwrapping',
    );
    expect(page.querySelectorAll('.demo-card-input')).toHaveLength(6);
  });

  it('renders the not-found page', () => {
    const page = renderNotFound('/missing');
    expect(page.querySelector('.not-found-title')?.textContent).toContain(
      'does not exist',
    );
    expect(page.querySelector('.not-found-text')?.textContent).toContain(
      '/missing',
    );
  });
});

describe('scenario page shell', () => {
  it('renders the four views and disables downloads before a run', () => {
    const demo = getDemo('gazebo');
    expect(demo).toBeDefined();
    const client = { run: vi.fn() } as unknown as ScenarioClient;
    const page = new DemoPage(demo!, client).element;

    expect(page.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(page.querySelector('.demo-title')?.textContent).toBe('Gazebo');
    expect(page.querySelector('.demo-summary')?.textContent).toContain(
      'Waiting',
    );
    expect(page.querySelector('.button-primary')?.hasAttribute('disabled')).toBe(
      true,
    );
    expect(page.querySelector('.atlas-select')?.hasAttribute('disabled')).toBe(
      true,
    );
  });
});
