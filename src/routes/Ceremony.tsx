import { useState } from "react";
import type { WeddingData, CeremonyStep } from "../lib/schema";
import { defaultCeremony } from "../data/ceremonyTemplate";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void };

function makeStep(): CeremonyStep {
  return {
    id: `ceremony-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
  };
}

export default function Ceremony({ data, update }: Props) {
  const steps = data.ceremony ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  const loadDefault = () => {
    update((prev: WeddingData) => ({ ...prev, ceremony: defaultCeremony() }));
  };

  const addStep = () => {
    const step = makeStep();
    update((prev: WeddingData) => ({
      ...prev,
      ceremony: [...(prev.ceremony ?? []), step],
    }));
    setOpenId(step.id);
  };

  const updateStep = (id: string, patch: Partial<CeremonyStep>) => {
    update((prev: WeddingData) => ({
      ...prev,
      ceremony: (prev.ceremony ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeStep = (id: string) => {
    const s = steps.find((x) => x.id === id);
    const label = s?.title?.trim();
    if (!confirm(`'${label || "이 단계"}'을(를) 식순에서 지울까요?\n되돌릴 수 없어요.`)) return;
    update((prev: WeddingData) => ({
      ...prev,
      ceremony: (prev.ceremony ?? []).filter((x) => x.id !== id),
    }));
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    update((prev: WeddingData) => {
      const list = [...(prev.ceremony ?? [])];
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return prev;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...prev, ceremony: list };
    });
  };

  const toggleDone = (id: string, done: boolean) => updateStep(id, { done });

  // 빈 상태
  if (steps.length === 0) {
    return (
      <div className="page pt-20 pb-10 text-center space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">예식 진행</div>
          <h1 className="display-sm mb-4">
            {koBreak("예식 순서를")}
            <br />
            <span className="italic font-light text-gold">{koBreak("함께 짜볼까요?")}</span>
          </h1>
          <p className="text-[15px] text-soft leading-[1.85]">
            입장부터 행진까지 순서를 적어두면, 당일 사회자와 두 분이 그대로 따라갈 큐시트가 됩니다.
          </p>
        </div>
        <button onClick={loadDefault} className="btn-primary px-8 py-3.5 text-[13px]">
          기본 식순 불러오기 →
        </button>
        <div>
          <button
            onClick={addStep}
            className="text-[12px] text-soft underline underline-offset-4 hover:text-ink"
          >
            빈 순서로 시작 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">예식 진행</div>
        <h1 className="h-page">식순</h1>
      </div>

      <p className="text-[12.5px] text-soft leading-relaxed border-y border-hair py-4">
        당일 사회자와 두 분이 따라갈 진행표예요. 시간·담당·구간 음악을 미리 적어두면, 리허설과 당일에
        한 줄씩 체크하며 진행할 수 있어요.
      </p>

      <ul className="border-y border-hair divide-y divide-hair">
        {steps.map((s, i) => (
          <CeremonyRow
            key={s.id}
            step={s}
            index={i}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
            open={openId === s.id}
            onToggleOpen={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
            onChange={(patch) => updateStep(s.id, patch)}
            onRemove={() => removeStep(s.id)}
            onMove={(dir) => moveStep(s.id, dir)}
            onToggleDone={(done) => toggleDone(s.id, done)}
          />
        ))}
      </ul>

      <button
        onClick={addStep}
        className="w-full min-h-11 border border-hair text-[13px] text-ink hover:text-gold transition-colors"
      >
        + 단계 추가
      </button>

      <div className="pt-2 text-center">
        <button
          onClick={() => {
            if (!confirm("지금 식순을 기본 식순으로 바꿀까요?\n적어둔 내용은 사라져요.")) return;
            loadDefault();
          }}
          className="text-[12px] text-soft underline underline-offset-4 hover:text-gold"
        >
          기본 식순으로 다시 채우기
        </button>
      </div>

      <p className="text-[10.5px] text-soft text-center leading-relaxed">
        주례 없는 식이면 해당 단계를 지우고, 식장·사회자와 맞춰 시간을 조정하세요.
      </p>
    </div>
  );
}

function CeremonyRow({
  step,
  index,
  isFirst,
  isLast,
  open,
  onToggleOpen,
  onChange,
  onRemove,
  onMove,
  onToggleDone,
}: {
  step: CeremonyStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onChange: (patch: Partial<CeremonyStep>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggleDone: (done: boolean) => void;
}) {
  const num = String(index + 1).padStart(2, "0");
  const meta = [
    step.role ? `담당 ${step.role}` : "",
    step.music ? `음악 ${step.music}` : "",
  ].filter(Boolean);

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        {/* 완료 토글 (리허설·당일 체크) */}
        <button
          onClick={() => onToggleDone(!step.done)}
          aria-label={step.done ? "완료 해제" : "완료"}
          className={`w-11 h-11 -my-2.5 -ml-1 flex items-center justify-center flex-shrink-0 transition after:w-4 after:h-4 after:border ${
            step.done ? "after:bg-ink after:border-ink" : "after:border-mute hover:after:border-ink"
          }`}
        >
          {step.done && <span className="block text-paper text-[10px] leading-4 text-center">✓</span>}
        </button>

        {/* 단계 번호 + 본문 (탭하면 편집) */}
        <button
          onClick={onToggleOpen}
          className="row-tap flex-1 min-w-0 text-left flex items-baseline gap-3 -my-1 py-1"
        >
          <span className="font-serif text-[15px] text-gold tabular-nums flex-shrink-0 leading-none pt-0.5">
            {num}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2">
              {step.time && (
                <span className="text-[12px] text-soft tabular-nums flex-shrink-0">{step.time}</span>
              )}
              <span
                className={`text-[15px] font-medium break-keep ${
                  step.done ? "line-through text-soft" : "text-ink"
                }`}
              >
                {step.title || "(제목 없음)"}
              </span>
            </span>
            {meta.length > 0 && (
              <span className="block text-[12px] text-soft mt-1 break-keep leading-relaxed">
                {meta.join(" · ")}
              </span>
            )}
            {step.notes && (
              <span className="block text-[11.5px] text-soft/90 mt-0.5 break-keep leading-relaxed">
                {step.notes}
              </span>
            )}
          </span>
          <span className="text-soft text-[11px] flex-shrink-0">{open ? "−" : "+"}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-hair space-y-3 pl-[3.25rem]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">시간</label>
              <input
                className="input text-[13px] tabular-nums"
                value={step.time ?? ""}
                onChange={(e) => onChange({ time: e.target.value })}
                placeholder="13:00"
              />
            </div>
            <div>
              <label className="label">담당</label>
              <input
                className="input text-[13px]"
                value={step.role ?? ""}
                onChange={(e) => onChange({ role: e.target.value })}
                placeholder="사회 · 주례 · 축가"
              />
            </div>
          </div>
          <div>
            <label className="label">제목</label>
            <input
              className="input text-[14px]"
              value={step.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="신랑 입장"
            />
          </div>
          <div>
            <label className="label">음악</label>
            <input
              className="input text-[13px]"
              value={step.music ?? ""}
              onChange={(e) => onChange({ music: e.target.value })}
              placeholder="구간 음악 · 축가 곡"
            />
          </div>
          <div>
            <label className="label">메모</label>
            <input
              className="input text-[13px]"
              value={step.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="동선 · 큐 · 주의할 점"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-hair">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onMove(-1)}
                disabled={isFirst}
                className="min-h-11 text-[14px] text-soft hover:text-ink disabled:opacity-30 px-1"
                aria-label="위로"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(1)}
                disabled={isLast}
                className="min-h-11 text-[14px] text-soft hover:text-ink disabled:opacity-30 px-1"
                aria-label="아래로"
              >
                ↓
              </button>
            </div>
            <button
              onClick={onRemove}
              className="text-[11px] text-soft hover:text-gold underline underline-offset-4"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
