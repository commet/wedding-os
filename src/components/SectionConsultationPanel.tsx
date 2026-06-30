import { useEffect, useMemo, useState } from "react";
import type { WeddingData } from "../lib/schema";
import {
  CONSULTATION_META,
  answerConsultation,
  consultationAnswers,
  consultationProgress,
  consultationQuestions,
  nextConsultationQuestion,
  type ConsultationQuestion,
  type ConsultationSectionId,
} from "../lib/sectionConsultation";
import { AgentIdentity } from "./AgentIdentity";

type Props = {
  sectionId: ConsultationSectionId;
  data: WeddingData;
  update: (patch: any) => void;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function SectionConsultationPanel({ sectionId, data, update, defaultOpen, open: controlledOpen, onOpenChange }: Props) {
  const meta = CONSULTATION_META[sectionId];
  const progress = consultationProgress(data, sectionId);
  const questions = consultationQuestions(sectionId);
  const answers = useMemo(() => consultationAnswers(data, sectionId), [data, sectionId]);
  const nextQuestion = nextConsultationQuestion(data, sectionId);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const activeQuestion = activeQuestionId
    ? questions.find((question) => question.id === activeQuestionId) ?? nextQuestion
    : nextQuestion;
  const changeItems = useMemo(
    () => buildConsultationChangeItems(meta, questions, answers, nextQuestion),
    [answers, meta, nextQuestion, questions],
  );
  const progressPercent = Math.round((progress.answered / progress.total) * 100);
  const [internalOpen, setInternalOpen] = useState(() => defaultOpen ?? false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (controlledOpen === undefined) setInternalOpen(defaultOpen ?? false);
    setActiveQuestionId(null);
    // 섹션이 바뀔 때만 초기 열림 상태를 다시 계산한다.
    // 답변할 때마다 자동으로 접히거나 펼쳐지면 상담 흐름이 끊긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, defaultOpen, controlledOpen]);

  if (!meta || questions.length === 0) return null;

  const answer = (question: ConsultationQuestion, value: string) => {
    update((prev: WeddingData) => answerConsultation(prev, sectionId, question.id, value));
    setActiveQuestionId(question.multiple ? question.id : null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-16 w-full items-center justify-between gap-4 border-y border-hair py-3 text-left"
      >
        <span className="min-w-0">
          <span className="eyebrow-gold block">
            Dearie 기준 잡기 · <span className={progress.complete ? "text-ink" : "text-gold"}>{progress.answered}/{progress.total}</span>
          </span>
          <span className="mt-1 block truncate text-[13.5px] font-medium text-ink">
            {nextQuestion ? nextQuestion.title : `${meta.label} 기준은 잡혔어요`}
          </span>
        </span>
        <span className="flex-shrink-0 text-[12px] font-medium text-soft underline underline-offset-4 group-hover:text-ink">
          {nextQuestion ? "이어서 답하기" : "기준 보기"}
        </span>
      </button>
    );
  }

  return (
    <section className="border-y border-hair py-5 space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <AgentIdentity compact mood={activeQuestion ? "thinking" : "ready"} />
          <div className="min-w-0">
            <div className="eyebrow-gold mb-2">Dearie 기준 잡기 · {progress.answered}/{progress.total}</div>
            <h2 className="font-serif text-[20px] leading-snug text-ink break-keep">{meta.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-soft break-keep">
              {activeQuestion
                ? "답을 누르면 기준, 오늘 할 일, 다음 질문이 바로 바뀝니다."
                : "기준은 잡혔어요. 이제 실제 후보나 항목을 정리하면 됩니다."}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <div className="h-[3px] bg-cream">
        <div className="h-full bg-gold transition-all duration-500" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)] lg:items-start">
        {activeQuestion ? (
          <QuestionCard
            question={activeQuestion}
            value={answers[activeQuestion.id]}
            onAnswer={answer}
            onContinue={() => setActiveQuestionId(null)}
          />
        ) : (
          <div className="border-y border-hair py-4">
            <div className="eyebrow-gold mb-1">기준 완료</div>
            <p className="text-[13.5px] leading-relaxed text-soft break-keep">{meta.summary}</p>
          </div>
        )}

        <ConsultationChangeLog items={changeItems} />
      </div>

      {progress.answered > 0 && (
        <details className="border-y border-hair py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
            <span>
              <span className="section-title">답한 기준 수정</span>
              <span className="mt-1 block text-[12px] text-soft">바꿀 기준만 다시 고르면 Dearie가 다음 행동을 다시 잡습니다.</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">보기</span>
          </summary>
          <div className="mt-4 space-y-4">
            {questions
              .filter((question) => (answers[question.id]?.length ?? 0) > 0)
              .map((question) => (
                <AnsweredQuestion key={question.id} question={question} value={answers[question.id]} onAnswer={answer} />
              ))}
          </div>
        </details>
      )}
    </section>
  );
}

function QuestionCard({
  question,
  value,
  onAnswer,
  onContinue,
}: {
  question: ConsultationQuestion;
  value?: string[];
  onAnswer: (question: ConsultationQuestion, value: string) => void;
  onContinue: () => void;
}) {
  const selectedValues = value ?? [];
  const hasSelection = selectedValues.length > 0;
  return (
    <div className="border-y border-hair py-4 space-y-4">
      <div>
        <div className="eyebrow-gold mb-2">
          {question.eyebrow}{question.multiple ? " · 복수 선택 가능" : ""}
        </div>
        <h3 className="font-serif text-[20px] leading-snug text-ink break-keep">{question.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-soft break-keep">{question.body}</p>
      </div>
      <div className="space-y-2">
        {question.options.map((option) => {
          const selected = selectedValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onAnswer(question, option.value)}
              className={`w-full border px-4 py-3 text-left transition active:scale-[0.99] ${
                selected ? "border-gold bg-gold/5 text-ink" : "border-hair text-soft hover:border-gold hover:text-ink"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold leading-snug break-keep">{option.label}</span>
                <span className="text-[12px]">{selected ? "반영됨" : question.multiple ? "추가" : "선택"}</span>
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed break-keep">{option.detail}</span>
            </button>
          );
        })}
      </div>
      {question.multiple && (
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSelection}
          className="btn-primary min-h-12 w-full text-[13px] disabled:opacity-40"
        >
          선택한 기준으로 다음 질문 →
        </button>
      )}
    </div>
  );
}

type ConsultationChangeItem = {
  key: string;
  label: string;
  value: string;
  detail: string;
};

function ConsultationChangeLog({ items }: { items: ConsultationChangeItem[] }) {
  return (
    <aside className="border-y border-hair py-4">
      <div className="eyebrow-gold mb-3">지금 바뀐 것</div>
      <div className="grid border-y border-hair">
        {items.map((item) => (
          <div key={item.key} className="anim-fade border-b border-hair p-3 last:border-b-0">
            <div className="eyebrow mb-2">{item.label}</div>
            <div className="text-[13.5px] font-semibold leading-snug text-ink break-keep">{item.value}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-soft break-keep">{item.detail}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function buildConsultationChangeItems(
  meta: typeof CONSULTATION_META[ConsultationSectionId],
  questions: ConsultationQuestion[],
  answers: Record<string, string[] | undefined>,
  nextQuestion: ConsultationQuestion | null,
): ConsultationChangeItem[] {
  const answeredQuestions = questions.filter((question) => (answers[question.id]?.length ?? 0) > 0);
  if (answeredQuestions.length === 0) {
    return [
      {
        key: "waiting",
        label: "기준 대기",
        value: "아직 반영 전",
        detail: "답을 고르면 Dearie가 이 화면의 다음 행동을 바로 다시 잡습니다.",
      },
      {
        key: "today",
        label: "준비판 변화",
        value: `${meta.label} 기준 이어가기`,
        detail: "첫 답부터 홈의 오늘 할 일에 이어갈 작업으로 올라갑니다.",
      },
      {
        key: "next",
        label: "다음 질문",
        value: nextQuestion?.eyebrow ?? "질문 준비",
        detail: nextQuestion?.title ?? meta.summary,
      },
    ];
  }

  const latest = answeredQuestions.slice(-1)[0];
  const latestLabels = selectedConsultationLabels(latest, answers);
  const items: ConsultationChangeItem[] = [
    {
      key: `answer-${latest.id}`,
      label: "기준 반영",
      value: `${latest.eyebrow.replace(/^\d+\s*·\s*/, "")} · ${latestLabels}`,
      detail: "방금 고른 답을 이 화면의 비교 기준에 넣었습니다.",
    },
    {
      key: "today",
      label: "준비판 변화",
      value: `${meta.label} 기준 이어가기`,
      detail: `${latestLabels} 기준이 홈의 오늘 할 일과 이 화면의 다음 행동에 반영됩니다.`,
    },
    {
      key: "next",
      label: nextQuestion ? "다음 질문" : "기준 완료",
      value: nextQuestion?.eyebrow ?? "완료",
      detail: nextQuestion?.title ?? "이제 실제 후보나 항목을 정리하면 됩니다.",
    },
  ];

  return items;
}

function selectedConsultationLabels(question: ConsultationQuestion, answers: Record<string, string[] | undefined>): string {
  const values = answers[question.id] ?? [];
  return question.options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)
    .join(", ") || "선택한 기준";
}

function AnsweredQuestion({
  question,
  value,
  onAnswer,
}: {
  question: ConsultationQuestion;
  value?: string[];
  onAnswer: (question: ConsultationQuestion, value: string) => void;
}) {
  const selectedValues = value ?? [];
  const selectedOptions = question.options.filter((item) => selectedValues.includes(item.value));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="eyebrow">{question.eyebrow}</div>
        <div className="text-[12px] font-medium text-ink">{selectedOptions.map((item) => item.label).join(", ") || "미답"}</div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {question.options.map((item) => {
          const selected = selectedValues.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onAnswer(question, item.value)}
              className={`tracking-wide ${selected ? "seg-active" : "seg"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
