export type Route =
  | { readonly kind: 'gallery' }
  | { readonly kind: 'demo'; readonly id: string }
  | { readonly kind: 'not-found'; readonly path: string };

/** Parses `#/` and `#/p/<id>`. Unknown routes render the not-found page. */
export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const path = raw.split('?')[0] || '/';
  if (path === '/') return { kind: 'gallery' };

  const demo = /^\/p\/([^/]+)\/?$/.exec(path);
  if (demo?.[1]) {
    return { kind: 'demo', id: decodeURIComponent(demo[1]) };
  }

  return { kind: 'not-found', path };
}

export function navigate(path: string): void {
  const target = `#${path}`;
  if (window.location.hash !== target) window.location.hash = target;
}

export function startRouter(onRoute: (route: Route) => void): () => void {
  const handle = (): void => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
  return () => window.removeEventListener('hashchange', handle);
}
