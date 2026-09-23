---
name: product-manual-web
description: Adapt the product-manual workflow to desktop web products using source scanning plus live browser exploration. Use for React, Vue, Angular, or generic web projects and choose ego-browser for an existing user login context or Playwright for isolated and repeatable execution. Do not use for native desktop applications.
---

# Product Manual Web

Create desktop-web platform variants from both source evidence and observed UI behavior.

## Choose the runner

- Prefer `ego-browser` when the operation depends on the user's existing browser login, cookies, or personal context.
- Prefer Playwright when isolation, deterministic replay, test accounts, CI, or remote execution matters more than the user's browser context.
- Do not silently switch runners after login, permissions, or browser state has become part of the evidence. Record the runner in each runtime event.

## Source discovery

- Scan routing, menus, tabs, buttons, forms, dialogs, drawers, tables, cards, bulk actions, overflow menus, keyboard actions, guards, feature flags, API clients, validation, user-facing errors, and backend transitions.
- Resolve React/Vue/Angular route and component relationships where practical. Preserve dynamic routes, generated menus, runtime feature flags, and unresolved API symbols as explicit review candidates.
- Treat hidden DOM, source-only endpoints, and generic shared-component internals as non-published candidates until a product entry is confirmed.

## Runtime evidence

- Use DOM/ARIA semantics and bounding boxes before coordinates or vision.
- Capture the state before every action and the visible state after it. Preserve modal, menu, drawer, loading-complete, confirmation, and success states when they explain the operation.
- Use viewport captures for documentation. Capture browser chrome only when browser-owned prompts or system UI matter.
- Record URL, route, viewport, selector or accessible target, geometry source, expected result, observed result, and exact account/data context.

Read `references/web-adapter.md` before scanning or browser execution.
