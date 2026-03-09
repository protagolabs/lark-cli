import { createServer } from "node:http";
import { Command } from "commander";
import chalk from "chalk";
import {
  clearUserTokens,
  getAuthConfig,
  hasValidRefreshToken,
  hasValidUserToken,
  saveUserTokens,
} from "../auth.js";
import { exitWithError, printRecord } from "../utils/format.js";
import { exchangeCodeForToken } from "../utils/lark-api.js";

const CALLBACK_PORT = 9876;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

/**
 * Register all auth subcommands on the given commander program.
 *
 * @param program - The root commander program.
 */
export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("User authentication (OAuth2)");

  auth
    .command("login")
    .description("Authorize as a Lark user via browser OAuth2 flow")
    .action(async () => {
      try {
        const { app_id } = getAuthConfig();

        const state = Math.random().toString(36).slice(2);
        const authUrl =
          `https://open.larksuite.com/open-apis/authen/v1/authorize` +
          `?app_id=${app_id}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&state=${state}`;

        // Wait for OAuth callback with authorization code
        const code = await new Promise<string>((resolve, reject) => {
          const server = createServer((req, res) => {
            const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);

            if (url.pathname !== "/callback") {
              res.writeHead(404);
              res.end();
              return;
            }

            const returnedState = url.searchParams.get("state");
            if (returnedState !== state) {
              res.writeHead(400);
              res.end("State mismatch");
              server.close();
              reject(new Error("OAuth state mismatch"));
              return;
            }

            const code = url.searchParams.get("code");
            if (!code) {
              res.writeHead(400);
              res.end("Missing authorization code");
              server.close();
              reject(new Error("Missing authorization code"));
              return;
            }

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<h2>Authorization successful!</h2><p>You can close this tab and return to the terminal.</p>",
              () => {
                server.closeAllConnections();
                server.close();
              },
            );
            resolve(code);
          });

          server.listen(CALLBACK_PORT, () => {
            console.log(chalk.cyan("\nOpen this URL in your browser to authorize:\n"));
            console.log(`  ${authUrl}\n`);
            console.log(chalk.dim(`Waiting for callback on localhost:${CALLBACK_PORT}...`));
          });

          server.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
              reject(new Error(`Port ${CALLBACK_PORT} is already in use`));
            } else {
              reject(err);
            }
          });
        });

        // Exchange code for tokens
        console.log(chalk.dim("Exchanging authorization code for tokens..."));
        const tokenData = await exchangeCodeForToken(code);

        const now = Date.now();
        saveUserTokens({
          user_access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expiry: now + tokenData.expires_in * 1000 - 300_000,
          refresh_expiry: now + tokenData.refresh_expires_in * 1000 - 300_000,
        });

        console.log(chalk.green("\nLogged in successfully. Commands will now run as your user."));
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  auth
    .command("logout")
    .description("Remove user tokens (revert to app identity)")
    .action(() => {
      try {
        clearUserTokens();
        console.log(chalk.green("Logged out. Commands will now run as app identity."));
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(() => {
      try {
        const config = getAuthConfig();
        const userValid = hasValidUserToken();
        const refreshValid = hasValidRefreshToken();

        let identity: string;
        if (userValid) {
          identity = "user (OAuth2)";
        } else if (refreshValid) {
          identity = "user (token expired, will auto-refresh)";
        } else {
          identity = "app (tenant)";
        }

        const info: Record<string, unknown> = {
          app_id: config.app_id,
          identity,
        };

        if (config.token_expiry) {
          info.token_expires = new Date(config.token_expiry).toLocaleString();
        }
        if (config.refresh_expiry) {
          info.refresh_expires = new Date(config.refresh_expiry).toLocaleString();
        }

        printRecord(info);
      } catch (e: any) {
        exitWithError(e.message ?? e);
      }
    });
}
