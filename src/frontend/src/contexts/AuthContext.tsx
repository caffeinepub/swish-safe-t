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

async function seedIfNeeded() {
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

  // Create sample template
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
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "General inspection - Environment cleanliness",
    questionType: "dropdown",
    options: ["Cleaned", "Dirty", "Needs Attention"],
    isMandatoryPhoto: false,
    order: 1,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "Check for Meter seal (un-Intact)?",
    questionType: "dropdown",
    options: ["OK", "Not OK"],
    isMandatoryPhoto: false,
    order: 2,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec1.id,
    label: "Images of Mains Meter",
    questionType: "imageUpload",
    options: [],
    isMandatoryPhoto: true,
    order: 3,
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
    label: "Incomer condition",
    questionType: "dropdown",
    options: ["Good", "Fair", "Poor"],
    isMandatoryPhoto: false,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec2.id,
    label: "Cable condition",
    questionType: "dropdown",
    options: ["Good", "Damaged", "Replaced"],
    isMandatoryPhoto: false,
    order: 1,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec2.id,
    label: "Remarks",
    questionType: "remarks",
    options: [],
    isMandatoryPhoto: false,
    order: 2,
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
    label: "Is Servo Stabilizer installed?",
    questionType: "radio",
    options: ["Yes", "No"],
    isMandatoryPhoto: false,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec3.id,
    label: "Stabilizer condition",
    questionType: "dropdown",
    options: ["Working", "Faulty", "Not Applicable"],
    isMandatoryPhoto: false,
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
    label: "DG set installed?",
    questionType: "radio",
    options: ["Yes", "No"],
    isMandatoryPhoto: false,
    order: 0,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec4.id,
    label: "DG capacity (KVA)",
    questionType: "remarks",
    options: [],
    isMandatoryPhoto: false,
    order: 1,
    isEnabled: true,
  });
  templateQuestionStore.add({
    templateId: tmpl.id,
    sectionId: sec4.id,
    label: "DG room images",
    questionType: "imageUpload",
    options: [],
    isMandatoryPhoto: false,
    order: 2,
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
    branchName: "Mumbai Main Branch",
    branchAddress: "123 Nariman Point, Mumbai",
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
    branchName: "Delhi Connaught Place",
    branchAddress: "Block A, Connaught Place, New Delhi",
    branchCode: "HDFC-DEL-002",
    branchCity: "New Delhi",
    branchState: "Delhi",
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
    branchName: "Pune Koregaon Branch",
    branchAddress: "45 Koregaon Park, Pune",
    branchCode: "HDFC-PUN-003",
    branchCity: "Pune",
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
    clientId: idbi.id,
    branchName: "Gurgaon Sector 14",
    branchAddress: "Sector 14, Gurgaon, Haryana",
    branchCode: "IDBI-GGN-001",
    branchCity: "Gurgaon",
    branchState: "Haryana",
    branchType: "Urban",
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
  const s5 = siteStore.add({
    clientId: idbi.id,
    branchName: "Amritsar Main Branch",
    branchAddress: "Lawrence Road, Amritsar, Punjab",
    branchCode: "IDBI-AMR-002",
    branchCity: "Amritsar",
    branchState: "Punjab",
    branchType: "Urban",
    scheduledAuditDate: "2026-05-10",
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

  const now = Date.now();
  const mo = 30 * 24 * 60 * 60 * 1000;
  const samples: Array<{
    siteId: string;
    clientId: string;
    offset: number;
    status: "Draft" | "Submitted" | "Reviewed" | "Completed";
  }> = [
    { siteId: s1.id, clientId: hdfc.id, offset: 0, status: "Draft" },
    { siteId: s2.id, clientId: hdfc.id, offset: 1, status: "Submitted" },
    { siteId: s3.id, clientId: hdfc.id, offset: 1, status: "Reviewed" },
    { siteId: s4.id, clientId: idbi.id, offset: 2, status: "Completed" },
    { siteId: s5.id, clientId: idbi.id, offset: 2, status: "Submitted" },
    { siteId: s1.id, clientId: hdfc.id, offset: 3, status: "Completed" },
    { siteId: s2.id, clientId: hdfc.id, offset: 3, status: "Completed" },
    { siteId: s4.id, clientId: idbi.id, offset: 4, status: "Reviewed" },
    { siteId: s3.id, clientId: hdfc.id, offset: 4, status: "Draft" },
    { siteId: s5.id, clientId: idbi.id, offset: 5, status: "Submitted" },
  ];
  for (const a of samples) {
    auditStore.add({
      siteId: a.siteId,
      clientId: a.clientId,
      auditorId: auditor1.id,
      auditorName: auditor1.fullName,
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
