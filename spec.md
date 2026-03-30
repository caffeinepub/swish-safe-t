# SWiSH SAFE-T — Export Feature

## Current State
The app is a full-featured electrical safety audit tool (localStorage-based). QuestionnairePage.tsx handles the full audit form with answers, remarks, images, critical observations, and power supply details. There is no export functionality yet. The app has no xlsx or docx libraries installed.

## Requested Changes (Diff)

### Add
- `xlsx` npm package for Excel export
- `docx` npm package for Word export
- `src/frontend/src/lib/exportExcel.ts` — utility to generate Excel file from audit data
- `src/frontend/src/lib/exportWord.ts` — utility to generate Word/Doc report from audit data
- Export buttons (Excel + Word) on the QuestionnairePage, visible only to Reviewer/Manager/Admin when audit status is Submitted, Under Review, Reviewed, or Completed

### Modify
- `src/frontend/package.json` — add `xlsx` and `docx` dependencies
- `src/frontend/src/pages/QuestionnairePage.tsx` — add Export Excel and Export Word buttons to the action bar area (near Submit/Update buttons), role and status gated

### Remove
- Nothing

## Implementation Plan

### 1. Install packages
- `xlsx` (SheetJS) for Excel generation
- `docx` for Word .docx generation
- `file-saver` for triggering browser download

### 2. Excel export (`exportExcel.ts`)
- One worksheet named after the site
- Columns: S/No | Section | Question | Observation (Answer) | Remarks
- Rows: one per question across all sections
- Below questions: Critical Observations rows (Section | "Critical Observation" | Remarks | Recommendations)
- Power Supply Details rows (Section | "Power Supply" | type + field values)
- Header row styled with bold olive-green background

### 3. Word export (`exportWord.ts`)
Generate a .docx with three visual sections matching the sample report:

**Cover Page:**
- Title: "Electrical Safety Audit Report of"
- Client name (large bold)
- Branch Name + State (large bold)
- Branch Code + Branch Type in a bordered table row
- "Executed By:" section with "M/s APlus Automations" and www.aplusautomations.com
- Audit date
- Note: logos cannot be embedded without binary assets; use text placeholders for logo areas

**Report Pages (per section):**
- Header row: client name | APlus Automations | SWiSH SAFE-T (text-based, 3-column table)
- Section heading: "N. Section Name" (large bold, olive color #7a9e3b)
- Table: S/No | Parameters need to be checked | Observation | Remarks
  - Header row: olive-green shading (#7a9e3b), white bold text
  - Alternating white rows
- Footer: "Electrical Safety Audit Report" left | "Page X" right

**Photo Pages (per section that has images):**
- Same 3-column header
- Section label in a full-width grey shaded bar (bold centered)
- 3 images per row, each resized to ~180x150px, with "Image N" label above and remarks caption below
- Images are base64 data URLs stored in localStorage — extract and embed

**Critical Observations (per section):**
- After each section table, if observations exist, render a sub-table: Remarks | Recommendations
- Observation images grouped into the photo section

### 4. QuestionnairePage changes
- Import and call exportExcel / exportWord utilities
- Show "Export Excel" and "Export Word" buttons in the footer action area
- Only visible when: role is admin/manager/reviewer AND audit.status is one of Submitted/Reviewed/Completed/UnderReview
- Buttons use Download icon from lucide-react
- Word export may take a moment — show loading state on button
