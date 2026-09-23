# Product manual data model

The project-local workspace is the durable source of truth. Conversation state is not.

## Core entities

| Entity | Purpose |
| --- | --- |
| Module | User-facing functional area in visible navigation order |
| BusinessNode | Meaningful object or stage used to attach related operations |
| Capability | Discovered user-facing function candidate with evidence and disposition |
| Operation | Platform-neutral user goal with scenario, result, prerequisites, and stable anchor |
| PlatformVariant | WeChat or web implementation of an Operation |
| Transition | One visible `fromState -> action target -> toState` change |
| Evidence | Sanitized source, runtime, database, user, or inferred support |
| Capture | Immutable raw screenshot and its derived asset dependencies |
| Annotation | One actionable numbered arrow, target box, or explanatory marker |
| Redaction | One privacy transformation justified by a policy rule |
| ReviewDecision | Approval or rejection of an object revision |

## Independent state axes

Do not collapse these fields into a single status:

- discovery: `discovered`, `merged`, `excluded`;
- documentation: `unplanned`, `planned`, `documented`, `excluded`;
- evidence types: `source`, `runtime`, `database`, `user`, `inferred`;
- execution: `passed`, `partial`, `blocked`, `failed`, `not-run`;
- publication: `draft`, `requires-review`, `publishable`, `excluded`.

`documented` never means runtime-passed or business-confirmed.

## Stable identity

Prefer readable stable IDs:

```text
MOD-PROJECT
NODE-PROJECT-LIST
OP-PROJECT-CREATE
VAR-PROJECT-CREATE-WEB
TR-PROJECT-CREATE-WEB-01
CAP-PROJECT-CREATE-SUBMIT
CAPTURE-PROJECT-CREATE-WEB-01-BEFORE
ANN-PROJECT-CREATE-WEB-01
RED-PROJECT-CREATE-WEB-01
```

Keep an Operation ID when its user-visible meaning remains the same. Create a new ID when the function meaning changes and archive the replaced object.

## Workspace layout

```text
<project>/.product-manual-plan/
  modules/
  business-nodes/
  operations/
  platform-variants/
  coverage.md
  review-decisions.md

<project>/.product-manual/
  config/
  project-inventory.json
  capability-graph.json
  coverage.json
  capture-manifest.json
  review-state.json
  run-state.json
  evidence-log.jsonl
  test-data.json
  database-evidence.json
  history/
  automation/
  images/
```

Published Markdown lives under `docs/product-manual/`. Never publish internal state labels or raw evidence logs as fixed manual sections.
