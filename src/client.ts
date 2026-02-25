import * as lark from "@larksuiteoapi/node-sdk";
import { getAuthConfig } from "./auth.js";

let client: lark.Client | null = null;

/**
 * Get the Lark SDK client singleton.
 *
 * @returns Configured Lark Client instance.
 */
export function getClient(): lark.Client {
  if (!client) {
    const { app_id, app_secret } = getAuthConfig();
    client = new lark.Client({
      appId: app_id,
      appSecret: app_secret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Lark,
      loggerLevel: lark.LoggerLevel.error,
    });
  }
  return client;
}
