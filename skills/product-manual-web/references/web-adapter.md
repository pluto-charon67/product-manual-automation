# Desktop web adapter

## Source scan

Inspect route definitions, lazy imports, navigation menus, page components, visible controls, forms, tables, cards, tabs, drawers, modals, bulk actions, overflow items, client API wrappers, stores, route guards, feature flags, validation, and backend business errors.

Recognize common React, Vue, Angular, and generic JavaScript/TypeScript layouts, but keep framework-specific dynamic expressions as unresolved candidates when static evidence is insufficient.

## Runner selection

| Runner | Prefer when |
| --- | --- |
| ego-browser | Existing login state and user browser context are required |
| Playwright | Isolation, replay, CI, test accounts, or remote execution is required |

Record the chosen runner per runtime event. Do not mix browser states in one claimed coherent sequence unless the user confirms they represent the same environment and account.

## Geometry and screenshots

Use semantic selectors and element bounding boxes first. OCR and visual UI parsing are fallbacks. Every actionable transition needs a before-action capture and an observed after-state. Expanded menus, confirmation dialogs, drawers, pickers, success prompts, and result pages are states, not implementation detail.
