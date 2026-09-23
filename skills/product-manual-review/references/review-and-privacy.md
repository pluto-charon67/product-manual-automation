# Review and privacy model

## Review modes

- `all`: every published capture and required object revision must be approved;
- `risky`: only low-confidence, vision-derived, conflicted, or privacy-sensitive objects require approval;
- `none`: review is bypassed and recorded as such.

Default to `all`.

## Object-level revision

Each capture, annotation, and redaction stores `id`, `revision`, `status`, `confidence`, `source`, `updatedAt`, and dependencies. Editing one object increments its revision, marks it pending, marks the parent capture pending, and invalidates only derived files and sequences that depend on it.

Replacing, resizing, cropping, or rescaling the raw image invalidates all geometry. Changing transition order invalidates numbered annotations. Changing a privacy rule invalidates matching redactions and downstream assets, not runtime evidence.

## Privacy rules

Allow project categories and custom rules with these matchers:

- DOM/ARIA selector and field label;
- WeChat selector and element geometry;
- regular expression;
- OCR text;
- fixed region;
- manual rectangle.

Allow solid mask, partial mask, blur, pixelation, replacement text, and publication exclusion. Keep categories and patterns, never matched sensitive values.

By default protect functional controls, page and dialog titles, field labels, status labels, tabs, button text, confirmation messages, success prompts, operation drawers, filters, and annotation targets.
