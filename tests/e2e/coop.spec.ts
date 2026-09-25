import { test, expect, type Page } from "@playwright/test";

async function cells(page: Page) {
  return page.evaluate(() => {
    const id = localStorage.getItem("pindou.active");
    const projects = JSON.parse(
      localStorage.getItem("pindou.projects.v1") || "[]",
    );
    return (projects.find((p: { id: string }) => p.id === id)?.cells ?? []) as (
      string | null
    )[];
  });
}
test("two independent makers share beads, trays, spills, undo and reconnect", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New creation", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Our shared little table");
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create co-op room", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page
    .getByRole("button", { name: "Open shared table", exact: true })
    .click();
  await expect(page).toHaveURL(/\/room\//);
  await expect(page.getByText("Live · everyone is in sync")).toBeVisible();
  await page
    .getByRole("button", { name: "Invite friend", exact: true })
    .click();
  const invite = await page.getByLabel("Invitation link").inputValue();
  expect(invite).toContain("/room/");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
  });
  const friend = await context.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  try {
    await friend.goto(invite);
    await expect(friend.getByText("Live · everyone is in sync")).toBeVisible();
    await expect(
      page.getByText("2 at the table", { exact: true }),
    ).toBeVisible();
    for (const p of [page, friend]) {
      await p.getByRole("button", { name: "Top", exact: true }).click();
    }
    await page.waitForTimeout(900);
    await page
      .getByRole("button", { name: "Take Bubblegum bead", exact: true })
      .click();
    await expect(page.locator(".pickup-status")).toContainText(
      "Holding Bubblegum",
    );
    await page.locator("canvas").scrollIntoViewIfNeeded();
    const box = (await page.locator("canvas").boundingBox())!;
    const center = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
    await page.mouse.click(center.x, center.y);
    await expect(friend.locator(".workspace-status")).toContainText("1 beads");
    await expect
      .poll(
        async () =>
          JSON.stringify(await cells(friend)) ===
          JSON.stringify(await cells(page)),
      )
      .toBe(true);
    // Friend physically drags a bead from its box into the canvas.
    await friend
      .getByRole("button", { name: "Take Leaf green bead", exact: true })
      .scrollIntoViewIfNeeded();
    const tray = (await friend
      .getByRole("button", { name: "Take Leaf green bead", exact: true })
      .boundingBox())!;
    const board = (await friend.locator("canvas").boundingBox())!;
    await friend.mouse.move(tray.x + tray.width / 2, tray.y + tray.height / 2);
    await friend.mouse.down();
    await friend.mouse.move(
      board.x + board.width * 0.56,
      board.y + board.height * 0.52,
      { steps: 15 },
    );
    await friend.mouse.up();
    await expect(page.locator(".workspace-status")).toContainText("2 beads");
    await expect
      .poll(async () => (await cells(page)).filter(Boolean).length)
      .toBe(2);
    const oldPink = (await cells(page)).indexOf("pink");
    // Host moves its bead to an empty peg, with no change in bead count.
    await page
      .getByRole("button", { name: "Grab bead (G)", exact: true })
      .click();
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x - 40, center.y + 25, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(".pickup-status")).not.toContainText("Holding");
    await expect
      .poll(async () => (await cells(page)).indexOf("pink"))
      .not.toBe(oldPink);
    await expect
      .poll(
        async () =>
          JSON.stringify(await cells(friend)) ===
          JSON.stringify(await cells(page)),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator(".workspace-status")).toContainText("2 beads");
    // Move a box using its accessible keyboard controls, then spill it.
    const handle = friend.getByRole("button", {
      name: "Move Bubblegum box",
      exact: true,
    });
    await handle.focus();
    await friend.keyboard.press("ArrowRight");
    await expect(page.locator('[data-tray="tray-1"]')).toHaveCSS(
      "left",
      await friend
        .locator('[data-tray="tray-1"]')
        .evaluate((el) => getComputedStyle(el).left),
    );
    await friend
      .getByRole("button", { name: "Spill Bubblegum box", exact: true })
      .click();
    await expect(page.locator(".loose-bead")).toHaveCount(10);
    await context.setOffline(true);
    await friend
      .getByRole("button", { name: "Spill Leaf green box", exact: true })
      .click();
    await expect(friend.getByText(/Reconnecting…/)).toBeVisible();
    await context.setOffline(false);
    await expect(page.locator(".loose-bead")).toHaveCount(20);
    const moving = friend.getByRole("button", {
      name: "Move Sunshine box",
      exact: true,
    });
    await moving.scrollIntoViewIfNeeded();
    const handleBox = (await moving.boundingBox())!;
    const priorPosition = await page
      .locator('[data-tray="tray-2"]')
      .getAttribute("style");
    await friend.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await friend.mouse.down();
    await friend.mouse.move(
      handleBox.x + handleBox.width / 2 - 90,
      handleBox.y + handleBox.height / 2 + 20,
      { steps: 12 },
    );
    // The other maker sees the box move before the drag ends.
    await expect(page.locator('[data-tray="tray-2"]')).not.toHaveAttribute(
      "style",
      priorPosition!,
    );
    await friend.mouse.up();
    await expect(page.locator('[data-tray="tray-2"]')).toHaveAttribute(
      "style",
      (await friend.locator('[data-tray="tray-2"]').getAttribute("style"))!,
    );
    await page.getByRole("button", { name: "Tidy table", exact: true }).click();
    await expect(friend.locator(".loose-bead")).toHaveCount(0);
    await page.screenshot({ path: "/tmp/pindou-coop.png", fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("palette drag, spilled-bead pickup, cancel and mobile tap-to-place", async ({
  page,
}) => {
  await page.goto("/create");
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.waitForTimeout(900); // Let the camera transition and initial WebGL sizing finish.
  const swatch = page
    .locator(".swatch-grid")
    .getByRole("button", { name: "Select Lilac", exact: true });
  const from = (await swatch.boundingBox())!,
    board = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    board.x + board.width * 0.5,
    board.y + board.height * 0.5,
    { steps: 15 },
  );
  await page.mouse.up();
  await expect(page.locator(".workspace-status")).toContainText("1 beads");
  await expect
    .poll(async () => (await cells(page)).filter(Boolean))
    .toEqual(["lavender"]);
  await page
    .getByRole("button", { name: "Spill Bubblegum box", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Pick up spilled Bubblegum bead",
      exact: true,
    })
    .first()
    .click();
  await expect(page.locator(".pickup-status")).toContainText(
    "Holding Bubblegum",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".loose-bead")).toHaveCount(10);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", {
      name: "Pick up spilled Bubblegum bead",
      exact: true,
    })
    .first()
    .click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const mobile = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(
    mobile.x + mobile.width * 0.4,
    mobile.y + mobile.height * 0.5,
  );
  await expect(page.locator(".workspace-status")).toContainText("2 beads");
  await expect(page.locator(".loose-bead")).toHaveCount(9);
  await expect(page.locator(".pickup-status")).not.toContainText("Holding");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("closed invitation explains recovery without pretending to connect", async ({
  page,
}) => {
  await page.goto(`/room/${"0".repeat(48)}`);
  await expect(page.locator(".room-loading")).toContainText(
    "This room has closed",
  );
  await expect(
    page.getByRole("button", { name: "Leave with your own copy" }),
  ).toBeVisible();
});
