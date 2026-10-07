import type { APIResponse } from "@playwright/test";
import jwt from "jsonwebtoken";
import { test, expect } from "../fixtures/test.fixture";
import { ACCESS_TOKEN_SECRET, API_BASE_URL } from "../support/env";
import type { FeedbackApi, FeedbackInput, FeedbackPayload } from "../support/feedback-api";
import { KeepAliveClient } from "../support/keep-alive-client";
import { buildFeedback } from "../support/test-data";

type ErrorEnvelope = {
  name?: string;
  message?: string;
  errors?: Array<{
    property?: string;
    constraints?: Record<string, string>;
  }>;
};

const BODY_MAX_LENGTH = 10_000;

async function expectErrorResponse(response: APIResponse, status: number, name: string) {
  expect(response.status()).toBe(status);
  expect(response.headers()["content-type"]).toContain("application/json");

  const payload = (await response.json()) as ErrorEnvelope;
  expect(payload).toEqual(
    expect.objectContaining({
      name,
      message: expect.any(String),
    }),
  );

  return payload;
}

async function expectValidationError(response: APIResponse, property: string) {
  const payload = await expectErrorResponse(response, 400, "BadRequestError");

  expect(payload.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        property,
        constraints: expect.any(Object),
      }),
    ]),
  );
}

async function expectFeedbackWasNotCreated(feedbackApi: FeedbackApi, accessToken: string, title: string) {
  const listResponse = await feedbackApi.listFeedback(accessToken);
  expect(listResponse.status()).toBe(200);

  const feedback = (await listResponse.json()) as FeedbackPayload[];
  expect(feedback.map((item) => item.title)).not.toContain(title);
}

function withoutField(input: FeedbackInput, field: string): FeedbackInput {
  const changed = { ...input };
  delete changed[field];
  return changed;
}

const validationScenarios: Array<{
  name: string;
  property: string;
  change: (input: FeedbackInput) => FeedbackInput;
}> = [
  { name: "a missing title", property: "title", change: (input) => withoutField(input, "title") },
  { name: "a title of two characters", property: "title", change: (input) => ({ ...input, title: "xy" }) },
  { name: "a non-string title", property: "title", change: (input) => ({ ...input, title: 123 }) },
  { name: "a missing body", property: "body", change: (input) => withoutField(input, "body") },
  { name: "a body of two characters", property: "body", change: (input) => ({ ...input, body: "xy" }) },
  {
    name: `a body longer than ${BODY_MAX_LENGTH} characters`,
    property: "body",
    change: (input) => ({ ...input, body: "b".repeat(BODY_MAX_LENGTH + 1) }),
  },
  { name: "a missing receiver ID", property: "receiverId", change: (input) => withoutField(input, "receiverId") },
  { name: "a non-numeric receiver ID", property: "receiverId", change: (input) => ({ ...input, receiverId: "jane" }) },
];

test.describe("POST /feedback", () => {
  test.describe("successful creation", () => {
    test("creates and persists feedback for an authenticated user", async ({ feedbackApi, apiSession }) => {
      const feedback = buildFeedback("API persistence");
      const input = {
        title: feedback.title,
        body: feedback.body,
        receiverId: apiSession.receiver.id,
      };

      const response = await feedbackApi.createFeedback(input, apiSession.accessToken);

      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/json");

      const createdFeedback = (await response.json()) as FeedbackPayload;
      expect(createdFeedback).toEqual({
        id: expect.any(Number),
        title: input.title,
        body: input.body,
        author: apiSession.author,
        receiver: apiSession.receiver,
      });

      const listResponse = await feedbackApi.listFeedback(apiSession.accessToken);
      expect(listResponse.status()).toBe(200);
      expect((await listResponse.json()) as FeedbackPayload[]).toContainEqual(createdFeedback);
    });

    test("accepts title and body at their minimum length of three characters", async ({ feedbackApi, apiSession }) => {
      const response = await feedbackApi.createFeedback(
        { title: "abc", body: "abc", receiverId: apiSession.receiver.id },
        apiSession.accessToken,
      );

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual(expect.objectContaining({ title: "abc", body: "abc" }));
    });

    test(`accepts a body at its maximum length of ${BODY_MAX_LENGTH} characters`, async ({
      feedbackApi,
      apiSession,
    }) => {
      const feedback = buildFeedback("API maximum body");
      const body = "b".repeat(BODY_MAX_LENGTH);

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body, receiverId: apiSession.receiver.id },
        apiSession.accessToken,
      );

      expect(response.status()).toBe(200);
      expect(((await response.json()) as FeedbackPayload).body).toHaveLength(BODY_MAX_LENGTH);
    });

    test("sanitizes HTML before persisting feedback", async ({ feedbackApi, apiSession }) => {
      const feedback = buildFeedback("API sanitization");
      const input = {
        title: `${feedback.title} <strong>safe</strong>`,
        body: `${feedback.body} <strong>team</strong><script>alert("unsafe")</script>`,
        receiverId: apiSession.receiver.id,
      };

      const response = await feedbackApi.createFeedback(input, apiSession.accessToken);
      expect(response.status()).toBe(200);

      const createdFeedback = (await response.json()) as FeedbackPayload;
      expect(createdFeedback.title).toBe(`${feedback.title} safe`);
      expect(createdFeedback.body).toContain("<strong>team</strong>");
      expect(createdFeedback.body).not.toContain("<script");
      expect(createdFeedback.body).not.toContain("unsafe");
    });

    test("takes the author from the access token and ignores an author ID in the payload", async ({
      feedbackApi,
      apiSession,
    }) => {
      const feedback = buildFeedback("API author spoofing");

      const response = await feedbackApi.createFeedback(
        {
          title: feedback.title,
          body: feedback.body,
          receiverId: apiSession.receiver.id,
          authorId: apiSession.receiver.id,
        },
        apiSession.accessToken,
      );

      expect(response.status()).toBe(200);
      expect(((await response.json()) as FeedbackPayload).author).toEqual(apiSession.author);
    });
  });

  test.describe("authentication", () => {
    const unauthorizedScenarios: Array<{ name: string; token: () => string | undefined }> = [
      { name: "a missing token", token: () => undefined },
      { name: "a malformed token", token: () => "not-a-valid-jwt" },
      { name: "a token signed with a different secret", token: () => jwt.sign({ sub: 1 }, "not-the-api-secret") },
      { name: "an unsigned token", token: () => jwt.sign({ sub: 1 }, "", { algorithm: "none" }) },
    ];

    for (const scenario of unauthorizedScenarios) {
      test(`rejects ${scenario.name} and creates no feedback`, async ({ feedbackApi, apiSession }) => {
        const feedback = buildFeedback("API unauthorized");

        const response = await feedbackApi.createFeedback(
          { title: feedback.title, body: feedback.body, receiverId: apiSession.receiver.id },
          scenario.token(),
        );

        await expectErrorResponse(response, 401, "AuthorizationRequiredError");
        await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
      });
    }

    test("rejects an expired token and creates no feedback", async ({ feedbackApi, apiSession }) => {
      test.skip(!ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET is required to sign an expired token");
      const feedback = buildFeedback("API expired token");
      const expiredToken = jwt.sign({ sub: apiSession.author.id }, ACCESS_TOKEN_SECRET as string, {
        expiresIn: -60,
        issuer: "leapsome",
      });

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body: feedback.body, receiverId: apiSession.receiver.id },
        expiredToken,
      );

      await expectErrorResponse(response, 401, "AuthorizationRequiredError");
      await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
    });
  });

  test.describe("validation", () => {
    for (const scenario of validationScenarios) {
      test(`rejects a payload with ${scenario.name}`, async ({ feedbackApi, apiSession }) => {
        const feedback = buildFeedback(`API validation ${scenario.property}`);
        const validInput: FeedbackInput = {
          title: feedback.title,
          body: feedback.body,
          receiverId: apiSession.receiver.id,
        };

        const response = await feedbackApi.createFeedback(scenario.change(validInput), apiSession.accessToken);

        await expectValidationError(response, scenario.property);
        await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
      });
    }

    for (const receiverId of [999_999, 0, -1]) {
      test(`rejects receiver ID ${receiverId}, which belongs to no user`, async ({ feedbackApi, apiSession }) => {
        const feedback = buildFeedback("API unknown receiver");

        const response = await feedbackApi.createFeedback(
          { title: feedback.title, body: feedback.body, receiverId },
          apiSession.accessToken,
        );

        const error = await expectErrorResponse(response, 400, "BadRequestError");
        expect(error.message).toContain("Receiver does not exist");
        await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
      });
    }
  });

  test.describe("connection handling", () => {
    // Regression test for FINDINGS.md, F1: every error response used to destroy the keep-alive socket, so the next
    // request sent over the same connection failed with ECONNRESET.
    test("keeps the keep-alive connection usable after error responses", async ({ apiSession }) => {
      const client = new KeepAliveClient(API_BASE_URL);

      try {
        for (const rejectedRequest of [
          { name: "validation error", accessToken: apiSession.accessToken, expectedStatus: 400 },
          { name: "missing authentication", accessToken: undefined, expectedStatus: 401 },
        ]) {
          const rejected = await client.send("POST", "/feedback", {
            body: { title: "xy" },
            accessToken: rejectedRequest.accessToken,
          });
          expect(rejected, `response to the ${rejectedRequest.name}`).toEqual({
            status: rejectedRequest.expectedStatus,
          });

          const followUp = await client.send("GET", "/feedback", { accessToken: apiSession.accessToken });
          expect(followUp, `follow-up request after the ${rejectedRequest.name}`).toEqual({ status: 200 });
        }
      } finally {
        client.close();
      }
    });
  });

  // Each test below describes the expected behaviour for a defect documented in FINDINGS.md. They are marked with
  // test.fail(): the suite stays green while the defect exists and turns red as soon as it is fixed, as a reminder to
  // remove the marker.
  test.describe("known defects", () => {
    test("rejects a non-integer receiver ID with 400 instead of 500", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F2" });
      test.fail();
      const feedback = buildFeedback("API fractional receiver");

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body: feedback.body, receiverId: 1.5 },
        apiSession.accessToken,
      );

      await expectValidationError(response, "receiverId");
    });

    test("rejects a JSON array payload with 400 instead of 500", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F2" });
      test.fail();
      const feedback = buildFeedback("API array payload");

      const response = await feedbackApi.createFeedback(
        [{ title: feedback.title, body: feedback.body, receiverId: apiSession.receiver.id }],
        apiSession.accessToken,
      );

      expect(response.status()).toBe(400);
    });

    test("rejects a valid token of a user that no longer exists with 401 instead of 500", async ({
      feedbackApi,
      apiSession,
    }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F3" });
      test.skip(!ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET is required to sign a token for an unknown user");
      test.fail();
      const feedback = buildFeedback("API unknown author");
      const tokenOfUnknownUser = jwt.sign({ sub: 999_999 }, ACCESS_TOKEN_SECRET as string, { issuer: "leapsome" });

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body: feedback.body, receiverId: apiSession.receiver.id },
        tokenOfUnknownUser,
      );

      expect(response.status()).toBe(401);
    });

    test("rejects feedback addressed to the author, as the UI does", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F4" });
      test.fail();
      const feedback = buildFeedback("API self feedback");

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body: feedback.body, receiverId: apiSession.author.id },
        apiSession.accessToken,
      );

      expect(response.status()).toBe(400);
      await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
    });

    test("rejects a title that is empty after HTML sanitization", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F5" });
      test.fail();
      const feedback = buildFeedback("API markup-only title");

      const response = await feedbackApi.createFeedback(
        { title: "<b></b>", body: feedback.body, receiverId: apiSession.receiver.id },
        apiSession.accessToken,
      );

      await expectValidationError(response, "title");
    });

    test("rejects a title that consists only of whitespace", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F5" });
      test.fail();
      const feedback = buildFeedback("API blank title");

      const response = await feedbackApi.createFeedback(
        { title: "   ", body: feedback.body, receiverId: apiSession.receiver.id },
        apiSession.accessToken,
      );

      await expectValidationError(response, "title");
    });

    test("rejects an authorization header that does not use the Bearer scheme", async ({ feedbackApi, apiSession }) => {
      test.info().annotations.push({ type: "issue", description: "FINDINGS.md, F6" });
      test.fail();
      const feedback = buildFeedback("API basic scheme");

      const response = await feedbackApi.createFeedback(
        { title: feedback.title, body: feedback.body, receiverId: apiSession.receiver.id },
        undefined,
        { Authorization: `Basic ${apiSession.accessToken}` },
      );

      expect(response.status()).toBe(401);
      await expectFeedbackWasNotCreated(feedbackApi, apiSession.accessToken, feedback.title);
    });
  });
});
