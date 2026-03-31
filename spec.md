# SWiSH SAFE-T — Cross-Device Sync for Templates & Audit Reports

## Current State

- Templates (QuestionTemplate, TemplateSection, TemplateQuestion) are stored entirely in localStorage under keys `swish_templates`, `swish_tmpl_sections`, `swish_tmpl_questions`. No backend persistence.
- Audit reports (answers, observations, power supply, status) are stored in localStorage under `swish_audits`. No backend persistence.
- The Motoko backend (`main.mo`) has stable var storage for `appUsers` only. It has template/section/question APIs tied to IC identity (Principal-based) which are not used by the frontend.
- Photos are stored on ICP blob-storage (already working cross-device).
- Backend uses username/password auth (no IC identity for app operations).

## Requested Changes (Diff)

### Add
- `TemplateBlob` type in Motoko: `{ id: Text; dataJson: Text; updatedAt: Int; createdBy: Text }`
- `AuditBlob` type in Motoko: `{ siteId: Text; dataJson: Text; status: Text; lastSavedAt: Int }`
- Stable vars: `stableTemplateBlobs: [(Text, TemplateBlob)]` and `stableAuditBlobs: [(Text, AuditBlob)]`
- Backend APIs (all open — no IC auth, app uses username/password): `saveTemplateBlob`, `loadTemplateBlob`, `listTemplateBlobs`, `deleteTemplateBlob`, `saveAuditBlob`, `loadAuditBlob`, `listAuditBlobs`
- `src/frontend/src/lib/backendSync.ts` — sync service implementing:
  - Template sync: load from canister on open → update localStorage cache; on first sync push existing localStorage templates to canister; on save write to localStorage then async push to canister
  - Audit sync: load from canister on open → fall back to localStorage if offline; auto-save writes to localStorage immediately then async push to canister; last-write-wins via timestamp
  - Offline queue stored in localStorage key `swish_sync_queue`; flushes automatically on `window.addEventListener('online', ...)` event
  - Network detection: if canister call throws, treat as offline and enqueue

### Modify
- `TemplatePage.tsx`: on mount call `backendSync.loadTemplates()` which fetches from canister and updates localStorage; on save/update/delete call `backendSync.saveTemplate()` / `backendSync.deleteTemplate()` which write localStorage + background-sync canister
- `QuestionnairePage.tsx`: on mount call `backendSync.loadAudit(siteId)` which fetches from canister first, falls back to localStorage; on every auto-save and manual save call `backendSync.saveAudit()` which writes localStorage immediately then background-syncs canister
- `src/backend/main.mo`: add new types, stable vars, and blob APIs; preserve all existing functionality

### Remove
- Nothing removed

## Implementation Plan

1. Regenerate Motoko backend with `TemplateBlob` + `AuditBlob` types, stable vars, and open CRUD APIs added alongside all existing functionality.
2. Create `src/frontend/src/lib/backendSync.ts` with:
   - `loadTemplates()`: fetch all from canister → merge into localStorage → return merged list; on network error return localStorage fallback
   - `saveTemplate(id, fullData)`: write to localStorage immediately; push to canister in background; if offline enqueue
   - `deleteTemplate(id)`: delete from localStorage; push delete to canister in background
   - `firstSyncTemplates()`: check `swish_sync_done` flag; if not set, push all localStorage templates to canister once
   - `loadAudit(siteId)`: fetch from canister; if newer than localStorage version update localStorage; if offline return localStorage
   - `saveAudit(siteId, dataJson, status)`: write to localStorage immediately; push to canister in background
   - `flushOfflineQueue()`: iterate `swish_sync_queue` and replay each pending operation against canister; called on `window.online` event
3. Update `TemplatePage.tsx` to call `backendSync.loadTemplates()` on mount and `backendSync.saveTemplate/deleteTemplate` on mutations.
4. Update `QuestionnairePage.tsx` to call `backendSync.loadAudit(siteId)` on mount and `backendSync.saveAudit()` on every save.
5. Validate, build, deploy.
