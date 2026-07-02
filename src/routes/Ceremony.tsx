import { useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, WeddingUpdate, CeremonyStep } from "../lib/schema";
import { defaultCeremony } from "../data/ceremonyTemplate";
import { koBreak } from "../lib/typography";
import { parseISODateLocal } from "../lib/date";
import { buildCeremonySheet, shareOrDownloadText } from "../lib/textExport";
import { attendingCount, mealTicketCount } from "../lib/derived";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import DearieConfirmModal from "../components/DearieConfirmModal";

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026.11.07 토" — 요일은 로컬 타임존 기준 getDay() 로 계산
function formatCeremonyDate(iso?: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd} ${KO_WEEKDAYS[d.getDay()]}`;
}

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void };
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "normal" | "warn";
  onConfirm: () => void | Promise<void>;
};

function makeStep(): CeremonyStep {
  return {
    id: `ceremony-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
  };
}

export default function Ceremony({ data, update }: Props) {
  const steps = data.ceremony ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const shareSheet = async () => {
    const r = await shareOrDownloadText({
      title: "식순",
      text: buildCeremonySheet(data),
      filename: "식순.txt",
    });
    setToast(
      r === "shared" ? "공유 시트를 열었어요" :
      r === "copied" ? "파일로 저장하고 클립보드에 복사했어요" :
      "파일로 저장했어요",
    );
    window.setTimeout(() => setToast(null), 2600);
  };

  const loadDefault = () => {
    update((prev: WeddingData) => ({ ...prev, ceremony: defaultCeremony() }));
  };

  const confirmLoadDefault = () => {
    setConfirmDialog({
      title: "기본 식순으로 다시 채울까요?",
      body: "지금 적어둔 단계와 메모가 기본 식순으로 바뀝니다. 식장 안내에 맞춰 처음부터 다시 정리하려는 경우에만 진행하세요.",
      confirmLabel: "기본 식순으로",
      tone: "warn",
      onConfirm: loadDefault,
    });
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
    setConfirmDialog({
      title: `${label || "이 단계"}를 지울까요?`,
      body: "식순에서 이 단계가 사라집니다. 다시 필요하면 새 단계로 추가할 수 있어요.",
      confirmLabel: "지우기",
      onConfirm: () => {
        update((prev: WeddingData) => ({
          ...prev,
          ceremony: (prev.ceremony ?? []).filter((x) => x.id !== id),
        }));
      },
    });
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

  const doneCount = steps.filter((s) => s.done).length;
  const roleMissing = steps.filter((s) => !s.role?.trim()).length;
  const musicMissing = steps.filter((s) => !s.music?.trim()).length;

  // 식순을 실제 예식 순간에 묶어주는 컨텍스트 한 줄 — 있는 정보만 모아 표기
  const inv = data.invitation;
  const ceremonyDate = formatCeremonyDate(inv?.date);
  const contextParts = [
    ceremonyDate,
    inv?.time?.trim() || "",
    inv?.venue?.trim() ? `${inv.venue.trim()}${inv.venueHall?.trim() ? ` ${inv.venueHall.trim()}` : ""}` : "",
  ].filter(Boolean);

  // 빈 상태
  if (steps.length === 0) {
    return (
      <div className="page pt-12 pb-10 text-center space-y-6 md:pt-20 md:space-y-8">
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
        <ProcessAgentPanel
          title="사회자에게 보낼 큐시트를 준비합니다"
          summary="처음엔 기본 식순을 불러온 뒤, 주례 여부·축가·혼인서약처럼 실제 예식에 맞지 않는 단계만 지우면 됩니다."
          metrics={[
            { label: "단계", value: "0개", tone: "warn" },
            { label: "예식 정보", value: contextParts.length ? "있음" : "미정", tone: contextParts.length ? "normal" : "muted" },
            { label: "식권", value: `${mealTicketCount(data)}장`, tone: mealTicketCount(data) ? "normal" : "muted" },
          ]}
          steps={[
            { label: "기본 식순 불러오기", detail: "입장부터 행진까지 표준 흐름을 먼저 깔아요." },
            { label: "사회자·축가·음악 담당 정하기", detail: "담당이 비어 있으면 당일에 질문이 다시 돌아옵니다." },
          ]}
          actions={[
            { label: "기본 식순 불러오기 →", onClick: loadDefault, tone: "primary" },
            { label: "빈 순서로 시작", onClick: addStep },
          ]}
        />
        <div className="text-left">
          <SectionConsultationPanel sectionId="ceremony" data={data} update={update} />
        </div>
      </div>
    );
  }

  return (
    <div className="page pt-6 pb-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow-gold mb-2">예식 진행</div>
          <h1 className="h-page">식순</h1>
          {contextParts.length > 0 && (
            <p className="mt-1.5 text-[12px] text-soft break-keep">
              <span className="tabular-nums">{contextParts.join(" · ")}</span>
            </p>
          )}
        </div>
        <span className="eyebrow tabular-nums whitespace-nowrap">
          {doneCount}/{steps.length} 확인
        </span>
      </div>

      {/* 진행 게이지 — 리허설·당일 체크 진척을 한눈에 */}
      <div className="mt-3 h-px w-full bg-hair" aria-hidden="true">
        <div
          className="h-full bg-gold transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="mt-6 space-y-6">
        <SectionDecisionLoop data={data} sectionId="ceremony" />

        <ProcessAgentPanel
          title={roleMissing > 0 || musicMissing > 0 ? "빈 담당과 음악을 찾는 중" : "사회자 공유 준비가 거의 끝났어요"}
          summary={
            roleMissing > 0 || musicMissing > 0
              ? `담당이 비어 있는 단계 ${roleMissing}개, 음악이 비어 있는 단계 ${musicMissing}개가 있어요. 식장·사회자에게 보내기 전 이 두 칸을 먼저 채우면 됩니다.`
              : "모든 단계에 담당과 음악이 잡혀 있어요. 리허설 때 한 번씩 체크하면서 실제 진행표로 쓰면 됩니다."
          }
          mood={roleMissing > 0 || musicMissing > 0 ? "watching" : "ready"}
          metrics={[
            { label: "확인", value: `${doneCount}/${steps.length}` },
            { label: "담당 없음", value: `${roleMissing}개`, tone: roleMissing > 0 ? "warn" : "muted" },
            { label: "음악 없음", value: `${musicMissing}개`, tone: musicMissing > 0 ? "warn" : "muted" },
          ]}
          steps={[
            { label: "단계 순서 확정", detail: "주례 없는 식, 폐백 여부, 축가 순서를 식장과 맞춥니다.", done: steps.length > 0 },
            { label: "담당자 채우기", detail: "사회·주례·축가·음향 담당을 각 단계에 남깁니다.", done: roleMissing === 0 },
            { label: "사회자에게 보낼 시트 저장", detail: "식권·축의금 담당은 하객 데이터와 함께 당일 운영에서 봅니다.", done: doneCount === steps.length },
          ]}
          actions={[
            { label: "진행표 내보내기 →", onClick: shareSheet, tone: "primary" },
            { label: "단계 추가", onClick: addStep },
            { label: "기본 식순으로 다시 채우기", onClick: confirmLoadDefault },
          ]}
        />

        <SectionConsultationPanel sectionId="ceremony" data={data} update={update} />
      </div>

      <p className="mt-4 text-[13px] text-soft leading-[1.8] break-keep">
        당일 사회자와 두 분이 따라갈 진행표예요. 노드를 누르면 리허설·당일에 한 단계씩 체크할 수 있어요.
      </p>

      <div className="mt-3">
        <button
          onClick={shareSheet}
          className="text-[12px] underline underline-offset-4 text-ink hover:text-gold"
        >
          사회자에게 보내기 · 저장 →
        </button>
      </div>

      <ol className="mt-8">
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
            onToggleDone={(done) => updateStep(s.id, { done })}
          />
        ))}
      </ol>

      <button
        onClick={addStep}
        className="mt-6 w-full min-h-11 border border-hair text-[13px] text-ink hover:border-gold transition-colors"
      >
        + 단계 추가
      </button>

      {/* 당일 운영 — 한국 예식에서 자주 빠뜨리는 것들 + 하객 데이터 자동 집계 */}
      <details className="mt-8 border-t border-hair pt-5">
        <summary className="list-none cursor-pointer flex items-baseline justify-between gap-4 min-h-11">
          <span>
            <span className="eyebrow-gold block mb-1">당일 운영</span>
            <span className="font-serif text-[17px] text-ink break-keep">자주 빠뜨리는 것들</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
        </summary>
        <div className="mt-4 space-y-5">
          <Link to="/guests" className="row-tap block border border-hair px-4 py-3">
            <div className="eyebrow mb-1.5">식수 · 축의금 (하객에서 자동)</div>
            <div className="text-[14px] text-ink break-keep">
              참석 <b className="tabular-nums">{attendingCount(data)}명</b>
              <span className="text-soft"> · </span>
              식권 <b className="tabular-nums">{mealTicketCount(data)}장</b> 예상
            </div>
          </Link>

          <div>
            <div className="eyebrow mb-2">꼭 정해둘 담당</div>
            <ul className="space-y-1.5 text-[13px] text-soft leading-relaxed break-keep">
              <li>· 축의금·식권 <b className="text-ink">수거 담당</b> — 양가 1명씩, 입구 데스크</li>
              <li>· 음향·음악 — 마이크·입장곡·축가 음량, <b className="text-ink">백업 USB·폰</b> 따로</li>
              <li>· 신부 대기실 — 음료·응급약·슬리퍼·여분 스타킹·부케 보관</li>
            </ul>
          </div>

          <div>
            <div className="eyebrow mb-2">폐백을 한다면</div>
            <p className="text-[13px] text-soft leading-relaxed break-keep">
              폐백실 위치·방석·이바지·혼주 동선을 미리 확인하세요. 안 하는 식이면 식순에서 빼면 돼요.
            </p>
          </div>

          <p className="text-[11.5px] text-soft leading-relaxed break-keep">
            체크는 <Link to="/checklist" className="underline underline-offset-2 text-ink">체크리스트</Link>에서,
            사람·식수는 <Link to="/guests" className="underline underline-offset-2 text-ink">하객</Link>에서 관리해요.
          </p>
        </div>
      </details>

      <div className="mt-6 text-center">
        <button
          onClick={confirmLoadDefault}
          className="text-[12px] text-soft underline underline-offset-4 hover:text-gold"
        >
          기본 식순으로 다시 채우기
        </button>
      </div>

      <p className="mt-6 text-[11px] text-soft text-center leading-relaxed break-keep">
        주례 없는 식이면 해당 단계를 지우고, 식장·사회자와 맞춰 시간을 조정하세요.
      </p>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-6 pointer-events-none">
          <div className="bg-ink text-paper text-[12px] px-4 py-2.5 anim-pop">{toast}</div>
        </div>
      )}
      <DearieConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        body={confirmDialog?.body ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "확인"}
        tone={confirmDialog?.tone}
        onClose={() => setConfirmDialog(null)}
        onConfirm={async () => { await confirmDialog?.onConfirm(); }}
      />
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
    <li className="relative pl-9">
      {/* 타임라인 세로선 — 단계들을 흐름으로 잇는다 */}
      <span
        aria-hidden="true"
        className={`absolute left-[7px] w-px bg-hair ${isFirst ? "top-[1.35rem]" : "top-0"} ${isLast ? "h-[1.35rem]" : "bottom-0"}`}
      />
      {/* 노드 = 완료 토글 (마름모) */}
      <button
        onClick={() => onToggleDone(!step.done)}
        aria-label={step.done ? "완료 해제" : "완료 표시"}
        className="absolute left-0 top-[0.85rem] w-4 h-4 flex items-center justify-center"
      >
        <span
          className={`w-[9px] h-[9px] rotate-45 border transition-colors ${
            step.done ? "bg-gold border-gold" : "border-mute bg-paper"
          }`}
        />
      </button>

      {/* 본문 — 탭하면 편집 펼침 */}
      <button
        onClick={onToggleOpen}
        className="row-tap block w-full text-left py-3.5 border-b border-hair"
      >
        <span className="flex items-baseline gap-2">
          <span className="font-serif text-[11px] text-gold tabular-nums flex-shrink-0">{num}</span>
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
          <span className="ml-auto text-soft text-[11px] flex-shrink-0 pl-2">{open ? "−" : "+"}</span>
        </span>
        {meta.length > 0 && (
          <span className="mt-1 block text-[12px] text-soft break-keep leading-relaxed">
            {meta.join(" · ")}
          </span>
        )}
        {step.notes && (
          <span className="mt-0.5 block text-[11.5px] text-soft/90 break-keep leading-relaxed">
            {step.notes}
          </span>
        )}
      </button>

      {open && (
        <div className="py-4 border-b border-hair space-y-3">
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

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onMove(-1)}
                disabled={isFirst}
                className="min-h-11 min-w-11 text-[15px] text-soft hover:text-ink disabled:opacity-25"
                aria-label="위로"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(1)}
                disabled={isLast}
                className="min-h-11 min-w-11 text-[15px] text-soft hover:text-ink disabled:opacity-25"
                aria-label="아래로"
              >
                ↓
              </button>
            </div>
            <button
              onClick={onRemove}
              className="text-[11px] text-soft hover:text-gold underline underline-offset-4"
            >
              이 단계 삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
