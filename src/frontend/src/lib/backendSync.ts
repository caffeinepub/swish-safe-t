/**
 * backendSync — silent background sync between localStorage and ICP canister.
 *
 * Rules:
 * - All canister calls are wrapped in try/catch — never crashes the UI.
 * - localStorage is always the primary source of truth for the UI.
 * - Canister is a shared persistent store for cross-device access.
 * - Offline changes are queued and flushed automatically on reconnect.
 */

import { createActorWithConfig } from "../config";
import {
  auditStore,
  templateQuestionStore,
  templateSectionStore,
  templateStore,
} from "./dataStore";
import { type StoredUser, addUser, getUsers, updateUser } from "./userStore";

// ── Types ─────────────────────────────────────────────────────────────────

interface SyncQueueItem {
  type: "pushTemplate" | "deleteTemplate" | "pushAudit" | "pushUser";
  id: string; // templateId, siteId, or username
  ts: number;
}

const QUEUE_KEY = "swish_sync_queue";

// ── Actor helper ──────────────────────────────────────────────────────────

async function getActor(): Promise<any> {
  return createActorWithConfig();
}

// ── Queue helpers ─────────────────────────────────────────────────────────

function readQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SyncQueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* quota — ignore */
  }
}

function enqueue(item: SyncQueueItem) {
  const q = readQueue();
  const filtered = q.filter((x) => !(x.type === item.type && x.id === item.id));
  writeQueue([...filtered, item]);
}

function dequeue(type: SyncQueueItem["type"], id: string) {
  const q = readQueue();
  writeQueue(q.filter((x) => !(x.type === type && x.id === id)));
}

// ── User helpers ──────────────────────────────────────────────────────────

/** Convert StoredUser to the AppUser shape the canister expects */
function toCanisterUser(user: StoredUser) {
  return {
    username: user.username,
    passwordHash: user.password, // stored as plain text on both sides
    fullName: user.fullName,
    role: user.role as string,
    originalRole: user.originalRole as string,
    isEnabled: user.isEnabled,
    elevatedUntil:
      user.elevatedUntil !== null ? [BigInt(user.elevatedUntil)] : [],
  };
}

// ── Template helpers ──────────────────────────────────────────────────────

function buildTemplateDataJson(templateId: string): string {
  const template = templateStore.getById(templateId);
  if (!template) return "{}";
  const sections = templateSectionStore.getByTemplate(templateId);
  const questions = templateQuestionStore.getByTemplate(templateId);
  return JSON.stringify({ template, sections, questions });
}

function dedupeLocalStorageTemplatesByName() {
  try {
    const raw = localStorage.getItem("swish_templates");
    if (!raw) return;
    const all = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (all.length === 0) return;

    const byName = new Map<string, Record<string, unknown>>();
    const toRemoveIds = new Set<string>();

    for (const t of all) {
      const name = (t.name as string) ?? "";
      const existing = byName.get(name);
      if (!existing) {
        byName.set(name, t);
      } else {
        const existingTs = (existing.createdAt as number) ?? 0;
        const incomingTs = (t.createdAt as number) ?? 0;
        if (incomingTs > existingTs) {
          toRemoveIds.add(existing.id as string);
          byName.set(name, t);
        } else {
          toRemoveIds.add(t.id as string);
        }
      }
    }

    if (toRemoveIds.size === 0) return;

    const deduped = all.filter((t) => !toRemoveIds.has(t.id as string));
    localStorage.setItem("swish_templates", JSON.stringify(deduped));

    for (const id of toRemoveIds) {
      templateSectionStore.deleteByTemplate(id);
      templateQuestionStore.deleteByTemplate(id);
    }
  } catch {
    /* ignore */
  }
}

function applyTemplateBlob(blob: {
  id: string;
  createdBy: string;
  updatedAt: bigint;
  dataJson: string;
}) {
  try {
    const parsed = JSON.parse(blob.dataJson) as {
      template?: Record<string, unknown>;
      sections?: unknown[];
      questions?: unknown[];
    };
    if (!parsed.template) return;

    const existing = templateStore.getById(blob.id);
    const incomingUpdatedAt = Number(blob.updatedAt);

    if (existing) {
      const localTs =
        (existing as { syncedAt?: number; createdAt?: number }).syncedAt ??
        (existing as { createdAt?: number }).createdAt ??
        0;
      if (incomingUpdatedAt <= localTs) return;
      templateStore.update(blob.id, {
        ...(parsed.template as object),
        id: blob.id,
        syncedAt: incomingUpdatedAt,
      } as Parameters<typeof templateStore.update>[1]);
    } else {
      const all = JSON.parse(
        localStorage.getItem("swish_templates") ?? "[]",
      ) as Array<Record<string, unknown>>;

      const incomingName = (parsed.template.name as string) ?? "";

      const duplicateIdx = all.findIndex(
        (t) => (t.name as string) === incomingName,
      );
      if (duplicateIdx !== -1) {
        const duplicateId = all[duplicateIdx].id as string;
        all.splice(duplicateIdx, 1);
        templateSectionStore.deleteByTemplate(duplicateId);
        templateQuestionStore.deleteByTemplate(duplicateId);
      }

      all.push({
        ...parsed.template,
        id: blob.id,
        isEnabled: true,
        syncedAt: incomingUpdatedAt,
      });
      localStorage.setItem("swish_templates", JSON.stringify(all));
    }

    templateSectionStore.deleteByTemplate(blob.id);
    templateQuestionStore.deleteByTemplate(blob.id);

    const rawSecs = localStorage.getItem("swish_tmpl_sections");
    const allSecs: unknown[] = rawSecs ? JSON.parse(rawSecs) : [];
    for (const sec of (parsed.sections ?? []) as unknown[]) {
      allSecs.push(sec);
    }
    localStorage.setItem("swish_tmpl_sections", JSON.stringify(allSecs));

    const rawQs = localStorage.getItem("swish_tmpl_questions");
    const allQs: unknown[] = rawQs ? JSON.parse(rawQs) : [];
    for (const q of (parsed.questions ?? []) as unknown[]) {
      allQs.push(q);
    }
    localStorage.setItem("swish_tmpl_questions", JSON.stringify(allQs));
  } catch (err) {
    console.error("[backendSync] Failed to apply template blob", blob.id, err);
  }
}

// ── Core sync operations ──────────────────────────────────────────────────

async function _pushTemplateNow(templateId: string): Promise<void> {
  const actor = await getActor();
  const template = templateStore.getById(templateId);
  if (!template) return;
  const dataJson = buildTemplateDataJson(templateId);
  const updatedAt = BigInt(Date.now() + 1);
  await actor.saveTemplateBlob({
    id: templateId,
    createdBy: template.createdBy ?? "",
    updatedAt,
    dataJson,
  });
  templateStore.update(templateId, { syncedAt: Number(updatedAt) } as any);
}

async function _deleteTemplateNow(templateId: string): Promise<void> {
  const actor = await getActor();
  await actor.deleteTemplateBlob(templateId);
}

async function _pushAuditNow(siteId: string): Promise<void> {
  const audit = auditStore.getLatestBySite(siteId);
  if (!audit) return;
  const actor = await getActor();
  await actor.saveAuditBlob({
    siteId,
    dataJson: audit.answersJson,
    status: audit.status,
    lastSavedAt: BigInt(audit.lastSavedAt),
  });
}

async function _pushUserNow(username: string): Promise<void> {
  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
  if (!user) return;
  const actor = await getActor();
  await actor.upsertAppUser(toCanisterUser(user));
}

// ── Flush offline queue ────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  const q = readQueue();
  if (!q.length) return;
  for (const item of q) {
    try {
      if (item.type === "pushTemplate") {
        await _pushTemplateNow(item.id);
        dequeue("pushTemplate", item.id);
      } else if (item.type === "deleteTemplate") {
        await _deleteTemplateNow(item.id);
        dequeue("deleteTemplate", item.id);
      } else if (item.type === "pushAudit") {
        await _pushAuditNow(item.id);
        dequeue("pushAudit", item.id);
      } else if (item.type === "pushUser") {
        await _pushUserNow(item.id);
        dequeue("pushUser", item.id);
      }
    } catch (err) {
      console.error(
        "[backendSync] Failed to flush queue item",
        item.type,
        item.id,
        err,
      );
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().catch(() => {});
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export const backendSync = {
  // ── Templates ──────────────────────────────────────────────────────────

  async loadTemplates(): Promise<void> {
    await flushQueue().catch(() => {});
    try {
      const actor = await getActor();

      dedupeLocalStorageTemplatesByName();

      const blobs: Array<{
        id: string;
        createdBy: string;
        updatedAt: bigint;
        dataJson: string;
      }> = await actor.listTemplateBlobs();

      const canisterIds = new Set(blobs.map((b) => b.id));

      const localTemplates = templateStore.getAll();
      for (const t of localTemplates) {
        if (!canisterIds.has(t.id)) {
          try {
            await _pushTemplateNow(t.id);
          } catch (err) {
            console.error("[backendSync] Failed to push template", t.id, err);
            enqueue({ type: "pushTemplate", id: t.id, ts: Date.now() });
          }
        }
      }

      const blobsByName = new Map<
        string,
        Array<{
          id: string;
          createdBy: string;
          updatedAt: bigint;
          dataJson: string;
        }>
      >();

      for (const blob of blobs) {
        try {
          const parsed = JSON.parse(blob.dataJson) as {
            template?: { name?: string };
          };
          const name = parsed.template?.name ?? blob.id;
          const group = blobsByName.get(name) ?? [];
          group.push(blob);
          blobsByName.set(name, group);
        } catch {
          const group = blobsByName.get(blob.id) ?? [];
          group.push(blob);
          blobsByName.set(blob.id, group);
        }
      }

      for (const [, group] of blobsByName) {
        if (group.length === 1) {
          applyTemplateBlob(group[0]);
          continue;
        }
        group.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
        applyTemplateBlob(group[0]);
        for (const dup of group.slice(1)) {
          actor.deleteTemplateBlob(dup.id).catch(() => {});
        }
      }

      dedupeLocalStorageTemplatesByName();
    } catch {
      // Offline — silently continue with localStorage
    }
  },

  async pushTemplateDirect(templateId: string): Promise<void> {
    const actor = await getActor();
    const template = templateStore.getById(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);
    const dataJson = buildTemplateDataJson(templateId);
    const updatedAt = BigInt(Date.now() + 1);
    await actor.saveTemplateBlob({
      id: templateId,
      createdBy: template.createdBy ?? "",
      updatedAt,
      dataJson,
    });
    templateStore.update(templateId, { syncedAt: Number(updatedAt) } as any);
  },

  pushTemplate(templateId: string): void {
    enqueue({ type: "pushTemplate", id: templateId, ts: Date.now() });
    flushQueue().catch(() => {});
  },

  deleteTemplate(templateId: string): void {
    _deleteTemplateNow(templateId).catch(() => {
      enqueue({ type: "deleteTemplate", id: templateId, ts: Date.now() });
    });
  },

  // ── Site audit reports ─────────────────────────────────────────────────

  /**
   * Load audit data for a specific site from the canister.
   * Called when opening a questionnaire — ensures latest data is shown.
   */
  async loadAudit(siteId: string): Promise<void> {
    try {
      const actor = await getActor();
      const blob: {
        siteId: string;
        dataJson: string;
        status: string;
        lastSavedAt: bigint;
      } | null = await actor.loadAuditBlob(siteId);

      if (!blob) return;

      const remoteTs = Number(blob.lastSavedAt);
      const localAudit = auditStore.getLatestBySite(siteId);
      const localTs = localAudit?.lastSavedAt ?? 0;

      if (remoteTs > localTs) {
        if (localAudit) {
          auditStore.update(localAudit.id, {
            answersJson: blob.dataJson,
            status: blob.status as Parameters<
              typeof auditStore.update
            >[1]["status"],
            lastSavedAt: remoteTs,
          });
        } else {
          auditStore.add({
            siteId,
            clientId: "",
            auditorId: "",
            auditorName: "",
            status: blob.status as Parameters<
              typeof auditStore.add
            >[0]["status"],
            answersJson: blob.dataJson,
            reviewComment: "",
            lastSavedAt: remoteTs,
          });
        }
      }
    } catch {
      // Offline — silently continue with localStorage
    }
  },

  /**
   * Pull all audits from the canister and merge into local storage.
   * Called on TaskListPage load so reviewers/managers see latest status
   * on any device without opening each audit individually.
   */
  async loadAllAudits(): Promise<void> {
    await flushQueue().catch(() => {});
    try {
      const actor = await getActor();
      const blobs: Array<{
        siteId: string;
        dataJson: string;
        status: string;
        lastSavedAt: bigint;
      }> = await actor.listAuditBlobs();

      for (const blob of blobs) {
        const remoteTs = Number(blob.lastSavedAt);
        const localAudit = auditStore.getLatestBySite(blob.siteId);
        const localTs = localAudit?.lastSavedAt ?? 0;

        if (remoteTs > localTs) {
          if (localAudit) {
            auditStore.update(localAudit.id, {
              answersJson: blob.dataJson,
              status: blob.status as Parameters<
                typeof auditStore.update
              >[1]["status"],
              lastSavedAt: remoteTs,
            });
          } else {
            auditStore.add({
              siteId: blob.siteId,
              clientId: "",
              auditorId: "",
              auditorName: "",
              status: blob.status as Parameters<
                typeof auditStore.add
              >[0]["status"],
              answersJson: blob.dataJson,
              reviewComment: "",
              lastSavedAt: remoteTs,
            });
          }
        }
      }
    } catch {
      // Offline — silently continue with localStorage
    }
  },

  /**
   * Background-push audit data to the canister.
   * Called on every auto-save.
   */
  pushAudit(siteId: string): void {
    _pushAuditNow(siteId).catch(() => {
      enqueue({ type: "pushAudit", id: siteId, ts: Date.now() });
    });
  },

  // ── Users ──────────────────────────────────────────────────────────────

  /**
   * Load all users from the canister and merge into local storage.
   *
   * Strategy:
   * 1. Flush any pending local pushes first.
   * 2. Pull all users from canister.
   * 3. Apply canister users that are missing locally (new device bootstrap).
   * 4. Push any local users not yet in the canister (recovery after reset).
   *
   * Conflict resolution: canister wins for users it already has.
   * Local-only users (e.g. admin seeded before network) are pushed up.
   */
  async loadUsers(): Promise<void> {
    await flushQueue().catch(() => {});
    try {
      const actor = await getActor();

      // Use listAppUsersWithPasswords so new devices can fully bootstrap
      // user accounts (including passwords) from the canister.
      const canisterUsers: Array<{
        username: string;
        fullName: string;
        role: { admin?: null; manager?: null; reviewer?: null; auditor?: null };
        originalRole: {
          admin?: null;
          manager?: null;
          reviewer?: null;
          auditor?: null;
        };
        isEnabled: boolean;
        elevatedUntil: [] | [bigint];
        passwordHash: string;
      }> = await actor.listAppUsersWithPasswords();

      const canisterUsernames = new Set(
        canisterUsers.map((u) => u.username.toLowerCase()),
      );

      // Helper: convert Motoko variant role to string
      function roleToStr(r: {
        admin?: null;
        manager?: null;
        reviewer?: null;
        auditor?: null;
      }): StoredUser["role"] {
        if ("admin" in r) return "admin";
        if ("manager" in r) return "manager";
        if ("reviewer" in r) return "reviewer";
        return "auditor";
      }

      // Apply canister users to localStorage (add missing, update existing)
      for (const cu of canisterUsers) {
        const local = getUsers().find(
          (u) => u.username.toLowerCase() === cu.username.toLowerCase(),
        );
        const role = roleToStr(cu.role);
        const originalRole = roleToStr(cu.originalRole);
        const elevatedUntil =
          cu.elevatedUntil.length > 0 ? Number(cu.elevatedUntil[0]) : null;

        if (!local) {
          // New device: create user account locally from canister data.
          // passwordHash field stores the plain-text password (upsertAppUser sends it as-is).
          addUser({
            username: cu.username,
            password: cu.passwordHash,
            fullName: cu.fullName,
            role,
            originalRole,
            elevatedUntil,
            isEnabled: cu.isEnabled,
          });
        } else {
          // User exists locally — sync role/enabled/fullName status from canister
          const updates: Partial<StoredUser> = {};
          if (local.role !== role) updates.role = role;
          if (local.originalRole !== originalRole)
            updates.originalRole = originalRole;
          if (local.isEnabled !== cu.isEnabled)
            updates.isEnabled = cu.isEnabled;
          if (local.fullName !== cu.fullName) updates.fullName = cu.fullName;
          if (local.elevatedUntil !== elevatedUntil)
            updates.elevatedUntil = elevatedUntil;
          // Also sync password if canister has a non-empty one and local password is placeholder
          if (
            cu.passwordHash &&
            (!local.password || local.password === "__canister_sync__")
          ) {
            updates.password = cu.passwordHash;
          }
          if (Object.keys(updates).length > 0) {
            updateUser(local.id, updates);
          }
        }
      }

      // Push local users that are NOT in the canister (bootstrap / recovery)
      const localUsers = getUsers();
      for (const user of localUsers) {
        if (!canisterUsernames.has(user.username.toLowerCase())) {
          try {
            await _pushUserNow(user.username);
          } catch (err) {
            console.error(
              "[backendSync] Failed to push user",
              user.username,
              err,
            );
            enqueue({ type: "pushUser", id: user.username, ts: Date.now() });
          }
        }
      }
    } catch {
      // Offline — silently continue with localStorage
    }
  },

  /**
   * Background-push a user to the canister after saving to localStorage.
   * Fire-and-forget. If offline, enqueues for later.
   */
  pushUser(username: string): void {
    _pushUserNow(username).catch(() => {
      enqueue({ type: "pushUser", id: username, ts: Date.now() });
    });
  },

  /**
   * Directly push a user to the canister. Throws on failure.
   */
  async pushUserDirect(username: string): Promise<void> {
    await _pushUserNow(username);
  },
};
