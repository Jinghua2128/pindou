import { test, expect } from "@playwright/test";
test("studio renders a live 3D board without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Little things, made by you." }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/pindou-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("new 29 × 29 project, paint, erase, history, camera, autosave and export", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New creation", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("E2E little creation");
  await page.getByRole("button", { name: "29 × 29", exact: true }).click();
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await expect(page).toHaveURL(/\/create\//);
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.waitForTimeout(900);
  await page
    .locator(".swatch-grid")
    .getByRole("button", { name: "Select Bubblegum", exact: true })
    .click();
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.59, box.y + box.height * 0.5, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  const painted = await page.locator(".workspace-status").innerText();
  expect(parseInt(painted, 10)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".workspace-status")).toContainText("0 beads");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".workspace-status")).toContainText(
    painted.split(" beads")[0],
  );
  await page.getByRole("button", { name: "Eraser (E)", exact: true }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "3D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.waitForTimeout(900);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "E2E little creation" }),
  ).toBeVisible();
  expect(
    parseInt(await page.locator(".workspace-status").innerText(), 10),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save project file", exact: false })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "E2E little creation.pindou.json",
  );
});
test("templates, fusion, production estimate and saved copies", async ({
  page,
}) => {
  await page.goto("/presets");
  await expect(page.locator(".preset-card")).toHaveCount(12);
  await page.getByLabel("Search templates").fill("Cherry");
  await expect(page.locator(".preset-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Make it yours" }).click();
  await expect(page).toHaveURL(/\/create\//);
  await page
    .getByRole("button", { name: "Fuse creation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Make it real", exact: true }),
  ).toBeVisible({ timeout: 6000 });
  await page.getByRole("button", { name: "Make it real", exact: true }).click();
  await expect(
    page.getByText("Estimated total", { exact: true }),
  ).toBeVisible();
  const before = await page.locator(".price-total").innerText();
  await page.getByRole("button", { name: "Framed", exact: true }).click();
  expect(await page.locator(".price-total").innerText()).not.toBe(before);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download production brief" }).click();
  expect((await download).suggestedFilename()).toContain("-production.json");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "My creations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cherry", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate Cherry", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cherry (copy)", exact: true }),
  ).toBeVisible();
});
test("all required responsive widths fit without horizontal overflow", async ({
  page,
}) => {
  for (const width of [375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "/tmp/pindou-mobile.png", fullPage: true });
      await page.getByRole("button", { name: /Colors & details/ }).click();
      await expect(
        page.getByRole("button", { name: "Fuse creation", exact: true }),
      ).toBeVisible();
      await page
        .locator(".swatch-grid")
        .getByRole("button", { name: "Select Bubblegum", exact: true })
        .click();
      await expect(page.locator(".selected-color strong")).toHaveText(
        "Bubblegum",
      );
    }
  }
});

test("storage failures stay visible and a new project remains editable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Test quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(
    page.getByText("Save failed — export to keep your work"),
  ).toBeVisible();
  await page.getByRole("button", { name: "New creation", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Unsaved but editable");
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unsaved but editable" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save project file", exact: false })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "Unsaved but editable.pindou.json",
  );
});

test("image conversion creates a fully editable project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New creation", exact: true }).click();
  await page.getByRole("button", { name: /Image to beads/ }).click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ea464b";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#f6c842";
    ctx.fillRect(8, 8, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "Tiny picture.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  await expect(
    page.getByRole("img", { name: "Converted bead pattern" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bring it to the studio" }).click();
  await expect(
    page.getByRole("button", { name: "Tiny picture", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-status")).toContainText("841 beads");
  await page.getByRole("button", { name: "Clear board", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear board", exact: true })
    .click();
  await expect(page.locator(".workspace-status")).toContainText("0 beads");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".workspace-status")).toContainText("841 beads");
});
