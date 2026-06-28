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

    await expect(page.getByRole("heading", { name: "오늘 이어갈 일" })).toBeVisible();
    await expect(page.getByTestId("dashboard-ai-starter")).toBeVisible();
    await expect(page.getByLabel("예식 날짜")).toBeVisible();
    await expect(page.getByText("Timeline")).toHaveCount(0);
    await expect(page.getByText("영역별 준비도")).toHaveCount(0);
    await expect(page.getByText("시작 후보 잡기")).toHaveCount(0);

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

  test("explains the product before asking for setup choices", async ({ page }) => {
    await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "막막한 준비를 두 분의 순서로 바꿔드릴게요." })).toBeVisible();
    await expect(page.getByRole("button", { name: "에이전트와 시작하기 →" })).toBeVisible();
    await expect(page.getByText("약 2분")).toBeVisible();
    await expect(page.getByText("나중에 수정")).toBeVisible();
    await expect(page.getByText("자동 저장")).toBeVisible();
    await expect(page.getByText("내 저장소로 직접 운영")).toHaveCount(0);
    await assertLayoutHealth(page);
  });

  test("reveals the planning overview after basic information exists", async ({ page }) => {
    await seedVisualData(page, true);
    await page.goto("/dashboard");

    await expect(page.getByText("전체 준비 현황")).toBeVisible();
    await expect(page.getByText("Timeline")).toHaveCount(0);
    await expect(page.getByText("영역별 준비도")).toHaveCount(0);
    await expect(page.getByText("시작 후보 잡기")).toHaveCount(0);
    await assertLayoutHealth(page);
  });

  test("shows AI entry points in the actual UI", async ({ page }, testInfo) => {
    await seedVisualData(page);
    const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-ai-starter").click();
    await expect(page.getByText("아래 요청을 평소 쓰는 AI에 보내고")).toBeVisible();
    await expect(page.getByRole("link", { name: "로그인 →", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "초안 만들기 →", exact: true })).toHaveCount(0);
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

async function seedVisualData(page: Page, populated = false) {
  const data: WeddingData = defaultData();
  data.preferences = { ...data.preferences, mode: "local", isDemo: true };
  if (populated) {
    data.invitation = {
      ...data.invitation,
      groomName: "민준",
      brideName: "서연",
      date: "2026-11-07",
      venue: "그랜드하우스 웨딩홀",
    };
  }
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
