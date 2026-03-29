// Local data store for clients, sites, etc.

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  isEnabled: boolean;
  createdBy: string;
}

export interface Site {
  id: string;
  clientId: string;
  branchName: string;
  branchAddress: string;
  branchCode: string;
  branchCity: string;
  branchState: string;
  branchType: string;
  scheduledAuditDate: string;
  auditorId: string;
  auditorName: string;
  reviewerId: string;
  reviewerName: string;
  managerId: string;
  managerName: string;
  isEnabled: boolean;
  createdBy?: string;
  templateId?: string;
  // Legacy compat
  siteName?: string;
  address?: string;
  siteCode?: string;
  city?: string;
  state?: string;
  region?: string;
  scheduledDate?: string;
  assignedAuditorId?: string;
  assignedAuditorName?: string;
}

export interface Section {
  id: string;
  clientId: string;
  name: string;
  order: number;
}

export interface Question {
  id: string;
  sectionId: string;
  clientId: string;
  label: string;
  questionType: "radio" | "dropdown" | "remarks" | "imageUpload";
  options: string[];
  isMandatoryPhoto: boolean;
  order: number;
  isEnabled: boolean;
}

export interface QuestionTemplate {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  isEnabled: boolean;
}

export interface TemplateSection {
  id: string;
  templateId: string;
  name: string;
  order: number;
}

export interface TemplateQuestion {
  id: string;
  templateId: string;
  sectionId: string;
  label: string;
  /** Only 'radio' | 'dropdown' for new templates. Legacy values kept for compat. */
  questionType: "radio" | "dropdown" | "remarks" | "imageUpload";
  options: string[];
  /** @deprecated use enableImageUpload + imageUploadMandatory instead */
  isMandatoryPhoto: boolean;
  /** Whether this question has an image upload field */
  enableImageUpload: boolean;
  /** Whether at least one image is required for submission */
  imageUploadMandatory: boolean;
  order: number;
  isEnabled: boolean;
}

/** Per-question answer stored in audit answersJson */
export interface QuestionAnswer {
  answer: string;
  remarks: string;
  images: string[];
}

export type AuditAnswers = Record<string, QuestionAnswer>;

export interface Audit {
  id: string;
  siteId: string;
  clientId: string;
  auditorId: string;
  auditorName: string;
  status: "Draft" | "Submitted" | "Reviewed" | "PendingReReview" | "Completed";
  answersJson: string;
  reviewComment: string;
  lastSavedAt: number;
  startedAt?: number;
}

function loadKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveKey<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const clientStore = {
  getAll: (): Client[] => loadKey<Client>("swish_clients"),
  getById: (id: string): Client | null =>
    loadKey<Client>("swish_clients").find((c) => c.id === id) ?? null,
  add: (c: Omit<Client, "id">): Client => {
    const clients = loadKey<Client>("swish_clients");
    const newClient = {
      ...c,
      id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    saveKey("swish_clients", [...clients, newClient]);
    return newClient;
  },
  update: (id: string, updates: Partial<Client>) => {
    const clients = loadKey<Client>("swish_clients");
    saveKey(
      "swish_clients",
      clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  },
  delete: (id: string) => {
    const clients = loadKey<Client>("swish_clients");
    saveKey(
      "swish_clients",
      clients.map((c) => (c.id === id ? { ...c, isEnabled: false } : c)),
    );
  },
};

export const siteStore = {
  getAll: (): Site[] => loadKey<Site>("swish_sites"),
  getByClient: (clientId: string): Site[] =>
    loadKey<Site>("swish_sites").filter(
      (s) => s.clientId === clientId && s.isEnabled,
    ),
  getById: (id: string): Site | null =>
    loadKey<Site>("swish_sites").find((s) => s.id === id) ?? null,
  getAssignedToUser: (userId: string, role: string): Site[] => {
    const all = loadKey<Site>("swish_sites").filter((s) => s.isEnabled);
    if (role === "admin") return all;
    if (role === "auditor")
      return all.filter(
        (s) => s.auditorId === userId || s.assignedAuditorId === userId,
      );
    if (role === "reviewer") return all.filter((s) => s.reviewerId === userId);
    if (role === "manager") return all.filter((s) => s.managerId === userId);
    return [];
  },
  add: (s: Omit<Site, "id">): Site => {
    const sites = loadKey<Site>("swish_sites");
    const newSite = {
      ...s,
      id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    saveKey("swish_sites", [...sites, newSite]);
    return newSite;
  },
  update: (id: string, updates: Partial<Site>) => {
    const sites = loadKey<Site>("swish_sites");
    saveKey(
      "swish_sites",
      sites.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  },
  delete: (id: string) => {
    const sites = loadKey<Site>("swish_sites");
    saveKey(
      "swish_sites",
      sites.map((s) => (s.id === id ? { ...s, isEnabled: false } : s)),
    );
  },
};

export const sectionStore = {
  getByClient: (clientId: string): Section[] =>
    loadKey<Section>("swish_sections")
      .filter((s) => s.clientId === clientId)
      .sort((a, b) => a.order - b.order),
  add: (s: Omit<Section, "id">): Section => {
    const sections = loadKey<Section>("swish_sections");
    const newSection = { ...s, id: `section_${Date.now()}` };
    saveKey("swish_sections", [...sections, newSection]);
    return newSection;
  },
  update: (id: string, updates: Partial<Section>) => {
    const sections = loadKey<Section>("swish_sections");
    saveKey(
      "swish_sections",
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  },
  delete: (id: string) => {
    const sections = loadKey<Section>("swish_sections");
    saveKey(
      "swish_sections",
      sections.filter((s) => s.id !== id),
    );
  },
};

export const questionStore = {
  getByClient: (clientId: string): Question[] =>
    loadKey<Question>("swish_questions")
      .filter((q) => q.clientId === clientId && q.isEnabled)
      .sort((a, b) => a.order - b.order),
  getBySection: (sectionId: string): Question[] =>
    loadKey<Question>("swish_questions")
      .filter((q) => q.sectionId === sectionId && q.isEnabled)
      .sort((a, b) => a.order - b.order),
  add: (q: Omit<Question, "id">): Question => {
    const questions = loadKey<Question>("swish_questions");
    const newQuestion = { ...q, id: `q_${Date.now()}` };
    saveKey("swish_questions", [...questions, newQuestion]);
    return newQuestion;
  },
  update: (id: string, updates: Partial<Question>) => {
    const questions = loadKey<Question>("swish_questions");
    saveKey(
      "swish_questions",
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  },
  delete: (id: string) => {
    const questions = loadKey<Question>("swish_questions");
    saveKey(
      "swish_questions",
      questions.map((q) => (q.id === id ? { ...q, isEnabled: false } : q)),
    );
  },
};

export const templateStore = {
  getAll: (): QuestionTemplate[] =>
    loadKey<QuestionTemplate>("swish_templates").filter((t) => t.isEnabled),
  getById: (id: string): QuestionTemplate | null =>
    loadKey<QuestionTemplate>("swish_templates").find((t) => t.id === id) ??
    null,
  add: (t: Omit<QuestionTemplate, "id">): QuestionTemplate => {
    const templates = loadKey<QuestionTemplate>("swish_templates");
    const newT = {
      ...t,
      id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    saveKey("swish_templates", [...templates, newT]);
    return newT;
  },
  update: (id: string, updates: Partial<QuestionTemplate>) => {
    const templates = loadKey<QuestionTemplate>("swish_templates");
    saveKey(
      "swish_templates",
      templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  },
  delete: (id: string) => {
    const templates = loadKey<QuestionTemplate>("swish_templates");
    saveKey(
      "swish_templates",
      templates.map((t) => (t.id === id ? { ...t, isEnabled: false } : t)),
    );
  },
};

export const templateSectionStore = {
  getByTemplate: (templateId: string): TemplateSection[] =>
    loadKey<TemplateSection>("swish_tmpl_sections")
      .filter((s) => s.templateId === templateId)
      .sort((a, b) => a.order - b.order),
  add: (s: Omit<TemplateSection, "id">): TemplateSection => {
    const items = loadKey<TemplateSection>("swish_tmpl_sections");
    const newItem = {
      ...s,
      id: `tsec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    saveKey("swish_tmpl_sections", [...items, newItem]);
    return newItem;
  },
  update: (id: string, updates: Partial<TemplateSection>) => {
    const items = loadKey<TemplateSection>("swish_tmpl_sections");
    saveKey(
      "swish_tmpl_sections",
      items.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  },
  delete: (id: string) => {
    const items = loadKey<TemplateSection>("swish_tmpl_sections");
    saveKey(
      "swish_tmpl_sections",
      items.filter((s) => s.id !== id),
    );
  },
  deleteByTemplate: (templateId: string) => {
    const items = loadKey<TemplateSection>("swish_tmpl_sections");
    saveKey(
      "swish_tmpl_sections",
      items.filter((s) => s.templateId !== templateId),
    );
  },
};

export const templateQuestionStore = {
  getByTemplate: (templateId: string): TemplateQuestion[] =>
    loadKey<TemplateQuestion>("swish_tmpl_questions")
      .filter((q) => q.templateId === templateId && q.isEnabled)
      .sort((a, b) => a.order - b.order),
  getBySection: (sectionId: string): TemplateQuestion[] =>
    loadKey<TemplateQuestion>("swish_tmpl_questions")
      .filter((q) => q.sectionId === sectionId && q.isEnabled)
      .sort((a, b) => a.order - b.order),
  add: (q: Omit<TemplateQuestion, "id">): TemplateQuestion => {
    const items = loadKey<TemplateQuestion>("swish_tmpl_questions");
    const newItem = {
      ...q,
      id: `tq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    saveKey("swish_tmpl_questions", [...items, newItem]);
    return newItem;
  },
  update: (id: string, updates: Partial<TemplateQuestion>) => {
    const items = loadKey<TemplateQuestion>("swish_tmpl_questions");
    saveKey(
      "swish_tmpl_questions",
      items.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    );
  },
  delete: (id: string) => {
    const items = loadKey<TemplateQuestion>("swish_tmpl_questions");
    saveKey(
      "swish_tmpl_questions",
      items.map((q) => (q.id === id ? { ...q, isEnabled: false } : q)),
    );
  },
  deleteByTemplate: (templateId: string) => {
    const items = loadKey<TemplateQuestion>("swish_tmpl_questions");
    saveKey(
      "swish_tmpl_questions",
      items.filter((q) => q.templateId !== templateId),
    );
  },
};

export const auditStore = {
  getAll: (): Audit[] => loadKey<Audit>("swish_audits"),
  getBySite: (siteId: string): Audit[] =>
    loadKey<Audit>("swish_audits").filter((a) => a.siteId === siteId),
  getByAuditor: (auditorId: string): Audit[] =>
    loadKey<Audit>("swish_audits").filter((a) => a.auditorId === auditorId),
  getById: (id: string): Audit | null =>
    loadKey<Audit>("swish_audits").find((a) => a.id === id) ?? null,
  getLatestBySite: (siteId: string): Audit | null => {
    const audits = loadKey<Audit>("swish_audits").filter(
      (a) => a.siteId === siteId,
    );
    if (!audits.length) return null;
    return audits.sort((a, b) => b.lastSavedAt - a.lastSavedAt)[0];
  },
  add: (a: Omit<Audit, "id">): Audit => {
    const audits = loadKey<Audit>("swish_audits");
    const newAudit = { ...a, id: `audit_${Date.now()}` };
    saveKey("swish_audits", [...audits, newAudit]);
    return newAudit;
  },
  update: (id: string, updates: Partial<Audit>) => {
    const audits = loadKey<Audit>("swish_audits");
    saveKey(
      "swish_audits",
      audits.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  },
};
