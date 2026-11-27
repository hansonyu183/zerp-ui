// 读取已渲染的链接并区分普通点击和浏览器原生导航。
export function renderedTarget(event: Event) {
  return event.currentTarget instanceof HTMLElement
    ? event.currentTarget.dataset.target
    : undefined;
}
export function plainClick(event: MouseEvent | KeyboardEvent) {
  return (
    !event.defaultPrevented &&
    (!(event instanceof MouseEvent) || event.button === 0) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function renderedHref(event: MouseEvent | KeyboardEvent) {
  return event.currentTarget instanceof Element
    ? event.currentTarget.getAttribute("href")
    : null;
}
