import type { Locator, Page } from "@playwright/test";

export type FeedbackFormData = {
  title: string;
  body: string;
  receiver: string;
};

export class FeedbackDialog {
  readonly root: Locator;
  readonly titleInput: Locator;
  readonly commentInput: Locator;
  readonly receiverSelect: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("feedback-dialog");
    this.titleInput = this.root.getByLabel("Title", { exact: true });
    this.commentInput = this.root.getByLabel("Comment", { exact: true });
    this.receiverSelect = this.root.getByLabel("Receiver", { exact: true });
    this.submitButton = this.root.getByRole("button", { name: "Submit" });
    this.errorAlert = this.root.getByRole("alert");
  }

  async fill(data: FeedbackFormData) {
    await this.titleInput.fill(data.title);
    await this.commentInput.fill(data.body);
    await this.receiverSelect.selectOption({ label: data.receiver });
  }

  async submit() {
    await this.submitButton.click();
  }

  async createFeedback(data: FeedbackFormData) {
    await this.fill(data);
    await this.submit();
  }
}
