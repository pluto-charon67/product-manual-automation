# Template contract

## Default outputs

```text
docs/product-manual/
  index.md
  wechat/user-manual.md
  web/user-manual.md
```

Only enabled platforms are rendered. The index links to platform manuals and does not duplicate their full content.

## Required operation content

Every published operation must contain:

1. a stable operation heading and anchor;
2. one non-empty `适用场景：` line;
3. reproducibility-affecting prerequisites in user-facing language when present;
4. one non-empty `操作结果：` line;
5. `#### 操作步骤截图` with PNG sequence references;
6. `#### 异常说明` only when traceable business-level errors exist.

Do not publish permission codes, API paths, route names, database fields, numeric statuses, controller names, stack traces, evidence labels, or raw exception diagnostics.

## Safe customization

Templates may customize headings, order, wording, image width, emphasis markup, node visibility, branding text, and error-note visibility. Strict validation still requires the semantic fields above and complete visual/evidence linkage.
