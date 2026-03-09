import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AUTH_PATH = join(homedir(), ".lark_auth");

export interface AuthConfig {
  app_id: string;
  app_secret: string;
  user_access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  refresh_expiry?: number;
}

/**
 * Read Lark auth credentials from ~/.lark_auth.
 *
 * @returns Auth config with app_id, app_secret, and optional user tokens.
 * @throws Error if file is missing or malformed.
 */
export function getAuthConfig(): AuthConfig {
  let raw: string;
  try {
    raw = readFileSync(AUTH_PATH, "utf-8");
  } catch {
    throw new Error(
      `Auth file not found at ${AUTH_PATH}\nCreate it with: {"app_id": "cli_xxx", "app_secret": "xxx"}`,
    );
  }

  const config = JSON.parse(raw);

  if (!config.app_id || !config.app_secret) {
    throw new Error(
      `Invalid auth file: app_id and app_secret are required in ${AUTH_PATH}`,
    );
  }

  return config;
}

/**
 * Save user tokens to ~/.lark_auth, merging with existing config.
 *
 * @param tokens - User token fields to merge into the auth file.
 */
export function saveUserTokens(tokens: {
  user_access_token: string;
  refresh_token: string;
  token_expiry: number;
  refresh_expiry: number;
}): void {
  const config = getAuthConfig();
  const updated = { ...config, ...tokens };
  writeFileSync(AUTH_PATH, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}

/**
 * Remove user tokens from ~/.lark_auth, keeping app credentials.
 */
export function clearUserTokens(): void {
  const config = getAuthConfig();
  delete config.user_access_token;
  delete config.refresh_token;
  delete config.token_expiry;
  delete config.refresh_expiry;
  writeFileSync(AUTH_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Check if a valid (non-expired) user access token exists.
 *
 * @returns True if user token exists and has not expired.
 */
export function hasValidUserToken(): boolean {
  try {
    const config = getAuthConfig();
    if (!config.user_access_token || !config.token_expiry) return false;
    return Date.now() < config.token_expiry;
  } catch {
    return false;
  }
}

/**
 * Check if the refresh token is still valid for token renewal.
 *
 * @returns True if refresh token exists and has not expired.
 */
export function hasValidRefreshToken(): boolean {
  try {
    const config = getAuthConfig();
    if (!config.refresh_token || !config.refresh_expiry) return false;
    return Date.now() < config.refresh_expiry;
  } catch {
    return false;
  }
}
