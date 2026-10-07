import { test, expect } from "../fixtures/test.fixture";
import { USERS } from "../support/test-data";

// These scenarios cover the sign-in journey itself, so they start without the stored session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("authentication", () => {
  test("redirects an unauthenticated user away from the feedback wall", async ({
    page,
    loginPage,
    feedbackWallPage,
  }) => {
    await feedbackWallPage.navigate();

    await expect(page).toHaveURL(/\/$/);
    await expect(loginPage.heading).toBeVisible();
    await expect(feedbackWallPage.root).toHaveCount(0);
  });

  test("signs in with valid credentials and lands on the feedback wall", async ({
    page,
    loginPage,
    feedbackWallPage,
  }) => {
    await loginPage.open();
    await loginPage.signIn(USERS.primary.username, USERS.primary.password);

    await expect(page).toHaveURL(/\/feedback$/);
    await expect(feedbackWallPage.heading).toBeVisible();
    await expect(feedbackWallPage.signOutButton).toBeVisible();
  });

  test("shows an accessible error for invalid credentials", async ({ page, loginPage }) => {
    await loginPage.open();
    await loginPage.signIn(USERS.primary.username, "wrong-password");

    await expect(loginPage.errorAlert).toHaveText("Wrong username or password");
    await expect(page).toHaveURL(/\/$/);
    await expect(loginPage.heading).toBeVisible();
  });

  test("signs out and protects the feedback wall from the ended session", async ({
    page,
    loginPage,
    feedbackWallPage,
  }) => {
    await loginPage.open();
    await loginPage.signIn(USERS.primary.username, USERS.primary.password);
    await expect(feedbackWallPage.heading).toBeVisible();

    await feedbackWallPage.signOut();

    await expect(page).toHaveURL(/\/$/);
    await expect(loginPage.heading).toBeVisible();

    await feedbackWallPage.navigate();
    await expect(page).toHaveURL(/\/$/);
    await expect(loginPage.heading).toBeVisible();
  });
});
