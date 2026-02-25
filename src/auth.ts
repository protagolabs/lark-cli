import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AuthConfig {
  app_id: string;
  app_secret: string;
}

/**
 * Read Lark auth credentials from ~/.lark_auth.
 *
 * @returns Auth config with app_id and app_secret.
 * @throws Error if file is missing or malformed.
 */
export function getAuthConfig(): AuthConfig {
  const authPath = join(homedir(), ".lark_auth");

  let raw: string;
  try {
    raw = readFileSync(authPath, "utf-8");
  } catch {
    throw new Error(
      `Auth file not found at ${authPath}\nCreate it with: {"app_id": "cli_xxx", "app_secret": "xxx"}`,
    );
  }

  const config = JSON.parse(raw);

  if (!config.app_id || !config.app_secret) {
    throw new Error(
      `Invalid auth file: app_id and app_secret are required in ${authPath}`,
    );
  }

  return { app_id: config.app_id, app_secret: config.app_secret };
}
