import { expect, test } from "@playwright/test";

test("checkout return waits for verified access and clearly labels test payments", async ({
  page,
}) => {
  let paid = false;
  await page.route("**/api/billing/status", (route) =>
    route.fulfill({
      json: {
        configured: true,
        active: paid,
        email: "maker@example.test",
        remaining: 5,
        testMode: true,
        pricing: { amount: 490, currency: "sgd" },
      },
    }),
  );
  await page.goto("/account/plus?checkout=complete");
  await expect(
    page.getByText("Test payments only — use a Stripe test card."),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Confirming your subscription…",
  );
  await expect(
    page.getByRole("button", { name: "Subscribe with Stripe" }),
  ).toHaveCount(0);
  paid = true;
  await expect(page.getByText("Plus is active.", { exact: false })).toBeVisible(
    { timeout: 10000 },
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});
