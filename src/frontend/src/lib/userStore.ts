export type UserRole = "admin" | "manager" | "reviewer" | "auditor";

export interface StoredUser {
  id: string;
  username: string;
  /** Plain-text password (no hash — simple & reliable) */
  password: string;
  fullName: string;
  role: UserRole;
  originalRole: UserRole;
  elevatedUntil: number | null; // ms timestamp
  isEnabled: boolean;
  principalId?: string;
}

const STORE_KEY = "swish_users";

function load(): StoredUser[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(users: StoredUser[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

export function getUsers(): StoredUser[] {
  return load();
}

export function getUserByUsername(username: string): StoredUser | null {
  return (
    load().find((u) => u.username.toLowerCase() === username.toLowerCase()) ??
    null
  );
}

export function addUser(user: Omit<StoredUser, "id">): StoredUser {
  const users = load();
  const id = Date.now().toString();
  const newUser = { ...user, id };
  save([...users, newUser]);
  return newUser;
}

export function updateUser(id: string, updates: Partial<StoredUser>) {
  const users = load();
  save(users.map((u) => (u.id === id ? { ...u, ...updates } : u)));
}

export function hasAdmin(): boolean {
  return load().some((u) => u.role === "admin" && u.isEnabled);
}

// Check and revert temp admin if expired
export function checkTempAdminExpiry(userId: string) {
  const users = load();
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  if (user.elevatedUntil && Date.now() > user.elevatedUntil) {
    updateUser(userId, { role: user.originalRole, elevatedUntil: null });
  }
}

export function isTempAdmin(user: StoredUser): boolean {
  return (
    user.elevatedUntil !== null &&
    user.elevatedUntil > Date.now() &&
    user.originalRole !== "admin"
  );
}
