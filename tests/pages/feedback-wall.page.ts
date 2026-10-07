import type { Locator, Page } from "@playwright/test";

export class FeedbackWallPage {
  readonly page: Page;
  readonly root: Locator;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly signOutButton: Locator;
  readonly feedbackCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("feedback-wall-page");
    this.heading = page.getByRole("heading", { name: "Feedback Wall" });
    this.createButton = page.getByRole("button", { name: "Create New" });
    this.signOutButton = page.getByRole("button", { name: "Sign out" });
    this.feedbackCards = page.getByTestId("feedback-card");
  }

  /** Navigates to the wall without waiting for data; use it where the user is expected to be redirected away. */
  async navigate() {
    await this.page.goto("/feedback");
  }

  /** Opens the wall as a signed-in user and waits until the feedback list has been loaded from the API. */
  async open() {
    // Match only the API call: the page document itself is also served from a URL ending in /feedback.
    const feedbackLoaded = this.page.waitForResponse(
      (response) =>
        response.url().endsWith("/feedback") &&
        response.request().method() === "GET" &&
        ["fetch", "xhr"].includes(response.request().resourceType()),
    );

    await this.navigate();
    await feedbackLoaded;
  }

  async openCreateDialog() {
    await this.createButton.click();
  }

  feedbackCard(title: string) {
    return this.feedbackCards.filter({
      has: this.page.getByRole("heading", { name: title, exact: true }),
    });
  }

  async signOut() {
    await this.signOutButton.click();
  }
}
