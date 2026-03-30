import { HttpAgent } from "@icp-sdk/core/agent";
/**
 * Blob Storage Service for SWiSH SAFE-T
 * Wraps the Caffeine blob storage infrastructure to provide simple upload/URL functions.
 * Photos are stored on ICP servers and accessible from any device.
 */
import { loadConfig } from "../config";
import { StorageClient } from "../utils/StorageClient";

interface BlobConfig {
  storageGatewayUrl: string;
  bucketName: string;
  backendCanisterId: string;
  projectId: string;
}

let configCache: BlobConfig | null = null;
let storageClientCache: StorageClient | null = null;
let initPromise: Promise<{ config: BlobConfig; client: StorageClient }> | null =
  null;

async function getBlobClient(): Promise<{
  config: BlobConfig;
  client: StorageClient;
}> {
  if (configCache && storageClientCache) {
    return { config: configCache, client: storageClientCache };
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const cfg = await loadConfig();
    const agent = new HttpAgent({ host: cfg.backend_host });
    if (cfg.backend_host?.includes("localhost")) {
      await agent.fetchRootKey().catch(() => {});
    }
    const client = new StorageClient(
      cfg.bucket_name ?? "default-bucket",
      cfg.storage_gateway_url,
      cfg.backend_canister_id,
      cfg.project_id,
      agent,
    );
    const blobCfg: BlobConfig = {
      storageGatewayUrl: cfg.storage_gateway_url,
      bucketName: cfg.bucket_name ?? "default-bucket",
      backendCanisterId: cfg.backend_canister_id,
      projectId: cfg.project_id,
    };
    configCache = blobCfg;
    storageClientCache = client;
    return { config: blobCfg, client };
  })();

  return initPromise;
}

// Eagerly start loading config
getBlobClient().catch(() => {});

/**
 * Upload a file to blob storage.
 * Returns the blob ID (hash) and the URL.
 */
export async function uploadFile(
  file: File,
): Promise<{ id: string; url: string }> {
  const { client } = await getBlobClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { hash } = await client.putFile(bytes);
  const url = await client.getDirectURL(hash);
  return { id: hash, url };
}

/**
 * Get the URL for a blob by its ID (hash).
 * Works synchronously if config is already loaded.
 * Falls back to async loading if not yet cached.
 */
export function getFileUrl(id: string): string {
  if (!id) return "";
  // Legacy: base64 data URLs are passed through unchanged
  if (id.startsWith("data:")) return id;
  if (!configCache) {
    // Config not loaded yet — return a placeholder
    // The component will re-render once the URL is resolved
    return "";
  }
  const { storageGatewayUrl, backendCanisterId, projectId } = configCache;
  return `${storageGatewayUrl}/v1/blob/?blob_hash=${encodeURIComponent(id)}&owner_id=${encodeURIComponent(backendCanisterId)}&project_id=${encodeURIComponent(projectId)}`;
}

/**
 * Async version of getFileUrl — ensures config is loaded.
 */
export async function getFileUrlAsync(id: string): Promise<string> {
  if (!id) return "";
  if (id.startsWith("data:")) return id;
  const { client } = await getBlobClient();
  return client.getDirectURL(id);
}

/**
 * Hook-like helper — returns upload function and URL resolver.
 */
export function useBlobStorage() {
  return {
    uploadFile,
    getFileUrl,
    getFileUrlAsync,
  };
}
