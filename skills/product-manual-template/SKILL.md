---
name: product-manual-template
description: Configure, render, and validate function-first Markdown manuals produced by the product-manual plugin. Use when defining manual structure, platform outputs, wording, image layout, operation sections, business error notes, stable anchors, or strict publication rules.
---

# Product Manual Template

Render structured Operations into concise product documentation rather than an audit report.

## Default publication contract

- Generate `docs/product-manual/index.md` plus separate `wechat/user-manual.md` and `web/user-manual.md` files for enabled platforms.
- Order modules by visible product navigation. Use business-node subgroups only when they improve scanning.
- For every operation publish one concise `适用场景：`, reproducibility-affecting prerequisites when present, one concise `操作结果：`, and `#### 操作步骤截图` with one or more PNG sequence images.
- Publish `#### 异常说明` only for non-query operations with traceable business-level errors. Exclude ordinary required-field, format, precision, and length validation.
- Do not duplicate sequence captions as a numbered Markdown step list.
- Do not publish fixed role, evidence, verification-scope, known-limitations, global recovery, or audit sections.

## Customization boundary

Allow project configuration to change headings, ordering, wording, emphasis, image width/layout, business-node visibility, branding text, and optional error-note display. Never allow a template to remove the required scenario, visible result, reproducible entry, privacy-compliant visual chain, or strict evidence linkage.

Use `node scripts/render-manual.mjs` for deterministic generation and `node scripts/validate-publication.mjs --strict` before handoff. Read `references/template-contract.md` when changing template configuration or publication structure.
