import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getUserByUsernameFromBackend,
  seedAdminToBackend,
  verifyCredentialsFromBackend,
} from "../lib/backendUserService";
import { hashPassword } from "../lib/crypto";
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
import { type StoredUser, isTempAdmin } from "../lib/userStore";

const DATA_VERSION = "v8_stable_backend";
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
    "swish_session",
    "swish_admin_claimed",
  ];
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

async function ensureAdminSeeded() {
  const adminHash = await hashPassword(ADMIN_USERNAME, ADMIN_PASSWORD);
  await seedAdminToBackend(adminHash);
}

/** Seed local demo data (clients, sites, templates) — does NOT touch backend */
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
      status: "Reviewed" as const,
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
      status: "Reviewed" as const,
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
  // Restore session synchronously from localStorage so login screen shows INSTANTLY
  const [session, setSessionState] = useState<Session | null>(() =>
    getSession(),
  );
  // isLoading is NEVER true on startup — login screen must show immediately
  const [isLoading] = useState(false);

  useEffect(() => {
    // 1. Seed local demo data (localStorage, synchronous-ish)
    seedLocalDataIfNeeded();

    // 2. Seed admin to backend in background — fire and forget, never blocks UI
    ensureAdminSeeded().catch(() => {});

    // 3. If we have a cached session, silently validate it against backend in background
    const existing = getSession();
    if (existing) {
      getUserByUsernameFromBackend(existing.username)
        .then((freshUser) => {
          if (freshUser?.isEnabled) {
            setSessionState(setSession(freshUser));
          } else if (freshUser && !freshUser.isEnabled) {
            // Account disabled — log out
            clearSession();
            setSessionState(null);
          }
          // If freshUser is null (backend unreachable), keep the cached session
        })
        .catch(() => {}); // Never crash on background validation failure
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const hash = await hashPassword(username, password);

      // Use verifyAppUserCredentials — the correct backend API
      let valid = await verifyCredentialsFromBackend(username, hash);

      // Self-healing: if admin verification fails, the canister may be fresh.
      // Re-seed the admin and retry once.
      if (!valid && username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        await ensureAdminSeeded();
        valid = await verifyCredentialsFromBackend(username, hash);
      }

      if (!valid) {
        return { success: false, error: "Invalid username or password" };
      }

      // Fetch user profile
      const user = await getUserByUsernameFromBackend(username);
      if (!user) {
        return { success: false, error: "User not found. Please try again." };
      }
      if (!user.isEnabled) {
        return {
          success: false,
          error: "Your account has been disabled. Contact your admin.",
        };
      }

      const sess = setSession(user);
      setSessionState(sess);
      return { success: true };
    } catch (err) {
      console.error("[AuthContext] login error:", err);
      return {
        success: false,
        error: "Connection error. Please check your network and try again.",
      };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const refresh = useCallback(async () => {
    const existing = getSession();
    if (existing) {
      const freshUser = await getUserByUsernameFromBackend(existing.username);
      if (freshUser?.isEnabled) {
        setSessionState(setSession(freshUser));
      } else if (freshUser && !freshUser.isEnabled) {
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
