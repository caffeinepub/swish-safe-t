import { Ed25519KeyIdentity } from "@dfinity/identity";

// Simple hash using SubtleCrypto
export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Derive a deterministic 32-byte seed from username+password
export async function deriveSeed(
  username: string,
  password: string,
): Promise<Uint8Array> {
  const combined = `swish-safe-t:${username.toLowerCase()}:${password}`;
  const hashHex = await sha256Hex(combined);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Create a deterministic Ed25519 identity from username+password
export async function identityFromCredentials(
  username: string,
  password: string,
): Promise<Ed25519KeyIdentity> {
  const seed = await deriveSeed(username, password);
  return Ed25519KeyIdentity.generate(seed);
}

// Hash password for storage verification
export async function hashPassword(
  username: string,
  password: string,
): Promise<string> {
  return sha256Hex(`swish-pass:${username.toLowerCase()}:${password}`);
}
