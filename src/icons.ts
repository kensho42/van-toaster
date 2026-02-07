import type { ToastIcons, ToastT, VanRenderable } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(paths: Array<Record<string, string>>, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS(SVG_NS, "svg");
  node.setAttribute("viewBox", "0 0 24 24");
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "2");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("aria-hidden", "true");

  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }

  for (const pathAttributes of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    for (const [key, value] of Object.entries(pathAttributes)) {
      path.setAttribute(key, value);
    }
    node.append(path);
  }

  return node;
}

export function createLoader(visible: boolean): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "van-loader";
  wrapper.dataset.visible = String(visible);

  const loadingWrapper = document.createElement("div");
  loadingWrapper.className = "van-loading-wrapper";
  loadingWrapper.dataset.visible = String(visible);

  const spinner = document.createElement("div");
  spinner.className = "van-spinner";

  for (let i = 0; i < 12; i += 1) {
    const bar = document.createElement("div");
    bar.className = "van-loading-bar";
    spinner.append(bar);
  }

  loadingWrapper.append(spinner);
  wrapper.append(loadingWrapper);

  return wrapper;
}

export function defaultCloseIcon(): SVGElement {
  return svg([{ d: "M18 6 6 18" }, { d: "m6 6 12 12" }]);
}

export function defaultSuccessIcon(): SVGElement {
  return svg([{ d: "M20 6 9 17l-5-5" }]);
}

export function defaultInfoIcon(): SVGElement {
  return svg([
    { d: "M12 17v-6" },
    { d: "M12 8h.01" },
    { d: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20" },
  ]);
}

export function defaultWarningIcon(): SVGElement {
  return svg([
    {
      d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
    },
    { d: "M12 9v4" },
    { d: "M12 17h.01" },
  ]);
}

export function defaultErrorIcon(): SVGElement {
  return svg([
    { d: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20" },
    { d: "m15 9-6 6" },
    { d: "m9 9 6 6" },
  ]);
}

export function getDefaultIcon(type: ToastT["type"]): VanRenderable {
  switch (type) {
    case "success":
      return defaultSuccessIcon();
    case "info":
      return defaultInfoIcon();
    case "warning":
      return defaultWarningIcon();
    case "error":
      return defaultErrorIcon();
    default:
      return null;
  }
}

export function getCloseIcon(icons?: ToastIcons): VanRenderable {
  return icons?.close ?? defaultCloseIcon();
}
