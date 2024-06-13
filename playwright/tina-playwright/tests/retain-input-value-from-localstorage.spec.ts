import { test, expect } from "@playwright/test";

test.describe("Local storage retain edit test", () => {
  const inputSelector = 'input[name="Title"]';
  const newValue = "Updated Author Name";

  test.beforeEach(async ({ page }) => {
    await page.goto(
      "http://localhost:3000/admin/index.html#/collections/edit/author/first_author",
      { waitUntil: "domcontentloaded" }
    );

    //Need to dismiss the popup dialog to enter edit mode
    //TODO : Remove this click once figure out how the dialog state changes (ideal solution is to set the relevant state when the page load dialog dismiss during the e2e test)
    page.click('button[data-test="enter-edit-mode"]');
  });

  test("Input value retain when page reload without saving", async ({
    page,
  }) => {
    // Fill the input field with the new value
    await page.fill('input[name="Title"]', newValue);

    // Refresh the page
    await page.reload();

    // Verify that the input field retains the new value
    const inputValue = await page.inputValue(inputSelector);
    expect(inputValue).toBe(newValue);
  });
});
