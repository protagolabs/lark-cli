import {
  getAuthConfig,
  hasValidRefreshToken,
  hasValidUserToken,
  saveUserTokens,
} from "../auth.js";

const BASE_URL = "https://open.larksuite.com/open-apis";

let cachedTenantToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a tenant access token, caching until expiry.
 *
 * @returns The tenant access token string.
 * @throws Error if token request fails.
 */
async function getTenantToken(): Promise<string> {
  if (cachedTenantToken && Date.now() < cachedTenantToken.expiresAt) {
    return cachedTenantToken.token;
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

  cachedTenantToken = {
    token: body.tenant_access_token,
    expiresAt: Date.now() + (body.expire - 300) * 1000,
  };

  return cachedTenantToken.token;
}

/**
 * Get an app access token (needed for user token refresh).
 *
 * @returns The app access token string.
 */
async function getAppToken(): Promise<string> {
  const { app_id, app_secret } = getAuthConfig();
  const resp = await fetch(`${BASE_URL}/auth/v3/app_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id, app_secret }),
  });

  const body = await resp.json();
  if (body.code !== 0) {
    throw new Error(`Failed to get app token: ${body.msg}`);
  }
  return body.app_access_token;
}

/**
 * Refresh the user access token using the stored refresh token.
 *
 * @returns The new user access token.
 * @throws Error if refresh fails.
 */
async function refreshUserToken(): Promise<string> {
  const config = getAuthConfig();
  const appToken = await getAppToken();

  const resp = await fetch(`${BASE_URL}/authen/v1/oidc/refresh_access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  const body = await resp.json();
  if (body.code !== 0) {
    throw new Error(`Failed to refresh user token: ${body.msg}`);
  }

  const now = Date.now();
  saveUserTokens({
    user_access_token: body.data.access_token,
    refresh_token: body.data.refresh_token,
    token_expiry: now + body.data.expires_in * 1000 - 300_000,
    refresh_expiry: now + body.data.refresh_expires_in * 1000 - 300_000,
  });

  return body.data.access_token;
}

/**
 * Get the best available token. Prefers user_access_token (with auto-refresh),
 * falls back to tenant_access_token.
 *
 * @returns Bearer token string.
 */
async function getToken(): Promise<string> {
  if (hasValidUserToken()) {
    return getAuthConfig().user_access_token!;
  }

  if (hasValidRefreshToken()) {
    return refreshUserToken();
  }

  return getTenantToken();
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
  const token = await getToken();

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

/**
 * Exchange an authorization code for user tokens via OIDC.
 *
 * @param code - Authorization code from OAuth callback.
 * @returns Object with access_token, refresh_token, and expiry info.
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}> {
  const appToken = await getAppToken();

  const resp = await fetch(`${BASE_URL}/authen/v1/oidc/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
    }),
  });

  const body = await resp.json();
  if (body.code !== 0) {
    throw new Error(`Failed to exchange code: ${body.msg}`);
  }

  return body.data;
}
