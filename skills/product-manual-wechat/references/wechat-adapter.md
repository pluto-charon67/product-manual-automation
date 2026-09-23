# WeChat adapter

## Roots and freshness

Distinguish repository source from the project opened by WeChat DevTools:

```text
repositoryRoot = package/config/git root
sourceRoot = native root or uni-app source root
wechatProject = native root or compiled mp-weixin output
```

For uni-app, compare relevant source timestamps with compiled output. A simulator refresh does not compile Vue source. Missing or stale output blocks runtime claims.

## Candidate scan

Inspect pages, subpackages, tab bars, WXML/Vue controls, page-local components, request wrappers, stores, navigation, permission/visibility guards, validation, Toasts, dialogs, drawers, pickers, swipe and long-press actions. Record visible label/icon, region, trigger, handler, condition, destination, and parent trigger for secondary actions.

For every business node expand main and derived actions: read, maintenance, branch, state change, related data, cancellation, and destructive operations.

## Runtime evidence

Delegate environment and UI operations to the installed `wechatide-skill`. Do not duplicate its tool schemas or hardcode a version. Record the Operation, platform variant, Capability IDs, page, selector/target, expected and observed states, capture paths, and exact execution boundary after every meaningful step.

Prefer viewport screenshots. Use full simulator captures only when status bar, Toast, permission prompt, or system UI matters. Preserve all raw captures even when the publication sequence uses handoff compaction.
