# Workflow and review gates

## Gate 1: platform and module scope

Present detected platforms, functional modules, visible entries, excluded modules, and code-invisible assumptions. For a whole product, confirm the module list once, then complete each module serially.

## Gate 2: business nodes and operations

For each module present main-flow and derived operations, uncertain attachments, suspected external steps, self-contained entry paths, and proposed execution tiers. Every discovered operation must be included, merged, excluded with a reason, or unresolved for review.

## Gate 3: account, data, privacy, and writes

Confirm the runtime environment, available accounts, representative records, database scope, privacy policy, visual policy, expected effort, and authorization for submit, approve, cancel, delete, payment, notification, upload, or other consequential actions.

Execution tiers:

| Tier | Meaning |
| --- | --- |
| A | Complete authorized terminal operation |
| B | Verify the write path to a confirmation boundary or safe terminal step |
| C | Verify navigation, filters, detail, and visible states without consequential writes |
| D | Document from source, user, or database evidence only |

## Gate 4: review and publication

Resolve or explicitly accept internal gaps, confirm every enabled screenshot review, confirm privacy-policy revision, decide test-data retention, and validate removed/replaced assets. Keep accepted gaps internal.

## Scope changes

A global change to platforms, modules, business-node attachment, operation meaning, output audience, global template, or privacy contract increments `scopeRevision` and invalidates the earliest affected gates. An isolated operation or module change invalidates only the named Operations and shared-entry dependents.

## Incremental change levels

| Level | Change | Required work |
| --- | --- | --- |
| L1 | Prose correction | Re-render and validate anchors |
| L2 | Annotation or redaction | Rebuild affected assets and review |
| L3 | One operation path | Rescan and rerun that variant |
| L4 | Shared navigation | Rerun all dependent variants |
| L5 | Module business structure | Repeat module Gate 2 review |
| L6 | Global template/privacy/navigation | Re-audit all modules; rerun only affected runtime paths |
