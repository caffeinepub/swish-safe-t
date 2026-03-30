# SWiSH SAFE-T Electrical Audit Tool

## Current State
Workspace is empty (files lost between sessions). Full rebuild required.

## Requested Changes (Diff)

### Add
- Full rebuild of entire application
- Thumb-friendly mobile CSS for floating Update/Submit buttons (min 48px touch targets, safe-area-inset support for iOS notch)
- Auto-save explicitly uses localStorage writes with debounce so it never fails on signal loss

### Modify
- Floating footer buttons: larger touch targets, proper padding, `env(safe-area-inset-bottom)` for iOS home indicator clearance
- Auto-save: localStorage-first, no network dependency for save operation

### Remove
- Nothing (full rebuild restores all existing features)

## Implementation Plan

### Backend (Motoko)
- `stable var` user storage with preupgrade/postupgrade hooks
- `createAppUser`, `verifyAppUserCredentials`, `getAppUserPublic`, `listAppUsers`, `updateAppUser` — all accessible without IC identity checks
- Auto-seed admin `APA_Arun` if no users exist on first call

### Frontend (React + Tailwind)
- **Auth**: localStorage primary + backend canister sync. On new device with empty localStorage, pull users from canister on load. Login never blocked by backend availability.
- **RBAC**: Admin, Manager, Reviewer, Auditor. Reviewer add-only on clients/sites. Admin manages users.
- **Dashboard**: Bar + donut charts. HDFC Bank and IDBI Bank seeded. Multi-site per client.
- **Clients & Sites**: Branch Name, Code, Address, City, State, Type, Scheduled Audit Date, Auditor (1:1), Reviewer, Manager.
- **Templates**: Admin/Manager create reusable templates. Sections → Questions (Radio/Dropdown). Per-question: always-required Remarks field, optional image upload toggle + mandatory toggle.
- **Questionnaire Fill**: Collapsible sections. Per-question: answer input + Remarks (required) + conditional image upload. Section-level: Power Supply Details table (3in3out / 3in1out / 1in1out, non-mandatory). Critical Observations panel (add/remove rows, each with Remarks + Recommendations + mandatory image upload). Last section: Photographs (all uploaded photos grouped by section with remarks captions).
- **Task List**: Status summary cards. Searchable table. Workflow: Auditor → Submit → Reviewer → Submit → Manager → Approve/Send Back.
- **Floating footer buttons**: `position: fixed; bottom: 0`. Use `padding-bottom: env(safe-area-inset-bottom, 16px)` for iOS. Min height 56px. Touch target ≥ 48px. Full-width on mobile.
- **Auto-save**: 5-second debounced write to localStorage. Never makes network call. Backup sync to canister happens on manual Save/Submit only.
- **Logo**: `/assets/uploads/image-019d3a59-4137-76fd-9587-931d91b77fab-1.png` in header (white bg container) and login page.
- **Branding**: Grey-green (`#1a2420` header, `#4a7c59` accents), white, industrial Tailwind styling.
- **Admin credentials**: `APA_Arun` / `SWiSH_SafeArun@21`. No password hint on login page.
- **Temporary Admin**: 24-hour elevation, badge shown, no countdown timer.
