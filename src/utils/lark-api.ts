import { getAuthConfig } from "../auth.js";

const BASE_URL = "https://open.larksuite.com/open-apis";

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a tenant access token, caching until expiry.
 *
 * @returns The tenant access token string.
 * @throws Error if token request fails.
 */
async function getTenantToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const { app_id, app_secret } = getAuthConfig();
  const resp = await fetch(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id, app_secret }),
  });

  const body = await resp.json();
  if (body.code !== 0) {
    throw new Error(`Failed to get tenant token: ${body.msg}`);
  }

  cachedToken = {
    token: body.tenant_access_token,
    // Expire 5 minutes early to avoid edge cases
    expiresAt: Date.now() + (body.expire - 300) * 1000,
  };

  return cachedToken.token;
}

/**
 * Make an authenticated request to the Lark Open API.
 *
 * @param method - HTTP method.
 * @param path - API path (e.g., "/docx/v1/documents/xxx/blocks/xxx").
 * @param body - Optional request body (will be JSON-serialized).
 * @param params - Optional query parameters.
 * @returns Parsed JSON response body.
 * @throws Error if API returns non-zero code.
 */
export async function larkApi(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>,
): Promise<any> {
  const token = await getTenantToken();

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, String(v));
    }
    url += `?${qs.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await resp.json();
  if (json.code && json.code !== 0) {
    throw new Error(`Lark API error ${json.code}: ${json.msg ?? "Unknown error"}`);
  }

  return json;
}
