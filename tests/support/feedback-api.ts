import type { APIRequestContext, APIResponse } from "@playwright/test";

export type FeedbackInput = Record<string, unknown>;

export type UserPayload = {
  id: number;
  username: string;
};

export type FeedbackPayload = {
  id: number;
  title: string;
  body: string;
  author: UserPayload;
  receiver: UserPayload;
};

type TokenPayload = {
  accessToken?: string;
};

/**
 * Thin client for the feedback service. It expects an APIRequestContext whose baseURL points at the API,
 * so tests only deal with paths and payloads.
 */
export class FeedbackApi {
  constructor(private readonly request: APIRequestContext) {}

  private authorizationHeaders(accessToken?: string): Record<string, string> {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  async signIn(username: string, password: string) {
    const response = await this.request.post("/auth/sign-in", {
      data: { username, password },
    });

    if (!response.ok()) {
      throw new Error(`Unable to authenticate test user: ${response.status()} ${await response.text()}`);
    }

    const payload = (await response.json()) as TokenPayload;
    if (!payload.accessToken) {
      throw new Error("Authentication response did not contain an access token");
    }

    return payload.accessToken;
  }

  async users(accessToken: string) {
    const response = await this.request.get("/auth/users", {
      headers: this.authorizationHeaders(accessToken),
    });

    if (!response.ok()) {
      throw new Error(`Unable to load test users: ${response.status()} ${await response.text()}`);
    }

    return (await response.json()) as UserPayload[];
  }

  createFeedback(data: unknown, accessToken?: string, headers: Record<string, string> = {}): Promise<APIResponse> {
    return this.request.post("/feedback", {
      headers: { ...this.authorizationHeaders(accessToken), ...headers },
      data,
    });
  }

  listFeedback(accessToken: string): Promise<APIResponse> {
    return this.request.get("/feedback", {
      headers: this.authorizationHeaders(accessToken),
    });
  }
}
