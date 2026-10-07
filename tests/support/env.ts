import "dotenv/config";

/**
 * Single source of truth for the URLs and secrets used by the test suite and the Playwright config.
 * Values come from the environment (.env locally, workflow variables in CI) with local-development defaults.
 */
const clientPort = process.env.PLAYWRIGHT_CLIENT_PORT ?? "3000";
const apiPort = process.env.SERVICE_PORT ?? "3022";

export const CLIENT_PORT = clientPort;
export const CLIENT_BASE_URL = `http://127.0.0.1:${clientPort}`;
export const API_BASE_URL = process.env.API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;

/** Secret the API signs access tokens with; needed only by the token-tampering tests. */
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

/** Browser storage state of the signed-in primary user, written by the setup project. */
export const AUTH_STATE_PATH = "playwright/.auth/user.json";
