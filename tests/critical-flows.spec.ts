import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { defaultChecklist } from "../src/data/checklistTemplate";
import { buildPublishInvitation } from "../src/lib/invitePublish";
import { defaultData, type WeddingData } from "../src/lib/schema";

const DATA_KEY = "wedding-os/v1";
const DRAFT_KEY = "wedding-os/setup-draft/v1";
const OWNER_KEY = "wedding-os/owner/v1";

test.describe("critical product flows", () => {
  test("starts from the demo and creates a clean local workspace", async ({ page }) => {
    await resetBrowserStorage(page);
    await page.goto("/");

    await page.getByRole("button", { name: "내 결혼식 준비 시작" }).click();
    await page.getByText("혼자 이 기기에 저장").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Wedding day")).toBeVisible();

    const stored = await readStoredData(page);
    expect(stored.preferences.mode).toBe("local");
    expect(stored.preferences.isDemo).toBe(false);
    expect(stored.invitation.groomName).toBe("");
    expect(stored.invitation.brideName).toBe("");
    expect(stored.checklist.length).toBeGreaterThan(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), OWNER_KEY)).toBe("1");
  });

  test("keeps existing local data when moving from local mode into setup", async ({ page }) => {
    const seeded = seededWeddingData();
    await seedBrowserStorage(page, seeded);

    await page.goto("/settings");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "저장 방식 다시 선택 →" }).click();

    await page.getByRole("button", { name: "내 결혼식 준비 시작" }).click();
    await page.getByText("내 저장소로 직접 운영").click();

    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByText("옮겨갈 데이터")).toBeVisible();
    await expect(page.getByText("청첩장 정보")).toBeVisible();
    await expect(page.getByText("예산 항목")).toBeVisible();
    await expect(page.getByText("하객", { exact: true })).toBeVisible();

    const stored = await readStoredData(page);
    expect(stored.invitation.groomName).toBe(seeded.invitation.groomName);
    expect(stored.invitation.brideName).toBe(seeded.invitation.brideName);
    expect(stored.budget?.[0]?.category).toBe(seeded.budget?.[0]?.category);
    expect(stored.guests?.[0]?.name).toBe(seeded.guests?.[0]?.name);
  });

  test("preserves local data if Cloud conversion cannot save to Supabase", async ({ page }) => {
    const seeded = seededWeddingData();
    await seedBrowserStorage(page, seeded, {
      [DRAFT_KEY]: JSON.stringify({
        step: 5,
        url: "https://weddingostest.supabase.co",
        anonKey: "eyJ" + "a".repeat(80),
      }),
    });
    await page.route("https://weddingostest.supabase.co/**", (route) => route.abort());

    await page.goto("/setup");
    await expect(page.getByText("백업하고 둘이 쓰기로 전환하기")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "백업 후 완료 ✓" }).click();
    const download = await downloadPromise;
    await download.delete().catch(() => undefined);

    await expect(page.getByText("같이 쓰는 저장소에 저장하지 못했어요.")).toBeVisible({ timeout: 15_000 });

    const stored = await readStoredData(page);
    expect(stored.preferences.mode).toBe("local");
    expect(stored.preferences.supabase).toBeUndefined();
    expect(stored.invitation.groomName).toBe(seeded.invitation.groomName);
    expect(stored.guests?.[0]?.name).toBe(seeded.guests?.[0]?.name);
  });

  test("opens starter panels and turns catalog suggestions into user data", async ({ page }) => {
    const seeded = seededWeddingData();
    await seedBrowserStorage(page, seeded);

    await page.goto("/rings?starter=1");
    await expect(page.getByText("반지 기준 잡기")).toBeVisible();
    await page.getByRole("button", { name: /후보 \d+개 표시하기 →/ }).click();
    await expect.poll(() => readStoredData(page).then((stored) =>
      stored.rings.some((ring) => ring.likedBy?.includes("bride"))
    )).toBe(true);

    await page.goto("/trip?starter=1");
    await expect(page.getByText("여행 기준 잡기")).toBeVisible();
    await page.getByRole("button", { name: "후보 3곳 담기 →" }).click();
    await expect.poll(() => readStoredData(page).then((stored) => stored.honeymoon.regions.length)).toBeGreaterThan(
      seeded.honeymoon.regions.length,
    );

    await page.goto("/venues?starter=1");
    await expect(page.getByText("예식장 기준 잡기")).toBeVisible();
    await page.getByRole("button", { name: /후보 \d+곳 담기 →/ }).click();
    await expect.poll(() => readStoredData(page).then((stored) => stored.venues?.length ?? 0)).toBeGreaterThan(
      seeded.venues?.length ?? 0,
    );
  });

  test("lets AI starter output create a useful first board without calling an API", async ({ page }) => {
    const seeded = seededWeddingData();
    seeded.budget = [];
    seeded.honeymoon.regions = [];
    await seedBrowserStorage(page, seeded);

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-ai-starter").click();
    await expect(page.getByRole("button", { name: "초안 만들기 →" })).toBeVisible();

    await page.getByPlaceholder("챗봇이 준 답변을 그대로 복사해서 붙여넣기…").fill(JSON.stringify({
      summary: "예산과 여행 후보를 먼저 잡으면 다음 결정이 쉬워집니다.",
      today: [
        { title: "반지 예산 상한 정하기", reason: "브랜드 비교 전에 기준이 필요합니다.", targetPath: "/rings" },
      ],
      checklistItems: [
        { text: "반지 후보 3개를 같은 기준으로 비교하기", ddayOffset: -180, priority: "yellow" },
        { text: "신혼여행 지역 후보를 3곳으로 좁히기", ddayOffset: -170, priority: "green" },
      ],
      budgetItems: [
        { category: "반지", planned: 3000000, notes: "브랜드·소재·착용감 기준으로 확인" },
        { category: "신혼여행", planned: 7000000, notes: "항공·숙소·현지 이동 포함" },
      ],
      honeymoonRegions: [
        { name: "발리", durationDays: 6, notes: "휴양과 리조트 중심으로 시작하기 좋음" },
      ],
      invitationGreeting: "서로의 계절을 함께 건너온 두 사람이\n소중한 분들을 모시고 결혼식을 올립니다.",
    }));
    await page.getByRole("button", { name: "검토하기 →" }).click();
    await expect(page.getByText("적용 전 확인")).toBeVisible();
    await page.getByRole("button", { name: "이대로 반영 →" }).click();

    await expect.poll(() => readStoredData(page).then((stored) => {
      const aiSection = stored.checklist.find((section) => section.id === "ai-starter");
      return {
        checklist: aiSection?.items.length ?? 0,
        budget: stored.budget?.length ?? 0,
        regions: stored.honeymoon.regions.length,
        greeting: stored.invitation.greeting,
        summary: stored.ai?.starterSummary,
        today: stored.ai?.today?.[0]?.title,
      };
    })).toEqual({
      checklist: 2,
      budget: 2,
      regions: 1,
      greeting: "서로의 계절을 함께 건너온 두 사람이\n소중한 분들을 모시고 결혼식을 올립니다.",
      summary: "예산과 여행 후보를 먼저 잡으면 다음 결정이 쉬워집니다.",
      today: "반지 예산 상한 정하기",
    });

    await expect(page.getByText("예산과 여행 후보를 먼저 잡으면 다음 결정이 쉬워집니다.")).toBeVisible();
    await expect(page.getByText("반지 예산 상한 정하기")).toBeVisible();
  });

  test("lets the invitation editor apply an AI-refined greeting", async ({ page }) => {
    const seeded = seededWeddingData();
    seeded.invitation.greeting = "저희 결혼합니다.";
    await seedBrowserStorage(page, seeded);

    await page.goto("/invitation");
    await page.getByRole("button", { name: "편집" }).click();
    await page.getByRole("button", { name: "담백하게" }).click();
    await expect(page.getByRole("button", { name: "문안 다듬기 →" })).toBeVisible();

    const greeting = "오랜 시간 서로의 일상을 아껴온 두 사람이\n소중한 분들을 모시고 결혼식을 올립니다.\n따뜻한 마음으로 함께 축복해주시면 감사하겠습니다.";
    await page.getByPlaceholder("챗봇이 준 답변을 그대로 복사해서 붙여넣기…").fill(greeting);
    await page.getByRole("button", { name: "검토하기 →" }).click();
    await expect(page.getByText("적용 전 확인")).toBeVisible();
    await page.getByRole("button", { name: "이대로 반영 →" }).click();

    await expect.poll(() => readStoredData(page).then((stored) => stored.invitation.greeting)).toBe(greeting);
  });

  test("renders recovered local ring catalog images", async ({ page }) => {
    await resetBrowserStorage(page);

    await page.goto("/rings");
    await expect(page.getByText(/반지 카탈로그/)).toBeVisible();
    await page.getByRole("button", { name: /반지 카탈로그/ }).click();
    await scrollPageToLoadImages(page);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[src^="/rings/"]'));
            return images.length > 0 && images.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    const imageStats = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('img[src^="/rings/"]'));
      return {
        total: images.length,
        unique: new Set(images.map((img) => img.getAttribute("src"))).size,
        loaded: images.filter((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0).length,
        productFit: images.filter((img) => img.className.includes("scale-[1.55]")).length,
      };
    });

    expect(imageStats.total).toBeGreaterThan(40);
    expect(imageStats.unique).toBeGreaterThan(40);
    expect(imageStats.loaded).toBe(imageStats.total);
    expect(imageStats.productFit).toBeGreaterThan(30);
  });

  test("publishing builds only the invitation payload, not planning data", async () => {
    const data = seededWeddingData();
    data.guests = [
      {
        id: "guest-secret",
        name: "비공개 하객",
        relation: "회사",
        side: "shared",
        status: "참석",
      },
    ];
    data.budget = [{ id: "budget-secret", category: "비공개 예산", planned: 99_000_000 }];
    data.checklist = [
      {
        id: "private",
        icon: "!",
        title: "비공개 할 일",
        items: [{ id: "private-task", text: "가족 회의 메모", done: false }],
      },
    ];

    const { invitation } = await buildPublishInvitation(data);
    const payload = JSON.stringify(invitation);

    expect(payload).toContain(data.invitation.groomName);
    expect(payload).toContain(data.invitation.brideName);
    expect(payload).not.toContain("비공개 하객");
    expect(payload).not.toContain("비공개 예산");
    expect(payload).not.toContain("가족 회의 메모");
  });

  test("keeps the Supabase setup SQL in sync with the in-app copy", async () => {
    const sql = fs.readFileSync("supabase/schema.sql", "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trimEnd();
    const source = fs.readFileSync("src/supabase-schema-text.ts", "utf8").replace(/^\uFEFF/, "");
    const embedded = source.match(/const SchemaText = `([\s\S]*)`;\s*export default SchemaText;/)?.[1];

    expect(embedded?.replace(/\r\n/g, "\n").trimEnd()).toBe(sql);
  });
});

function seededWeddingData(): WeddingData {
  const data = defaultData();
  data.preferences = { ...data.preferences, mode: "local", isDemo: false };
  data.invitation = {
    ...data.invitation,
    groomName: "민준",
    brideName: "서연",
    date: "2026-11-07",
    time: "오후 1시",
    venue: "그랜드하우스 웨딩홀",
  };
  data.checklist = defaultChecklist(data.invitation.date);
  data.budget = [{ id: "budget-1", category: "예식장 식대", planned: 24_000_000 }];
  data.guests = [
    {
      id: "guest-1",
      name: "김지현",
      relation: "친구",
      side: "bride",
      status: "초대 예정",
    },
  ];
  data.rings = [{ id: "ring-1", brand: "Sample", model: "Classic Band" }];
  data.honeymoon = {
    ...data.honeymoon,
    regions: [{ id: "trip-1", name: "발리", durationDays: 6 }],
  };
  return data;
}

async function resetBrowserStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function seedBrowserStorage(page: Page, data: WeddingData, extra: Record<string, string> = {}) {
  await page.addInitScript(
    ({ data: value, extra: extraValues }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("wedding-os/v1", JSON.stringify(value));
      for (const [key, item] of Object.entries(extraValues)) {
        localStorage.setItem(key, item);
      }
    },
    { data, extra },
  );
}

async function readStoredData(page: Page): Promise<WeddingData> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error(`Missing ${key}`);
    return JSON.parse(raw);
  }, DATA_KEY);
}

async function scrollPageToLoadImages(page: Page) {
  await page.evaluate(async () => {
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const step = Math.max(360, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await wait(80);
    }
    window.scrollTo(0, 0);
  });
}
