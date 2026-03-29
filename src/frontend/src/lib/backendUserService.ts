import { createActorWithConfig } from "../config";
import type { StoredUser, UserRole } from "./userStore";

// Raw AppUser shape matching the Motoko backend
interface AppUserBackend {
  username: string;
  passwordHash: string;
  fullName: string;
  role: AppRole;
  originalRole: AppRole;
  elevatedUntil?: bigint;
  isEnabled: boolean;
}

type AppRole =
  | { admin: null }
  | { manager: null }
  | { reviewer: null }
  | { auditor: null };

// AppUserPublic — returned by getAppUserPublic / listAppUsers (no passwordHash)
interface AppUserPublicBackend {
  username: string;
  fullName: string;
  role: AppRole;
  originalRole: AppRole;
  elevatedUntil?: bigint;
  isEnabled: boolean;
}

function variantToRole(v: AppRole): UserRole {
  if ("admin" in v) return "admin";
  if ("manager" in v) return "manager";
  if ("reviewer" in v) return "reviewer";
  return "auditor";
}

function roleToVariant(role: UserRole): AppRole {
  return { [role]: null } as AppRole;
}

function publicToStoredUser(u: AppUserPublicBackend): StoredUser {
  return {
    id: u.username,
    username: u.username,
    passwordHash: "", // not available in public API — set empty
    fullName: u.fullName,
    role: variantToRole(u.role),
    originalRole: variantToRole(u.originalRole),
    elevatedUntil: u.elevatedUntil != null ? Number(u.elevatedUntil) : null,
    isEnabled: u.isEnabled,
  };
}

function toAppUser(u: StoredUser): AppUserBackend {
  return {
    username: u.username.toLowerCase(),
    passwordHash: u.passwordHash,
    fullName: u.fullName,
    role: roleToVariant(u.role),
    originalRole: roleToVariant(u.originalRole),
    elevatedUntil:
      u.elevatedUntil != null ? BigInt(u.elevatedUntil) : undefined,
    isEnabled: u.isEnabled,
  };
}

// Always create a fresh actor to avoid stale connections
async function getAnonActor(): Promise<any> {
  return createActorWithConfig();
}

/**
 * Fetch a user's public profile from the backend.
 * Uses getAppUserPublic — which does NOT return passwordHash.
 */
export async function getUserByUsernameFromBackend(
  username: string,
): Promise<StoredUser | null> {
  try {
    const actor = await getAnonActor();
    // Backend returns AppUserPublic | null
    const result: AppUserPublicBackend | null = await actor.getAppUserPublic(
      username.toLowerCase(),
    );
    if (!result) return null;
    return publicToStoredUser(result);
  } catch (err) {
    console.error("[backendUserService] getAppUserPublic failed:", err);
    return null;
  }
}

/**
 * Verify credentials using the backend verifyAppUserCredentials method.
 * Returns true if username + passwordHash match.
 */
export async function verifyCredentialsFromBackend(
  username: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    const actor = await getAnonActor();
    return await actor.verifyAppUserCredentials(
      username.toLowerCase(),
      passwordHash,
    );
  } catch (err) {
    console.error("[backendUserService] verifyAppUserCredentials failed:", err);
    return false;
  }
}

/**
 * Check if any admin account exists in the backend.
 * Returns null on connection failure (distinct from "no admin exists").
 */
export async function appUserHasAdminFromBackend(): Promise<boolean | null> {
  try {
    const actor = await getAnonActor();
    return await actor.appUserHasAdmin();
  } catch {
    return null; // null = backend unreachable, NOT "no admin"
  }
}

/**
 * Seed the admin account via seedAppAdmin.
 * This is idempotent — only inserts if no admin exists.
 */
export async function seedAdminToBackend(
  adminPasswordHash: string,
): Promise<void> {
  try {
    const actor = await getAnonActor();
    const adminUser: AppUserBackend = {
      username: "apa_arun",
      passwordHash: adminPasswordHash,
      fullName: "APA Arun",
      role: { admin: null },
      originalRole: { admin: null },
      isEnabled: true,
    };
    await actor.seedAppAdmin(adminUser);
  } catch (err) {
    console.error("[backendUserService] seedAppAdmin failed:", err);
  }
}

export async function listUsersFromBackend(actor: any): Promise<StoredUser[]> {
  try {
    const users: AppUserPublicBackend[] = await actor.listAppUsers();
    return users.map(publicToStoredUser);
  } catch (err) {
    console.error("[backendUserService] listAppUsers failed:", err);
    return [];
  }
}

export async function upsertUserToBackend(
  actor: any,
  user: StoredUser,
): Promise<void> {
  await actor.upsertAppUser(toAppUser(user));
}
