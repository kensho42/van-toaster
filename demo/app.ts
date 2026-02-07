import van from "vanjs-core";

import { Toaster, toast } from "../src/index";
import type { Position, ToasterProps } from "../src/types";

const { a, button, code, div, h1, h2, input, label, option, p, pre, section, select } = van.tags;

export function DemoApp(): HTMLElement {
  const position = van.state<Position>("bottom-right");
  const theme = van.state<NonNullable<ToasterProps["theme"]>>("light");
  const duration = van.state(4000);
  const visibleToasts = van.state(3);
  const richColors = van.state(false);
  const expand = van.state(false);
  const closeButton = van.state(false);
  const toasterId = van.state("secondary");

  const secondaryToaster = Toaster({
    id: toasterId.val,
    position: "top-left",
    closeButton: true,
    richColors: true,
    containerAriaLabel: "Secondary notifications",
  });

  const controls = section(
    { class: "demo-controls" },
    h2("Controls"),
    div(
      label(
        "Position",
        select(
          {
            value: position,
            oninput: (event: Event) => {
              position.val = (event.target as HTMLSelectElement).value as Position;
            },
          },
          option({ value: "bottom-right" }, "bottom-right"),
          option({ value: "bottom-left" }, "bottom-left"),
          option({ value: "top-right" }, "top-right"),
          option({ value: "top-left" }, "top-left"),
          option({ value: "top-center" }, "top-center"),
          option({ value: "bottom-center" }, "bottom-center"),
        ),
      ),
    ),
    div(
      label(
        "Theme",
        select(
          {
            value: theme,
            oninput: (event: Event) => {
              theme.val = (event.target as HTMLSelectElement).value as NonNullable<
                ToasterProps["theme"]
              >;
            },
          },
          option({ value: "light" }, "light"),
          option({ value: "dark" }, "dark"),
          option({ value: "system" }, "system"),
        ),
      ),
    ),
    div(
      label(
        "Duration (ms)",
        input({
          type: "number",
          min: "1000",
          max: "10000",
          step: "500",
          value: duration,
          oninput: (event: Event) => {
            duration.val = Number((event.target as HTMLInputElement).value);
          },
        }),
      ),
    ),
    div(
      label(
        "Visible toasts",
        input({
          type: "number",
          min: "1",
          max: "8",
          value: visibleToasts,
          oninput: (event: Event) => {
            visibleToasts.val = Number((event.target as HTMLInputElement).value);
          },
        }),
      ),
    ),
    div(
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
    ),
    div(
      label(
        input({
          type: "checkbox",
          checked: expand,
          onchange: (event: Event) => {
            expand.val = (event.target as HTMLInputElement).checked;
          },
        }),
        " Expand by default",
      ),
    ),
    div(
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
  ) as HTMLElement;

  const actions = section(
    { class: "demo-actions" },
    h2("Toast methods"),
    div(
      button(
        {
          onclick: () =>
            toast("A normal message", {
              duration: duration.val,
            }),
        },
        "toast()",
      ),
      button({ onclick: () => toast.success("Saved successfully") }, "success"),
      button({ onclick: () => toast.info("Heads up") }, "info"),
      button({ onclick: () => toast.warning("Something looks risky") }, "warning"),
      button({ onclick: () => toast.error("Failed to save") }, "error"),
      button({ onclick: () => toast.loading("Uploading...") }, "loading"),
      button(
        {
          onclick: () => {
            toast.promise(
              new Promise<string>((resolve) => {
                setTimeout(() => resolve("done"), 1200);
              }),
              {
                loading: "Saving",
                success: (value) => `Saved: ${value}`,
                error: "Failed",
              },
            );
          },
        },
        "promise",
      ),
      button(
        {
          onclick: () => {
            toast.custom(
              () => {
                const node = document.createElement("strong");
                node.textContent = "Custom DOM node content";
                return node;
              },
              { description: "Rendered from custom callback" },
            );
          },
        },
        "custom",
      ),
      button({ onclick: () => toast.dismiss() }, "dismiss all"),
    ),
  ) as HTMLElement;

  const secondaryActions = section(
    { class: "demo-actions" },
    h2("Multiple toaster IDs"),
    p("Default toaster plus a dedicated secondary toaster mounted at top-left."),
    div(
      button(
        {
          onclick: () => {
            toast.message("Secondary toast", {
              toasterId: toasterId.val,
              action: {
                label: "Acknowledge",
                onClick: () => undefined,
              },
              cancel: {
                label: "Close",
                onClick: () => undefined,
              },
            });
          },
        },
        "Send to secondary",
      ),
    ),
  ) as HTMLElement;

  const usage = section(
    { class: "demo-usage" },
    h2("Install + use"),
    pre(
      code(`bun add van-toaster vanjs-core

import van from "vanjs-core";
import { Toaster, toast } from "van-toaster";
import "van-toaster/style.css";

van.add(document.body, Toaster());
toast.success("Saved");`),
    ),
    p(
      "Source inspiration: ",
      a(
        { href: "https://github.com/emilkowalski/sonner", target: "_blank", rel: "noreferrer" },
        "Sonner",
      ),
    ),
  );

  const root = div(
    { class: "demo-root" },
    h1("Van Toaster demo"),
    p("A Sonner-style toaster implementation for VanJS."),
    controls,
    actions,
    secondaryActions,
    usage,
    secondaryToaster,
  ) as HTMLElement;

  const updatePrimaryToaster = () => {
    const oldToaster = document.querySelector("[data-demo-primary-toaster]");
    oldToaster?.remove();

    const toaster = Toaster({
      position: position.val,
      theme: theme.val,
      duration: duration.val,
      visibleToasts: visibleToasts.val,
      richColors: richColors.val,
      expand: expand.val,
      closeButton: closeButton.val,
      containerAriaLabel: "Primary notifications",
    });

    toaster.setAttribute("data-demo-primary-toaster", "true");
    document.body.append(toaster);
  };

  van.derive(updatePrimaryToaster);

  return root;
}
