import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  auditStore,
  clientStore,
  siteStore,
  templateQuestionStore,
  templateSectionStore,
  templateStore,
} from "../lib/dataStore";
import {
  type Session,
  clearSession,
  getSession,
  setSession,
} from "../lib/session";
import {
  type StoredUser,
  addUser,
  getUserByUsername,
  hasAdmin,
  isTempAdmin,
  updateUser,
} from "../lib/userStore";

// ── Version key ───────────────────────────────────────────────────────────
// Bump this to wipe old localStorage data and re-seed with new credentials.
const DATA_VERSION = "SWISH_DATA_V4";
const ADMIN_USERNAME = "APA_Arun";
const ADMIN_PASSWORD = "SWiSH_SafeArun@21";

function clearLocalData() {
  const keysToRemove = [
    "swish_clients",
    "swish_sites",
    "swish_templates",
    "swish_tmpl_sections",
    "swish_tmpl_questions",
    "swish_audits",
    "swish_sections",
    "swish_questions",
    "swish_users",
    // clear old version data_version keys
    "swish_data_version",
  ];
  // Also clear any audit drafts
  const draftKeys = Object.keys(localStorage).filter((k) =>
    k.startsWith("audit_draft_"),
  );
  for (const key of [...keysToRemove, ...draftKeys]) {
    localStorage.removeItem(key);
  }
}

function ensureAdminSeeded() {
  if (hasAdmin()) return;
  addUser({
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    fullName: "APA Arun",
    role: "admin",
    originalRole: "admin",
    elevatedUntil: null,
    isEnabled: true,
  });
}

function seedLocalDataIfNeeded() {
  const currentVersion = localStorage.getItem("swish_data_version");
  if (currentVersion !== DATA_VERSION) {
    clearLocalData();
    localStorage.setItem("swish_data_version", DATA_VERSION);
  }

  const clients = clientStore.getAll();
  if (clients.length > 0) return;

  const DEMO_AUDITOR_1_ID = "demo_auditor_1";
  const DEMO_AUDITOR_1_NAME = "Rajesh Kumar";
  const DEMO_AUDITOR_2_ID = "demo_auditor_2";
  const DEMO_AUDITOR_2_NAME = "Priya Sharma";
  const DEMO_REVIEWER_ID = "demo_reviewer_1";
  const DEMO_REVIEWER_NAME = "Anita Patel";
  const DEMO_MANAGER_ID = "demo_manager_1";
  const DEMO_MANAGER_NAME = "Vikram Singh";
  const ADMIN_ID = ADMIN_USERNAME;

  const tmpl = templateStore.add({
    name: "Banking Branch Electrical Audit",
    description: "Standard electrical safety audit for banking branches",
    createdBy: ADMIN_ID,
    createdAt: Date.now(),
    isEnabled: true,
  });

  const sec1 = templateSectionStore.add({
    templateId: tmpl.id,
    name: "Mains Meter",
    order: 0,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "Facility mains power supply type?",
    questionType: "dropdown",
    options: ["HT - High Tension", "LT - Low Tension"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: true,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "Check for Meter seal (un-Intact)?",
    questionType: "radio",
    options: ["OK", "Not OK", "NA"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: true,
    order: 1,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "General inspection - Environment cleanliness",
    questionType: "dropdown",
    options: ["Cleaned", "Dirty", "Needs Attention"],
    isMandatoryPhoto: false,
    enableImageUpload: false,
    imageUploadMandatory: false,
    order: 2,
    isEnabled: true,
  });

  const sec2 = templateSectionStore.add({
    templateId: tmpl.id,
    name: "Mains Incomer",
    order: 1,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec2.id,
    label: "Incomer rating (Amps)?",
    questionType: "dropdown",
    options: ["100A", "200A", "400A", "630A"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: true,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec2.id,
    label: "Cable condition?",
    questionType: "radio",
    options: ["Good", "Damaged", "Requires Replacement"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: false,
    order: 1,
    isEnabled: true,
  });

  const sec3 = templateSectionStore.add({
    templateId: tmpl.id,
    name: "Servo Stabilizer",
    order: 2,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec3.id,
    label: "Stabilizer installed?",
    questionType: "radio",
    options: ["Yes", "No", "NA"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: true,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec3.id,
    label: "Output voltage stable?",
    questionType: "radio",
    options: ["Yes", "No"],
    isMandatoryPhoto: false,
    enableImageUpload: false,
    imageUploadMandatory: false,
    order: 1,
    isEnabled: true,
  });

  const sec4 = templateSectionStore.add({
    templateId: tmpl.id,
    name: "Diesel Generator (DG)",
    order: 3,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec4.id,
    label: "DG Set capacity (KVA)?",
    questionType: "dropdown",
    options: ["15", "25", "62.5", "125", "250"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: true,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec4.id,
    label: "Last maintenance done?",
    questionType: "radio",
    options: ["Within 3 months", "3-6 months", "Over 6 months"],
    isMandatoryPhoto: false,
    enableImageUpload: true,
    imageUploadMandatory: false,
    order: 1,
    isEnabled: true,
  });

  const hdfc = clientStore.add({
    name: "HDFC Bank",
    industry: "Banking",
    contactName: "Suresh Mehta",
    contactEmail: "suresh@hdfc.com",
    isEnabled: true,
    createdBy: ADMIN_ID,
  });
  const idbi = clientStore.add({
    name: "IDBI Bank",
    industry: "Banking",
    contactName: "Kavita Rao",
    contactEmail: "kavita@idbi.com",
    isEnabled: true,
    createdBy: ADMIN_ID,
  });

  const s1 = siteStore.add({
    clientId: hdfc.id,
    branchName: "HDFC Andheri",
    branchAddress: "Andheri West, Mumbai",
    branchCode: "HDFC-MUM-001",
    branchCity: "Mumbai",
    branchState: "Maharashtra",
    branchType: "Metro",
    scheduledAuditDate: "2026-04-15",
    auditorId: DEMO_AUDITOR_1_ID,
    auditorName: DEMO_AUDITOR_1_NAME,
    reviewerId: DEMO_REVIEWER_ID,
    reviewerName: DEMO_REVIEWER_NAME,
    managerId: DEMO_MANAGER_ID,
    managerName: DEMO_MANAGER_NAME,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: ADMIN_ID,
  });
  const s2 = siteStore.add({
    clientId: hdfc.id,
    branchName: "HDFC Bandra",
    branchAddress: "Bandra West, Mumbai",
    branchCode: "HDFC-MUM-002",
    branchCity: "Mumbai",
    branchState: "Maharashtra",
    branchType: "Urban",
    scheduledAuditDate: "2026-04-22",
    auditorId: DEMO_AUDITOR_2_ID,
    auditorName: DEMO_AUDITOR_2_NAME,
    reviewerId: DEMO_REVIEWER_ID,
    reviewerName: DEMO_REVIEWER_NAME,
    managerId: DEMO_MANAGER_ID,
    managerName: DEMO_MANAGER_NAME,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: ADMIN_ID,
  });
  const s3 = siteStore.add({
    clientId: hdfc.id,
    branchName: "HDFC Kurla",
    branchAddress: "Kurla East, Mumbai",
    branchCode: "HDFC-MUM-003",
    branchCity: "Mumbai",
    branchState: "Maharashtra",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-03",
    auditorId: DEMO_AUDITOR_1_ID,
    auditorName: DEMO_AUDITOR_1_NAME,
    reviewerId: DEMO_REVIEWER_ID,
    reviewerName: DEMO_REVIEWER_NAME,
    managerId: DEMO_MANAGER_ID,
    managerName: DEMO_MANAGER_NAME,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: ADMIN_ID,
  });
  const s4 = siteStore.add({
    clientId: idbi.id,
    branchName: "IDBI Connaught Place",
    branchAddress: "Connaught Place, New Delhi",
    branchCode: "IDBI-DEL-001",
    branchCity: "New Delhi",
    branchState: "Delhi",
    branchType: "Metro",
    scheduledAuditDate: "2026-04-28",
    auditorId: DEMO_AUDITOR_2_ID,
    auditorName: DEMO_AUDITOR_2_NAME,
    reviewerId: DEMO_REVIEWER_ID,
    reviewerName: DEMO_REVIEWER_NAME,
    managerId: DEMO_MANAGER_ID,
    managerName: DEMO_MANAGER_NAME,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: ADMIN_ID,
  });
  const s5 = siteStore.add({
    clientId: idbi.id,
    branchName: "IDBI Karol Bagh",
    branchAddress: "Karol Bagh, New Delhi",
    branchCode: "IDBI-DEL-002",
    branchCity: "New Delhi",
    branchState: "Delhi",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-08",
    auditorId: DEMO_AUDITOR_1_ID,
    auditorName: DEMO_AUDITOR_1_NAME,
    reviewerId: DEMO_REVIEWER_ID,
    reviewerName: DEMO_REVIEWER_NAME,
    managerId: DEMO_MANAGER_ID,
    managerName: DEMO_MANAGER_NAME,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: ADMIN_ID,
  });

  const now = Date.now();
  const mo = 30 * 24 * 60 * 60 * 1000;
  for (const [, data] of [
    {
      siteId: s1.id,
      clientId: hdfc.id,
      offset: 0,
      status: "Draft" as const,
      auditorId: DEMO_AUDITOR_1_ID,
      auditorName: DEMO_AUDITOR_1_NAME,
    },
    {
      siteId: s2.id,
      clientId: hdfc.id,
      offset: 1,
      status: "Submitted" as const,
      auditorId: DEMO_AUDITOR_2_ID,
      auditorName: DEMO_AUDITOR_2_NAME,
    },
    {
      siteId: s3.id,
      clientId: hdfc.id,
      offset: 1,
      status: "PendingApproval" as const,
      auditorId: DEMO_AUDITOR_1_ID,
      auditorName: DEMO_AUDITOR_1_NAME,
    },
    {
      siteId: s4.id,
      clientId: idbi.id,
      offset: 2,
      status: "Completed" as const,
      auditorId: DEMO_AUDITOR_2_ID,
      auditorName: DEMO_AUDITOR_2_NAME,
    },
    {
      siteId: s5.id,
      clientId: idbi.id,
      offset: 3,
      status: "PendingApproval" as const,
      auditorId: DEMO_AUDITOR_1_ID,
      auditorName: DEMO_AUDITOR_1_NAME,
    },
  ].entries()) {
    auditStore.add({
      siteId: data.siteId,
      clientId: data.clientId,
      auditorId: data.auditorId,
      auditorName: data.auditorName,
      status: data.status,
      answersJson: "{}",
      reviewComment: "",
      lastSavedAt: now - data.offset * mo,
      startedAt: now - data.offset * mo,
    });
  }
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: false,
  login: async () => ({ success: false }),
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() =>
    getSession(),
  );
  const [isLoading] = useState(false);

  useEffect(() => {
    seedLocalDataIfNeeded();
    ensureAdminSeeded();
  }, []);

  const login = useCallback(
    (
      username: string,
      password: string,
    ): Promise<{ success: boolean; error?: string }> => {
      // Ensure admin always exists (sync, no async)
      ensureAdminSeeded();

      const user = getUserByUsername(username);

      if (!user || user.password !== password) {
        return Promise.resolve({
          success: false,
          error: "Invalid username or password",
        });
      }
      if (!user.isEnabled) {
        return Promise.resolve({
          success: false,
          error: "Your account has been disabled. Contact your admin.",
        });
      }

      // Check temp admin expiry
      if (user.elevatedUntil && Date.now() > user.elevatedUntil) {
        updateUser(user.id, { role: user.originalRole, elevatedUntil: null });
        user.role = user.originalRole;
        user.elevatedUntil = null;
      }

      const sess = setSession(user);
      setSessionState(sess);
      return Promise.resolve({ success: true });
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const refresh = useCallback(() => {
    const existing = getSession();
    if (existing) {
      const user = getUserByUsername(existing.username);
      if (user?.isEnabled) {
        setSessionState(setSession(user));
      } else {
        clearSession();
        setSessionState(null);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, isLoading, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
export { isTempAdmin, type StoredUser };
