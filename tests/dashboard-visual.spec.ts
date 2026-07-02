import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { defaultData, type WeddingData } from "../src/lib/schema";
import { defaultChecklist } from "../src/data/checklistTemplate";

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

    await expect(page.locator("#today-focus").getByText("오늘 할 일", { exact: true })).toBeVisible();
    await expect(page.locator("#today-focus").getByText("Dearie", { exact: true })).toHaveCount(0);
    await expect(page.getByText("오늘의 첫 단계")).toBeVisible();
    await expect(page.getByText("private briefing")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "다음 할 일 정리하기 →" })).toHaveCount(0);
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

  test("reaches a buried feature in two taps via the 더보기 sheet from any page", async ({ page }) => {
    await seedVisualData(page);
    // 횡단 이동: 예산 화면에서 곧장 하객 명단으로 (홈을 경유하지 않고).
    await page.goto("/budget");
    await page.getByRole("button", { name: "더보기" }).click();
    const sheet = page.getByRole("dialog", { name: "전체 메뉴" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: /하객 명단/ }).click();
    await expect(page).toHaveURL(/\/guests$/);
    // 시트는 이동 후 닫힌다.
    await expect(page.getByRole("dialog", { name: "전체 메뉴" })).toHaveCount(0);
  });

  test("builds the day-of run sheet from the standard template", async ({ page }) => {
    await seedVisualData(page);
    await page.goto("/ceremony");
    await page.getByRole("button", { name: /기본 식순 불러오기/ }).click();
    await expect(page.getByText("개식 선언")).toBeVisible();
    await expect(page.getByText("혼인 서약")).toBeVisible();
    await expect(page.getByText("성혼 선언문 낭독")).toBeVisible();
    // 진행표를 사회자에게 넘길 수 있는 내보내기 동선이 있다.
    await expect(page.getByRole("button", { name: "사회자에게 보내기", exact: true })).toBeVisible();
  });

  test("shows the couple exactly what guests see via a dedicated tab", async ({ page }) => {
    await seedVisualData(page, true);
    await page.goto("/invitation");
    await page.getByRole("button", { name: "하객 시점", exact: true }).click();
    // koBreak 가 NBSP로 단어를 잇기 때문에 안정적인 한 단어로 배너를 찾는다.
    const banner = page.getByText("하객에게는", { exact: false });
    await expect(banner).toBeVisible();
    // 안내 배너는 닫을 수 있다.
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(banner).toHaveCount(0);
  });

  test("agent reads the couple's situation — capacity and meal-budget signals", async ({ page }) => {
    const data = defaultData();
    data.preferences = { ...data.preferences, mode: "local", isDemo: false };
    data.invitation = { ...data.invitation, groomName: "민준", brideName: "서연", date: "2026-11-07", venue: "그랜드하우스" };
    data.checklist = defaultChecklist(data.invitation.date);
    data.venues = [{ id: "v1", name: "그랜드하우스", status: "계약", capacityMin: 100, capacityMax: 150, mealPriceMin: 65000, mealPriceMax: 70000 }] as WeddingData["venues"];
    data.guests = Array.from({ length: 180 }, (_, i) => ({ id: `g${i}`, name: `손님${i}`, side: (i % 2 ? "bride" : "groom") as const, status: "참석" as const, partyCount: 1 }));
    data.budget = [{ id: "b1", category: "스드메", planned: 4000000 }];
    await page.addInitScript((v) => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem("wedding-os/v1", JSON.stringify(v));
      localStorage.setItem("wedding-os/owner/v1", "1");
    }, data);
    await page.goto("/dashboard");
    // 계약 식장 수용 초과 + 예산표 식대 항목 누락을 에이전트가 스스로 짚는다.
    await expect(page.getByText("보증인원과 초대 범위 맞추기")).toBeVisible();
    await expect(page.getByText("준비된 재료")).toBeVisible();
    await expect(page.getByText("남은 확인")).toBeVisible();
    await expect(page.getByText(/초대 인원 180명이 그랜드하우스 수용/)).toBeVisible();
    await expect(page.getByText(/식대 항목이 없어요/)).toBeVisible();
    await assertLayoutHealth(page);
  });

  test("budget shows expected net burden after gift income", async ({ page }) => {
    const data = defaultData();
    data.preferences = { ...data.preferences, mode: "local", isDemo: false };
    data.invitation = { ...data.invitation, groomName: "민준", brideName: "서연", date: "2026-11-07", venue: "그랜드하우스" };
    data.venues = [{ id: "v1", name: "그랜드하우스", status: "계약", capacityMin: 100, capacityMax: 300, mealPriceMin: 65000, mealPriceMax: 70000 }] as WeddingData["venues"];
    data.headcount = { estimates: [
      { side: "groom", category: "work", expected: 80 },
      { side: "bride", category: "friend", expected: 70 },
    ] };
    data.budget = [
      { id: "b1", category: "예식장 식대", planned: 17500000 },
      { id: "b2", category: "스드메", planned: 4000000 },
    ];
    await page.addInitScript((v) => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem("wedding-os/v1", JSON.stringify(v));
      localStorage.setItem("wedding-os/owner/v1", "1");
    }, data);
    await page.goto("/budget");
    await expect(page.getByText("예상 실부담")).toBeVisible();
    await expect(page.getByRole("button", { name: /분류별 평균 조정/ })).toBeVisible();
    await assertLayoutHealth(page);
  });

  test("headcount estimator projects capacity and meal cost before the list is filled", async ({ page }) => {
    const data = defaultData();
    data.preferences = { ...data.preferences, mode: "local", isDemo: false };
    data.invitation = { ...data.invitation, groomName: "민준", brideName: "서연", date: "2026-11-07", venue: "그랜드하우스" };
    data.venues = [{ id: "v1", name: "그랜드하우스", status: "계약", capacityMin: 100, capacityMax: 200, mealPriceMin: 65000, mealPriceMax: 70000 }] as WeddingData["venues"];
    data.headcount = { estimates: [
      { side: "groom", category: "work", expected: 150 },
      { side: "bride", category: "friend", expected: 100 },
    ] };
    // 명단은 아직 비어 있음 — 추정만으로 경고가 나와야 한다.
    await page.addInitScript((v) => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem("wedding-os/v1", JSON.stringify(v));
      localStorage.setItem("wedding-os/owner/v1", "1");
    }, data);
    await page.goto("/guests");
    await expect(page.getByText("예상 인원")).toBeVisible();
    await expect(page.getByText(/보증 200명을 50명 넘/)).toBeVisible();
    await expect(page.getByText(/예상 식대/)).toBeVisible();
    await assertLayoutHealth(page);
  });

  test("explains the product before asking for setup choices", async ({ page }) => {
    await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "질문 5개로 오늘 할 일부터 정할게요." })).toBeVisible();
    await expect(page.getByRole("button", { name: "질문 5개 시작하기 →" })).toBeVisible();
    await expect(page.getByText("약 2분")).toBeVisible();
    await expect(page.getByText("나중에 수정")).toBeVisible();
    await expect(page.getByText("자동 저장")).toBeVisible();
    await expect(page.getByText("내 저장소로 직접 운영")).toHaveCount(0);
    await assertLayoutHealth(page);
  });

  test("reveals the planning overview after basic information exists", async ({ page }) => {
    await seedVisualData(page, true);
    await page.goto("/dashboard");

    await expect(page.getByText("둘이 같이 보면 좋은 결정을 앞에 모았어요.")).toBeVisible();
    await expect.poll(async () =>
      page.getByText("다음 같이 정할 것").evaluateAll((nodes) =>
        nodes.some((node) => node.getClientRects().length > 0),
      ),
    ).toBe(true);
    await expect(page.getByText("예식장 답사 순서 정하기")).toBeVisible();
    await expect(page.getByRole("heading", { name: "다음만 남기기" })).toBeVisible();
    await expect(page.getByText("Timeline")).toHaveCount(0);
    await expect(page.getByText("영역별 준비도")).toHaveCount(0);
    await expect(page.getByText("시작 후보 잡기")).toHaveCount(0);
    await assertLayoutHealth(page);
  });

  test("keeps long lists secondary and opens the invitation publisher directly", async ({ page }) => {
    await seedVisualData(page, true);

    await page.goto("/checklist");
    await expect(page.getByRole("heading", { name: /다가오는 일정/ })).toBeVisible();
    await expect(page.getByText("종이 청첩장 인쇄", { exact: true })).not.toBeVisible();

    await page.goto("/trip");
    await expect(page.getByRole("button", { name: /여행지 후보 더 찾아보기/ })).toBeVisible();
    await expect(page.getByText("인기 신혼여행지")).toHaveCount(0);

    await page.goto("/share");
    await page.getByRole("button", { name: /청첩장 발행 화면 열기/ }).click();
    await expect(page).toHaveURL(/\/invitation\?edit=publish#publish-invitation$/);
    await expect(page.getByRole("heading", { name: "하객용 링크 발행" })).toBeVisible();
  });

  test("shows AI entry points in the actual UI", async ({ page }, testInfo) => {
    await seedVisualData(page, true);
    const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-ai-starter").click();
    await expect(page.getByText("지금 화면에서 바로 쓸 다음 행동만 뽑습니다.")).toBeVisible();
    await expect(page.getByText("로그인 없이도 짧게 써볼 수 있어요")).toBeVisible();
    await expect(page.getByRole("button", { name: "초안 만들기", exact: true })).toBeVisible();
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
    data.checklist = defaultChecklist(data.invitation.date);
    data.honeymoon = { ...data.honeymoon, regions: [{ id: "trip-1", name: "발리", durationDays: 6 }] };
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
