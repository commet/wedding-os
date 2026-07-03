import { expect, test } from "@playwright/test";
import { defaultData, type WeddingData } from "../src/lib/schema";
import { budgetSyncSuggestions, planningHeadcount } from "../src/lib/derived";
import { collectLossDeadlines } from "../src/lib/lossDeadlines";
import { consultationHeadcountBand } from "../src/lib/sectionConsultation";

test.describe("decision brain core", () => {
  test("collects structured loss deadlines in D-day order", () => {
    const data = defaultData();
    data.venues = [{
      id: "venue-1",
      name: "테스트홀",
      status: "계약",
      freeCancelUntil: "2026-07-05",
      holdExpiresAt: "2026-07-20",
      guaranteeDueAt: "2026-07-01",
      balanceKRW: 5_000_000,
      balanceDueAt: "2026-07-04",
    }];
    data.budget = [{
      id: "budget-1",
      category: "본식 스냅",
      planned: 1_200_000,
      dueDate: "2026-07-03",
      paid: false,
    }];

    const deadlines = collectLossDeadlines(data, "2026-07-03");

    expect(deadlines.map((item) => item.kind)).toEqual([
      "guarantee-due",
      "budget-due",
      "balance",
      "free-cancel",
      "hold-expiry",
    ]);
    expect(deadlines[0]).toMatchObject({ name: "테스트홀", daysLeft: -2, severity: "high" });
    expect(deadlines[1]).toMatchObject({ name: "본식 스냅", daysLeft: 0 });
  });

  test("keeps budget sync suggestions split by category instead of double-counting", () => {
    const data = defaultData();
    data.venues = [{
      id: "venue-1",
      name: "테스트홀",
      status: "계약",
      mealPriceMax: 100_000,
      depositKRW: 2_000_000,
      balanceKRW: 8_000_000,
    }];
    data.headcount = {
      estimates: [
        { side: "groom", category: "friend", expected: 60 },
        { side: "bride", category: "friend", expected: 40 },
      ],
    };
    data.sdm = [
      { id: "sdm-1", category: "studio", name: "스튜디오A", status: "계약", depositKRW: 500_000, balanceKRW: 1_000_000 },
      { id: "sdm-2", category: "dress", name: "드레스B", status: "계약", depositKRW: 700_000, balanceKRW: 2_000_000 },
    ];
    data.flights = [
      { id: "flight-1", airline: "A", priceKRW: 3_000_000 },
      { id: "flight-2", airline: "B", priceKRW: 2_500_000 },
    ];
    data.hotels = [{
      id: "hotel-1",
      name: "호텔",
      rooms: [{ type: "기본", pricePerNight: 400_000 }],
    }];
    data.honeymoon = { ...data.honeymoon, startDate: "2026-07-10", endDate: "2026-07-15" };
    data.budget = [
      { id: "budget-meal", category: "예식장 식대", planned: 1_000_000 },
      { id: "budget-studio", category: "스튜디오", planned: 100_000 },
      { id: "budget-dress", category: "드레스", planned: 100_000 },
      { id: "budget-flight", category: "항공권", planned: 100_000 },
      { id: "budget-hotel", category: "숙소", planned: 100_000 },
    ];

    const suggestions = budgetSyncSuggestions(data);
    const byKey = new Map(suggestions.map((item) => [item.key, item]));

    expect(planningHeadcount(data)).toBe(100);
    expect(byKey.get("venue-meal")?.suggestedKRW).toBe(10_000_000);
    expect(byKey.get("sdm-studio")?.suggestedKRW).toBe(1_500_000);
    expect(byKey.get("sdm-dress")?.suggestedKRW).toBe(2_700_000);
    expect(byKey.get("trip-flight")?.suggestedKRW).toBe(2_500_000);
    expect(byKey.get("trip-hotel")?.suggestedKRW).toBe(2_000_000);
    expect(suggestions.some((item) => item.key === "sdm-contract")).toBe(false);
  });

  test("falls back from unknown guest scale to venue scale", () => {
    const data: WeddingData = {
      ...defaultData(),
      ai: {
        dialogue: [
          { id: "guests-scale", question: "전체 하객은 어느 정도로 잡을까요?", answer: "아직 몰라요", answeredAt: "2026-07-03T00:00:00.000Z" },
          { id: "venues-scale", question: "예상 하객 규모는 어느 정도인가요?", answer: "200명 안팎", answeredAt: "2026-07-03T00:00:00.000Z" },
        ],
      },
    };

    expect(consultationHeadcountBand(data)).toBe(200);
    expect(planningHeadcount(data)).toBe(200);
  });
});
