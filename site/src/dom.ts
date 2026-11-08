export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function featureList(features: readonly string[]): HTMLElement {
  const list = el('ul', 'feature-list');
  for (const feature of features) {
    list.append(el('li', 'feature', feature));
  }
  return list;
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
