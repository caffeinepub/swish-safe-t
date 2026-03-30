# SWiSH SAFE-T

## Current State
The app has a 4-stage workflow: Draft → Submitted → Reviewed/PendingReReview → Completed.
- Auditor can submit (Draft → Submitted)
- Reviewer can submit (Submitted/PendingReReview → Reviewed or Completed)
- Manager can approve (Reviewed → Completed) or send back (Reviewed → PendingReReview)
- Status type: `"Draft" | "Submitted" | "Reviewed" | "PendingReReview" | "Completed"`
- StatusBadge maps these statuses with display labels
- QuestionnairePage has `validateAndSubmit`, edit access guards, and submit button rendering
- TaskListPage shows status summary cards with current status counts

## Requested Changes (Diff)

### Add
- New status `"PendingApproval"` — after Reviewer submits, moves to Manager queue
- New status `"ReturnedForCorrection"` — Manager rejects, sent back to Reviewer with note
- Manager "Reject" button in QuestionnairePage when status is `PendingApproval`; requires a mandatory rejection comment modal
- `rejectionNote` field on Audit object to store Manager's rejection comment
- Status badge styles and display labels for `PendingApproval` and `ReturnedForCorrection`
- Status summary cards on TaskListPage for `PendingApproval` and `ReturnedForCorrection`
- Rejection note shown to Reviewer in audit view when status is `ReturnedForCorrection`

### Modify
- Audit status type: add `"PendingApproval"` and `"ReturnedForCorrection"`
- Auditor submit → `"Submitted"` (unchanged, Reviewer's queue)
- Reviewer submit flow: `"Submitted"` or `"ReturnedForCorrection"` → `"PendingApproval"` (not directly to Completed or Reviewed)
- Manager submit/approve: `"PendingApproval"` → `"Completed"`
- Admin submit: → `"Completed"` immediately regardless of current status
- Edit access rules:
  - Auditor: editable only on `Draft`; read-only after
  - Reviewer: editable on `Submitted` or `ReturnedForCorrection`; read-only on `PendingApproval` or `Completed`
  - Manager: can submit/approve/reject when status is `PendingApproval`
  - Admin: always editable
- Submit button label and visibility per role and status
- Remove old `Reviewed` and `PendingReReview` statuses (replace with new workflow)
- TaskListPage status cards updated to reflect new statuses

### Remove
- Old `"Reviewed"` status and `"PendingReReview"` status (superseded by `PendingApproval` and `ReturnedForCorrection`)
- Old Manager "Send Back" logic (replaced by Reject with mandatory note)

## Implementation Plan
1. Update `Audit` type in `dataStore.ts`: add `PendingApproval`, `ReturnedForCorrection`, remove `Reviewed`, `PendingReReview`; add `rejectionNote?: string` field
2. Update `StatusBadge.tsx`: add styles for new statuses with appropriate colors
3. Update `QuestionnairePage.tsx`:
   - Fix `validateAndSubmit` to route Reviewer submit → `PendingApproval`
   - Add Manager approve button → `Completed`
   - Add Manager reject button → opens modal for rejection note → saves note + status `ReturnedForCorrection`
   - Admin submit → `Completed` always
   - Fix `isReadOnly` logic for new statuses
   - Show rejection note banner when status is `ReturnedForCorrection`
   - Fix `STATUS_CONFIG` map for new statuses
4. Update `TaskListPage.tsx`: update status summary cards and badge map for new statuses
