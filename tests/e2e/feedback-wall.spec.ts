import type { Request } from "@playwright/test";
import { test, expect } from "../fixtures/test.fixture";
import { buildFeedback, USERS } from "../support/test-data";

const isCreateFeedbackRequest = (request: Request) =>
  request.url().endsWith("/feedback") && request.method() === "POST";

test.describe("feedback wall", () => {
  test.beforeEach(async ({ feedbackWallPage }) => {
    await feedbackWallPage.open();
    await expect(feedbackWallPage.heading).toBeVisible();
  });

  test("creates feedback and keeps it after a reload", async ({ page, feedbackWallPage, feedbackDialog }) => {
    const feedback = buildFeedback("E2E persistence");

    await test.step("submit the feedback form", async () => {
      await feedbackWallPage.openCreateDialog();
      await expect(feedbackDialog.root).toBeVisible();

      const createResponsePromise = page.waitForResponse((response) => isCreateFeedbackRequest(response.request()));
      await feedbackDialog.createFeedback(feedback);

      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);
      expect(createResponse.headers()["content-type"]).toContain("application/json");
      await expect(feedbackDialog.root).toBeHidden();
    });

    await test.step("show the new feedback on the wall", async () => {
      const feedbackCard = feedbackWallPage.feedbackCard(feedback.title);
      await expect(feedbackCard).toHaveCount(1);
      await expect(feedbackCard).toContainText(feedback.body);
      await expect(feedbackCard.getByLabel("Author")).toHaveText(USERS.primary.username);
      await expect(feedbackCard.getByLabel("Receiver")).toHaveText(USERS.receiver.username);
    });

    await test.step("keep the feedback after a reload", async () => {
      await page.reload();

      await expect(feedbackWallPage.heading).toBeVisible();
      await expect(feedbackWallPage.feedbackCard(feedback.title)).toHaveCount(1);
    });
  });

  test("does not offer the signed-in user as a feedback receiver", async ({ feedbackWallPage, feedbackDialog }) => {
    await feedbackWallPage.openCreateDialog();

    await expect(feedbackDialog.receiverSelect.getByRole("option", { name: USERS.primary.username })).toHaveCount(0);
    await expect(feedbackDialog.receiverSelect.getByRole("option", { name: USERS.receiver.username })).toHaveCount(1);
    await expect(feedbackDialog.receiverSelect.getByRole("option", { name: "Select the receiver" })).toBeDisabled();
  });

  test("prevents submitting an empty feedback form", async ({ page, feedbackWallPage, feedbackDialog }) => {
    const createRequests: Request[] = [];
    page.on("request", (request) => {
      if (isCreateFeedbackRequest(request)) createRequests.push(request);
    });

    await feedbackWallPage.openCreateDialog();
    await feedbackDialog.submit();

    await expect(feedbackDialog.root).toBeVisible();
    await expect(feedbackDialog.titleInput).toBeFocused();
    expect(createRequests).toHaveLength(0);
  });

  test("shows an error when the API rejects short feedback content", async ({
    page,
    feedbackWallPage,
    feedbackDialog,
  }) => {
    const rejectedTitle = "xy";

    await feedbackWallPage.openCreateDialog();
    await feedbackDialog.fill({
      title: rejectedTitle,
      body: "xy",
      receiver: USERS.receiver.username,
    });

    const createResponsePromise = page.waitForResponse((response) => isCreateFeedbackRequest(response.request()));
    await feedbackDialog.submit();

    expect((await createResponsePromise).status()).toBe(400);
    await expect(feedbackDialog.errorAlert).toHaveText("Please make sure that all fields are filled");
    await expect(feedbackDialog.root).toBeVisible();
    await expect(feedbackWallPage.feedbackCard(rejectedTitle)).toHaveCount(0);
  });

  test("keeps the dialog open with an error when the feedback service fails", async ({
    page,
    feedbackWallPage,
    feedbackDialog,
  }) => {
    const feedback = buildFeedback("E2E service failure");
    await page.route(
      (url) => url.pathname === "/feedback",
      (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 500, json: { name: "InternalServerError", message: "Simulated outage" } })
          : route.fallback(),
    );

    await feedbackWallPage.openCreateDialog();
    await feedbackDialog.createFeedback(feedback);

    await expect(feedbackDialog.errorAlert).toBeVisible();
    await expect(feedbackDialog.root).toBeVisible();
    await expect(feedbackDialog.titleInput).toHaveValue(feedback.title);
    await expect(feedbackWallPage.feedbackCard(feedback.title)).toHaveCount(0);
  });
});
