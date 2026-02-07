import van from "vanjs-core";

import { Toaster, toast } from "../src/index";
import type { Position, ToasterProps } from "../src/types";

const { button, code, div, h1, h2, input, label, option, p, pre, section, select } = van.tags;

type DemoToastType =
  | "message"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading"
  | "promise"
  | "custom";
type DemoPosition = Position | "default";

const positions: Position[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function disposeExistingDemoToasters(): void {
  const nodes = document.querySelectorAll("[data-alt-demo-toaster]");
  for (const node of nodes) {
    const host = node as HTMLElement & { __vanToasterDispose__?: () => void };
    host.__vanToasterDispose__?.();
    host.remove();
  }
}

export function AltDemoApp(): HTMLElement {
  const mainPosition = van.state<DemoPosition>("default");
  const auditPosition = van.state<DemoPosition>("default");
  const mainTheme = van.state<NonNullable<ToasterProps["theme"]>>("light");
  const targetToaster = van.state<"default" | "audit">("default");
  const toastType = van.state<DemoToastType>("success");
  const duration = van.state(4000);
  const richColors = van.state(true);
  const closeButton = van.state(true);

  const mountToasters = () => {
    disposeExistingDemoToasters();

    const mainToaster = Toaster({
      theme: mainTheme.val,
      richColors: richColors.val,
      closeButton: closeButton.val,
      expand: true,
      visibleToasts: 5,
      containerAriaLabel: "Alt notifications",
      ...(mainPosition.val !== "default" ? { position: mainPosition.val } : {}),
    });
    mainToaster.setAttribute("data-alt-demo-toaster", "main");

    const auditToaster = Toaster({
      id: "audit",
      theme: "dark",
      closeButton: true,
      containerAriaLabel: "Audit notifications",
      ...(auditPosition.val !== "default" ? { position: auditPosition.val } : {}),
    });
    auditToaster.setAttribute("data-alt-demo-toaster", "audit");

    document.body.append(mainToaster, auditToaster);
  };

  const emitToast = () => {
    const data = {
      duration: duration.val,
      ...(targetToaster.val === "audit" ? { toasterId: "audit" } : {}),
    };

    switch (toastType.val) {
      case "message":
        toast("General notice", {
          ...data,
          description: "Default message toast",
        });
        return;
      case "success":
        toast.success("Build deployed", {
          ...data,
          description: "The production artifact is now live.",
          action: {
            label: "Acknowledge",
            onClick: () => undefined,
          },
        });
        return;
      case "info":
        toast.info("Pipeline update", {
          ...data,
          description: "Dependency scan queued.",
        });
        return;
      case "warning":
        toast.warning("Approaching quota", {
          ...data,
          description: "Artifact retention will be trimmed soon.",
        });
        return;
      case "error":
        toast.error("Deployment failed", {
          ...data,
          description: "Rollback required.",
          cancel: {
            label: "Dismiss",
            onClick: () => undefined,
          },
        });
        return;
      case "loading":
        toast.loading("Uploading release bundle", {
          ...data,
          description: "Processing 18 files",
        });
        return;
      case "promise":
        toast.promise(
          new Promise<string>((resolve) => setTimeout(() => resolve("artifact-v7"), 1200)),
          {
            ...data,
            loading: "Publishing package",
            success: (artifact) => `Published ${artifact}`,
            error: "Publish failed",
            description: "Release train #42",
          },
        );
        return;
      case "custom": {
        toast.custom(
          () => {
            const node = document.createElement("div");
            node.style.fontWeight = "700";
            node.textContent = "Custom node toast";
            return node;
          },
          {
            ...data,
            description: "Rendered from toast.custom callback",
          },
        );
        return;
      }
      default:
        return;
    }
  };

  van.derive(mountToasters);

  const controls = section(
    { class: "alt-controls" },
    h2("Options"),
    div(
      { class: "alt-grid" },
      label(
        "Main position",
        select(
          {
            value: mainPosition,
            oninput: (event: Event) => {
              mainPosition.val = (event.target as HTMLSelectElement).value as DemoPosition;
            },
          },
          option({ value: "default" }, "default (auto)"),
          ...positions.map((value) => option({ value }, value)),
        ),
      ),
      label(
        "Audit position",
        select(
          {
            value: auditPosition,
            oninput: (event: Event) => {
              auditPosition.val = (event.target as HTMLSelectElement).value as DemoPosition;
            },
          },
          option({ value: "default" }, "default (auto)"),
          ...positions.map((value) => option({ value }, value)),
        ),
      ),
      label(
        "Main theme",
        select(
          {
            value: mainTheme,
            oninput: (event: Event) => {
              mainTheme.val = (event.target as HTMLSelectElement).value as NonNullable<
                ToasterProps["theme"]
              >;
            },
          },
          option({ value: "light" }, "light"),
          option({ value: "dark" }, "dark"),
          option({ value: "system" }, "system"),
        ),
      ),
      label(
        "Target toaster",
        select(
          {
            value: targetToaster,
            oninput: (event: Event) => {
              targetToaster.val = (event.target as HTMLSelectElement).value as "default" | "audit";
            },
          },
          option({ value: "default" }, "default"),
          option({ value: "audit" }, "audit"),
        ),
      ),
      label(
        "Toast type",
        select(
          {
            value: toastType,
            oninput: (event: Event) => {
              toastType.val = (event.target as HTMLSelectElement).value as DemoToastType;
            },
          },
          option({ value: "message" }, "message"),
          option({ value: "success" }, "success"),
          option({ value: "info" }, "info"),
          option({ value: "warning" }, "warning"),
          option({ value: "error" }, "error"),
          option({ value: "loading" }, "loading"),
          option({ value: "promise" }, "promise"),
          option({ value: "custom" }, "custom"),
        ),
      ),
      label(
        "Duration (ms)",
        input({
          type: "number",
          min: "1000",
          max: "20000",
          step: "500",
          value: duration,
          oninput: (event: Event) => {
            duration.val = Number((event.target as HTMLInputElement).value);
          },
        }),
      ),
    ),
    div(
      { class: "alt-switches" },
      label(
        input({
          type: "checkbox",
          checked: richColors,
          onchange: (event: Event) => {
            richColors.val = (event.target as HTMLInputElement).checked;
          },
        }),
        " Rich colors",
      ),
      label(
        input({
          type: "checkbox",
          checked: closeButton,
          onchange: (event: Event) => {
            closeButton.val = (event.target as HTMLInputElement).checked;
          },
        }),
        " Close button",
      ),
    ),
  );

  const actions = div(
    { class: "alt-actions" },
    button({ onclick: emitToast }, "Trigger selected toast"),
    button(
      {
        onclick: () =>
          toast.message("Security scan queued", {
            toasterId: "audit",
            description: "Direct send to audit toaster",
            duration: duration.val,
          }),
      },
      "Send to audit",
    ),
    button({ onclick: () => toast.dismiss() }, "Dismiss all"),
  ) as HTMLDivElement;

  const usage = pre(
    code(`bun run dev
# open /
# open /alt-demo.html`),
  ) as HTMLPreElement;

  return div(
    { class: "alt-root" },
    h1("Van Toaster: Alternate Vite Demo"),
    p("Configurable Vite demo with live toaster positioning and selectable toast types."),
    controls,
    actions,
    usage,
  ) as HTMLDivElement;
}
