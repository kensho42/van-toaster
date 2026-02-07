# Van Toaster Agent Guidelines

## Mission
Ship and maintain `van-toaster` as a high-parity Sonner port with production-grade API stability, UX consistency, and publish quality.

## Quality Bar
- Keep public API parity with Sonner v2.0.7 for `toast.*` and `Toaster`.
- Preserve styling and animation behavior using pure CSS only.
- Avoid regressions in accessibility, pointer interactions, and timing semantics.
- Keep implementation TypeScript strict and Bun-first.
- Keep the core library runtime free of `vanjs-core` dependency.

## Architecture Map
- `src/types.ts`: Public and internal type contracts.
- `src/store.ts`: Observer/store lifecycle, toast history, id semantics.
- `src/toast.ts`: Public toast facade (`toast`, `toast.success`, `toast.promise`, etc.).
- `src/toaster.ts`: DOM renderer, gestures, timers, keyboard and focus logic.
- `src/dom.ts`: DOM/renderable helpers and shared UI utilities.
- `src/icons.ts`: Default icon nodes and loading indicators.
- `src/style.css`: Full styling and animation definitions.
- `demo/*`: Usage and behavior showcase.
- `tests/*`: Unit + DOM integration coverage.

## Dependency Constraints
- Core package runtime must not import or require `vanjs-core`.
- Demo code may use `vanjs-core` for examples, but this must not leak into `src/*` runtime imports.

## API Parity Checklist
- `toast(message, data?)`
- `toast.success/info/warning/error/loading/message`
- `toast.custom`
- `toast.promise` with `unwrap()`
- `toast.dismiss(id?)`
- `toast.getHistory()` and `toast.getToasts()`
- `Toaster` props parity (`theme`, `position`, `hotkey`, `visibleToasts`, `offset`, `swipeDirections`, etc.)
- Intentional exception: no `useSonner` export.

## CSS and Animation Constraints
- Pure CSS only. Do not add Tailwind.
- Keep key motion behavior equivalent to Sonner (mount/unmount, stack lift, swipe-out, loader, reduced-motion).
- Use `data-van-*` attributes (`data-van-toaster`, `data-van-toast`, `data-van-theme`).

## Testing Requirements
Before merging:
- `bun run lint`
- `bun run test`
- `bun run typecheck`
- Add or update tests for any user-facing behavior changes.

## Release Checklist
- Update version and changelog/release notes.
- Run `bun run check` and `bun run build`.
- Verify package exports (`.` and `./style.css`) from `dist`.
- Confirm README API docs match current behavior.
- Publish with `bun publish`.
