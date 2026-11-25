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
  await expect(page).toHaveURL(/\/create\//);
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
  await page.locator("input[type=file]").setInputFiles({
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

test("one bead per pickup on a touch table, with mode switching, return and history", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/create");
    await page
      .getByRole("button", { name: "Start creating", exact: true })
      .tap();
    await page.getByRole("button", { name: "Interactive", exact: true }).tap();
    await page.getByRole("button", { name: "Top", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Grab bead (G)" }),
    ).toHaveAttribute("aria-pressed", "true");
    const box = page.getByRole("button", {
      name: "Take Bubblegum bead",
      exact: true,
    });
    await box.tap();
    await expect(page.locator(".pickup-status")).toContainText(
      "Holding Bubblegum",
    );
    await box.tap();
    await expect(page.locator(".pickup-status")).not.toContainText("Holding");
    await box.tap();
    const board = await page.locator("canvas").boundingBox();
    const x = board!.x + board!.width * 0.5,
      y = board!.y + board!.height * 0.42;
    const cdp = await context.newCDPSession(page);
    const first = { x: x - 15, y, id: 1 },
      second = { x: x + 15, y, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [first],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [first, second],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...first, x: x - 20 },
        { ...second, x: x + 20 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.locator(".workspace-status")).toContainText("0 beads");
    await expect(page.locator(".pickup-status")).toContainText(
      "Holding Bubblegum",
    );
    await page.touchscreen.tap(x, y);
    await expect(page.locator(".workspace-status")).toContainText("1 beads");
    await page.touchscreen.tap(x + 32, y);
    await expect(page.locator(".workspace-status")).toContainText("1 beads");
    await page.getByRole("button", { name: "Classic", exact: true }).tap();
    await page.touchscreen.tap(x + 32, y);
    await expect(page.locator(".workspace-status")).toContainText("2 beads");
    await page.getByRole("button", { name: "Interactive", exact: true }).tap();
    await page.getByRole("button", { name: "Undo", exact: true }).tap();
    await expect(page.locator(".workspace-status")).toContainText("1 beads");
    await page.getByRole("button", { name: "Redo", exact: true }).tap();
    await expect(page.locator(".workspace-status")).toContainText("2 beads");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Interactive", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".workspace-status")).toContainText("2 beads");
    await page.getByRole("button", { name: /Colors & details/ }).tap();
    await page
      .locator(".swatch-grid")
      .getByRole("button", { name: "Select Lilac", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Take Lilac bead", exact: true })
      .tap();
    await expect(page.locator(".pickup-status")).toContainText("Holding Lilac");
  } finally {
    await context.close();
  }
});

test("discovery bookmarks persist, keywords combine and a preview opens as a guided project", async ({
  page,
}) => {
  await page.goto("/presets");
  await page.getByLabel("Search templates").fill("food red");
  const cherry = page.locator(".preset-card").filter({
    has: page.getByRole("heading", { name: "Cherry", exact: true }),
  });
  await cherry
    .getByRole("button", { name: "Save Cherry on this device" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Saved (1)" }).click();
  await expect(page.locator(".preset-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Preview Cherry" }).click();
  const preview = page.getByRole("dialog", { name: "Cherry" });
  await expect(preview.getByRole("img", { name: "Cherry" })).toBeVisible();
  await preview.getByRole("button", { name: "Follow pattern" }).click();
  await expect(page).toHaveURL(/\/create\//);
  await expect(page.locator(".workspace-status")).toContainText("0 beads");
  await page.getByRole("tab", { name: "Template", exact: true }).click();
  await expect(page.getByText(/0 \/ 74 beads matched/)).toBeVisible();
  await page.getByRole("link", { name: "Explore templates" }).click();
  for (const sort of ["most", "recent"]) {
    await page.getByLabel("Sort templates").selectOption(sort);
    await expect(
      page.locator(".preset-card").first().getByRole("heading"),
    ).toHaveText("Cherry");
  }
  await page
    .getByRole("button", { name: "Save Cherry on this device" })
    .click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Saved (0)" })).toBeVisible();
});

test("a phone can add, swing and tidy a box in the first viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    const entry = await page
      .getByRole("button", { name: "Better with a little company" })
      .boundingBox();
    const create = await page
      .getByRole("button", { name: "New creation", exact: true })
      .boundingBox();
    expect(entry!.y).toBe(create!.y);
    const frame = await page.locator(".board-column").boundingBox();
    expect(frame!.y + frame!.height).toBeLessThan(844);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("button", { name: "Top", exact: true }).tap();
    for (const color of ["Lilac", "Blue sky", "Cherry red"]) {
      await page.getByRole("button", { name: "Add box", exact: true }).tap();
      await page
        .getByRole("button", { name: `Add ${color} box`, exact: true })
        .tap();
    }
    await expect(page.locator(".scene-tray")).toHaveCount(6);
    await page.getByRole("button", { name: "Add box", exact: true }).tap();
    await expect(
      page.getByText("Put away an extra box to add another color."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog", exact: true }).tap();
    const grip = page.getByRole("button", {
      name: "Move Lilac box",
      exact: true,
    });
    const box = (await grip.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    // Swing a far-side box toward the edge of its rack.
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - 8, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - 55, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.locator(".loose-bead")).toHaveCount(5);
    await page.getByRole("button", { name: "Tidy table", exact: true }).tap();
    await expect(page.locator(".loose-bead")).toHaveCount(0);
    await expect(page.locator(".scene-tray")).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  } finally {
    await context.close();
  }
});
