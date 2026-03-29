# SWiSH SAFE-T

## Current State
Workspace is empty (files lost between sessions). Full rebuild required.

## Requested Changes (Diff)

### Add
- Per-question Remarks field: every question in the questionnaire fill view shows a mandatory "Remarks" textarea (always labeled "Remarks", always required for submission)
- Per-question image upload config in template editor: each question has two toggles:
  1. "Enable image upload" — controls whether the image upload field appears for that question
  2. "Image upload is mandatory" (only visible if enable toggle is on) — controls whether submission is blocked without an image
- Question data model extended: `enableImageUpload: boolean`, `imageUploadMandatory: boolean`

### Modify
- Template editor: each question card now shows the two image toggles instead of a single shared section-level image config
- Questionnaire fill view: each question card renders: answer input (radio/dropdown) + Remarks textarea (always, required) + image upload (only if enableImageUpload=true; red error on submit if imageUploadMandatory=true and no image)
- Validation on submit: check remarks filled for every question; check images uploaded for questions where imageUploadMandatory=true
- Remove the shared "Additional Inputs" section-level Remarks/Images block — replaced by per-question layout

### Remove
- Section-level "Additional Inputs" block (Remarks + Images at section level)

## Implementation Plan
1. Extend question data model in localStorage helpers to include `enableImageUpload` and `imageUploadMandatory` fields
2. Update template editor question card UI to show the two toggles per question
3. Update pre-seeded "Banking Branch Electrical Audit" template questions to have `enableImageUpload: true, imageUploadMandatory: true` for all questions
4. Update questionnaire fill component: render per-question Remarks + conditional image upload below each answer input
5. Update submit validation to check remarks (all questions) and images (questions with mandatory image)
6. Keep all other features intact: RBAC, login (admin/Admin@1234), dashboard, task list, clients/sites, status workflow, auto-save
