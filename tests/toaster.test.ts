import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { ToastState } from "../src/store";
import { toast } from "../src/toast";
import { Toaster } from "../src/toaster";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dispatchPointer(
  target: Element,
  type: string,
  init: { clientX?: number; clientY?: number; button?: number; pointerType?: string } = {},
): void {
  const event = new window.Event(type, { bubbles: true, cancelable: true }) as Event & {
    clientX: number;
    clientY: number;
    button: number;
    pointerId: number;
    pointerType: string;
  };

  event.clientX = init.clientX ?? 0;
  event.clientY = init.clientY ?? 0;
  event.button = init.button ?? 0;
  event.pointerId = 1;
  event.pointerType = init.pointerType ?? "mouse";

  target.dispatchEvent(event);
}

function createMountedToaster(props: Parameters<typeof Toaster>[0] = {}) {
  const toaster = Toaster(props) as HTMLElement & { __vanToasterDispose__?: () => void };
  document.body.append(toaster);
  return toaster;
}

beforeAll(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window as unknown as typeof globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.navigator = dom.window.navigator;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);

  if (!("setPointerCapture" in dom.window.HTMLElement.prototype)) {
    (
      dom.window.HTMLElement.prototype as HTMLElement & { setPointerCapture: () => void }
    ).setPointerCapture = function setPointerCapture() {
      return undefined;
    };
  }
});

beforeEach(() => {
  document.body.innerHTML = "";
  ToastState.resetForTests();
});

afterEach(() => {
  const mounted = document.querySelectorAll("[data-van-toaster]");
  for (const node of mounted) {
    const host = node.closest("section") as HTMLElement & { __vanToasterDispose__?: () => void };
    host?.__vanToasterDispose__?.();
  }
  document.body.innerHTML = "";
  ToastState.resetForTests();
});

describe("toast store", () => {
  test("toast() creates toast with generated id", () => {
    const id = toast("hello");
    expect(typeof id === "number" || typeof id === "string").toBe(true);

    const active = toast.getToasts();
    expect(active.length).toBe(1);
    expect((active[0] as { id: unknown }).id).toBe(id);
  });

  test("reusing id updates existing toast", () => {
    const id = toast("first", { id: "same-id", description: "a" });
    expect(id).toBe("same-id");

    toast.success("second", { id: "same-id", description: "b" });

    const active = toast.getToasts();
    expect(active.length).toBe(1);
    const entry = active[0] as { title?: unknown; description?: unknown; type?: string };
    expect(entry.description).toBe("b");
    expect(entry.type).toBe("success");
  });

  test("toast.dismiss(id) removes one", async () => {
    const one = toast("one");
    toast("two");

    toast.dismiss(one);
    await sleep(10);

    const ids = toast.getToasts().map((item) => (item as { id: unknown }).id);
    expect(ids.includes(one)).toBe(false);
    expect(ids.length).toBe(1);
  });

  test("toast.dismiss() removes all", async () => {
    toast("one");
    toast("two");

    toast.dismiss();
    await sleep(10);

    expect(toast.getToasts().length).toBe(0);
  });

  test("toast.promise transitions loading to success", async () => {
    toast.promise(Promise.resolve("done"), {
      loading: "Loading",
      success: (data) => `OK ${data}`,
    });

    await sleep(20);

    const history = toast.getHistory() as Array<{ type?: string; title?: unknown }>;
    const success = history.find((item) => item.type === "success");
    expect(success).toBeTruthy();
    expect(success?.title).toBe("OK done");
  });

  test("toast.promise transitions loading to error", async () => {
    toast.promise(Promise.reject(new Error("boom")), {
      loading: "Loading",
      error: "Nope",
    });

    await sleep(20);

    const history = toast.getHistory() as Array<{ type?: string; title?: unknown }>;
    const error = history.find((item) => item.type === "error");
    expect(error).toBeTruthy();
    expect(error?.title).toBe("Nope");
  });

  test("toast.promise unwrap resolves and rejects", async () => {
    const resolveResult = toast.promise(Promise.resolve("value"), {
      loading: "Loading",
      success: "Done",
    });

    await expect(resolveResult?.unwrap()).resolves.toBe("value");

    const rejectResult = toast.promise(Promise.reject(new Error("fail")), {
      loading: "Loading",
      error: "Err",
    });

    await expect(rejectResult?.unwrap()).rejects.toThrow("fail");
  });

  test("getHistory and getToasts return expected values", async () => {
    const id = toast("visible");
    toast.dismiss(id);
    await sleep(10);

    expect(toast.getHistory().length).toBe(1);
    expect(toast.getToasts().length).toBe(0);
  });
});

describe("toaster dom", () => {
  test("default position is top-right on desktop", async () => {
    createMountedToaster();
    toast("desktop", { duration: 10_000 });

    await sleep(20);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    expect(list.getAttribute("data-y-position")).toBe("top");
    expect(list.getAttribute("data-x-position")).toBe("right");
  });

  test("default position is top-center on mobile", async () => {
    const originalMatchMedia = window.matchMedia;
    try {
      (
        window as typeof window & {
          matchMedia: (query: string) => MediaQueryList;
        }
      ).matchMedia = ((query: string) =>
        ({
          matches: query === "(max-width: 600px)",
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList) as typeof window.matchMedia;

      createMountedToaster();
      toast("mobile", { duration: 10_000 });
      await sleep(20);

      const list = document.querySelector("[data-van-toaster]") as HTMLElement;
      expect(list.getAttribute("data-y-position")).toBe("top");
      expect(list.getAttribute("data-x-position")).toBe("center");
    } finally {
      (
        window as typeof window & {
          matchMedia: typeof window.matchMedia;
        }
      ).matchMedia = originalMatchMedia;
    }
  });

  test("auto-dismiss occurs after duration", async () => {
    createMountedToaster();
    toast("bye", { duration: 30 });

    await sleep(320);

    const nodes = document.querySelectorAll("[data-van-toast]");
    expect(nodes.length).toBe(0);
  });

  test("hover pause delays auto-dismiss", async () => {
    createMountedToaster();
    toast("hover me", { duration: 80 });

    await sleep(20);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));

    await sleep(140);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(1);

    list.dispatchEvent(new window.Event("mouseleave", { bubbles: true }));
    await sleep(260);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(0);
  });

  test("toasterId routes to matching toaster", async () => {
    const primary = createMountedToaster({ containerAriaLabel: "Primary" });
    const secondary = createMountedToaster({ id: "aux", containerAriaLabel: "Secondary" });

    toast("for aux", { toasterId: "aux" });
    await sleep(20);

    expect(primary.querySelectorAll("[data-van-toast]").length).toBe(0);
    expect(secondary.querySelectorAll("[data-van-toast]").length).toBe(1);
  });

  test("visibleToasts caps visible stack", async () => {
    createMountedToaster({ visibleToasts: 1 });
    toast("one");
    toast("two");

    await sleep(30);

    const nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    expect(nodes.length).toBe(2);

    const visible = nodes.filter((node) => node.getAttribute("data-visible") === "true");
    expect(visible.length).toBe(1);
  });

  test("stack recalculates front height without interaction", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock(): DOMRect {
      if ((this as HTMLElement).hasAttribute("data-van-toast")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 356,
          bottom: 88,
          width: 356,
          height: 88,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return originalGetBoundingClientRect.call(this);
    };

    try {
      createMountedToaster({ position: "top-right", visibleToasts: 5, duration: 10_000 });
      toast.success("Build deployed", {
        description: "The production artifact is now live.",
        duration: 10_000,
      });
      toast.success("Build deployed", {
        description: "The production artifact is now live.",
        duration: 10_000,
      });
      toast.success("Build deployed", {
        description: "The production artifact is now live.",
        duration: 10_000,
      });

      await sleep(120);

      const list = document.querySelector("[data-van-toaster]") as HTMLElement;
      const frontHeight = Number(
        list.style.getPropertyValue("--front-toast-height").replace("px", ""),
      );
      expect(frontHeight).toBeGreaterThan(0);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test("stack z-index keeps newest toast on top", async () => {
    createMountedToaster({ position: "top-center", duration: 10_000 });
    toast("one", { duration: 10_000 });
    toast("two", { duration: 10_000 });
    toast("three", { duration: 10_000 });
    toast("four", { duration: 10_000 });

    await sleep(80);

    const nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    const zIndexes = nodes.map((node) =>
      Number((node as HTMLElement).style.getPropertyValue("--z-index")),
    );
    expect(zIndexes).toEqual([4, 3, 2, 1]);
    const inlineZIndexes = nodes.map((node) => Number((node as HTMLElement).style.zIndex));
    expect(inlineZIndexes).toEqual([4, 3, 2, 1]);
  });

  test("stack stays collapsed by default even when expand prop is true", async () => {
    createMountedToaster({ visibleToasts: 1, expand: true });
    toast("one", { duration: 10_000 });
    toast("two", { duration: 10_000 });
    await sleep(30);

    const nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    expect(nodes.length).toBe(2);
    const expanded = nodes.filter((node) => node.getAttribute("data-expanded") === "true");
    expect(expanded.length).toBe(0);
  });

  test("stack expands on hover and collapses on mouse leave", async () => {
    createMountedToaster({ visibleToasts: 1 });
    toast("one", { duration: 10_000 });
    toast("two", { duration: 10_000 });
    await sleep(30);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));
    await sleep(20);

    let nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    let expanded = nodes.filter((node) => node.getAttribute("data-expanded") === "true");
    expect(expanded.length).toBeGreaterThan(0);

    list.dispatchEvent(new window.Event("mouseleave", { bubbles: true }));
    await sleep(20);

    nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    expanded = nodes.filter((node) => node.getAttribute("data-expanded") === "true");
    expect(expanded.length).toBe(0);
  });

  test("stack expands on touch and collapses on touch end", async () => {
    createMountedToaster({ visibleToasts: 1 });
    toast("one", { duration: 10_000 });
    toast("two", { duration: 10_000 });
    await sleep(30);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    dispatchPointer(list, "pointerdown", { pointerType: "touch" });
    await sleep(20);

    let nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    let expanded = nodes.filter((node) => node.getAttribute("data-expanded") === "true");
    expect(expanded.length).toBeGreaterThan(0);

    dispatchPointer(list, "pointerup", { pointerType: "touch" });
    await sleep(20);

    nodes = Array.from(document.querySelectorAll("[data-van-toast]"));
    expanded = nodes.filter((node) => node.getAttribute("data-expanded") === "true");
    expect(expanded.length).toBe(0);
  });

  test("expanded stack uses latest measured heights for all offsets", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock(): DOMRect {
      if ((this as HTMLElement).hasAttribute("data-van-toast")) {
        const index = Number((this as HTMLElement).dataset.index ?? "0");
        const height = index === 0 ? 100 : index === 1 ? 90 : 80;
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 356,
          bottom: height,
          width: 356,
          height,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return originalGetBoundingClientRect.call(this);
    };

    try {
      createMountedToaster({ visibleToasts: 5, duration: 10_000 });
      toast("one", { duration: 10_000 });
      toast("two", { duration: 10_000 });
      toast("three", { duration: 10_000 });

      await sleep(80);

      const list = document.querySelector("[data-van-toaster]") as HTMLElement;
      list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));
      await sleep(80);

      const nodes = Array.from(document.querySelectorAll("[data-van-toast]")) as HTMLElement[];
      const offsets = nodes.map((node) =>
        Number(node.style.getPropertyValue("--offset").replace("px", "")),
      );

      expect(nodes.every((node) => node.getAttribute("data-expanded") === "true")).toBe(true);
      expect(offsets).toEqual([0, 114, 218]);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test("list exposes hover hit-area across toast gaps when expanded", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectMock(): DOMRect {
      if ((this as HTMLElement).hasAttribute("data-van-toast")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 356,
          bottom: 80,
          width: 356,
          height: 80,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return originalGetBoundingClientRect.call(this);
    };

    try {
      createMountedToaster({ visibleToasts: 5, gap: 14, duration: 10_000 });
      toast("one", { duration: 10_000 });
      toast("two", { duration: 10_000 });
      toast("three", { duration: 10_000 });

      await sleep(80);

      const list = document.querySelector("[data-van-toaster]") as HTMLElement;
      list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));
      await sleep(40);

      const stackHeight = Number(list.style.getPropertyValue("--stack-height").replace("px", ""));
      expect(stackHeight).toBeGreaterThan(160);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test("swipe threshold dismisses toast", async () => {
    createMountedToaster();
    toast("swipe me", { duration: 10_000 });
    await sleep(30);

    const node = document.querySelector("[data-van-toast]") as HTMLElement;
    dispatchPointer(node, "pointerdown", { clientX: 0, clientY: 0, button: 0 });
    dispatchPointer(node, "pointermove", { clientX: 120, clientY: 0 });
    dispatchPointer(node, "pointerup", { clientX: 120, clientY: 0 });

    await sleep(260);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(0);
  });

  test("action button respects defaultPrevented", async () => {
    createMountedToaster({ closeButton: true });
    toast("action", {
      duration: 10_000,
      action: {
        label: "Keep",
        onClick: (event) => event.preventDefault(),
      },
    });

    await sleep(30);

    const buttonNode = document.querySelector("[data-action]") as HTMLButtonElement;
    buttonNode.click();

    await sleep(40);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(1);
  });

  test("action button dismisses with pointer sequence when not prevented", async () => {
    createMountedToaster({ closeButton: true });
    toast("action", {
      duration: 10_000,
      action: {
        label: "Acknowledge",
        onClick: () => undefined,
      },
    });

    await sleep(30);

    const actionButton = document.querySelector("[data-action]") as HTMLButtonElement;
    dispatchPointer(actionButton, "pointerdown", { pointerType: "mouse" });
    dispatchPointer(actionButton, "pointerup", { pointerType: "mouse" });
    actionButton.click();

    await sleep(320);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(0);
  });

  test("close button does not dismiss when toast is not dismissible", async () => {
    createMountedToaster({ closeButton: true });
    toast("fixed", {
      duration: 10_000,
      dismissible: false,
      closeButton: true,
    });

    await sleep(30);

    const close = document.querySelector("[data-close-button]") as HTMLButtonElement;
    close.click();

    await sleep(30);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(1);
  });

  test("close button dismisses while list is expanded", async () => {
    createMountedToaster({ closeButton: true });
    toast("closable", { duration: 10_000, closeButton: true });

    await sleep(30);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));

    const close = document.querySelector("[data-close-button]") as HTMLButtonElement;
    dispatchPointer(close, "pointerdown", { pointerType: "mouse" });
    dispatchPointer(close, "pointerup", { pointerType: "mouse" });
    close.click();

    await sleep(320);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(0);
  });

  test("dismiss all works while list is expanded", async () => {
    createMountedToaster({ closeButton: true });
    toast("one", { duration: 10_000 });
    toast("two", { duration: 10_000 });

    await sleep(30);

    const list = document.querySelector("[data-van-toaster]") as HTMLElement;
    list.dispatchEvent(new window.Event("mouseenter", { bubbles: true }));

    toast.dismiss();

    await sleep(420);
    expect(document.querySelectorAll("[data-van-toast]").length).toBe(0);
  });

  test("per-toast position override renders in right list", async () => {
    createMountedToaster({ position: "bottom-right" });
    toast("top left", { position: "top-left" });

    await sleep(20);

    const list = document.querySelector(
      "[data-van-toaster][data-y-position='top'][data-x-position='left']",
    );
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll("[data-van-toast]").length).toBe(1);
  });

  test("reduced-motion styles are present in stylesheet", async () => {
    const css = await Bun.file("src/style.css").text();
    expect(css.includes("prefers-reduced-motion")).toBe(true);
    expect(css.includes("[data-van-toast]")).toBe(true);
  });

  test("collapsed stack uses transform and height transitions", async () => {
    const css = await Bun.file("src/style.css").text();
    expect(css.includes("transform 420ms cubic-bezier(0.22, 1, 0.36, 1)")).toBe(true);
    expect(css.includes("height 420ms")).toBe(true);
    expect(css.includes("cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease")).toBe(true);
    expect(
      css.includes(
        '[data-van-toast][data-mounted="true"][data-expanded="false"][data-front="false"]',
      ),
    ).toBe(true);
  });
});
