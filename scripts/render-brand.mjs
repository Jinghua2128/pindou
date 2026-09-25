import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
const root = path.resolve("public/brand");
const assets = JSON.parse(
  fs.readFileSync(path.join(root, "assets.json"), "utf8"),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1920 },
    deviceScaleFactor: 1,
  });
  for (const asset of assets) {
    await page.goto(
      pathToFileURL(path.join(root, "social-source.html")).href +
        "?asset=" +
        asset.id,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    const target =
      asset.id === "avatar"
        ? "avatar.png"
        : asset.id === "github-banner"
          ? "github-banner.png"
          : `social/${asset.id}.png`;
    await page.locator(".card").screenshot({ path: path.join(root, target) });
    console.log(target);
  }
  const iconPage = await browser.newPage({
    viewport: { width: 180, height: 180 },
    deviceScaleFactor: 1,
  });
  await iconPage.setContent(
    `<style>*{margin:0;padding:0}img{width:180px;height:180px}</style><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(root, "icon.svg")).toString("base64")}">`,
  );
  await iconPage
    .locator("img")
    .screenshot({
      path: path.resolve("app/apple-icon.png"),
      omitBackground: true,
    });
  fs.copyFileSync(
    path.join(root, "github-banner.png"),
    "app/opengraph-image.png",
  );
} finally {
  await browser.close();
}
