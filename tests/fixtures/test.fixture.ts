import { test as base } from "@playwright/test";
import { FeedbackDialog } from "../pages/feedback-dialog.component";
import { FeedbackWallPage } from "../pages/feedback-wall.page";
import { LoginPage } from "../pages/login.page";
import { API_BASE_URL } from "../support/env";
import { FeedbackApi, type UserPayload } from "../support/feedback-api";
import { USERS } from "../support/test-data";

type ApiSession = {
  accessToken: string;
  author: UserPayload;
  receiver: UserPayload;
};

type TestFixtures = {
  loginPage: LoginPage;
  feedbackWallPage: FeedbackWallPage;
  feedbackDialog: FeedbackDialog;
  feedbackApi: FeedbackApi;
};

type WorkerFixtures = {
  apiSession: ApiSession;
};

/** Avatar images are loaded from a third-party service; stub them so UI tests never depend on the internet. */
const AVATAR_URL_PATTERN = "https://avatars.dicebear.com/**";
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

export const test = base.extend<TestFixtures, WorkerFixtures>({
  context: async ({ context }, use) => {
    await context.route(AVATAR_URL_PATTERN, (route) =>
      route.fulfill({ status: 200, contentType: "image/svg+xml", body: EMPTY_SVG }),
    );
    await use(context);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  feedbackWallPage: async ({ page }, use) => {
    await use(new FeedbackWallPage(page));
  },
  feedbackDialog: async ({ page }, use) => {
    await use(new FeedbackDialog(page));
  },
  feedbackApi: async ({ request }, use) => {
    await use(new FeedbackApi(request));
  },
  // Signing in hashes a password with bcrypt, so the session is created once per worker instead of once per test.
  apiSession: [
    async ({ playwright }, use) => {
      const requestContext = await playwright.request.newContext({ baseURL: API_BASE_URL });
      const api = new FeedbackApi(requestContext);

      const accessToken = await api.signIn(USERS.primary.username, USERS.primary.password);
      const users = await api.users(accessToken);
      const author = users.find((user) => user.username === USERS.primary.username);
      const receiver = users.find((user) => user.username === USERS.receiver.username);

      if (!author || !receiver) {
        throw new Error("Expected seeded author and receiver users to exist");
      }

      await use({ accessToken, author, receiver });
      await requestContext.dispose();
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
