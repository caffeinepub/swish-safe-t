import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
import {
  type StoredUser,
  addUser,
  checkTempAdminExpiry,
  getUserByUsername,
  getUsers,
  hasAdmin,
  isTempAdmin,
} from "../lib/userStore";

const DATA_VERSION = "v3_remarks_per_question";

function clearAllData() {
  const keysToRemove = [
    "swish_users",
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

async function seedIfNeeded() {
  // Version migration: clear and re-seed if data version changed
  const currentVersion = localStorage.getItem("swish_data_version");
  if (currentVersion !== DATA_VERSION) {
    clearAllData();
    localStorage.setItem("swish_data_version", DATA_VERSION);
  }

  const users = getUsers();
  if (users.length > 0) return;

  const adminHash = await hashPassword("admin", "Admin@1234");
  const admin = addUser({
    username: "admin",
    passwordHash: adminHash,
    fullName: "Admin User",
    role: "admin",
    originalRole: "admin",
    elevatedUntil: null,
    isEnabled: true,
  });
  const a1Hash = await hashPassword("auditor1", "Audit@1234");
  const auditor1 = addUser({
    username: "auditor1",
    passwordHash: a1Hash,
    fullName: "Rajesh Kumar",
    role: "auditor",
    originalRole: "auditor",
    elevatedUntil: null,
    isEnabled: true,
  });
  const a2Hash = await hashPassword("auditor2", "Audit@1234");
  const auditor2 = addUser({
    username: "auditor2",
    passwordHash: a2Hash,
    fullName: "Priya Sharma",
    role: "auditor",
    originalRole: "auditor",
    elevatedUntil: null,
    isEnabled: true,
  });
  const r1Hash = await hashPassword("reviewer1", "Review@1234");
  const reviewer1 = addUser({
    username: "reviewer1",
    passwordHash: r1Hash,
    fullName: "Anita Patel",
    role: "reviewer",
    originalRole: "reviewer",
    elevatedUntil: null,
    isEnabled: true,
  });
  const m1Hash = await hashPassword("manager1", "Manager@1234");
  const manager1 = addUser({
    username: "manager1",
    passwordHash: m1Hash,
    fullName: "Vikram Singh",
    role: "manager",
    originalRole: "manager",
    elevatedUntil: null,
    isEnabled: true,
  });

  // Create sample template with new schema
  const tmpl = templateStore.add({
    name: "Banking Branch Electrical Audit",
    description: "Standard electrical safety audit for banking branches",
    createdBy: admin.id,
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
    createdBy: admin.id,
  });
  const idbi = clientStore.add({
    name: "IDBI Bank",
    industry: "Banking",
    contactName: "Kavita Rao",
    contactEmail: "kavita@idbi.com",
    isEnabled: true,
    createdBy: admin.id,
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
    auditorId: auditor1.id,
    auditorName: auditor1.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
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
    auditorId: auditor2.id,
    auditorName: auditor2.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
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
    auditorId: auditor1.id,
    auditorName: auditor1.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });
  const s4 = siteStore.add({
    clientId: hdfc.id,
    branchName: "HDFC Powai",
    branchAddress: "Powai, Mumbai",
    branchCode: "HDFC-MUM-004",
    branchCity: "Mumbai",
    branchState: "Maharashtra",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-10",
    auditorId: auditor2.id,
    auditorName: auditor2.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });
  const s5 = siteStore.add({
    clientId: hdfc.id,
    branchName: "HDFC Thane",
    branchAddress: "Thane West, Maharashtra",
    branchCode: "HDFC-THA-005",
    branchCity: "Thane",
    branchState: "Maharashtra",
    branchType: "Semi-urban",
    scheduledAuditDate: "2026-05-20",
    auditorId: auditor1.id,
    auditorName: auditor1.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });
  const s6 = siteStore.add({
    clientId: idbi.id,
    branchName: "IDBI Connaught Place",
    branchAddress: "Connaught Place, New Delhi",
    branchCode: "IDBI-DEL-001",
    branchCity: "New Delhi",
    branchState: "Delhi",
    branchType: "Metro",
    scheduledAuditDate: "2026-04-28",
    auditorId: auditor2.id,
    auditorName: auditor2.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });
  const s7 = siteStore.add({
    clientId: idbi.id,
    branchName: "IDBI Karol Bagh",
    branchAddress: "Karol Bagh, New Delhi",
    branchCode: "IDBI-DEL-002",
    branchCity: "New Delhi",
    branchState: "Delhi",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-08",
    auditorId: auditor1.id,
    auditorName: auditor1.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });
  const s8 = siteStore.add({
    clientId: idbi.id,
    branchName: "IDBI Lajpat Nagar",
    branchAddress: "Lajpat Nagar, New Delhi",
    branchCode: "IDBI-DEL-003",
    branchCity: "New Delhi",
    branchState: "Delhi",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-15",
    auditorId: auditor2.id,
    auditorName: auditor2.fullName,
    reviewerId: reviewer1.id,
    reviewerName: reviewer1.fullName,
    managerId: manager1.id,
    managerName: manager1.fullName,
    templateId: tmpl.id,
    isEnabled: true,
    createdBy: admin.id,
  });

  const now = Date.now();
  const mo = 30 * 24 * 60 * 60 * 1000;
  const samples: Array<{
    siteId: string;
    clientId: string;
    offset: number;
    status: "Draft" | "Submitted" | "Reviewed" | "Completed";
    auditorId: string;
    auditorName: string;
  }> = [
    {
      siteId: s1.id,
      clientId: hdfc.id,
      offset: 0,
      status: "Draft",
      auditorId: auditor1.id,
      auditorName: auditor1.fullName,
    },
    {
      siteId: s2.id,
      clientId: hdfc.id,
      offset: 1,
      status: "Submitted",
      auditorId: auditor2.id,
      auditorName: auditor2.fullName,
    },
    {
      siteId: s3.id,
      clientId: hdfc.id,
      offset: 1,
      status: "Reviewed",
      auditorId: auditor1.id,
      auditorName: auditor1.fullName,
    },
    {
      siteId: s4.id,
      clientId: hdfc.id,
      offset: 2,
      status: "Completed",
      auditorId: auditor2.id,
      auditorName: auditor2.fullName,
    },
    {
      siteId: s5.id,
      clientId: hdfc.id,
      offset: 2,
      status: "Submitted",
      auditorId: auditor1.id,
      auditorName: auditor1.fullName,
    },
    {
      siteId: s6.id,
      clientId: idbi.id,
      offset: 3,
      status: "Completed",
      auditorId: auditor2.id,
      auditorName: auditor2.fullName,
    },
    {
      siteId: s7.id,
      clientId: idbi.id,
      offset: 3,
      status: "Reviewed",
      auditorId: auditor1.id,
      auditorName: auditor1.fullName,
    },
    {
      siteId: s8.id,
      clientId: idbi.id,
      offset: 4,
      status: "Draft",
      auditorId: auditor2.id,
      auditorName: auditor2.fullName,
    },
  ];
  for (const a of samples) {
    auditStore.add({
      siteId: a.siteId,
      clientId: a.clientId,
      auditorId: a.auditorId,
      auditorName: a.auditorName,
      status: a.status,
      answersJson: "{}",
      reviewComment: "",
      lastSavedAt: now - a.offset * mo,
      startedAt: now - a.offset * mo,
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
  isLoading: true,
  login: async () => ({ success: false }),
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const init = useCallback(async () => {
    await seedIfNeeded();
    const existing = getSession();
    if (existing) {
      checkTempAdminExpiry(existing.userId);
      const freshUser = getUserByUsername(existing.username);
      if (freshUser?.isEnabled) {
        setSessionState(setSession(freshUser));
      } else {
        clearSession();
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const login = useCallback(async (username: string, password: string) => {
    const user = getUserByUsername(username);
    if (!user) return { success: false, error: "Invalid username or password" };
    if (!user.isEnabled)
      return {
        success: false,
        error: "Your account has been disabled. Contact your admin.",
      };
    const hash = await hashPassword(username, password);
    if (hash !== user.passwordHash)
      return { success: false, error: "Invalid username or password" };
    checkTempAdminExpiry(user.id);
    const freshUser = getUserByUsername(username)!;
    const sess = setSession(freshUser);
    setSessionState(sess);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
  }, []);

  const refresh = useCallback(() => {
    const existing = getSession();
    if (existing) {
      checkTempAdminExpiry(existing.userId);
      const freshUser = getUserByUsername(existing.username);
      if (freshUser?.isEnabled) setSessionState(setSession(freshUser));
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
export { isTempAdmin, hasAdmin, type StoredUser };
