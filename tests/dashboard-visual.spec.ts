import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { defaultData, type WeddingData } from "../src/lib/schema";

const screenshotDir = join(process.cwd(), "artifacts", "screenshots");
const DATA_KEY = "wedding-os/v1";

test.describe("dashboard visual smoke", () => {
  test.beforeAll(() => {
    mkdirSync(screenshotDir, { recursive: true });
  });

  test("keeps the dashboard focused and readable", async ({ page }, testInfo) => {
    await seedVisualData(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("오늘은 이것만")).toBeVisible();
    await expect(page.getByTestId("dashboard-ai-starter")).toBeVisible();
    await expect(page.getByText("Timeline")).toBeVisible();
    await expect(page.getByText("영역별 준비도")).toBeVisible();
    await expect(page.getByText("시작 후보 잡기")).toBeVisible();

    await assertLayoutHealth(page);

    const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    await page.screenshot({
      path: join(screenshotDir, `dashboard-${projectName}-top.png`),
      fullPage: false,
    });

    await page.evaluate(() => window.scrollTo(0, Math.floor(window.innerHeight * 0.9)));
    await page.waitForTimeout(250);
    await assertLayoutHealth(page);
    await page.screenshot({
      path: join(screenshotDir, `dashboard-${projectName}-mid.png`),
      fullPage: false,
    });
  });

  test("shows AI entry points in the actual UI", async ({ page }, testInfo) => {
    await seedVisualData(page);
    const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-ai-starter").click();
    await expect(page.getByText("현재 입력된 정보만 바탕으로 초안을 만들고")).toBeVisible();
    await expect(page.getByRole("button", { name: "초안 만들기 →", exact: true })).toBeVisible();
    await page.screenshot({
      path: join(screenshotDir, `dashboard-ai-modal-${projectName}.png`),
      fullPage: false,
    });

    await page.goto("/invitation");
    await page.getByRole("button", { name: "편집" }).click();
    const invitationAi = page.getByRole("button", { name: "담백하게" });
    await invitationAi.scrollIntoViewIfNeeded();
    await expect(invitationAi).toBeVisible();
    await page.screenshot({
      path: join(screenshotDir, `invitation-ai-entry-${projectName}.png`),
      fullPage: false,
    });
  });
});

async function seedVisualData(page: Page) {
  const data: WeddingData = defaultData();
  data.preferences = { ...data.preferences, mode: "local", isDemo: true };
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: DATA_KEY, value: data },
  );
}

async function assertLayoutHealth(page: Page) {
  const result = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    const visibleElements = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= 0 &&
          rect.top <= window.innerHeight &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      });

    const horizontalLeaks = visibleElements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((el) => el.left < -1 || el.right > viewportWidth + 1)
      .slice(0, 5);

    return {
      hasHorizontalScroll: documentWidth > viewportWidth + 1,
      horizontalLeaks,
    };
  });

  expect(result.hasHorizontalScroll, JSON.stringify(result, null, 2)).toBe(false);
  expect(result.horizontalLeaks, JSON.stringify(result, null, 2)).toEqual([]);
}
