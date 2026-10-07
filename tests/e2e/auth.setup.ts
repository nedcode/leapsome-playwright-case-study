import { test as setup, expect } from "../fixtures/test.fixture";
import { AUTH_STATE_PATH } from "../support/env";
import { USERS } from "../support/test-data";

// Signs in through the UI once and stores the session, so the feedback-wall specs start authenticated.
// The sign-in journey itself is still verified end to end in authentication.spec.ts.
setup("authenticate the primary user", async ({ page, loginPage, feedbackWallPage }) => {
  await loginPage.open();
  await loginPage.signIn(USERS.primary.username, USERS.primary.password);

  await expect(page).toHaveURL(/\/feedback$/);
  await expect(feedbackWallPage.heading).toBeVisible();

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
