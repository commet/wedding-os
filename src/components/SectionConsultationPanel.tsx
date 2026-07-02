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
type Props = {
  sectionId: ConsultationSectionId;
  data: WeddingData;
  update: (patch: any) => void;
  defaultOpen?: boolean;
};

export default function SectionConsultationPanel({ sectionId, data, update, defaultOpen }: Props) {
  const meta = CONSULTATION_META[sectionId];
  const progress = consultationProgress(data, sectionId);
  const questions = consultationQuestions(sectionId);
  const answers = useMemo(() => consultationAnswers(data, sectionId), [data, sectionId]);
  const activeQuestion = nextConsultationQuestion(data, sectionId);
  const [open, setOpen] = useState(() => defaultOpen ?? progress.answered === 0);

  useEffect(() => {
    setOpen(defaultOpen ?? progress.answered === 0);
    // 섹션이 바뀔 때만 초기 열림 상태를 다시 계산한다.
    // 답변할 때마다 자동으로 접히거나 펼쳐지면 상담 흐름이 끊긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, defaultOpen]);

  if (!meta || questions.length === 0) return null;

  const answer = (questionId: string, value: string) => {
    update((prev: WeddingData) => answerConsultation(prev, sectionId, questionId, value));
  };

  if (!open) {
    return (
      <section className="border-y border-hair py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="eyebrow-gold">기준 질문</div>
          <div className="text-[12px] font-medium text-soft">
            <span className={progress.complete ? "text-ink" : "text-gold"}>{progress.answered}/{progress.total}</span>
          </div>
        </div>
        <h2 className="mt-2 font-serif text-[19px] leading-snug text-ink break-keep">
          {activeQuestion ? activeQuestion.title : meta.closedTitle}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-soft break-keep">
          {activeQuestion ? "하나만 고르면 아래 후보와 다음 할 일이 바로 좁혀집니다." : meta.summary}
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
    <section className="border-y border-hair py-3 space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow-gold mb-1">기준 질문 · {progress.answered}/{progress.total}</div>
          <h2 className="font-serif text-[19px] leading-snug text-ink break-keep">
            {activeQuestion ? activeQuestion.title : "기준은 다 골랐어요"}
          </h2>
          {!activeQuestion && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-soft break-keep">
              {meta.summary}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="whitespace-nowrap text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      {activeQuestion ? (
        <QuestionCard question={activeQuestion} value={answers[activeQuestion.id]} onAnswer={answer} />
      ) : (
        <div className="border border-hair bg-cream/40 px-4 py-3">
          <div className="section-title">답한 기준으로 아래 내용을 정리합니다</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-soft break-keep">
            바꾸고 싶은 기준은 접힌 영역에서 다시 고르면 됩니다.
          </p>
        </div>
      )}

      {progress.answered > 0 && (
        <details className="border-t border-hair pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
            <span>
              <span className="section-title">답한 기준</span>
              <span className="mt-1 block text-[12px] text-soft">필요하면 여기서 다시 고르면 됩니다.</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">보기</span>
          </summary>
          <div className="mt-4 space-y-4">
            {questions.map((question) => (
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
}: {
  question: ConsultationQuestion;
  value?: string;
  onAnswer: (questionId: string, value: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[12.5px] leading-relaxed text-soft break-keep">{question.body}</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAnswer(question.id, option.value)}
            className={`w-full border px-4 py-2.5 text-left transition ${
              value === option.value
                ? "border-gold bg-gold/5 text-ink"
                : "border-hair bg-paper text-ink hover:border-ink"
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold leading-snug break-keep">{option.label}</span>
              <span className={`text-[12px] ${value === option.value ? "text-gold" : "text-soft"}`}>
                {value === option.value ? "선택됨" : "고르기"}
              </span>
            </span>
            <span className="mt-1.5 block text-[12.5px] leading-relaxed text-soft break-keep">{option.detail}</span>
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
