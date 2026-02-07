# Van Toaster

A Sonner-inspired toast library with a framework-agnostic core runtime.

## Install

```bash
bun add van-toaster
```

No framework peer dependencies are required for core usage.

## Usage

```ts
import { Toaster, toast } from "van-toaster";
import "van-toaster/style.css";

document.body.append(Toaster({ position: "bottom-right" }));

const button = document.createElement("button");
button.type = "button";
button.textContent = "Show toast";
button.addEventListener("click", () => toast.success("Saved"));
document.body.append(button);
```

## API

Exports:
- `Toaster(props?: ToasterProps): HTMLElement`
- `toast(message, data?)`
- `toast.success`, `toast.info`, `toast.warning`, `toast.error`, `toast.loading`, `toast.message`
- `toast.custom`, `toast.promise`, `toast.dismiss`
- `toast.getHistory`, `toast.getToasts`

Intentional difference from Sonner: `useSonner` is not exported.

## Styling

Van Toaster ships plain CSS. Import it explicitly:

```ts
import "van-toaster/style.css";
```

No runtime CSS injection is used.

## Development

```bash
bun install
bun run dev
bun run dev:demo:alt
bun run check
bun run build
```

`bun run dev` serves both demo entries:
- `/` (main demo)
- `/alt-demo.html` (alternate demo)

Demo apps use [VanJS](https://github.com/vanjs-org/van) for showcasing controls and integration patterns.

## Attribution

Van Toaster is an independent implementation inspired by [Sonner](https://github.com/emilkowalski/sonner).
