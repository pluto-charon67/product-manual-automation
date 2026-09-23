---
name: product-manual-wechat
description: Adapt the product-manual workflow to native WeChat Mini Programs and modern uni-app projects. Use for WeChat source discovery, compiled mp-weixin freshness checks, WeChat DevTools runtime verification, element geometry, simulator screenshots, and WeChat platform variants. Requires the installed wechatide-skill for runtime work.
---

# Product Manual Wechat

Implement the WeChat platform adapter without changing or copying the installed `wechatide-skill` tool contract.

## Inputs

Determine `repositoryRoot`, `sourceRoot`, `wechatProject`, optional `backendProject`, and project output root. Native projects use `project.config.json` and the configured `miniprogramRoot`. Modern uni-app projects may use `pages.config.ts`, `manifest.config.ts`, generated `src/pages.json`, and `dist` or `unpackage` `mp-weixin` output.

## Discovery

- Scan pages, subpackages, tab bars, page-local components, visible labels/icons, event bindings, navigation calls, API wrappers, stores, conditional visibility, validation, Toasts, dialogs, drawers, action sheets, swipe actions, and long-press actions.
- Build a separate affordance inventory. A handler name is not a user-facing function.
- Inspect custom navigation bars and icon-only controls explicitly.
- Preserve unresolved dynamic routes and API expressions for review.
- Compare source modification times with compiled WeChat output. Stop runtime verification when the compiled output is missing or stale.

## Runtime

1. Use the current installed `wechatide-skill` root workflow for environment, login, and version checks.
2. Capture a calibration screenshot before a module run and after simulator restarts or capture failures.
3. Use initializer to open `wechatProject`, compiler to open or refresh pages, automator for interaction/assertion/geometry/viewport screenshots, and debugger for console/network/Toast/system UI evidence.
4. Capture both sides of each transition. Expanded menus, drawers, dialogs, pickers, Toasts, and result states are separate visible states.
5. Do not preview, upload, publish, deploy cloud resources, or write cloud data unless separately requested.

Read `references/wechat-adapter.md` before scanning or runtime work.
