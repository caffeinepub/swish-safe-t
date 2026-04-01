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

// ── Types ─────────────────────────────────────────────────────────────────

interface SyncQueueItem {
  type: "pushTemplate" | "deleteTemplate" | "pushAudit";
  id: string;
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
      // Use a dedicated syncedAt timestamp for comparison, falling back to createdAt
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
      // Insert — write directly to localStorage, preventing same-name duplicates
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

    // Replace sections and questions for this template
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
  // Use Date.now() + 1 to always be newer than the canister's current entry
  const updatedAt = BigInt(Date.now() + 1);
  await actor.saveTemplateBlob({
    id: templateId,
    createdBy: template.createdBy ?? "",
    updatedAt,
    dataJson,
  });
  // Mark local copy with the timestamp we pushed so we don't pull it back as newer
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
      }
    } catch (err) {
      console.error(
        "[backendSync] Failed to flush queue item",
        item.type,
        item.id,
        err,
      );
      // Leave in queue for next reconnect
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
  /**
   * Load all templates from the canister.
   *
   * Strategy:
   * 1. Flush any pending local pushes to canister first.
   * 2. Push any local templates that the canister does NOT have (bootstrap + recovery).
   * 3. Pull from canister — apply any blobs newer than local copies.
   * 4. Deduplicate local storage.
   */
  async loadTemplates(): Promise<void> {
    await flushQueue().catch(() => {});
    try {
      const actor = await getActor();

      // Deduplicate local storage before any sync
      dedupeLocalStorageTemplatesByName();

      // Pull current canister blobs (used for both push-guard and pull)
      const blobs: Array<{
        id: string;
        createdBy: string;
        updatedAt: bigint;
        dataJson: string;
      }> = await actor.listTemplateBlobs();

      // Build a map of canister blob IDs for quick lookup
      const canisterIds = new Set(blobs.map((b) => b.id));

      // Push local templates that are missing from the canister
      // (handles first-time bootstrap AND recovery after canister resets)
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

      // Group canister blobs by template name, keep winner (highest updatedAt)
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

  /**
   * Directly push a template to the canister. Throws on failure (no silent catch).
   * Use this for immediate sync — fall back to pushTemplate() if it throws.
   */
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

  /**
   * Background-push a template to the canister after saving to localStorage.
   * Fire-and-forget. If offline, enqueues for later.
   */
  pushTemplate(templateId: string): void {
    enqueue({ type: "pushTemplate", id: templateId, ts: Date.now() });
    flushQueue().catch(() => {});
  },

  /**
   * Background-delete a template from the canister.
   */
  deleteTemplate(templateId: string): void {
    _deleteTemplateNow(templateId).catch(() => {
      enqueue({ type: "deleteTemplate", id: templateId, ts: Date.now() });
    });
  },

  /**
   * Load audit data for a specific site from the canister.
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
   * Background-push audit data to the canister.
   */
  pushAudit(siteId: string): void {
    _pushAuditNow(siteId).catch(() => {
      enqueue({ type: "pushAudit", id: siteId, ts: Date.now() });
    });
  },
};
