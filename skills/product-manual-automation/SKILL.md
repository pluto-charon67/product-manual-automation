---
name: product-manual-automation
description: Orchestrate evidence-backed Markdown product manuals for native WeChat Mini Programs, uni-app WeChat builds, and desktop web products. Use when Codex must discover functions, confirm operation paths, collect source/runtime/database evidence, capture and review privacy-safe annotated screenshots, generate a new manual, or incrementally update an existing manual workspace. Do not use for native desktop clients or for importing an existing external manual in v1.
---

# Product Manual Automation

Create a function-first product operation manual from confirmed operations and reproducible UI state transitions. Treat source code as a candidate map, not proof of the real business process.

## Scope and routing

- Support `wechat` and `web` platform variants. A project may use either or both.
- For WeChat source and runtime work, read and use `product-manual-wechat`.
- For desktop web source and runtime work, read and use `product-manual-web`.
- Before rendering or validating Markdown, read and use `product-manual-template`.
- Before changing annotation, redaction, or review state, read and use `product-manual-review`.
- Use the bundled `product-manual` MCP server for read-only database evidence and review-state operations when available.

## Mandatory workflow

1. Run `node scripts/detect-project.mjs --project <repositoryRoot>` and `node scripts/init-workspace.mjs --project <repositoryRoot> --platforms <wechat,web>` from the plugin root.
2. Read the active project, privacy, visual, template, and review policies. Do not capture publishable screenshots while privacy confirmation is pending.
3. Scan frontend routes, visible affordances, backend rules, and optional database relationships. Build modules, business nodes, Capabilities, Operations, and platform variants with stable IDs.
4. Complete the four review gates in `references/workflow-and-gates.md`. Ask focused questions about concrete ambiguities rather than asking the user to describe the product from scratch.
5. Assign execution tier A, B, C, or D per platform variant. Require explicit authorization for consequential writes.
6. Verify every included operation as contiguous `fromState -> target -> toState` transitions. Every operation must start from a self-contained module, tab, list, or system entry.
7. Record sanitized evidence immediately with `node scripts/record-evidence.mjs`. Runtime evidence proves only the exact tested branch, account, state, and data.
8. Preserve immutable raw PNG captures. Generate redacted, annotated, and sequence PNGs from sidecar JSON. Default to review mode `all`; every published capture must be approved unless the user changes the project policy.
9. Render platform manuals and a common index from structured data with `node scripts/render-manual.mjs`.
10. Run `node scripts/validate-publication.mjs --project <repositoryRoot> --strict`. Do not call a manual publication-ready while validation fails.

## Non-negotiable invariants

- Publish by function module and operation, never by role.
- Scan main-flow and derived operations: view, edit, supplement, approval, state change, related data, cancellation, and destructive actions.
- Keep evidence, permissions, execution state, gaps, and review metadata internal.
- Every published operation requires an applicable scenario, reproducibility-affecting prerequisites when present, a visible result, and a PNG operation sequence.
- Keep database access read-only. Database association is evidence, not proof of operating order.
- Never store credentials, cookies, tokens, connection strings, authorization headers, or raw personal records.
- Apply incremental invalidation. Do not duplicate unchanged modules or invalidate unrelated operations.
- Keep the original `generate-miniprogram-user-manual` Skill and its `.manual*` directories untouched.

Read `references/data-model.md` when creating or updating internal JSON and `references/workflow-and-gates.md` before planning or execution decisions.
