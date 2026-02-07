import {
  appendRenderable,
  applyStyle,
  assignOffset,
  clearChildren,
  cn,
  getDefaultSwipeDirections,
  getDocumentDirection,
} from "./dom";
import { createLoader, getCloseIcon, getDefaultIcon } from "./icons";
import { ToastState } from "./store";
import type {
  Action,
  Position,
  StyleObject,
  SwipeDirection,
  ToastClassnames,
  ToastIcons,
  ToastT,
  ToasterProps,
  VanRenderable,
} from "./types";

const VISIBLE_TOASTS_AMOUNT = 3;
const TOAST_LIFETIME = 4000;
const TOAST_WIDTH = 356;
const GAP = 14;
const SWIPE_THRESHOLD = 45;
const TIME_BEFORE_UNMOUNT = 200;

type Axis = "x" | "y";
type SwipeOutDirection = "left" | "right" | "up" | "down";

interface ToastViewUpdate {
  toast: ToastT;
  index: number;
  total: number;
  position: Position;
  offset: number;
  visibleToasts: number;
  expanded: boolean;
  interacting: boolean;
  frontToastHeight: number;
}

type ElementAttributes = Record<string, unknown>;

function setElementAttribute(element: HTMLElement, key: string, value: unknown): void {
  if (key === "class") {
    element.className = String(value);
    return;
  }

  if (key.startsWith("on") && typeof value === "function") {
    (element as unknown as Record<string, unknown>)[key] = value;
    return;
  }

  if (!key.includes("-") && key in element) {
    (element as unknown as Record<string, unknown>)[key] = value;
    return;
  }

  element.setAttribute(key, String(value));
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes?: ElementAttributes,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (!attributes) {
    return element;
  }

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) {
      continue;
    }

    setElementAttribute(element, key, value);
  }

  return element;
}

function isAction(action: Action | VanRenderable | undefined): action is Action {
  return Boolean(action && typeof action === "object" && "label" in action && "onClick" in action);
}

function splitPosition(position: Position): [string, string] {
  const [y = "bottom", x = "right"] = position.split("-");
  return [y, x];
}

function getTargetElement(target: EventTarget | null): Element | null {
  if (!target || typeof target !== "object") {
    return null;
  }

  const candidate = target as { nodeType?: number };
  return candidate.nodeType === 1 ? (target as Element) : null;
}

class ToasterInstance {
  readonly section: HTMLElement;

  readonly props: Required<
    Pick<
      ToasterProps,
      "position" | "hotkey" | "theme" | "visibleToasts" | "gap" | "containerAriaLabel" | "dir"
    >
  > &
    ToasterProps;

  private toasts: ToastT[] = [];
  private views = new Map<string, ToastView>();
  private lists = new Map<Position, HTMLOListElement>();
  private expanded = false;
  private interacting = false;
  private hovering = false;
  private hoveredLists = new Set<HTMLOListElement>();
  private isSyncing = false;
  private syncQueued = false;
  private actualTheme: "light" | "dark";
  private isDocumentHidden = false;
  private lastFocusedElement: Element | null = null;
  private isFocusWithin = false;
  private mediaQuery: MediaQueryList | null = null;
  private readonly unsubscribe: () => void;
  private readonly onVisibilityChange = () => {
    this.isDocumentHidden = typeof document !== "undefined" ? document.hidden : false;
    this.sync();
  };
  private readonly onKeyDown = (event: KeyboardEvent) => {
    const isHotkeyPressed = this.props.hotkey.every((key) => {
      const value = (event as unknown as Record<string, unknown>)[key];
      if (typeof value === "boolean") {
        return value;
      }
      return event.code === key;
    });

    if (isHotkeyPressed) {
      const firstList = this.lists.values().next().value as HTMLOListElement | undefined;
      firstList?.focus();
      return;
    }

    if (event.code !== "Escape") {
      return;
    }

    for (const list of this.lists.values()) {
      if (document.activeElement === list || list.contains(document.activeElement)) {
        this.setExpanded(false);
        return;
      }
    }
  };

  constructor(rawProps: ToasterProps = {}) {
    const defaultPosition = this.getDefaultPosition();
    this.props = {
      hotkey: ["altKey", "KeyT"],
      theme: "light",
      visibleToasts: VISIBLE_TOASTS_AMOUNT,
      gap: GAP,
      containerAriaLabel: "Notifications",
      dir: "auto",
      ...rawProps,
      position: rawProps.position ?? defaultPosition,
    };

    this.actualTheme = this.resolveTheme(this.props.theme);

    this.section = createElement("section", {
      tabIndex: -1,
      "aria-live": "polite",
      "aria-relevant": "additions text",
      "aria-atomic": "false",
      "aria-label": `${this.props.containerAriaLabel} ${this.props.hotkey
        .join("+")
        .replaceAll("Key", "")
        .replaceAll("Digit", "")}`,
    });

    this.unsubscribe = ToastState.subscribe((toast) => {
      if ("dismiss" in toast) {
        requestAnimationFrame(() => {
          this.toasts = this.toasts.map((item) =>
            item.id === toast.id
              ? {
                  ...item,
                  delete: true,
                }
              : item,
          );
          this.sync();
        });
        return;
      }

      const shouldHandle = this.props.id
        ? toast.toasterId === this.props.id
        : toast.toasterId === undefined;

      if (!shouldHandle) {
        return;
      }

      const existingIndex = this.toasts.findIndex((item) => item.id === toast.id);
      if (existingIndex >= 0) {
        const current = this.toasts[existingIndex];
        if (!current) {
          return;
        }

        this.toasts.splice(existingIndex, 1, {
          ...current,
          ...toast,
        });
      } else {
        this.toasts.unshift(toast);
      }

      this.sync();
    });

    if (typeof document !== "undefined") {
      this.isDocumentHidden = document.hidden;
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      document.addEventListener("keydown", this.onKeyDown);
    }

    this.setupThemeListener();
    this.sync();
  }

  private getDefaultPosition(): Position {
    if (typeof window !== "undefined" && window.matchMedia) {
      const isMobile = window.matchMedia("(max-width: 600px)").matches;
      if (isMobile) {
        return "top-center";
      }
    }

    return "top-right";
  }

  getEffectiveDuration(toast: ToastT): number {
    return (
      toast.duration ?? this.props.toastOptions?.duration ?? this.props.duration ?? TOAST_LIFETIME
    );
  }

  getEffectiveCloseButton(toast: ToastT): boolean {
    return (
      toast.closeButton ?? this.props.toastOptions?.closeButton ?? this.props.closeButton ?? false
    );
  }

  getEffectiveClassNames(toast: ToastT): ToastClassnames | undefined {
    const defaults = this.props.toastOptions?.classNames;
    if (!defaults && !toast.classNames) {
      return undefined;
    }
    return {
      ...defaults,
      ...toast.classNames,
    };
  }

  getEffectiveIcons(): ToastIcons | undefined {
    return this.props.icons;
  }

  getEffectiveUnstyled(toast: ToastT): boolean {
    return Boolean(toast.unstyled ?? this.props.toastOptions?.unstyled);
  }

  getEffectiveStyle(toast: ToastT): StyleObject | undefined {
    return {
      ...this.props.toastOptions?.style,
      ...toast.style,
    };
  }

  getEffectiveClassName(toast: ToastT): string {
    return cn(this.props.toastOptions?.className, toast.className);
  }

  getEffectiveDescriptionClassName(toast: ToastT): string {
    return cn(this.props.toastOptions?.descriptionClassName, toast.descriptionClassName);
  }

  getEffectiveCancelButtonStyle(toast: ToastT): StyleObject | undefined {
    return toast.cancelButtonStyle ?? this.props.toastOptions?.cancelButtonStyle;
  }

  getEffectiveActionButtonStyle(toast: ToastT): StyleObject | undefined {
    return toast.actionButtonStyle ?? this.props.toastOptions?.actionButtonStyle;
  }

  getEffectiveCloseButtonAriaLabel(): string {
    return this.props.toastOptions?.closeButtonAriaLabel ?? "Close toast";
  }

  getEffectiveRichColors(toast: ToastT): boolean {
    return toast.richColors ?? this.props.richColors ?? false;
  }

  getEffectiveInvert(toast: ToastT): boolean {
    return toast.invert ?? this.props.invert ?? false;
  }

  getEffectiveSwipeDirections(position: Position): SwipeDirection[] {
    return this.props.swipeDirections ?? getDefaultSwipeDirections(position);
  }

  isPaused(): boolean {
    return this.expanded || this.interacting || this.hovering || this.isDocumentHidden;
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  getVisibleToasts(): number {
    return this.props.visibleToasts;
  }

  removeToast(toastToRemove: ToastT): void {
    const found = this.toasts.find((toast) => toast.id === toastToRemove.id);
    this.toasts = this.toasts.filter((toast) => toast.id !== toastToRemove.id);
    if (found && !found.delete) {
      ToastState.dismiss(toastToRemove.id);
    }
    this.sync();
  }

  setExpanded(expanded: boolean): void {
    const nextExpanded = this.toasts.length <= 1 ? false : expanded;

    if (this.expanded === nextExpanded) {
      return;
    }

    this.expanded = nextExpanded;
    this.sync();
  }

  setInteracting(interacting: boolean): void {
    if (this.interacting === interacting) {
      return;
    }

    this.interacting = interacting;
    this.sync();
  }

  private setListHoverState(list: HTMLOListElement, hovering: boolean): void {
    if (hovering) {
      this.hoveredLists.add(list);
    } else {
      this.hoveredLists.delete(list);
    }

    const nextHovering = this.hoveredLists.size > 0;
    if (this.hovering === nextHovering) {
      return;
    }

    this.hovering = nextHovering;
    this.sync();
  }

  updateHeight(id: string, height: number): void {
    const view = this.views.get(id);
    if (!view) {
      return;
    }

    if (view.height !== height) {
      view.height = height;
      this.sync();
    }
  }

  sync(): void {
    if (this.isSyncing) {
      this.syncQueued = true;
      return;
    }

    this.isSyncing = true;
    try {
      this.syncQueued = true;
      while (this.syncQueued) {
        this.syncQueued = false;
        this.syncOnce();
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private syncOnce(): void {
    const positions = Array.from(
      new Set<Position>([
        this.props.position,
        ...this.toasts
          .map((toast) => toast.position)
          .filter((position): position is Position => position !== undefined),
      ]),
    );

    const activeViewKeys = new Set<string>();

    for (const position of positions) {
      const positionToasts = this.toasts.filter((toast) =>
        toast.position ? toast.position === position : position === this.props.position,
      );

      if (positionToasts.length === 0) {
        const existingList = this.lists.get(position);
        if (existingList) {
          this.setListHoverState(existingList, false);
        }
        existingList?.remove();
        this.lists.delete(position);
        continue;
      }

      const list = this.ensureList(position);
      this.updateListAttributes(list, position, positionToasts);

      let offsetAccumulator = 0;
      let stackExtent = 0;
      const frontToastKey = positionToasts[0]
        ? `${position}:${String(positionToasts[0].id)}`
        : null;
      const frontToastHeight = frontToastKey ? this.getViewHeight(frontToastKey) : 0;
      for (let index = 0; index < positionToasts.length; index += 1) {
        const toast = positionToasts[index];
        if (!toast) {
          continue;
        }

        const key = `${position}:${String(toast.id)}`;
        activeViewKeys.add(key);

        let view = this.views.get(key);
        if (!view) {
          view = new ToastView(this, list, toast, position);
          this.views.set(key, view);
        } else {
          view.setList(list, position);
        }

        const offset = index * this.props.gap + offsetAccumulator;
        view.update({
          toast,
          index,
          total: positionToasts.length,
          position,
          offset,
          visibleToasts: this.props.visibleToasts,
          expanded: this.expanded,
          interacting: this.interacting,
          frontToastHeight,
        });

        stackExtent = Math.max(stackExtent, offset + view.height);
        offsetAccumulator += view.height;

        const expectedChild = list.children.item(index);
        if (expectedChild !== view.element) {
          list.insertBefore(view.element, expectedChild ?? null);
        }
      }

      const visibleCount = Math.min(this.props.visibleToasts, positionToasts.length);
      const collapsedExtent = frontToastHeight + Math.max(0, visibleCount - 1) * this.props.gap;
      const expandedExtent = Math.max(frontToastHeight, stackExtent);
      const hitAreaHeight = this.expanded ? expandedExtent : collapsedExtent;
      list.style.setProperty("--stack-height", `${Math.max(1, hitAreaHeight)}px`);
    }

    for (const [key, view] of this.views.entries()) {
      if (!activeViewKeys.has(key)) {
        view.destroy();
        this.views.delete(key);
      }
    }
  }

  destroy(): void {
    this.unsubscribe();
    for (const view of this.views.values()) {
      view.destroy();
    }
    this.views.clear();
    for (const list of this.lists.values()) {
      this.setListHoverState(list, false);
      list.remove();
    }
    this.lists.clear();

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      document.removeEventListener("keydown", this.onKeyDown);
    }

    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener("change", this.onThemeMediaChange);
      this.mediaQuery = null;
    }
  }

  private getViewHeight(key: string): number {
    return this.views.get(key)?.height ?? 0;
  }

  private ensureList(position: Position): HTMLOListElement {
    const existing = this.lists.get(position);
    if (existing) {
      return existing;
    }

    const list = createElement("ol", { tabIndex: -1 });

    list.addEventListener("mouseenter", () => {
      this.setListHoverState(list, true);
      this.setExpanded(true);
    });
    list.addEventListener("mousemove", () => {
      this.setListHoverState(list, true);
      this.setExpanded(true);
    });
    list.addEventListener("mouseleave", () => {
      this.setListHoverState(list, false);
      if (!this.interacting) {
        this.setExpanded(false);
      }
    });
    list.addEventListener("dragend", () => {
      this.setListHoverState(list, false);
      this.setExpanded(false);
    });

    list.addEventListener("pointerdown", (event) => {
      const target = getTargetElement(event.target);
      const toastElement = target?.closest("[data-van-toast]") as HTMLElement | null;
      if (toastElement?.dataset.dismissible === "false") {
        return;
      }
      if (target?.closest("button")) {
        return;
      }
      this.setInteracting(true);
      if (this.shouldExpandForPointerEvent(event)) {
        this.setExpanded(true);
      }
    });

    list.addEventListener("pointerup", (event) => {
      this.setInteracting(false);
      if (this.shouldExpandForPointerEvent(event)) {
        this.setExpanded(false);
      }
    });
    list.addEventListener("pointercancel", (event) => {
      this.setInteracting(false);
      if (this.shouldExpandForPointerEvent(event)) {
        this.setExpanded(false);
      }
    });

    list.addEventListener("focus", (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.dismissible === "false") {
        return;
      }
      if (!this.isFocusWithin) {
        this.isFocusWithin = true;
        this.lastFocusedElement = event.relatedTarget as Element | null;
      }
    });

    list.addEventListener("blur", (event) => {
      if (this.isFocusWithin && !list.contains(event.relatedTarget as Node | null)) {
        this.isFocusWithin = false;
        if (this.lastFocusedElement instanceof HTMLElement) {
          this.lastFocusedElement.focus({ preventScroll: true });
          this.lastFocusedElement = null;
        }
      }
    });

    this.lists.set(position, list);
    this.section.append(list);

    return list;
  }

  private updateListAttributes(list: HTMLOListElement, position: Position, toasts: ToastT[]): void {
    const [y, x] = splitPosition(position);

    list.setAttribute(
      "dir",
      this.props.dir === "auto" ? getDocumentDirection() : (this.props.dir ?? "ltr"),
    );
    list.setAttribute("data-van-toaster", "true");
    list.setAttribute("data-van-theme", this.actualTheme);
    list.setAttribute("data-y-position", y);
    list.setAttribute("data-x-position", x);
    list.className = this.props.className ?? "";

    list.style.setProperty(
      "--front-toast-height",
      `${toasts[0] ? this.measureToastHeight(toasts[0], position) : 0}px`,
    );
    list.style.setProperty("--width", `${TOAST_WIDTH}px`);
    list.style.setProperty("--gap", `${this.props.gap}px`);

    const offsetStyles = assignOffset(this.props.offset, this.props.mobileOffset);
    applyStyle(list, {
      ...this.props.style,
      ...offsetStyles,
    });
  }

  private measureToastHeight(toast: ToastT, position: Position): number {
    const key = `${position}:${String(toast.id)}`;
    return this.getViewHeight(key);
  }

  private resolveTheme(theme: ToasterProps["theme"]): "light" | "dark" {
    if (theme !== "system") {
      return theme ?? "light";
    }

    if (typeof window === "undefined" || !window.matchMedia) {
      return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private readonly onThemeMediaChange = (event: MediaQueryListEvent) => {
    this.actualTheme = event.matches ? "dark" : "light";
    this.sync();
  };

  private setupThemeListener(): void {
    if (this.props.theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", this.onThemeMediaChange);
  }

  private shouldExpandForPointerEvent(event: Event): boolean {
    const pointerType = (event as PointerEvent).pointerType;
    if (pointerType === "touch") {
      return true;
    }
    if (pointerType === "mouse") {
      return false;
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    }
    return false;
  }
}

class ToastView {
  readonly element: HTMLLIElement;

  height = 0;

  private toast: ToastT;
  private list: HTMLOListElement;
  private position: Position;
  private mounted = false;
  private removed = false;
  private swiping = false;
  private swipeOut = false;
  private isSwiped = false;
  private swipeDirection: Axis | null = null;
  private swipeOutDirection: SwipeOutDirection | null = null;
  private pointerStart: { x: number; y: number } | null = null;
  private dragStartTime = 0;
  private offsetBeforeRemove = 0;
  private currentOffset = 0;
  private autoCloseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private removeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private duration = TOAST_LIFETIME;
  private remainingTime = TOAST_LIFETIME;
  private closeTimerStartTime = 0;
  private isDestroyed = false;
  private latestUpdate: ToastViewUpdate | null = null;
  private renderedToastRef: ToastT | null = null;

  constructor(
    private readonly instance: ToasterInstance,
    list: HTMLOListElement,
    toast: ToastT,
    position: Position,
  ) {
    this.list = list;
    this.toast = toast;
    this.position = position;
    this.element = createElement("li", { tabIndex: 0 });

    this.bindPointerEvents();

    requestAnimationFrame(() => {
      if (this.isDestroyed) {
        return;
      }
      this.mounted = true;
      this.applyStateData(this.latestUpdate ?? undefined);
      this.measureHeight();
    });
  }

  setList(list: HTMLOListElement, position: Position): void {
    this.list = list;
    this.position = position;
  }

  update(input: ToastViewUpdate): void {
    this.latestUpdate = input;
    this.toast = input.toast;
    this.position = input.position;
    this.currentOffset = input.offset;

    if (this.toast.delete && !this.removed) {
      this.remove();
      return;
    }

    this.duration = this.instance.getEffectiveDuration(this.toast);
    if (this.remainingTime > this.duration || this.remainingTime === TOAST_LIFETIME) {
      this.remainingTime = this.duration;
    }

    if (this.renderedToastRef !== this.toast) {
      this.renderContent();
      this.renderedToastRef = this.toast;
    }
    this.applyStateData(input);
    this.syncTimer(input.expanded || input.interacting || this.instance.isPaused());
    this.measureHeight();
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.autoCloseTimeoutId !== null) {
      clearTimeout(this.autoCloseTimeoutId);
      this.autoCloseTimeoutId = null;
    }
    if (this.removeTimeoutId !== null) {
      clearTimeout(this.removeTimeoutId);
      this.removeTimeoutId = null;
    }
    this.element.remove();
  }

  private bindPointerEvents(): void {
    this.element.addEventListener("dragend", () => {
      this.swiping = false;
      this.swipeDirection = null;
      this.pointerStart = null;
      this.applyStateData();
    });

    this.element.addEventListener("pointerdown", (event) => {
      if (event.button === 2) {
        return;
      }

      if (!this.isDismissible() || this.isDisabled()) {
        return;
      }

      const target = getTargetElement(event.target);
      if (target?.closest("button")) {
        return;
      }

      if (!target) {
        return;
      }

      this.dragStartTime = Date.now();
      this.offsetBeforeRemove = this.currentOffset;
      target.setPointerCapture(event.pointerId);

      this.swiping = true;
      this.pointerStart = { x: event.clientX, y: event.clientY };
      this.applyStateData();
    });

    this.element.addEventListener("pointerup", () => {
      if (!this.isDismissible() || this.swipeOut) {
        return;
      }

      this.pointerStart = null;

      const swipeAmountX = Number(
        this.element.style.getPropertyValue("--swipe-amount-x").replace("px", "") || 0,
      );
      const swipeAmountY = Number(
        this.element.style.getPropertyValue("--swipe-amount-y").replace("px", "") || 0,
      );
      const timeTaken = Math.max(1, Date.now() - this.dragStartTime);
      const swipeAmount = this.swipeDirection === "x" ? swipeAmountX : swipeAmountY;
      const velocity = Math.abs(swipeAmount) / timeTaken;

      if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
        this.offsetBeforeRemove = this.currentOffset;
        this.toast.onDismiss?.(this.toast);

        if (this.swipeDirection === "x") {
          this.swipeOutDirection = swipeAmountX > 0 ? "right" : "left";
        } else {
          this.swipeOutDirection = swipeAmountY > 0 ? "down" : "up";
        }

        this.swipeOut = true;
        this.remove();
        return;
      }

      this.element.style.setProperty("--swipe-amount-x", "0px");
      this.element.style.setProperty("--swipe-amount-y", "0px");

      this.isSwiped = false;
      this.swiping = false;
      this.swipeDirection = null;
      this.applyStateData();
    });

    this.element.addEventListener("pointercancel", () => {
      this.pointerStart = null;
      this.swiping = false;
      this.swipeDirection = null;
      this.element.style.setProperty("--swipe-amount-x", "0px");
      this.element.style.setProperty("--swipe-amount-y", "0px");
      this.applyStateData();
    });

    this.element.addEventListener("pointermove", (event) => {
      if (!this.pointerStart || !this.isDismissible()) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }

      const yDelta = event.clientY - this.pointerStart.y;
      const xDelta = event.clientX - this.pointerStart.x;
      const swipeDirections = this.instance.getEffectiveSwipeDirections(this.position);

      if (!this.swipeDirection && (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)) {
        this.swipeDirection = Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y";
      }

      const swipeAmount = { x: 0, y: 0 };
      const getDampening = (delta: number) => {
        const factor = Math.abs(delta) / 20;
        return 1 / (1.5 + factor);
      };

      if (this.swipeDirection === "y") {
        if (swipeDirections.includes("top") || swipeDirections.includes("bottom")) {
          if (
            (swipeDirections.includes("top") && yDelta < 0) ||
            (swipeDirections.includes("bottom") && yDelta > 0)
          ) {
            swipeAmount.y = yDelta;
          } else {
            const dampenedDelta = yDelta * getDampening(yDelta);
            swipeAmount.y = Math.abs(dampenedDelta) < Math.abs(yDelta) ? dampenedDelta : yDelta;
          }
        }
      } else if (this.swipeDirection === "x") {
        if (swipeDirections.includes("left") || swipeDirections.includes("right")) {
          if (
            (swipeDirections.includes("left") && xDelta < 0) ||
            (swipeDirections.includes("right") && xDelta > 0)
          ) {
            swipeAmount.x = xDelta;
          } else {
            const dampenedDelta = xDelta * getDampening(xDelta);
            swipeAmount.x = Math.abs(dampenedDelta) < Math.abs(xDelta) ? dampenedDelta : xDelta;
          }
        }
      }

      if (Math.abs(swipeAmount.x) > 0 || Math.abs(swipeAmount.y) > 0) {
        this.isSwiped = true;
      }

      this.element.style.setProperty("--swipe-amount-x", `${swipeAmount.x}px`);
      this.element.style.setProperty("--swipe-amount-y", `${swipeAmount.y}px`);
      this.applyStateData();
    });
  }

  private syncTimer(paused: boolean): void {
    if (this.removed) {
      this.clearTimer();
      return;
    }

    const toastType = this.toast.type;
    const shouldDisableTimer =
      (Boolean(this.toast.promise) && toastType === "loading") ||
      this.duration === Number.POSITIVE_INFINITY ||
      toastType === "loading";

    if (shouldDisableTimer) {
      this.clearTimer();
      return;
    }

    if (paused) {
      this.pauseTimer();
      return;
    }

    this.startTimer();
  }

  private startTimer(): void {
    if (this.autoCloseTimeoutId !== null) {
      return;
    }

    if (this.remainingTime === Number.POSITIVE_INFINITY) {
      return;
    }

    this.closeTimerStartTime = Date.now();
    this.autoCloseTimeoutId = setTimeout(() => {
      this.toast.onAutoClose?.(this.toast);
      this.remove();
    }, this.remainingTime);
  }

  private pauseTimer(): void {
    if (this.autoCloseTimeoutId === null) {
      return;
    }

    const elapsed = Date.now() - this.closeTimerStartTime;
    this.remainingTime = Math.max(0, this.remainingTime - elapsed);
    clearTimeout(this.autoCloseTimeoutId);
    this.autoCloseTimeoutId = null;
  }

  private clearTimer(): void {
    if (this.autoCloseTimeoutId !== null) {
      clearTimeout(this.autoCloseTimeoutId);
      this.autoCloseTimeoutId = null;
    }
  }

  private remove(): void {
    if (this.removed) {
      return;
    }

    this.removed = true;
    this.offsetBeforeRemove = this.currentOffset;
    this.applyStateData();
    this.clearTimer();

    if (this.removeTimeoutId !== null) {
      clearTimeout(this.removeTimeoutId);
    }

    this.removeTimeoutId = setTimeout(() => {
      this.instance.removeToast(this.toast);
    }, TIME_BEFORE_UNMOUNT);
  }

  private measureHeight(): void {
    const hadInlineHeight = this.element.style.height.length > 0;
    const previousInlineHeight = this.element.style.height;

    // Measure natural content height while preserving visual transform transitions.
    this.element.style.height = "auto";
    let height = this.element.offsetHeight;
    if (height <= 0) {
      height = this.element.scrollHeight;
    }
    if (height <= 0) {
      height = this.element.getBoundingClientRect().height;
    }

    if (hadInlineHeight) {
      this.element.style.height = previousInlineHeight;
    } else {
      this.element.style.removeProperty("height");
    }

    if (height > 0 && this.height !== height) {
      this.instance.updateHeight(`${this.position}:${String(this.toast.id)}`, height);
    }
  }

  private applyStateData(input?: ToastViewUpdate): void {
    const resolvedInput = input ?? this.latestUpdate ?? undefined;
    const [y, x] = splitPosition(this.position);
    const index = resolvedInput?.index ?? Number(this.element.dataset.index || 0);
    const inferredTotal = Number(this.element.style.getPropertyValue("--z-index")) + index;
    const total = resolvedInput?.total ?? (Number.isFinite(inferredTotal) ? inferredTotal : 1);
    const isFront = index === 0;
    const isVisible =
      index + 1 <= (resolvedInput?.visibleToasts ?? this.instance.getVisibleToasts());
    const expanded = Boolean(resolvedInput?.expanded ?? this.instance.isExpanded());
    const styled = !(this.toast.jsx || this.instance.getEffectiveUnstyled(this.toast));

    const classNames = this.instance.getEffectiveClassNames(this.toast);
    const typeClassName = this.toast.type
      ? (classNames as Partial<Record<string, string | undefined>>)?.[this.toast.type]
      : undefined;

    this.element.className = cn(
      this.instance.getEffectiveClassName(this.toast),
      classNames?.toast,
      classNames?.default,
      typeClassName,
    );

    this.element.setAttribute("data-van-toast", "");
    this.element.setAttribute(
      "data-rich-colors",
      String(this.instance.getEffectiveRichColors(this.toast)),
    );
    this.element.setAttribute("data-styled", String(styled));
    this.element.setAttribute("data-mounted", String(this.mounted));
    this.element.setAttribute("data-promise", String(Boolean(this.toast.promise)));
    this.element.setAttribute("data-swiped", String(this.isSwiped));
    this.element.setAttribute("data-removed", String(this.removed));
    this.element.setAttribute("data-visible", String(isVisible));
    this.element.setAttribute("data-y-position", y);
    this.element.setAttribute("data-x-position", x);
    this.element.setAttribute("data-index", String(index));
    this.element.setAttribute("data-front", String(isFront));
    this.element.setAttribute("data-swiping", String(this.swiping));
    this.element.setAttribute("data-dismissible", String(this.isDismissible()));
    this.element.setAttribute("data-type", this.toast.type ?? "default");
    this.element.setAttribute("data-invert", String(this.instance.getEffectiveInvert(this.toast)));
    this.element.setAttribute("data-swipe-out", String(this.swipeOut));
    this.element.setAttribute("data-expanded", String(expanded));

    if (this.swipeOutDirection) {
      this.element.setAttribute("data-swipe-direction", this.swipeOutDirection);
    } else {
      this.element.removeAttribute("data-swipe-direction");
    }

    if (this.toast.testId) {
      this.element.setAttribute("data-testid", this.toast.testId);
    } else {
      this.element.removeAttribute("data-testid");
    }

    this.element.style.setProperty("--index", String(index));
    this.element.style.setProperty("--toasts-before", String(index));
    this.element.style.setProperty("--z-index", String(total - index));
    this.element.style.zIndex = String(total - index);
    this.element.style.setProperty(
      "--offset",
      `${this.removed ? this.offsetBeforeRemove : this.currentOffset}px`,
    );
    this.element.style.setProperty("--initial-height", `${this.height}px`);

    applyStyle(this.element, this.instance.getEffectiveStyle(this.toast));

    const swipeAmountX = this.element.style.getPropertyValue("--swipe-amount-x");
    const swipeAmountY = this.element.style.getPropertyValue("--swipe-amount-y");
    if (!swipeAmountX) {
      this.element.style.setProperty("--swipe-amount-x", "0px");
    }
    if (!swipeAmountY) {
      this.element.style.setProperty("--swipe-amount-y", "0px");
    }
  }

  private renderContent(): void {
    clearChildren(this.element);

    const toastType = this.toast.type ?? "default";
    const dismissible = this.isDismissible();
    const disabled = this.isDisabled();
    const closeButton = this.instance.getEffectiveCloseButton(this.toast);
    const classNames = this.instance.getEffectiveClassNames(this.toast);
    const icons = this.instance.getEffectiveIcons();
    const iconMap = icons as Partial<Record<string, VanRenderable>> | undefined;

    if (closeButton && !this.toast.jsx && toastType !== "loading") {
      const close = createElement("button", {
        type: "button",
        "aria-label": this.instance.getEffectiveCloseButtonAriaLabel(),
        "data-disabled": String(disabled),
        "data-close-button": "true",
        class: classNames?.closeButton ?? "",
        onclick: () => {
          if (disabled || !dismissible) {
            return;
          }
          this.toast.onDismiss?.(this.toast);
          this.remove();
        },
      });

      appendRenderable(close, getCloseIcon(icons));
      this.element.append(close);
    }

    const icon =
      this.toast.icon ??
      (toastType ? iconMap?.[toastType] : undefined) ??
      getDefaultIcon(toastType);
    const shouldShowIcon =
      (Boolean(toastType) || Boolean(this.toast.icon) || Boolean(this.toast.promise)) &&
      this.toast.icon !== null &&
      ((toastType ? iconMap?.[toastType] : undefined) !== null ||
        this.toast.icon !== undefined ||
        icon !== null);

    if (shouldShowIcon) {
      const iconContainer = createElement("div", {
        "data-icon": "",
        class: classNames?.icon ?? "",
      });

      if (this.toast.promise || (this.toast.type === "loading" && !this.toast.icon)) {
        if (icons?.loading) {
          const loader = createElement("div", {
            class: cn(classNames?.loader, "van-loader"),
            "data-visible": String(toastType === "loading"),
          });
          appendRenderable(loader, icons.loading);
          iconContainer.append(loader);
        } else {
          const loader = createLoader(toastType === "loading");
          loader.className = cn(loader.className, classNames?.loader);
          iconContainer.append(loader);
        }
      }

      if (toastType !== "loading" && icon) {
        appendRenderable(iconContainer, icon);
      }

      this.element.append(iconContainer);
    }

    const content = createElement("div", {
      "data-content": "",
      class: classNames?.content ?? "",
    });

    const title = createElement("div", {
      "data-title": "",
      class: classNames?.title ?? "",
    });

    if (this.toast.jsx) {
      appendRenderable(title, this.toast.jsx);
    } else if (typeof this.toast.title === "function") {
      appendRenderable(title, this.toast.title());
    } else if (this.toast.title !== undefined) {
      appendRenderable(title, this.toast.title);
    }

    content.append(title);

    if (this.toast.description !== undefined) {
      const description = createElement("div", {
        "data-description": "",
        class: cn(
          this.instance.getEffectiveDescriptionClassName(this.toast),
          classNames?.description,
        ),
      });

      if (typeof this.toast.description === "function") {
        appendRenderable(description, this.toast.description());
      } else {
        appendRenderable(description, this.toast.description);
      }

      content.append(description);
    }

    this.element.append(content);

    if (isAction(this.toast.cancel)) {
      const cancelButton = createElement("button", {
        type: "button",
        "data-button": "true",
        "data-cancel": "true",
        class: classNames?.cancelButton ?? "",
        onclick: (event: MouseEvent) => {
          const cancelAction = this.toast.cancel;
          if (!dismissible) {
            return;
          }
          if (isAction(cancelAction)) {
            cancelAction.onClick(event);
          }
          this.remove();
        },
      });

      applyStyle(cancelButton, this.instance.getEffectiveCancelButtonStyle(this.toast));
      appendRenderable(cancelButton, this.toast.cancel.label);
      this.element.append(cancelButton);
    } else if (this.toast.cancel) {
      appendRenderable(this.element, this.toast.cancel);
    }

    if (isAction(this.toast.action)) {
      const actionButton = createElement("button", {
        type: "button",
        "data-button": "true",
        "data-action": "true",
        class: classNames?.actionButton ?? "",
        onclick: (event: MouseEvent) => {
          const action = this.toast.action;
          if (isAction(action)) {
            action.onClick(event);
          }
          if (event.defaultPrevented) {
            return;
          }
          this.remove();
        },
      });

      applyStyle(actionButton, this.instance.getEffectiveActionButtonStyle(this.toast));
      appendRenderable(actionButton, this.toast.action.label);
      this.element.append(actionButton);
    } else if (this.toast.action) {
      appendRenderable(this.element, this.toast.action);
    }
  }

  private isDismissible(): boolean {
    return this.toast.dismissible !== false;
  }

  private isDisabled(): boolean {
    return this.toast.type === "loading";
  }
}

export function Toaster(props: ToasterProps = {}): HTMLElement {
  const instance = new ToasterInstance(props);
  const host = instance.section as HTMLElement & { __vanToasterDispose__?: () => void };
  host.__vanToasterDispose__ = () => instance.destroy();
  return host;
}
