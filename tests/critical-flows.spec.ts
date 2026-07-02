import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import { defaultChecklist } from "../src/data/checklistTemplate";
import { buildPublishInvitation } from "../src/lib/invitePublish";
import { wrapBundle, unwrapBundle } from "../src/lib/account";
import {
  buildProtectedRecoveryLink,
  buildRecoveryLink,
  parseProtectedRecoveryFragment,
  parseRecoveryFragment,
  suggestSharePassword,
  unwrapProtectedRecoveryBundle,
  validateSharePassword,
} from "../src/lib/recovery";
import { decryptJSON, encryptJSON, generateInviteKey } from "../src/lib/inviteCrypto";
import { applyAgentAnswer, nextAgentQuestion } from "../src/lib/agentLoop";
import { defaultData, type WeddingData } from "../src/lib/schema";
import aiApi from "../api/ai";
import publishApi from "../api/invite-publish";

const DATA_KEY = "wedding-os/v1";
const DRAFT_KEY = "wedding-os/setup-draft/v1";
const OWNER_KEY = "wedding-os/owner/v1";

test.describe("critical product flows", () => {
  test("builds a personalized local workspace through the Dearie Agent", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();

    await page.getByRole("button", { name: "질문 5개 시작하기 →" }).click();
    await page.getByPlaceholder("예: 김민준").fill("김민준");
    await page.getByPlaceholder("예: 이서연").fill("이서연");
    await page.getByRole("button", { name: "계속 →" }).click();
    await page.getByRole("button", { name: "아직 미정이에요 →" }).click();
    await page.getByRole("button", { name: "기타 (직접 입력)" }).click();
    await page.getByPlaceholder("예: 서울 강남구").fill("서울 강남구");
    await page.getByRole("button", { name: "이 지역으로 보기 →" }).click();
    await page.getByRole("button", { name: "예식장을 찾고 싶어요" }).click();
    await page.getByRole("button", { name: "우선 이 기기에서 시작" }).click();
    await page.getByRole("button", { name: "준비 화면 열기 →" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("오늘 할 일").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "서울 강남구 예식장 후보 추리기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "예상 하객은 어느 정도로 잡을까요?" })).toBeVisible();
    await page.getByRole("button", { name: /200명 안팎/ }).click();
    await expect(page.getByText("예상 하객 200명과 식대 기준을 준비판에 반영했어요.")).toBeVisible();

    const stored = await readStoredData(page);
    expect(stored.preferences.mode).toBe("local");
    expect(stored.preferences.isDemo).toBe(false);
    expect(stored.invitation.groomName).toBe("김민준");
    expect(stored.invitation.brideName).toBe("이서연");
    expect(stored.checklist.length).toBeGreaterThan(0);
    expect(stored.checklist.some((section) => section.title === "Dearie의 첫 정리")).toBe(true);
    expect(stored.venues?.length).toBeGreaterThan(0);
    expect(stored.venues?.[0]?.notes).toContain("보증인원");
    expect(stored.budget?.length).toBeGreaterThan(0);
    expect(stored.budget?.some((item) => item.category === "예식장 식대")).toBe(true);
    expect(stored.headcount?.estimates?.reduce((sum, item) => sum + item.expected, 0)).toBeGreaterThan(0);
    expect(stored.ai?.dialogue?.some((item) => item.id === "headcount-scale" && item.answer === "200명 안팎")).toBe(true);
    expect(stored.ai?.profile?.priority).toBe("venue");
    expect(stored.ai?.profile?.region).toBe("서울 강남구");
    expect(stored.ai?.profile?.onboardedAt).toBeTruthy();
    expect(await page.evaluate((key) => localStorage.getItem(key), OWNER_KEY)).toBe("1");
    await page.reload();
    await expect(page.getByRole("heading", { name: "예상 하객 200명 기준으로 예식장 다시 보기" })).toBeVisible();
    expect((await readStoredData(page)).ai?.profile?.priority).toBe("venue");
  });

  test("keeps existing local data when moving from local mode into setup", async ({ page }) => {
    const seeded = seededWeddingData();
    await seedBrowserStorage(page, seeded);

    await page.goto("/settings");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "저장 방식 다시 선택 →" }).click();

    await page.getByRole("button", { name: "고급 저장 설정" }).click();
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

    await expect(page.getByText(/저장소에 저장하지 못했어요/)).toBeVisible({ timeout: 15_000 });

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
    await expect(page.getByText("질문 6개만 고르세요")).toBeVisible();
    await page.getByRole("button", { name: /이 후보 \d+개를 표시하기 →/ }).click();
    await expect.poll(() => readStoredData(page).then((stored) =>
      stored.rings.some((ring) => ring.likedBy?.includes("bride"))
    )).toBe(true);

    await page.goto("/trip?starter=1");
    await expect(page.getByText("여행 기준 잡기")).toBeVisible();
    await page.getByRole("button", { name: "후보 3곳 담기 →" }).click();
    await expect.poll(() => readStoredData(page).then((stored) => stored.honeymoon.regions.length)).toBeGreaterThan(
      seeded.honeymoon.regions.length,
    );
    await expect.poll(() => readStoredData(page).then((stored) => ({
      pace: stored.ai?.dialogue?.some((item) => item.id === "trip-pace"),
      budget: stored.ai?.dialogue?.some((item) => item.id === "trip-budget"),
    }))).toEqual({ pace: true, budget: true });

    await page.goto("/venues?starter=1");
    await expect(page.getByText("조건 4개만 고르세요")).toBeVisible();
    await page.getByRole("button", { name: /이 후보 \d+곳을 내 후보에 담기 →/ }).click();
    await expect.poll(() => readStoredData(page).then((stored) => stored.venues?.length ?? 0)).toBeGreaterThan(
      seeded.venues?.length ?? 0,
    );
    await expect.poll(() => readStoredData(page).then((stored) => ({
      region: stored.ai?.dialogue?.some((item) => item.id === "venues-region"),
      scale: stored.ai?.dialogue?.some((item) => item.id === "venues-scale"),
      priority: stored.ai?.dialogue?.some((item) => item.id === "venues-priority"),
    }))).toEqual({ region: true, scale: true, priority: true });
  });

  test("keeps Dearie consultation answers across direct route reloads", async ({ page }) => {
    const seeded = defaultData();
    seeded.preferences.mode = "local";
    seeded.invitation.groomName = "김민준";
    seeded.invitation.brideName = "이서연";
    seeded.invitation.date = "2026-11-14";

    await page.goto("/");
    await page.evaluate((data) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("wedding-os/v1", JSON.stringify(data));
    }, seeded);

    await page.goto("/snap");
    await expect(page.getByRole("heading", { name: "본식 스냅은 어떤 느낌이면 좋겠어요?" })).toBeVisible();
    await page.getByRole("button", { name: /자연스러운 기록/ }).click();
    await expect(page.getByRole("heading", { name: "어디부터 찍히면 좋을까요?" })).toBeVisible();

    await page.goto("/rings?starter=1");
    await expect(page.getByRole("heading", { name: "질문 6개만 고르세요" })).toBeVisible();
    await page.getByRole("button", { name: /매일 편하게/ }).click();
    await expect(page.getByRole("heading", { name: "두 분 한 쌍 예산 상한은 어디에 가까워요?" })).toBeVisible();

    const stored = await readStoredData(page);
    expect(stored.ai?.dialogue?.some((item) => item.id === "snap-style" && item.answer === "자연스러운 기록")).toBe(true);
    expect(stored.ai?.dialogue?.some((item) => item.id === "rings-wear" && item.answer === "매일 편하게")).toBe(true);

    await page.goto("/dashboard");
    await page.getByText(/전체 영역 \d+개/).click();
    await expect(page.getByText("스냅 기준 답하기").first()).toBeVisible();
    await expect(page.getByText("반지 취향 이어 고르기").first()).toBeVisible();
  });

  test("keeps section consultation answers when the dashboard agent asks follow-up questions", () => {
    const seeded = defaultData();
    seeded.preferences.mode = "local";
    seeded.venues = [{
      id: "venue-1",
      name: "테스트 예식장",
      region: "서울",
      status: "관심",
    }];
    seeded.ai = {
      dialogue: [
        ...Array.from({ length: 18 }, (_, index) => ({
          id: `legacy-${index}`,
          question: `이전 질문 ${index}`,
          answer: "답변",
          answeredAt: "2026-01-01T00:00:00.000Z",
        })),
        {
          id: "snap-style",
          question: "본식 스냅은 어떤 느낌이면 좋겠어요?",
          answer: "자연스러운 기록",
          answeredAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "rings-wear",
          question: "반지는 얼마나 자주 낄 예정인가요?",
          answer: "매일 편하게",
          answeredAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const question = nextAgentQuestion(seeded);
    expect(question?.id).toBe("headcount-scale");

    const { next } = applyAgentAnswer(seeded, question!, "200");
    expect(next.ai?.dialogue?.some((item) => item.id === "snap-style")).toBe(true);
    expect(next.ai?.dialogue?.some((item) => item.id === "rings-wear")).toBe(true);
    expect(next.ai?.dialogue?.some((item) => item.id === "headcount-scale")).toBe(true);
    expect(next.ai?.dialogue?.length).toBeGreaterThan(12);
  });

  test("lets AI starter output create a useful first board without calling an API", async ({ page }) => {
    const seeded = seededWeddingData();
    seeded.budget = [];
    seeded.honeymoon.regions = [];
    await seedBrowserStorage(page, seeded);

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-ai-starter").click();
    await expect(page.getByPlaceholder("챗봇이 준 답변을 그대로 복사해서 붙여넣기…")).toBeVisible();

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
    await page.getByRole("button", { name: "초안 확인하기 →" }).click();
    await expect(page.getByText("적용 전 확인", { exact: true })).toBeVisible();
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
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await expect(page.getByPlaceholder("챗봇이 준 답변을 그대로 복사해서 붙여넣기…")).toBeVisible();

    const greeting = "오랜 시간 서로의 일상을 아껴온 두 사람이\n소중한 분들을 모시고 결혼식을 올립니다.\n따뜻한 마음으로 함께 축복해주시면 감사하겠습니다.";
    await page.getByPlaceholder("챗봇이 준 답변을 그대로 복사해서 붙여넣기…").fill(greeting);
    await page.getByRole("button", { name: "초안 확인하기 →" }).click();
    await expect(page.getByText("적용 전 확인", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "이대로 반영 →" }).click();

    await expect.poll(() => readStoredData(page).then((stored) => stored.invitation.greeting)).toBe(greeting);
  });

  test("lets the owner use the representative photo as the link preview thumbnail", async ({ page }) => {
    const seeded = seededWeddingData();
    seeded.invitation.heroImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    await seedBrowserStorage(page, seeded);

    await page.goto("/invitation");
    await page.getByRole("button", { name: "편집" }).click();

    const previewSwitch = page.getByRole("switch", { name: "링크 미리보기 대표사진 사용" });
    await expect(previewSwitch).toBeVisible();
    await expect(previewSwitch).toHaveAttribute("aria-checked", "false");

    await previewSwitch.click();
    await expect(previewSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("대표사진 축소본이 카톡·문자 공유 카드에 공개 표시됩니다.")).toBeVisible();
    await expect.poll(() => readStoredData(page).then((stored) => stored.invitation.previewImageEnabled)).toBe(true);
  });

  test("keeps the invitation quick start singular and restores a deleted checklist item", async ({ page }) => {
    const seeded = defaultData();
    seeded.preferences = { ...seeded.preferences, mode: "local", isDemo: false };
    seeded.checklist = [{
      id: "essentials",
      title: "필수 준비",
      icon: "check",
      items: [{ id: "venue-call", text: "예식장에 전화하기", done: false }],
    }];
    await seedBrowserStorage(page, seeded);

    await page.goto("/invitation");
    await page.getByRole("button", { name: "편집" }).click();
    await expect(page.getByLabel("신랑 이름")).toHaveCount(1);
    await page.getByLabel("신랑 이름").fill("민준");
    await page.getByLabel("신부 이름").fill("서연");
    await page.getByLabel("예식 날짜").fill("2026-11-07");
    await expect(page.getByLabel("신랑 이름")).toHaveCount(1);

    await page.goto("/checklist");
    await expect(page.getByText("예식장에 전화하기")).toBeVisible();
    await page.getByRole("button", { name: "예식장에 전화하기 삭제" }).click();
    await expect(page.getByText("‘예식장에 전화하기’ 삭제됨")).toBeVisible();
    await page.getByRole("button", { name: "실행 취소" }).click();
    await expect(page.getByText("예식장에 전화하기")).toBeVisible();
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
    data.invitation.previewImageEnabled = true;

    const built = await buildPublishInvitation(data);
    const { invitation } = built;
    const payload = JSON.stringify(invitation);

    expect(built.previewImageRequested).toBe(true);
    expect(payload).toContain(data.invitation.groomName);
    expect(payload).toContain(data.invitation.brideName);
    expect(payload).toContain("previewImageEnabled");
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

  test("validates recovery capabilities and rejects oversized remote invitation images", async () => {
    const bundle = {
      weddingId: `w${"a".repeat(24)}`,
      ownerToken: "owner-" + "b".repeat(64),
      weddingKey: "c".repeat(43),
    };
    const link = buildRecoveryLink(bundle, "https://wedding.test");
    expect(parseRecoveryFragment(new URL(link).hash)).toEqual(bundle);
    expect(parseRecoveryFragment(`#w=${bundle.weddingId}&t=short&k=${bundle.weddingKey}`)).toBeNull();
    expect(parseRecoveryFragment(`#w=${bundle.weddingId}&t=${bundle.ownerToken}&k=not-a-key`)).toBeNull();

    const sharePassword = "091391";
    const protectedLink = await buildProtectedRecoveryLink(bundle, sharePassword, "https://wedding.test");
    expect(protectedLink).not.toContain(bundle.ownerToken);
    expect(protectedLink).not.toContain(bundle.weddingKey);
    const protectedPayload = parseProtectedRecoveryFragment(new URL(protectedLink).hash);
    expect(protectedPayload?.weddingId).toBe(bundle.weddingId);
    await expect(unwrapProtectedRecoveryBundle(protectedPayload!, sharePassword)).resolves.toEqual(bundle);
    await expect(unwrapProtectedRecoveryBundle(protectedPayload!, "wrong-pass")).rejects.toThrow();
    const suggestedSharePassword = suggestSharePassword();
    expect(suggestedSharePassword.length).toBeGreaterThanOrEqual(6);
    expect(validateSharePassword(suggestedSharePassword)).toBeNull();
    expect(validateSharePassword("123456")).toContain("흔한");

    const recoveryPassphrase = "Two families meet at 7pm!";
    const wrapped = await wrapBundle(bundle, recoveryPassphrase);
    await expect(unwrapBundle(wrapped.blob, wrapped.salt, recoveryPassphrase)).resolves.toEqual(bundle);
    await expect(unwrapBundle("a".repeat(5000), wrapped.salt, recoveryPassphrase)).rejects.toThrow();

    const seeded = seededWeddingData();
    seeded.invitation.heroImageUrl = "https://legacy.example/huge.jpg";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < 6; i++) controller.enqueue(new Uint8Array(1024 * 1024));
        controller.close();
      },
    }), { headers: { "content-type": "image/jpeg" } });
    try {
      const built = await buildPublishInvitation(seeded);
      expect(built.invitation.heroImageUrl).toBeUndefined();
      expect(built.droppedPhotos).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps ciphertext and shared-device data isolated between users", async ({ page }) => {
    const first = await generateInviteKey();
    const second = await generateInviteKey();
    const ciphertext = await encryptJSON({ owner: "first-user", private: "secret" }, first.key);
    await expect(decryptJSON(ciphertext, second.key)).rejects.toThrow();
    await expect(decryptJSON(ciphertext, first.key)).resolves.toEqual({ owner: "first-user", private: "secret" });

    await page.goto("/");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    const result = await page.evaluate(async () => {
      localStorage.setItem("wedding-os/v1", JSON.stringify({ private: "first-user" }));
      localStorage.setItem("wedding-os/secrets/v1", JSON.stringify({ ownerToken: "sensitive" }));
      localStorage.setItem("unrelated-app/key", "keep-me");
      const securityModulePath = "/src/lib/security.ts";
      const security = await import(securityModulePath);
      const firstUserId = "11111111-1111-4111-8111-111111111111";
      const secondUserId = "22222222-2222-4222-8222-222222222222";
      const accountBound = security.setHostedRecoveryCredentials(
        { weddingId: `w${"a".repeat(24)}`, weddingKey: "a".repeat(43) },
        "a".repeat(64),
        firstUserId,
      );
      const sameAccountAllowed = security.hostedUserMatches(firstUserId);
      const differentAccountBlocked = !security.hostedUserMatches(secondUserId);
      const imageModulePath = "/src/lib/imageStore.ts";
      const images = await import(imageModulePath);
      await images.putBlob(new Blob(["private-photo"], { type: "image/jpeg" }));
      const storageModulePath = "/src/lib/storage.ts";
      const storage = await import(storageModulePath);
      await storage.clearLocalDeviceData();
      const databases = "databases" in indexedDB ? await indexedDB.databases() : [];
      return {
        weddingKeys: Object.keys(localStorage).filter((key) => key.startsWith("wedding-os/")),
        unrelated: localStorage.getItem("unrelated-app/key"),
        imageDatabaseExists: databases.some((database) => database.name === "wedding-os-images"),
        accountBound,
        sameAccountAllowed,
        differentAccountBlocked,
      };
    });
    expect(result).toEqual({
      weddingKeys: [],
      unrelated: "keep-me",
      imageDatabaseExists: false,
      accountBound: true,
      sameAccountAllowed: true,
      differentAccountBlocked: true,
    });

    const seeded = seededWeddingData();
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: DATA_KEY, value: seeded });
    await page.goto("/dashboard");
    const secondTab = await page.context().newPage();
    await secondTab.goto("/dashboard");
    await expect(secondTab.getByText(
      `${seeded.invitation.groomName} · ${seeded.invitation.brideName}`,
      { exact: true },
    )).toBeVisible();

    await page.evaluate(async () => {
      const storageModulePath = "/src/lib/storage.ts";
      const storage = await import(storageModulePath);
      await storage.clearLocalDeviceData();
    });
    await expect(secondTab).toHaveURL(/\/$/);
    await expect(secondTab.getByRole("button", { name: "질문 5개 시작하기 →" })).toBeVisible();
    expect(await secondTab.evaluate(() => localStorage.getItem("wedding-os/v1"))).toBeNull();
    await secondTab.close();
  });

  test("preserves current local data when a recovery link cannot be verified", async ({ page }) => {
    const seeded = seededWeddingData();
    await seedBrowserStorage(page, seeded);
    const weddingId = `w${"a".repeat(24)}`;
    const ownerToken = "t".repeat(64);
    const weddingKey = "a".repeat(43);

    await page.goto(`/recover#w=${weddingId}&t=${ownerToken}&k=${weddingKey}`);
    await expect(page.getByText("복구 실패")).toBeVisible();
    await expect(page.getByRole("heading", { name: "기존 데이터는 그대로 두었어요" })).toBeVisible();
    await expect(page.getByRole("button", { name: "복구 링크 다시 확인" })).toBeVisible();
    await expect(page.getByRole("link", { name: "로그인으로 복구하기" })).toBeVisible();

    const protectedLink = await buildProtectedRecoveryLink(
      { weddingId, ownerToken, weddingKey },
      "091391",
      "http://127.0.0.1:5173",
    );
    await page.goto("/dashboard");
    await page.goto(`${new URL(protectedLink).pathname}${new URL(protectedLink).hash}`);
    await expect(page.getByRole("heading", { name: "이 링크는 비밀번호로 잠겨 있어요" })).toBeVisible();
    await page.getByLabel("공유 비밀번호").fill("wrong-pass");
    await page.getByRole("button", { name: "비밀번호 확인하고 이어가기 →" }).click();
    await expect(page.getByText("공유 비밀번호가 맞지 않아요")).toBeVisible();
    expect((await readStoredData(page)).invitation.groomName).toBe(seeded.invitation.groomName);

    const stored = await readStoredData(page);
    expect(stored.invitation.groomName).toBe(seeded.invitation.groomName);
    expect(stored.guests?.[0]?.name).toBe(seeded.guests?.[0]?.name);
  });

  test("allows limited managed AI trial but keeps deep AI and publishing protected", async () => {
    const previousKey = process.env.ANTHROPIC_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.ANTHROPIC_API_KEY = "test-key";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.anthropic.com")) {
        return new Response(JSON.stringify({ content: [{ type: "text", text: "trial-ok" }] }), { status: 200 });
      }
      return originalFetch(input);
    };
    try {
      const aiResponse = await aiApi.fetch(new Request("https://wedding.test/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "test" }),
      }));
      expect(aiResponse.status).toBe(200);
      expect(aiResponse.headers.get("set-cookie")).toContain("wos_ai_trial=");
      expect(await aiResponse.json()).toEqual({ text: "trial-ok" });

      const deepResponse = await aiApi.fetch(new Request("https://wedding.test/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "test", tier: "deep" }),
      }));
      expect(deepResponse.status).toBe(401);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousKey;
    }

    const publishResponse = await publishApi.fetch(new Request("https://wedding.test/api/invite-publish", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([1, 2, 3]),
    }));
    expect(publishResponse.status).toBe(401);
    const publishClient = fs.readFileSync("src/lib/inviteHosting.ts", "utf8");
    expect(publishClient).not.toContain("?meta=");
    expect(publishClient).toContain('"x-owner-token"');
    expect(publishClient).toContain('"x-publish-meta"');
    expect(publishClient).toContain("FormData");
    const publishApiSource = fs.readFileSync("api/invite-publish.ts", "utf8");
    expect(publishApiSource).toContain("metaRaw.length > 16_384");
    expect(publishApiSource).toContain("ownerToken.length > 256");
    expect(publishApiSource).toContain("meta.rsvpToken.length > 256");
    expect(publishApiSource).toContain("multipart/form-data");
    expect(publishApiSource).toContain('access: "public"');
    const securitySource = fs.readFileSync("api/_security.ts", "utf8");
    expect(securitySource).toContain("isSupabaseHost(url)");
    expect(securitySource).toContain("jsonWithHeaders");
    expect(securitySource).toContain("로그인 서버 설정이 올바르지 않습니다.");
    const aiSource = fs.readFileSync("api/ai.ts", "utf8");
    expect(aiSource).toContain("ai-trial-cookie-day");
    expect(aiSource).toContain("ai-trial-local-day");
    expect(aiSource).toContain("ai-trial-subnet-hour");
    expect(aiSource).toContain("signedTrialCookie");
    const authSource = fs.readFileSync("src/lib/auth.ts", "utf8");
    expect(authSource).toContain("replaceExisting?: boolean");
    expect(authSource).toContain("이미 연결된 청첩장이 있어요");
    for (const dynamicInvitePath of ["api/invite-payload.ts", "api/serve-invite.ts", "api/og.js"]) {
      const dynamicInviteSource = fs.readFileSync(dynamicInvitePath, "utf8");
      expect(dynamicInviteSource.includes("no-store") || dynamicInviteSource.includes("privateNoStoreHeaders")).toBe(true);
    }
    const ogSource = fs.readFileSync("api/og.js", "utf8");
    const payloadSource = fs.readFileSync("api/invite-payload.ts", "utf8");
    const rsvpSource = fs.readFileSync("api/invite-rsvp.ts", "utf8");
    const publishSource = fs.readFileSync("api/invite-publish.ts", "utf8");
    expect(ogSource).toContain("heroImageUrl: og.heroImageUrl");
    expect(ogSource).not.toContain("get_public_invitation");
    expect(ogSource).not.toContain("text=${encodeURIComponent");
    expect(ogSource).not.toContain("/rest/v1/wedding_data");
    expect(payloadSource).toContain("useCache: false");
    expect(rsvpSource).toContain("MAX_RSVP_BYTES = 8 * 1024");
    expect(rsvpSource).toContain("MAX_RSVP_ITEMS = 500");
    expect(publishSource).toContain("cacheControlMaxAge: 60");
    expect(fs.readFileSync("api/serve-invite.ts", "utf8")).toContain("new URL(`/api/og?code=");
  });

  test("does not load private wedding data on public or auth-only routes", async () => {
    const appSource = fs.readFileSync("src/App.tsx", "utf8");
    const hookIndex = appSource.indexOf("useWeddingData()");
    expect(hookIndex).toBeGreaterThan(0);
    for (const routeGuard of [
      'location.pathname === "/i"',
      'location.pathname.startsWith("/i/")',
      'location.pathname === "/recover"',
      'location.pathname === "/login"',
    ]) {
      const guardIndex = appSource.indexOf(routeGuard);
      expect(guardIndex).toBeGreaterThan(0);
      expect(guardIndex).toBeLessThan(hookIndex);
    }

    const storageSource = fs.readFileSync("src/lib/storage.ts", "utf8");
    expect(storageSource).toContain("if (!userId || !hostedUserMatches(userId))");
    expect(storageSource).toContain("getHostedConfig() && getHostedUserId() && (!userId || !hostedUserMatches(userId))");

    const supabaseStorageSource = fs.readFileSync("src/lib/storage.supabase.ts", "utf8");
    expect(supabaseStorageSource).toContain("if (!isSupabaseHost(url)) return");

    const menuSheetSource = fs.readFileSync("src/components/MenuSheet.tsx", "utf8");
    expect(menuSheetSource).toContain("previousFocus.current?.focus()");
    expect(menuSheetSource).toContain('e.key !== "Tab"');
    expect(menuSheetSource).toContain("panelRef.current?.focus()");
  });

  test("keeps legal and security notice surfaces reachable before setup", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Dearie 이용 안내" })).toBeVisible();
    await expect(page.getByText("업체·브랜드명은 비교와 개인 메모를 위한 식별 목적으로만 표시합니다.")).toBeVisible();
    await expect(page.getByText("보안 취약점을 발견하면 공개 글이나 이슈 대신")).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "개인정보 · 보안 안내" })).toBeVisible();
    await expect(page.getByText("권리 행사 · 침해 대응")).toBeVisible();
  });

  test("uses current AI provider contracts and parses their responses", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const requests: Array<{ url: string; body: any }> = [];
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ url, body });
        if (url.includes("generativelanguage.googleapis.com")) {
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "gemini-ok" }] } }] }), { status: 200 });
        }
        if (url.includes("api.openai.com")) {
          return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "openai-ok" }] }] }), { status: 200 });
        }
        if (url.includes("api.anthropic.com")) {
          return new Response(JSON.stringify({ content: [{ type: "text", text: "anthropic-ok" }] }), { status: 200 });
        }
        throw new Error(`Unexpected URL: ${url}`);
      };
      try {
        const modulePath = "/src/lib/aiClient.ts";
        const ai = await import(modulePath);
        const prompt = { title: "contract", expectedShape: "text" as const, prompt: "hello" };
        const gemini = await ai.runAiPrompt(prompt, { provider: "gemini", apiKey: "test", model: ai.defaultModel("gemini") });
        const openai = await ai.runAiPrompt(prompt, { provider: "openai", apiKey: "test", model: ai.defaultModel("openai") });
        const anthropic = await ai.runAiPrompt(prompt, { provider: "anthropic", apiKey: "test", model: ai.defaultModel("anthropic") });
        return {
          texts: [gemini.text, openai.text, anthropic.text],
          models: requests.map((request) => request.body?.model),
          openAiHasTemperature: "temperature" in requests[1].body,
          geminiMaxOutputTokens: requests[0].body?.generationConfig?.maxOutputTokens,
          remoteOllamaAllowed: ai.hasDirectAi({ provider: "ollama", model: "llama3.1", baseUrl: "http://192.168.0.1:11434" }),
        };
      } finally {
        window.fetch = originalFetch;
      }
    });
    expect(result).toEqual({
      texts: ["gemini-ok", "openai-ok", "anthropic-ok"],
      models: [undefined, "gpt-5.4-mini", "claude-haiku-4-5-20251001"],
      openAiHasTemperature: false,
      geminiMaxOutputTokens: 4096,
      remoteOllamaAllowed: false,
    });
    const managedAiSource = fs.readFileSync("api/ai.ts", "utf8");
    expect(managedAiSource).toContain('DEFAULT_MODEL = "claude-haiku-4-5-20251001"');
    expect(managedAiSource).toContain('DEFAULT_DEEP_MODEL = "claude-sonnet-4-6"');
    expect(managedAiSource).toContain('"ai-deep-user-hour"');
    expect(managedAiSource).toContain('"ai-user-hour"');
    expect(managedAiSource).toContain("AbortSignal.timeout(55_000)");
    const promptsSource = fs.readFileSync("src/lib/chatbotBridge.ts", "utf8");
    expect(promptsSource).toContain('tier: "deep"');
  });

  test("provisions direct Supabase ownership explicitly and ships hosted migrations", async () => {
    const directSql = fs.readFileSync("supabase/schema.sql", "utf8");
    const hostedSql = fs.readFileSync("supabase/hosted-schema.sql", "utf8");
    const vercelConfig = fs.readFileSync("vercel.json", "utf8");
    const setupSource = fs.readFileSync("src/routes/Setup.tsx", "utf8");
    const termsSource = fs.readFileSync("src/routes/Terms.tsx", "utf8");
    const menuSource = fs.readFileSync("src/lib/menu.ts", "utf8");
    const robots = fs.readFileSync("public/robots.txt", "utf8");
    const securityTxt = fs.readFileSync("public/.well-known/security.txt", "utf8");
    const securityMd = fs.readFileSync("SECURITY.md", "utf8");

    expect(directSql).toContain("__WEDDING_OS_OWNER_TOKEN__");
    expect(directSql).toContain("__WEDDING_OS_RSVP_TOKEN__");
    expect(directSql).toContain("__WEDDING_OS_CONFIG_ID__");
    expect(directSql).not.toContain('create policy "rsvp_insert_only"');
    expect(directSql).toContain("on conflict (id) do nothing");
    expect(directSql).not.toContain("set owner_token_hash = excluded.owner_token_hash");
    expect(directSql).toContain("revoke create on schema public from public");
    expect(directSql).toContain("revoke all on public.wedding_data, public.rsvp, public.collab_comments from anon, authenticated");
    expect(directSql).toContain("alter table public.wedding_data add column if not exists data jsonb not null default '{}'::jsonb");
    expect(directSql).toContain("drop function if exists public.save_wedding_data(text, text, jsonb, int)");
    expect(directSql.indexOf("drop function if exists public.save_wedding_data(text, text, jsonb, int)"))
      .toBeLessThan(directSql.indexOf("create or replace function public.save_wedding_data"));
    expect(directSql).toContain("missing expected version");
    expect(directSql).toContain("rsvp quota exceeded");
    expect(setupSource).toContain("const saved = await driver.save(nextData, remoteVersion)");
    expect(hostedSql).toContain("create or replace function public.wos_save");
    expect(hostedSql).toContain("alter table weddingos.weddings add column if not exists created_by uuid");
    expect(hostedSql.indexOf("alter table weddingos.weddings add column if not exists created_by uuid"))
      .toBeLessThan(hostedSql.indexOf("create index if not exists wos_weddings_created_by_idx"));
    expect(hostedSql).toContain("drop function if exists public.wos_delete(text, text)");
    expect(hostedSql.indexOf("drop function if exists public.wos_delete(text, text)"))
      .toBeLessThan(hostedSql.indexOf("create or replace function public.wos_delete"));
    expect(hostedSql).toContain("authentication required to provision wedding");
    expect(hostedSql).toContain("wedding quota exceeded");
    expect(hostedSql).toContain("pg_advisory_xact_lock");
    expect(hostedSql).toContain("invalid encrypted envelope");
    expect(hostedSql).toContain("jsonb_typeof(p_data->'ct') <> 'string'");
    expect(hostedSql).toContain("if p_expected_version is null then");
    expect(hostedSql).toContain("create or replace function public.wos_rotate_owner_token");
    expect(hostedSql).toContain("owner_token_hash = crypt(p_new_token, gen_salt('bf'))");
    expect(hostedSql).toContain("revoke all on schema weddingos from public, anon, authenticated");
    expect(hostedSql).toContain('create policy "wos_accounts_own"');
    expect(vercelConfig).toContain("img-src 'self' https://images.unsplash.com data: blob:");
    expect(vercelConfig).toContain("media-src 'self' data: blob:");
    expect(vercelConfig).not.toContain("img-src 'self' https: data:");
    expect(menuSource).toContain('to: "/terms"');
    expect(termsSource).toContain("후기 원문, 유료 DB, 회원 전용 게시물");
    expect(termsSource).toContain("서비스 거부 공격");
    expect(robots).toContain("Disallow: /i/");
    expect(robots).toContain("Disallow: /recover");
    expect(securityTxt).toContain("Contact: mailto:yclee913@gmail.com");
    expect(securityMd).toContain("Do not open a public GitHub issue for vulnerabilities");

    const viteConfig = fs.readFileSync("vite.config.ts", "utf8");
    expect(viteConfig).toContain("navigateFallbackDenylist: [/^\\/api\\//, /^\\/i\\//]");

    const storageSource = fs.readFileSync("src/lib/storage.ts", "utf8");
    const directStorageSource = fs.readFileSync("src/lib/storage.supabase.ts", "utf8");
    const hostedStorageSource = fs.readFileSync("src/lib/storage.hosted.ts", "utf8");
    const shellSource = fs.readFileSync("src/components/AppShell.tsx", "utf8");
    const ogSource = fs.readFileSync("api/og.js", "utf8");
    expect(storageSource).toContain("REMOTE_REFRESH_INTERVAL_MS = 90_000");
    expect(storageSource).toContain("isBootstrapRemoteData");
    expect(storageSource).toContain('REMOTE_SIGNAL_EVENT = "wedding-updated"');
    expect(storageSource).toContain('type: "broadcast"');
    expect(storageSource).toContain('refreshRemote("signal")');
    expect(storageSource).toContain("publishRemoteInvalidation(remoteSignal.scope, remoteSignal.version)");
    expect(storageSource).toContain('window.addEventListener("focus", onFocus)');
    expect(storageSource).toContain('document.addEventListener("visibilitychange", onVisibility)');
    expect(directStorageSource).not.toContain("postgres_changes");
    expect(hostedStorageSource).toContain("wos_rotate_owner_token");
    expect(shellSource).not.toContain("useRealtimeStatus");
    expect(ogSource).not.toContain("get_public_invitation");
    expect(ogSource).not.toContain("text=${encodeURIComponent");
    expect(ogSource).toContain("X-Robots-Tag");

    const exporterSource = fs.readFileSync("src/lib/exporters.ts", "utf8");
    const securitySource = fs.readFileSync("src/lib/security.ts", "utf8");
    expect(exporterSource).toContain("spreadsheetSafeCell");
    expect(exporterSource).toContain("/^[=+\\-@\\t\\r]/");
    expect(securitySource).toContain('throw new Error("Secure random generator unavailable")');
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
