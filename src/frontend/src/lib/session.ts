import type { StoredUser } from "./userStore";

export interface Session {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  isTemporaryAdmin: boolean;
}

// Use sessionStorage so the session clears when the browser tab/window closes
const SESSION_KEY = "swish_session";

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user: StoredUser): Session {
  const isTemp =
    user.elevatedUntil !== null &&
    user.elevatedUntil > Date.now() &&
    user.originalRole !== "admin";
  const session: Session = {
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isTemporaryAdmin: isTemp,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
