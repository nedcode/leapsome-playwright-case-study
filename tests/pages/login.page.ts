import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Sign in to your account" });
    this.usernameInput = page.getByLabel("Username", { exact: true });
    this.passwordInput = page.getByLabel("Password", { exact: true });
    this.signInButton = page.getByRole("button", { name: "Sign in" });
    this.errorAlert = page.getByRole("alert");
  }

  async open() {
    await this.page.goto("/");
  }

  async signIn(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}
