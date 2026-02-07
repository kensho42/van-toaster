import type { Offset, Position, StyleObject, SwipeDirection, VanRenderable } from "./types";

export const VIEWPORT_OFFSET = "24px";
export const MOBILE_VIEWPORT_OFFSET = "16px";

export function cn(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function getDocumentDirection(): "ltr" | "rtl" {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "ltr";
  }

  const dirAttribute = document.documentElement.getAttribute("dir");
  if (!dirAttribute || dirAttribute === "auto") {
    return window.getComputedStyle(document.documentElement).direction === "rtl" ? "rtl" : "ltr";
  }

  return dirAttribute === "rtl" ? "rtl" : "ltr";
}

function toCssLength(value: string | number): string {
  return typeof value === "number" ? `${value}px` : value;
}

export function assignOffset(defaultOffset?: Offset, mobileOffset?: Offset): StyleObject {
  const styles: StyleObject = {};

  const offsets = [defaultOffset, mobileOffset];
  for (const [index, offset] of offsets.entries()) {
    const isMobile = index === 1;
    const prefix = isMobile ? "--mobile-offset" : "--offset";
    const defaultValue = isMobile ? MOBILE_VIEWPORT_OFFSET : VIEWPORT_OFFSET;

    const assignAll = (value: string | number) => {
      for (const key of ["top", "right", "bottom", "left"]) {
        styles[`${prefix}-${key}`] = toCssLength(value);
      }
    };

    if (typeof offset === "number" || typeof offset === "string") {
      assignAll(offset);
      continue;
    }

    if (offset && typeof offset === "object") {
      for (const key of ["top", "right", "bottom", "left"]) {
        const offsetValue = offset[key as keyof Exclude<Offset, string | number>];
        styles[`${prefix}-${key}`] =
          offsetValue === undefined ? defaultValue : toCssLength(offsetValue);
      }
      continue;
    }

    assignAll(defaultValue);
  }

  return styles;
}

export function getDefaultSwipeDirections(position: Position): SwipeDirection[] {
  const [y, x] = position.split("-") as [SwipeDirection, SwipeDirection];
  const directions: SwipeDirection[] = [];

  if (y) {
    directions.push(y);
  }
  if (x) {
    directions.push(x);
  }

  return directions;
}

export function clearChildren(element: Element): void {
  while (element.firstChild) {
    element.firstChild.remove();
  }
}

export function applyStyle(target: HTMLElement, styles?: StyleObject): void {
  if (!styles) {
    return;
  }

  const toKebabCase = (value: string) =>
    value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

  for (const [key, value] of Object.entries(styles)) {
    target.style.setProperty(toKebabCase(key), typeof value === "number" ? `${value}` : value);
  }
}

export function appendRenderable(parent: Element, renderable: VanRenderable): void {
  if (renderable === null || renderable === undefined || renderable === false) {
    return;
  }

  if (typeof renderable === "function") {
    appendRenderable(parent, renderable());
    return;
  }

  if (renderable instanceof Node) {
    parent.append(renderable);
    return;
  }

  parent.append(document.createTextNode(String(renderable)));
}
