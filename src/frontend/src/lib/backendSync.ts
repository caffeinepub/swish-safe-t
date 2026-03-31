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
const TEMPLATES_PUSHED_FLAG = "swish_sync_templates_pushed";

// ── Actor helper (same pattern as backendUserService.ts) ──────────────────

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
  // Deduplicate: replace existing entry with same type+id
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

/**
 * Deduplicate swish_templates in localStorage by name.
 * For each group of same-name entries, keep the one with the highest createdAt.
 */
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
        // Keep the one with the higher createdAt
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

    // Remove duplicates from templates list
    const deduped = all.filter((t) => !toRemoveIds.has(t.id as string));
    localStorage.setItem("swish_templates", JSON.stringify(deduped));

    // Clean up sections and questions for removed IDs
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

    // Merge template record
    const existing = templateStore.getById(blob.id);
    const incomingUpdatedAt = Number(blob.updatedAt);

    // Only overwrite if canister has newer version
    if (existing) {
      const localTs = (existing as { createdAt?: number }).createdAt ?? 0;
      if (incomingUpdatedAt <= localTs) return;
      templateStore.update(blob.id, {
        ...(parsed.template as object),
        id: blob.id,
      } as Parameters<typeof templateStore.update>[1]);
    } else {
      // Insert — write directly to localStorage, preventing same-name duplicates
      const all = JSON.parse(
        localStorage.getItem("swish_templates") ?? "[]",
      ) as Array<Record<string, unknown>>;

      const incomingName = (parsed.template.name as string) ?? "";

      // Check for an existing entry with the same name
      const duplicateIdx = all.findIndex(
        (t) => (t.name as string) === incomingName,
      );
      if (duplicateIdx !== -1) {
        const duplicateId = all[duplicateIdx].id as string;
        // Remove the old duplicate entry and clean its sections/questions
        all.splice(duplicateIdx, 1);
        templateSectionStore.deleteByTemplate(duplicateId);
        templateQuestionStore.deleteByTemplate(duplicateId);
      }

      all.push({ ...parsed.template, id: blob.id, isEnabled: true });
      localStorage.setItem("swish_templates", JSON.stringify(all));
    }

    // Replace sections and questions for this template
    templateSectionStore.deleteByTemplate(blob.id);
    templateQuestionStore.deleteByTemplate(blob.id);

    // Re-add sections
    const rawSecs = localStorage.getItem("swish_tmpl_sections");
    const allSecs: unknown[] = rawSecs ? JSON.parse(rawSecs) : [];
    for (const sec of (parsed.sections ?? []) as unknown[]) {
      allSecs.push(sec);
    }
    localStorage.setItem("swish_tmpl_sections", JSON.stringify(allSecs));

    // Re-add questions
    const rawQs = localStorage.getItem("swish_tmpl_questions");
    const allQs: unknown[] = rawQs ? JSON.parse(rawQs) : [];
    for (const q of (parsed.questions ?? []) as unknown[]) {
      allQs.push(q);
    }
    localStorage.setItem("swish_tmpl_questions", JSON.stringify(allQs));
  } catch {
    /* malformed blob — skip */
  }
}

// ── Core sync operations ──────────────────────────────────────────────────

async function _pushTemplateNow(templateId: string): Promise<void> {
  const actor = await getActor();
  const template = templateStore.getById(templateId);
  if (!template) return;
  const dataJson = buildTemplateDataJson(templateId);
  await actor.saveTemplateBlob({
    id: templateId,
    createdBy: template.createdBy ?? "",
    updatedAt: BigInt(template.createdAt ?? Date.now()),
    dataJson,
  });
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
    } catch {
      // Leave in queue for next reconnect
    }
  }
}

// Register reconnect handler once
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().catch(() => {});
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export const backendSync = {
  /**
   * Load all templates from the canister.
   * Updates localStorage stores from canister blobs (canister wins if newer).
   * On first ever call, pushes any existing localStorage templates to canister.
   */
  async loadTemplates(): Promise<void> {
    try {
      const actor = await getActor();

      // First-time bootstrap: push local templates to canister
      const alreadyPushed = localStorage.getItem(TEMPLATES_PUSHED_FLAG);
      if (!alreadyPushed) {
        // Deduplicate localStorage templates by name before pushing
        dedupeLocalStorageTemplatesByName();

        const localTemplates = templateStore.getAll();
        for (const t of localTemplates) {
          try {
            await _pushTemplateNow(t.id);
          } catch {
            /* skip failed individual pushes */
          }
        }
        localStorage.setItem(TEMPLATES_PUSHED_FLAG, "1");
      }

      // Pull from canister — deduplicate by name, keep highest updatedAt
      const blobs: Array<{
        id: string;
        createdBy: string;
        updatedAt: bigint;
        dataJson: string;
      }> = await actor.listTemplateBlobs();

      // Group blobs by template name
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
          // Malformed — treat id as name to avoid losing the blob
          const group = blobsByName.get(blob.id) ?? [];
          group.push(blob);
          blobsByName.set(blob.id, group);
        }
      }

      // For each group: keep the one with highest updatedAt, delete the rest
      for (const [, group] of blobsByName) {
        if (group.length === 1) {
          applyTemplateBlob(group[0]);
          continue;
        }

        // Sort descending by updatedAt — winner is first
        group.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
        const winner = group[0];
        applyTemplateBlob(winner);

        // Delete duplicates from canister (fire-and-forget)
        for (const dup of group.slice(1)) {
          actor.deleteTemplateBlob(dup.id).catch(() => {});
        }
      }

      // Final pass: deduplicate localStorage in case it already had duplicates
      dedupeLocalStorageTemplatesByName();
    } catch {
      // Offline — silently continue with localStorage
    }
  },

  /**
   * Background-push a template to the canister after saving to localStorage.
   * Fire-and-forget. If offline, enqueues for later.
   */
  pushTemplate(templateId: string): void {
    _pushTemplateNow(templateId).catch(() => {
      enqueue({ type: "pushTemplate", id: templateId, ts: Date.now() });
    });
  },

  /**
   * Background-delete a template from the canister.
   * Fire-and-forget. If offline, enqueues for later.
   */
  deleteTemplate(templateId: string): void {
    _deleteTemplateNow(templateId).catch(() => {
      enqueue({ type: "deleteTemplate", id: templateId, ts: Date.now() });
    });
  },

  /**
   * Load audit data for a specific site from the canister.
   * If canister has newer data, updates localStorage.
   * If offline, silently continues with localStorage data.
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
        // Canister has newer data — update localStorage
        if (localAudit) {
          auditStore.update(localAudit.id, {
            answersJson: blob.dataJson,
            status: blob.status as Parameters<
              typeof auditStore.update
            >[1]["status"],
            lastSavedAt: remoteTs,
          });
        } else {
          // No local audit yet — create one
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
   * Background-push audit data to the canister after saving to localStorage.
   * Fire-and-forget. If offline, enqueues for later.
   */
  pushAudit(siteId: string): void {
    _pushAuditNow(siteId).catch(() => {
      enqueue({ type: "pushAudit", id: siteId, ts: Date.now() });
    });
  },
};
