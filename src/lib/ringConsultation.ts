import type { WeddingData } from "./schema";

export type RingConsultationQuestionId =
  | "rings-wear"
  | "rings-budget"
  | "rings-tone"
  | "rings-design"
  | "rings-match"
  | "rings-priority";

export type RingConsultationOption = {
  value: string;
  label: string;
  detail: string;
};

export type RingConsultationQuestion = {
  id: RingConsultationQuestionId;
  eyebrow: string;
  title: string;
  body: string;
  multiple?: boolean;
  options: RingConsultationOption[];
};

export const RING_CONSULTATION_QUESTIONS: RingConsultationQuestion[] = [
  {
    id: "rings-wear",
    eyebrow: "01 · 착용",
    title: "반지는 얼마나 자주 낄 예정인가요?",
    body: "매일 끼는 반지는 예쁜 것만큼 낮은 세팅, 튼튼한 소재, 관리 편의가 중요해요.",
    options: [
      { value: "daily", label: "매일 편하게", detail: "출근·손 씻기·일상 착용까지 고려" },
      { value: "balanced", label: "평일도 주말도", detail: "착용감과 디자인 존재감을 균형 있게" },
      { value: "occasion", label: "특별한 날 중심", detail: "존재감 있는 디자인과 브랜드 감성도 열어두기" },
    ],
  },
  {
    id: "rings-budget",
    eyebrow: "02 · 예산",
    title: "두 분 한 쌍 예산 상한은 어디에 가까워요?",
    body: "상한을 먼저 정하면 브랜드 매장과 종로·공방 후보를 섞을지 바로 판단할 수 있어요.",
    options: [
      { value: "under100", label: "100만 이하", detail: "실속형·공방·심플 밴드부터" },
      { value: "100to200", label: "100~200만", detail: "브랜드 기본 밴드와 지역 매장 비교" },
      { value: "200to300", label: "200~300만", detail: "브랜드 선택지를 넓혀도 되는 구간" },
      { value: "over300", label: "300만 이상", detail: "시그니처·다이아 라인까지 열어두기" },
    ],
  },
  {
    id: "rings-tone",
    eyebrow: "03 · 색감",
    title: "손에 올렸을 때 편한 금속 색은요?",
    body: "소재 색은 사진보다 실제 착용감이 중요해서, 끌리는 색은 여러 개 남겨두고 매장에서 비교해도 좋아요.",
    multiple: true,
    options: [
      { value: "platinum", label: "플래티넘", detail: "차분하고 단단한 느낌" },
      { value: "white", label: "화이트골드", detail: "밝고 깔끔한 은색 계열" },
      { value: "rose", label: "로즈골드", detail: "피부 톤에 부드럽게 얹히는 색" },
      { value: "yellow", label: "옐로우골드", detail: "클래식하고 따뜻한 색" },
      { value: "unsure", label: "아직 몰라요", detail: "후보를 넓게 보고 착용 때 결정" },
    ],
  },
  {
    id: "rings-design",
    eyebrow: "04 · 디자인",
    title: "첫인상은 어느 쪽이 더 좋아요?",
    body: "여기서 고른 답은 후보의 다이아 여부와 존재감을 좁히는 기준이 됩니다. 동시에 끌리는 인상이 있으면 같이 골라도 됩니다.",
    multiple: true,
    options: [
      { value: "minimal", label: "심플한 밴드", detail: "오래 봐도 질리지 않는 쪽" },
      { value: "classic", label: "클래식 웨딩", detail: "브랜드 기본기와 안정감" },
      { value: "diamond", label: "다이아 포인트", detail: "작은 포인트라도 반짝임이 있는 쪽" },
      { value: "signature", label: "시그니처", detail: "한눈에 그 브랜드인 느낌" },
    ],
  },
  {
    id: "rings-match",
    eyebrow: "05 · 커플감",
    title: "두 분 반지는 얼마나 맞출까요?",
    body: "똑같이 맞출지, 분위기만 맞출지에 따라 매장에서 볼 라인이 달라져요.",
    options: [
      { value: "same-line", label: "같은 라인", detail: "브랜드·모델을 맞추고 폭만 조정" },
      { value: "same-mood", label: "소재나 분위기만", detail: "각자 손에 맞게 고르되 통일감 유지" },
      { value: "each-own", label: "각자 취향대로", detail: "공통 후보보다 각자 만족도를 우선" },
    ],
  },
  {
    id: "rings-priority",
    eyebrow: "06 · 우선순위",
    title: "마지막으로 무엇을 제일 우선할까요?",
    body: "후보가 비슷할 때 무엇을 먼저 남길지 정하는 기준이에요.",
    options: [
      { value: "comfort", label: "착용감", detail: "매일 낄 때 불편하지 않은 후보 우선" },
      { value: "brand", label: "브랜드 로망", detail: "상징성과 시그니처 라인 우선" },
      { value: "value", label: "가격 대비 만족", detail: "예산 안에서 소재·디자인 좋은 후보 우선" },
    ],
  },
];

export const RING_CONSULTATION_IDS = RING_CONSULTATION_QUESTIONS.map((question) => question.id);

export type RingConsultationAnswers = Partial<Record<RingConsultationQuestionId, string[]>>;

export function ringConsultationAnswers(data: WeddingData): RingConsultationAnswers {
  const dialogue = data.ai?.dialogue ?? [];
  const answers: RingConsultationAnswers = {};
  for (const question of RING_CONSULTATION_QUESTIONS) {
    const item = dialogue.find((entry) => entry.id === question.id);
    if (!item) continue;
    const tokens = item.answer.split(",").map((entry) => entry.trim()).filter(Boolean);
    const matched = question.options.filter((option) => tokens.includes(option.value) || tokens.includes(option.label));
    if (matched.length > 0) answers[question.id] = question.multiple
      ? matched.map((option) => option.value)
      : [matched[0].value];
  }
  return answers;
}

export function ringConsultationProgress(data: WeddingData) {
  const answers = ringConsultationAnswers(data);
  const answered = RING_CONSULTATION_QUESTIONS.filter((question) => (answers[question.id]?.length ?? 0) > 0).length;
  return { answered, total: RING_CONSULTATION_QUESTIONS.length, complete: answered === RING_CONSULTATION_QUESTIONS.length };
}

export function nextRingConsultationQuestion(answers: RingConsultationAnswers) {
  return RING_CONSULTATION_QUESTIONS.find((question) => (answers[question.id]?.length ?? 0) === 0) ?? null;
}

export function answerRingConsultation(data: WeddingData, questionId: RingConsultationQuestionId, value: string): WeddingData {
  const question = RING_CONSULTATION_QUESTIONS.find((item) => item.id === questionId);
  if (!question) return data;
  const option = question.options.find((item) => item.value === value);
  if (!option) return data;
  const answeredAt = new Date().toISOString();
  const currentValues = ringConsultationAnswers(data)[question.id] ?? [];
  const nextValues = question.multiple
    ? toggleRingAnswerValue(question, currentValues, value)
    : [value];
  const nextOptions = question.options.filter((item) => nextValues.includes(item.value));
  const filteredDialogue = (data.ai?.dialogue ?? []).filter((item) => item.id !== question.id);
  if (nextOptions.length === 0) {
    return {
      ...data,
      ai: {
        ...(data.ai ?? {}),
        dialogue: filteredDialogue.slice(-80),
        updatedAt: answeredAt,
      },
    };
  }
  const answerLabel = nextOptions.map((item) => item.label).join(", ");
  return {
    ...data,
    ai: {
      ...(data.ai ?? {}),
      dialogue: [
        ...filteredDialogue,
        {
          id: question.id,
          question: question.title,
          answer: answerLabel,
          answeredAt,
        },
      ].slice(-80),
      today: [
        {
          title: "반지 후보를 취향 기준으로 좁히기",
          reason: `${answerLabel} 기준을 반영했어요. 겹치는 후보와 가격 확인 순서까지 이어가면 됩니다.`,
          targetPath: "/rings",
        },
        ...(data.ai?.today ?? []).filter((item) => item.targetPath !== "/rings"),
      ].slice(0, 3),
      updatedAt: answeredAt,
    },
  };
}

function toggleRingAnswerValue(question: RingConsultationQuestion, currentValues: string[], value: string): string[] {
  const exclusiveValues: Partial<Record<RingConsultationQuestionId, string[]>> = {
    "rings-tone": ["unsure"],
  };
  const exclusive = exclusiveValues[question.id] ?? [];
  const withoutExclusive = exclusive.includes(value)
    ? []
    : currentValues.filter((item) => !exclusive.includes(item));
  return currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...withoutExclusive, value];
}
