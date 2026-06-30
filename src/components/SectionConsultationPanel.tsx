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
  const activeQuestion = nextConsultationQuestion(data, sectionId);
  const [internalOpen, setInternalOpen] = useState(() => defaultOpen ?? progress.answered === 0);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (controlledOpen === undefined) setInternalOpen(defaultOpen ?? progress.answered === 0);
    // 섹션이 바뀔 때만 초기 열림 상태를 다시 계산한다.
    // 답변할 때마다 자동으로 접히거나 펼쳐지면 상담 흐름이 끊긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, defaultOpen, controlledOpen]);

  if (!meta || questions.length === 0) return null;

  const answer = (questionId: string, value: string) => {
    update((prev: WeddingData) => answerConsultation(prev, sectionId, questionId, value));
  };

  if (!open) {
    return (
      <section className="border-y border-hair py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="eyebrow-gold">Dearie</div>
          <div className="text-[12px] font-medium text-soft">
            기준 <span className={progress.complete ? "text-ink" : "text-gold"}>{progress.answered}/{progress.total}</span>
          </div>
        </div>
        <h2 className="mt-2 font-serif text-[20px] leading-snug text-ink break-keep">{meta.closedTitle}</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-soft break-keep">
          {activeQuestion ? `${activeQuestion.title} 답하면 다음 선택지가 더 선명해집니다.` : meta.summary}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group mt-4 flex min-h-11 w-full items-center justify-between gap-4 border-t border-hair pt-3 text-left text-ink hover:text-gold"
        >
          <span className="text-[14px] font-semibold leading-snug break-keep">
            {activeQuestion ? "기준 질문 이어가기" : "답한 기준 다시 보기"}
          </span>
          <span className="text-soft transition group-hover:text-ink">→</span>
        </button>
      </section>
    );
  }

  return (
    <section className="border-y border-hair py-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow-gold mb-2">Dearie 상담 · {progress.answered}/{progress.total}</div>
          <h2 className="font-serif text-[20px] leading-snug text-ink break-keep">{meta.title}</h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <div className="flex gap-3 border-l border-gold/40 pl-4">
        <AgentIdentity compact mood={activeQuestion ? "thinking" : "ready"} />
        <p className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-soft break-keep">
          {activeQuestion
            ? "제가 한 질문씩 묻고, 답에 맞춰 다음에 볼 일을 좁힐게요."
            : "기준은 잡혔어요. 이제 아래 답을 바꾸거나 실제 후보/항목을 정리하면 됩니다."}
        </p>
      </div>

      {activeQuestion ? (
        <QuestionCard question={activeQuestion} value={answers[activeQuestion.id]} onAnswer={answer} />
      ) : (
        <div className="border-l border-gold pl-4">
          <div className="eyebrow-gold mb-1">기준 완료</div>
          <p className="text-[13.5px] leading-relaxed text-soft break-keep">{meta.summary}</p>
        </div>
      )}

      <details className="border-y border-hair py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
          <span>
            <span className="section-title">답한 기준</span>
            <span className="mt-1 block text-[12px] text-soft">바꾸고 싶은 기준은 여기서 다시 고르면 됩니다.</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">보기</span>
        </summary>
        <div className="mt-4 space-y-4">
          {questions.map((question) => (
            <AnsweredQuestion key={question.id} question={question} value={answers[question.id]} onAnswer={answer} />
          ))}
        </div>
      </details>
    </section>
  );
}

function QuestionCard({
  question,
  value,
  onAnswer,
}: {
  question: ConsultationQuestion;
  value?: string;
  onAnswer: (questionId: string, value: string) => void;
}) {
  return (
    <div className="border-l border-gold pl-4 space-y-4">
      <div>
        <div className="eyebrow-gold mb-2">{question.eyebrow}</div>
        <h3 className="font-serif text-[20px] leading-snug text-ink break-keep">{question.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-soft break-keep">{question.body}</p>
      </div>
      <div className="space-y-2">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAnswer(question.id, option.value)}
            className={`w-full border-t border-hair py-3 text-left transition ${
              value === option.value ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold leading-snug break-keep">{option.label}</span>
              <span className="text-[12px]">{value === option.value ? "선택됨" : "선택"}</span>
            </span>
            <span className="mt-1 block text-[12.5px] leading-relaxed break-keep">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnsweredQuestion({
  question,
  value,
  onAnswer,
}: {
  question: ConsultationQuestion;
  value?: string;
  onAnswer: (questionId: string, value: string) => void;
}) {
  const option = question.options.find((item) => item.value === value);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="eyebrow">{question.eyebrow}</div>
        <div className="text-[12px] font-medium text-ink">{option?.label ?? "미답"}</div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {question.options.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onAnswer(question.id, item.value)}
            className={`tracking-wide ${value === item.value ? "seg-active" : "seg"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
