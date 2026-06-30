import { recalcDueDates } from "../data/checklistTemplate";
import { defaultData, type WeddingData } from "./schema";

export type StarterResult = {
  tasks: number;
  budget: number;
  regions: number;
  today: number;
  greeting: boolean;
};

export type StarterApplyResult = {
  next: WeddingData;
  result: StarterResult;
  appliedCount: number;
  hasSummary: boolean;
};

const SAFE_TARGET_PATHS = new Set([
  "/dashboard",
  "/checklist",
  "/budget",
  "/guests",
  "/invitation",
  "/rings",
  "/trip",
  "/venues",
  "/sdm",
  "/snap",
  "/ceremony",
  "/video",
  "/start-hosted",
  "/ai",
  "/share",
  "/setup",
  "/settings",
]);

export function normalizeTargetPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.trim();
  return SAFE_TARGET_PATHS.has(path) ? path : undefined;
}

export function applyStarterPlan(prev: WeddingData, parsed: unknown, timestamp = Date.now()): StarterApplyResult {
  const data = (parsed ?? {}) as any;
  const checklistItems = Array.isArray(data?.checklistItems) ? data.checklistItems : [];
  const budgetItems = Array.isArray(data?.budgetItems) ? data.budgetItems : [];
  const honeymoonRegions = Array.isArray(data?.honeymoonRegions) ? data.honeymoonRegions : [];
  const todayItems = Array.isArray(data?.today) ? data.today : [];
  const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
  const greeting = typeof data?.invitationGreeting === "string" ? data.invitationGreeting.trim() : "";
  const defaultGreeting = defaultData().invitation.greeting.trim();
  const result: StarterResult = {
    tasks: 0,
    budget: 0,
    regions: 0,
    today: 0,
    greeting: false,
  };

  let next: WeddingData = { ...prev };

  const newTasks = checklistItems
    .map((item: any, idx: number) => ({
      id: `ai-task-${timestamp}-${idx}`,
      text: typeof item?.text === "string" ? item.text.trim() : "",
      done: false,
      source: "ai" as const,
      ddayOffset: typeof item?.ddayOffset === "number" ? item.ddayOffset : undefined,
      priority: ["red", "yellow", "green"].includes(item?.priority) ? item.priority : "yellow",
    }))
    .filter((item: any) => item.text);
  if (newTasks.length > 0) {
    const sectionId = "ai-starter";
    const existing = next.checklist.find((section) => section.id === sectionId);
    const checklist = existing
      ? next.checklist.map((section) =>
          section.id === sectionId
            ? { ...section, items: [...newTasks, ...section.items].slice(0, 12) }
            : section,
        )
      : [
          {
            id: sectionId,
            icon: "AI",
            title: "Dearie 시작 정리",
            items: newTasks,
          },
          ...next.checklist,
        ];
    next = {
      ...next,
      checklist: recalcDueDates(checklist, next.invitation.date),
    };
    result.tasks = newTasks.length;
  }

  const budgetCategories = new Set((next.budget ?? []).map((item) => item.category.trim()));
  const newBudget = budgetItems
    .map((item: any, idx: number) => ({
      id: `ai-budget-${timestamp}-${idx}`,
      category: typeof item?.category === "string" ? item.category.trim() : "",
      planned: typeof item?.planned === "number" && item.planned > 0 ? Math.round(item.planned) : undefined,
      notes: typeof item?.notes === "string" ? item.notes.trim() : undefined,
    }))
    .filter((item: any) => item.category && !budgetCategories.has(item.category));
  if (newBudget.length > 0) {
    next = { ...next, budget: [...(next.budget ?? []), ...newBudget] };
    result.budget = newBudget.length;
  }

  const regionNames = new Set(next.honeymoon.regions.map((region) => region.name.trim()));
  const newRegions = honeymoonRegions
    .map((item: any, idx: number) => ({
      id: `ai-region-${timestamp}-${idx}`,
      name: typeof item?.name === "string" ? item.name.trim() : "",
      durationDays: typeof item?.durationDays === "number" ? Math.round(item.durationDays) : undefined,
      notes: typeof item?.notes === "string" ? item.notes.trim() : undefined,
    }))
    .filter((item: any) => item.name && !regionNames.has(item.name));
  if (newRegions.length > 0) {
    next = {
      ...next,
      honeymoon: {
        ...next.honeymoon,
        regions: [...next.honeymoon.regions, ...newRegions],
      },
    };
    result.regions = newRegions.length;
  }

  if (greeting && (!next.invitation.greeting.trim() || next.invitation.greeting.trim() === defaultGreeting)) {
    next = { ...next, invitation: { ...next.invitation, greeting } };
    result.greeting = true;
  }

  const normalizedToday = todayItems
    .map((item: any) => ({
      title: typeof item?.title === "string" ? item.title.trim() : "",
      reason: typeof item?.reason === "string" ? item.reason.trim() : undefined,
      targetPath: normalizeTargetPath(item?.targetPath),
    }))
    .filter((item: { title: string }) => item.title)
    .slice(0, 3);
  if (summary || normalizedToday.length > 0) {
    next = {
      ...next,
      ai: {
        ...(next.ai ?? {}),
        starterSummary: summary || next.ai?.starterSummary,
        today: normalizedToday.length > 0 ? normalizedToday : next.ai?.today,
        updatedAt: new Date(timestamp).toISOString(),
      },
    };
    result.today = normalizedToday.length;
  }

  const appliedCount = result.tasks + result.budget + result.regions + result.today + (result.greeting ? 1 : 0);
  return { next, result, appliedCount, hasSummary: !!summary };
}
