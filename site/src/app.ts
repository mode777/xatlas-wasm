import { getDemo } from './demos/index.js';
import { el } from './dom.js';
import { renderGallery } from './gallery.js';
import { renderNotFound } from './not-found.js';
import { startRouter, type Route } from './router.js';
import { ScenarioClient } from './worker/client.js';

interface PageInstance {
  readonly element: HTMLElement;
  mount(): void;
  dispose(): void;
}

export function startApp(root: HTMLElement): void {
  let client: ScenarioClient | null = null;
  let page: PageInstance | null = null;
  let routeToken = 0;

  const getClient = (): ScenarioClient => (client ??= new ScenarioClient());

  const show = (route: Route): void => {
    const token = ++routeToken;
    page?.dispose();
    page = null;
    root.replaceChildren();

    if (route.kind === 'gallery') {
      root.append(renderGallery());
    } else if (route.kind === 'demo') {
      const demo = getDemo(route.id);
      if (!demo) {
        root.append(renderNotFound(route.id));
      } else {
        root.append(el('div', 'page-loading', 'Loading scenario…'));
        void import('./demo-page.js')
          .then(({ DemoPage }) => {
            if (token !== routeToken) return;
            const instance = new DemoPage(demo, getClient());
            page = instance;
            root.replaceChildren(instance.element);
            instance.mount();
          })
          .catch(() => {
            if (token !== routeToken) return;
            root.replaceChildren(
              renderNotFound('The scenario page could not be loaded.'),
            );
          });
      }
    } else {
      root.append(renderNotFound(route.path));
    }

    window.scrollTo(0, 0);
  };

  const stopRouter = startRouter(show);
  window.addEventListener(
    'beforeunload',
    () => {
      stopRouter();
      client?.dispose();
    },
    { once: true },
  );
}
