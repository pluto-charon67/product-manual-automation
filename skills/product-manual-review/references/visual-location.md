# Visual target location

Prefer deterministic runtime geometry in this order:

1. Web DOM, ARIA, CDP, or Playwright bounding box;
2. WeChat selector and element geometry from `wechatide-skill`;
3. OCR text boxes, preferably PaddleOCR for Chinese interfaces;
4. OmniParser or another UI-element parser for icon-only or canvas-like interfaces;
5. manual rectangle.

Use OCR and visual-model outputs as proposals, not publication truth. Record the provider, confidence, matched text or semantic label, viewport size, and scaling transform. SoM-style numbered visual prompts may help an Agent select a candidate, but do not use SoM labels as the only stored geometry source.

Normalize candidates with `scripts/propose-annotation.mjs`. The script ranks semantic geometry above OCR and vision, marks non-geometric or low-confidence proposals for review, and writes an object-level annotation revision into `review-state.json`.
