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
      // Insert — write directly to localStorage
      const all = JSON.parse(
        localStorage.getItem("swish_templates") ?? "[]",
      ) as unknown[];
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

      // Pull from canister
      const blobs: Array<{
        id: string;
        createdBy: string;
        updatedAt: bigint;
        dataJson: string;
      }> = await actor.listTemplateBlobs();

      for (const blob of blobs) {
        applyTemplateBlob(blob);
      }
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
