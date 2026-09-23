---
name: product-manual-review
description: Review and incrementally correct product-manual screenshots, annotations, redactions, and publication approval state. Use when opening the visual review workbench, approving all screenshots, editing one arrow or mask, changing privacy rules, or regenerating only affected image derivatives.
---

# Product Manual Review

Default to review mode `all`: every publication screenshot and every required annotation/redaction object must be approved before strict publication. The project may explicitly select `risky` or `none`.

## Review unit

- Give every capture, annotation, and redaction a stable ID, revision, status, source, confidence, and dependency list.
- Editing one object invalidates that object, its capture approval, and derived images/sequences that depend on it. Preserve unrelated approved objects.
- Replacing or resizing the raw image, changing crop/scale, or changing transition ordering invalidates all dependent geometry.
- Changing a privacy rule invalidates matched redactions and downstream images, not unrelated runtime evidence.

## Privacy

- Keep project privacy categories and rules versioned and user-confirmed.
- Support DOM/selector, label, regex, OCR, fixed-region, and manual masks with platform/module/page/operation scope.
- Protect page titles, field labels, status labels, functional controls, confirmation text, success messages, and action targets unless the confirmed policy explicitly overrides protection.
- Never store sensitive values in policy rules.

Use `node scripts/serve-review.mjs --project <repositoryRoot>` for the local workbench. Read `references/review-and-privacy.md` before editing review state or privacy policy, and `references/visual-location.md` when automatic geometry is incomplete.
