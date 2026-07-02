import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, WeddingUpdate, Guest, GuestSide, GuestStatus, GuestCategory } from "../lib/schema";
import { listRsvps, type RsvpRow } from "../lib/storage.supabase";
import { koBreak } from "../lib/typography";
import {
  contractedVenue, expectedHeadcount, venueCapacityFit, planningHeadcount,
  headcountSummary, mealCostRange, formatKRW, GUEST_CATEGORIES, GUEST_CATEGORY_LABEL,
} from "../lib/derived";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import DearieConfirmModal from "../components/DearieConfirmModal";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void };
type Filter = "all" | "groom" | "bride" | "attending" | "pending";
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "normal" | "warn";
  onConfirm: () => void | Promise<void>;
};

const SIDE_LABEL: Record<GuestSide, string> = {
  groom: "신랑 측",
  bride: "신부 측",
  shared: "공통",
};

const STATUS_LABEL: Record<GuestStatus, string> = {
  "초대 예정": "초대 예정",
  "초대 완료": "초대 완료",
  "참석": "참석",
  "불참": "불참",
  "미정": "미정",
};

export default function Guests({ data, update }: Props) {
  const guests = data.guests ?? [];
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [addSide, setAddSide] = useState<GuestSide>("groom");
  const [rsvpStatus, setRsvpStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [rsvpMsg, setRsvpMsg] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter === "groom" && g.side !== "groom") return false;
      if (filter === "bride" && g.side !== "bride") return false;
      if (filter === "attending" && g.status !== "참석") return false;
      if (filter === "pending" && (g.status === "참석" || g.status === "불참")) return false;
      if (q && !(g.name.toLowerCase().includes(q) || (g.relation ?? "").toLowerCase().includes(q) || (g.group ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [guests, filter, search]);

  const stats = useMemo(() => {
    const total = guests.length;
    const attending = guests.filter((g) => g.status === "참석");
    const declined = guests.filter((g) => g.status === "불참");
    const pending = total - attending.length - declined.length;
    const partySum = attending.reduce((s, g) => s + (g.partyCount ?? 1), 0);
    const giftSum = guests.reduce((s, g) => s + (g.giftKRW ?? 0), 0);
    const mealCount = attending.filter((g) => g.meal !== false).reduce((s, g) => s + (g.partyCount ?? 1), 0);
    const groom = guests.filter((g) => g.side === "groom").length;
    const bride = guests.filter((g) => g.side === "bride").length;
    return { total, attending: attending.length, declined: declined.length, pending, partySum, giftSum, mealCount, groom, bride };
  }, [guests]);
  const seatingGroups = useMemo(() => summarizeSeatingGroups(guests), [guests]);
  const headSummary = useMemo(() => headcountSummary(data), [data]);
  const notInvited = guests.filter((g) => g.status === "초대 예정").length;
  const responded = stats.attending + stats.declined;
  const unclassified = guests.filter((g) => !g.category).length;
  const agentSummary = guests.length === 0
    ? "명단을 다 쓰기 전에 하객 규모부터 잡아도 됩니다. 보증인원·식대·예산은 이 추정치로 먼저 계산돼요."
    : responded === 0 && notInvited > 0
      ? "명단은 생겼고 아직 초대/회신 단계 전이에요. 보낼 사람을 정리한 뒤 초대 완료 상태로 넘기면 RSVP 진행률을 볼 수 있습니다."
      : stats.pending > 0
        ? "회신 대기가 남아 있어요. 참석 확정, 식수, 좌석 묶음이 같이 바뀌므로 응답 회수부터 보는 게 좋아요."
        : "참석 여부가 꽤 정리됐어요. 이제 식권 수와 테이블 묶음을 당일 운영으로 넘기면 됩니다.";

  const seedHeadcount = () => {
    update((prev: WeddingData) => {
      const ratios: Record<GuestCategory, number> = {
        family: 0.12,
        relative: 0.18,
        work: 0.24,
        school: 0.12,
        friend: 0.26,
        acquaintance: 0.08,
      };
      const estimates = GUEST_CATEGORIES.flatMap(({ key }) => [
        { side: "groom" as const, category: key, expected: Math.round(100 * ratios[key]) },
        { side: "bride" as const, category: key, expected: Math.round(100 * ratios[key]) },
      ]);
      return { ...prev, headcount: { ...(prev.headcount ?? {}), estimates } };
    });
  };

  const markAllScheduledInvited = () => {
    if (notInvited === 0) return;
    setConfirmDialog({
      title: "초대 완료로 넘길까요?",
      body: `초대 예정 ${notInvited}명을 모두 초대 완료로 바꾸고, 초대일이 비어 있으면 오늘 날짜로 채웁니다.`,
      confirmLabel: "초대 완료 처리",
      onConfirm: () => {
        const today = new Date().toISOString().split("T")[0];
        update((prev: WeddingData) => ({
          ...prev,
          guests: (prev.guests ?? []).map((g) =>
            g.status === "초대 예정" ? { ...g, status: "초대 완료" as const, invitedAt: g.invitedAt ?? today } : g
          ),
        }));
      },
    });
  };

  const exportCsv = () => {
    if (guests.length === 0) return;
    const header = ["이름", "구분", "분류", "관계", "묶음", "상태", "동반인원", "축의금"];
    const rows = guests.map((g) => [
      g.name,
      SIDE_LABEL[g.side],
      g.category ? GUEST_CATEGORY_LABEL[g.category] : "",
      g.relation ?? "",
      g.group ?? "",
      STATUS_LABEL[g.status],
      String(g.partyCount ?? 1),
      g.giftKRW != null ? String(g.giftKRW) : "",
    ]);
    const body = [header, ...rows]
      .map((cols) => cols.map(csvCell).join(","))
      .join("\r\n");
    // UTF-8 BOM — Excel에서 한글이 깨지지 않도록.
    const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding-guests.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const addGuest = (name: string, side: GuestSide) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    update((prev: WeddingData) => ({
      ...prev,
      guests: [...(prev.guests ?? []), makeGuest(cleanName, side)],
    }));
  };

  const bulkAddGuests = (names: string[], side: GuestSide) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length === 0) return;
    update((prev: WeddingData) => ({
      ...prev,
      guests: [...(prev.guests ?? []), ...clean.map((n) => makeGuest(n, side))],
    }));
  };

  const updateGuest = (id: string, patch: Partial<Guest>) => {
    update((prev: WeddingData) => ({
      ...prev,
      guests: (prev.guests ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  };

  // 일괄 상태 변경 — 지금 화면에 보이는(필터된) 하객에게만 적용. 초대장 보낸 날
  // 한 번에 '초대 완료'로 넘기는 흐름을 위해. 되돌리기 어려우니 확인을 받는다.
  const bulkSetStatus = (status: GuestStatus) => {
    const ids = new Set(filtered.map((g) => g.id));
    if (ids.size === 0) return;
    setConfirmDialog({
      title: "보이는 하객 상태를 바꿀까요?",
      body: `현재 필터에 보이는 ${ids.size}명의 상태를 ${STATUS_LABEL[status]}로 바꿉니다. 초대 완료로 바꾸는 경우 초대일이 비어 있으면 오늘로 채워요.`,
      confirmLabel: `${STATUS_LABEL[status]}로 변경`,
      onConfirm: () => {
        const today = new Date().toISOString().split("T")[0];
        update((prev: WeddingData) => ({
          ...prev,
          guests: (prev.guests ?? []).map((g) => {
            if (!ids.has(g.id)) return g;
            const patch: Partial<Guest> = { status };
            // '초대 완료'로 넘길 때 초대일이 비어 있으면 오늘로 채운다(행의 '초대 미전송' 해소).
            if (status === "초대 완료" && !g.invitedAt) patch.invitedAt = today;
            return { ...g, ...patch };
          }),
        }));
        setBulkOpen(false);
      },
    });
  };

  const removeGuest = (id: string) => {
    const g = guests.find((x) => x.id === id);
    const name = g?.name?.trim();
    const hasGift = typeof g?.giftKRW === "number" && g.giftKRW > 0;
    // 축의금이 적힌 하객은 실수 삭제 시 손실이 크므로 더 또렷이 경고.
    setConfirmDialog({
      title: `${name || "이 하객"} 님을 삭제할까요?`,
      body: hasGift
        ? "축의금 기록도 함께 사라지고 되돌릴 수 없어요. 착오 삭제가 아니라면 진행하세요."
        : "명단에서만 삭제합니다. 다시 필요하면 새로 추가할 수 있어요.",
      confirmLabel: "삭제하기",
      tone: hasGift ? "warn" : "normal",
      onConfirm: () => {
        update((prev: WeddingData) => ({
          ...prev,
          guests: (prev.guests ?? []).filter((g) => g.id !== id),
        }));
      },
    });
  };

  const importRsvps = async () => {
    const sb = data.preferences.supabase;
    if (data.preferences.mode !== "supabase" || !sb) {
      setRsvpStatus("fail");
      setRsvpMsg("RSVP 가져오기는 내 사이트 모드에서만 가능해요.");
      return;
    }
    setRsvpStatus("loading");
    setRsvpMsg("RSVP 응답을 불러오는 중…");
    const r = await listRsvps(sb.url, sb.anonKey, sb.configId);
    if (!r.ok) {
      setRsvpStatus("fail");
      setRsvpMsg(r.reason ?? "RSVP를 불러오지 못했어요.");
      return;
    }
    const rows = r.rows ?? [];
    let added = 0;
    let updated = 0;
    const nextGuests = [...guests];
    for (const row of rows) {
      const key = guestMatchKey(row.name, row.side ?? "shared");
      const idx = nextGuests.findIndex((g) => guestMatchKey(g.name, g.side) === key);
      const patch = rsvpToGuestPatch(row);
      if (idx >= 0) {
        nextGuests[idx] = { ...nextGuests[idx], ...patch, notes: mergeNotes(nextGuests[idx].notes, patch.notes) };
        updated++;
      } else {
        nextGuests.push({
          id: `rsvp-${row.id}`,
          name: row.name,
          side: row.side ?? "shared",
          status: row.attending ? "참석" : "불참",
          partyCount: row.attending ? Math.max(1, row.guests ?? 1) : 1,
          meal: row.attending ? row.meal !== "식사 안 함" : false,
          invitedAt: row.created_at?.split("T")[0],
          notes: rsvpNote(row),
        });
        added++;
      }
    }
    update((prev: WeddingData) => ({ ...prev, guests: nextGuests }));
    setRsvpStatus("ok");
    setRsvpMsg(`RSVP ${rows.length}건 확인 · ${added}명 추가 · ${updated}명 업데이트`);
  };

  // 빈 상태
  if (guests.length === 0) {
    return (
      <div className="page pt-12 pb-10 text-center space-y-6 md:pt-20 md:space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">하객 명단</div>
          <h1 className="display-sm mb-4 [text-wrap:balance] max-w-[18rem] mx-auto">떠오르는 분부터 <span className="italic font-light">{koBreak("한 명씩 적어보세요.")}</span></h1>
          <p className="text-[15px] text-soft leading-[1.85]">
            이름과 어느 쪽 하객인지 먼저 적어두면 참석 여부와 식수는 자동으로 모입니다.
          </p>
        </div>
        <div className="text-left">
          <SectionDecisionLoop data={data} sectionId="guests" />
          <ProcessAgentPanel
            title="명단 전에도 식수를 먼저 추정할 수 있어요"
            summary={agentSummary}
            metrics={[
              { label: "예상", value: `${planningHeadcount(data)}명`, tone: planningHeadcount(data) > 0 ? "normal" : "muted" },
              { label: "명단", value: "0명", tone: "muted" },
              { label: "회신", value: "0건", tone: "muted" },
            ]}
            steps={[
              { label: "양가 하객 규모부터 잡기", detail: "신랑·신부 측을 분류별로 나누면 예식장 보증인원 판단이 시작됩니다.", done: headSummary.estTotal > 0 },
              { label: "떠오르는 이름을 붙여넣기", detail: "정확한 관계·연락처는 나중에 상세에서 채워도 됩니다." },
            ]}
            actions={[
              ...(headSummary.estTotal === 0 ? [{ label: "200명 기준으로 시작 →", onClick: seedHeadcount, tone: "primary" as const }] : []),
            ]}
          />
          <SectionConsultationPanel sectionId="guests" data={data} update={update} />
          <HeadcountEstimator data={data} update={update} />
        </div>
        <GuestAddBlock
          side={addSide}
          onSideChange={setAddSide}
          onAddOne={addGuest}
          onAddBulk={bulkAddGuests}
          primary
        />
        {data.preferences.mode === "supabase" && (
          <div className="border-y border-hair py-4">
            <div className="eyebrow mb-2">RSVP</div>
            <p className={`text-[12px] leading-relaxed mb-3 ${rsvpStatus === "fail" ? "text-ink" : "text-soft"}`}>
              {rsvpMsg || "청첩장으로 받은 응답이 있다면 하객 명단으로 가져올 수 있어요."}
            </p>
            <button
              onClick={importRsvps}
              disabled={rsvpStatus === "loading"}
              className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40"
            >
              {rsvpStatus === "loading" ? "불러오는 중" : "RSVP 응답 가져오기 →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page pt-6 pb-10 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">초대와 참석</div>
        <h1 className="h-page">하객 명단</h1>
      </div>

      <SectionDecisionLoop data={data} sectionId="guests" />

      <ProcessAgentPanel
        title={stats.pending > 0 ? "회신 대기를 줄이는 중" : seatingGroups.total > 0 ? "좌석 묶음까지 읽는 중" : "명단을 식수로 바꾸는 중"}
        summary={agentSummary}
        mood={stats.pending > 0 || notInvited > 0 || unclassified > 0 ? "watching" : "ready"}
        metrics={[
          { label: "명단", value: `${stats.total}명` },
          { label: "참석", value: `${stats.partySum}명`, hint: "동반 포함" },
          { label: "대기", value: `${stats.pending}명`, tone: stats.pending > 0 ? "warn" : "muted" },
        ]}
        steps={[
          { label: "추정 규모와 실제 명단 맞추기", detail: `현재 기준 ${planningHeadcount(data)}명으로 보증인원과 식대가 계산됩니다.`, done: headSummary.estTotal > 0 || guests.length > 0 },
          { label: "초대 완료 상태로 넘기기", detail: "청첩장을 보낸 뒤 상태를 바꾸면 응답 대기가 보입니다.", done: notInvited === 0 },
          { label: "분류와 묶음 채우기", detail: "축의금 가정, 좌석 초안, 양가 균형 판단에 함께 쓰입니다.", done: unclassified === 0 },
        ]}
        actions={[
          ...(notInvited > 0 ? [{ label: "초대 예정 모두 완료 처리 →", onClick: markAllScheduledInvited, tone: "primary" as const }] : []),
          ...(stats.pending > 0 ? [{ label: "대기자만 보기", onClick: () => setFilter("pending") }] : []),
          ...(unclassified > 0 ? [{ label: "분류 빠진 사람 찾기", onClick: () => { setSearch(""); setFilter("all"); } }] : []),
          ...(data.preferences.mode === "supabase" ? [{ label: "RSVP 응답 가져오기 →", onClick: importRsvps }] : []),
        ]}
      />

      <SectionConsultationPanel sectionId="guests" data={data} update={update} />

      <HeadcountEstimator data={data} update={update} />

      {/* 통계 — hairline 그리드 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-hair py-6">
        <Stat label="초대 총 인원" value={stats.total} accent />
        <Stat label="참석 확정" value={stats.attending} hint={`+${stats.partySum - stats.attending}명 동반`} />
        <Stat label="신랑 측" value={stats.groom} />
        <Stat label="신부 측" value={stats.bride} />
        <Stat label="식수 (식권)" value={stats.mealCount} hint="참석자 동반 포함" />
        <Stat label="축의금 합계" value={stats.giftSum} unit="원" />
        <Stat label="응답 대기" value={stats.pending} muted />
        <Stat label="불참" value={stats.declined} muted />
      </div>

      {seatingGroups.total > 0 && (
        <details className="-mt-2 border-b border-hair pb-4">
          <summary className="cursor-pointer list-none flex items-baseline justify-between gap-4">
            <span>
              <span className="eyebrow-gold block mb-1">테이블 배치 초안</span>
              <span className="text-[12px] text-soft">
                {seatingGroups.total}명 · 약 {seatingGroups.tableCount}테이블
              </span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-[11.5px] text-soft leading-relaxed break-keep">
              불참자를 제외하고 묶음·관계·분류 순서로 가볍게 나눈 초안이에요. 각 하객 상세의 묶음 칸에 “신랑 회사”, “신부 대학 친구”처럼 적으면 더 정확해져요.
            </p>
            <div className="divide-y divide-hair border-y border-hair">
              {seatingGroups.rows.map((row) => (
                <div key={row.label} className="py-2.5 flex items-baseline justify-between gap-4 text-[12.5px]">
                  <span className="text-ink break-keep">{row.label}</span>
                  <span className="text-soft tabular-nums whitespace-nowrap">
                    {row.count}명 · {row.tables}테이블
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {(() => {
        const venue = contractedVenue(data);
        const head = planningHeadcount(data);
        const fit = venueCapacityFit(venue, head);
        if (!venue || fit === "unknown") return null;
        const tone = fit === "over" || fit === "under" ? "text-gold font-semibold" : "text-soft";
        const label = fit === "over" ? "수용 인원 초과" : fit === "under" ? "최소 보증인원 미달" : fit === "tight" ? "수용 인원에 근접" : "수용 범위 안";
        const range = `${venue.capacityMin ?? "?"}~${venue.capacityMax ?? "?"}명`;
        return (
          <Link to="/venues" className="row-tap -mt-2 flex items-baseline justify-between gap-3 border-b border-hair px-1 py-3">
            <span className="eyebrow break-keep">{venue.name} · 예식장 여유도</span>
            <span className={`text-[12px] break-keep ${tone}`}>초대 {head}명 / 수용 {range} · {label}</span>
          </Link>
        );
      })()}

      {(() => {
        const { groom, bride } = stats;
        if (groom === 0 || bride === 0) return null;
        const larger = Math.max(groom, bride);
        const smaller = Math.min(groom, bride);
        const diff = larger - smaller;
        // 한쪽이 1.6배 이상이면서 차이가 20명 이상일 때만 — 가볍게 한 번 짚어줍니다.
        if (larger < smaller * 1.6 || diff < 20) return null;
        const moreSide = groom > bride ? "신랑" : "신부";
        const lessSide = groom > bride ? "신부" : "신랑";
        return (
          <p className="-mt-2 border-b border-hair px-1 py-3 text-[12px] text-soft leading-relaxed break-keep">
            {moreSide} 측이 {lessSide} 측보다 {diff}명 많아요 — 양가 균형을 한 번 확인해 보세요.
          </p>
        );
      })()}

      {/* 검색 + 추가 */}
      <div className="space-y-4">
        {data.preferences.mode === "supabase" && (
          <div className="border-y border-hair py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow mb-1">RSVP</div>
              <p className={`text-[12px] leading-relaxed ${rsvpStatus === "fail" ? "text-ink" : "text-soft"}`}>
                {rsvpMsg || "청첩장 응답을 하객 명단으로 가져옵니다."}
              </p>
            </div>
            <button
              onClick={importRsvps}
              disabled={rsvpStatus === "loading"}
              className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40 whitespace-nowrap"
            >
              {rsvpStatus === "loading" ? "불러오는 중" : "응답 가져오기 →"}
            </button>
          </div>
        )}
        <input
          className="input text-[13px]"
          placeholder="이름·관계로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-5 overflow-x-auto -mx-6 px-6 scrollbar-hide">
            {(["all", "groom", "bride", "attending", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap ${filter === f ? "seg-active" : "seg"}`}
              >
                {f === "all" ? "전체" : f === "groom" ? "신랑" : f === "bride" ? "신부" : f === "attending" ? "참석" : "대기"}
              </button>
            ))}
          </div>
          {guests.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="text-[12px] underline underline-offset-4 text-soft hover:text-ink whitespace-nowrap flex-shrink-0"
            >
              내보내기 →
            </button>
          )}
        </div>
        <GuestAddBlock
          side={addSide}
          onSideChange={setAddSide}
          onAddOne={addGuest}
          onAddBulk={bulkAddGuests}
        />

        {/* 일괄 상태 변경 — 초대장 발송 후 한 번에 정리 */}
        {filtered.length > 1 && (
          <div className="border-t border-hair pt-3">
            <button
              type="button"
              onClick={() => setBulkOpen((o) => !o)}
              className="flex w-full items-baseline justify-between text-left"
            >
              <span className="eyebrow break-keep">일괄 상태 변경 · 보이는 <span className="tabular-nums">{filtered.length}</span>명</span>
              <span className="text-[11px] text-soft flex-shrink-0">{bulkOpen ? "닫기" : "열기"}</span>
            </button>
            {bulkOpen && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {(Object.keys(STATUS_LABEL) as GuestStatus[]).map((s) => (
                  <button key={s} type="button" onClick={() => bulkSetStatus(s)} className="seg">
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 명단 */}
      {filtered.length === 0 ? (
        <p className="text-center text-[13px] text-soft py-8">조건에 맞는 하객이 없어요.</p>
      ) : (
        <ul className="group-card px-4">
          {filtered.map((g) => (
            <GuestRow key={g.id} g={g} onChange={(p) => updateGuest(g.id, p)} onRemove={() => removeGuest(g.id)} />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-soft text-center pt-2">
        축의금 · 식수 합계는 자동 계산. 혼자 쓰는 동안에는 이 기기에만 저장됩니다.
      </p>
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

// 예상 인원 계산기 — 명단을 다 적기 전에도 측·분류별로 몇 명 올지 가늠하고,
// 보증인원·식대·균형을 즉시 계산해 알려준다. 명단·회신이 들어오면 자동으로 reconcile.
function HeadcountEstimator({ data, update }: { data: WeddingData; update: (patch: WeddingUpdate) => void }) {
  const sum = headcountSummary(data);
  const hasEst = sum.estTotal > 0;
  const [editing, setEditing] = useState(false);
  const open = !hasEst || editing;

  const venue = contractedVenue(data);
  const planning = planningHeadcount(data);
  const fit = venueCapacityFit(venue, planning);
  const meal = mealCostRange(venue, planning);
  const { groom, bride } = sum.estBySide;

  const setEstimate = (side: "groom" | "bride", category: GuestCategory, raw: string) => {
    const v = Math.max(0, Math.min(9999, Math.round(Number(raw) || 0)));
    update((prev: WeddingData) => {
      const list = (prev.headcount?.estimates ?? []).filter((e) => !(e.side === side && e.category === category));
      if (v > 0) list.push({ side, category, expected: v });
      return { ...prev, headcount: { estimates: list } };
    });
  };

  // 에이전트의 상황 읽기 — 추정치에서 바로 reconcile.
  const reads: string[] = [];
  if (venue && fit === "over" && venue.capacityMax) {
    reads.push(`계약한 ${venue.name} 보증 ${venue.capacityMax}명을 ${planning - venue.capacityMax}명 넘을 수 있어요 — 인원 조정이나 식장 재확인이 필요해요.`);
  } else if (venue && fit === "under" && venue.capacityMin) {
    reads.push(`최소 보증인원 ${venue.capacityMin}명보다 ${venue.capacityMin - planning}명 적어요 — 보증금 손해 가능성을 확인하세요.`);
  }
  if (meal) {
    const m = meal.max ?? meal.min;
    const per = venue?.mealPriceMax ?? venue?.mealPriceMin;
    if (m && per) reads.push(`예상 식대 약 ${formatKRW(m)} (1인 ${Math.round(per / 10000)}만 기준).`);
  }
  if (groom > 0 && bride > 0) {
    const diff = Math.abs(groom - bride);
    if (Math.max(groom, bride) >= Math.min(groom, bride) * 1.5 && diff >= 20) {
      reads.push(`${groom > bride ? "신랑" : "신부"} 측이 ${diff}명 많아요 — 양가 균형을 한 번 살펴보세요.`);
    }
  }
  if (sum.listed > 0) {
    reads.push(`명단엔 ${sum.listed}명 입력 · 참석 회신 ${sum.confirmed}명 — 회신이 들어오면 추정이 자동으로 좁혀져요.`);
  } else if (hasEst) {
    reads.push("아직 명단 전이에요. 이름·회신을 채우면 이 추정이 점점 정확해져요.");
  }

  return (
    <section className="border border-hair bg-cream/30 px-5 py-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow-gold mb-1.5">예상 인원</div>
          <div className="font-serif text-[2rem] leading-none text-ink tabular-nums">
            {planning}<span className="text-[14px] text-soft ml-1">명</span>
          </div>
        </div>
        <div className="text-right text-[12px] text-soft tabular-nums leading-relaxed">
          <div>신랑 {groom} · 신부 {bride}</div>
          {sum.confirmed > 0 && <div className="text-gold">참석 확정 {sum.confirmed}</div>}
        </div>
      </div>

      {!hasEst && (
        <p className="mt-3 text-[12.5px] text-soft leading-relaxed break-keep">
          명단을 다 적기 전에도, 분류별로 몇 명 올지 어림수로 잡아보세요. 보증인원·식대·균형을 바로 계산해 드려요.
        </p>
      )}

      {reads.length > 0 && (
        <ul className="mt-3.5 space-y-1.5 border-l-2 border-gold/60 pl-3">
          {reads.map((r, i) => (
            <li key={i} className="text-[12.5px] text-soft leading-relaxed break-keep">{r}</li>
          ))}
        </ul>
      )}

      {hasEst && (
        <button onClick={() => setEditing((v) => !v)} className="mt-4 min-h-11 text-[12px] underline underline-offset-4 text-ink hover:text-gold">
          {editing ? "분류별 입력 접기" : "분류별 예상 수정 →"}
        </button>
      )}

      {open && (
        <div className="mt-4 border-t border-hair pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] gap-x-3 gap-y-2.5 items-center">
            <span className="eyebrow">분류</span>
            <span className="eyebrow text-center">신랑</span>
            <span className="eyebrow text-center">신부</span>
            {sum.rows.map((row) => (
              <Fragment key={row.category}>
                <span className="text-[13px] text-ink break-keep">
                  {row.label}
                  {row.listed > 0 && <span className="text-[10px] text-soft tabular-nums ml-1.5">명단 {row.listed}</span>}
                </span>
                <input
                  type="number" min={0} inputMode="numeric"
                  aria-label={`${row.label} 신랑 측 예상`}
                  className="input-boxed min-h-11 px-2 py-2 text-center text-[14px] tabular-nums"
                  value={row.groomEst || ""}
                  onChange={(e) => setEstimate("groom", row.category, e.target.value)}
                  placeholder="0"
                />
                <input
                  type="number" min={0} inputMode="numeric"
                  aria-label={`${row.label} 신부 측 예상`}
                  className="input-boxed min-h-11 px-2 py-2 text-center text-[14px] tabular-nums"
                  value={row.brideEst || ""}
                  onChange={(e) => setEstimate("bride", row.category, e.target.value)}
                  placeholder="0"
                />
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-soft leading-relaxed break-keep">
            가족·친척·직장·학교·친구·지인으로 나눠 어림수로 적으면 돼요. 숫자는 언제든 고칠 수 있어요.
          </p>
        </div>
      )}
    </section>
  );
}

function makeGuest(name: string, side: GuestSide): Guest {
  return {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim(),
    side,
    status: "초대 예정",
    partyCount: 1,
  };
}

function summarizeSeatingGroups(guests: Guest[]): {
  total: number;
  tableCount: number;
  rows: { label: string; count: number; tables: number }[];
} {
  const grouped = new Map<string, number>();
  for (const g of guests) {
    if (g.status === "불참") continue;
    const label =
      g.group?.trim() ||
      g.relation?.trim() ||
      (g.category ? GUEST_CATEGORY_LABEL[g.category] : "") ||
      SIDE_LABEL[g.side];
    const count = Math.max(1, g.partyCount ?? 1);
    grouped.set(label, (grouped.get(label) ?? 0) + count);
  }
  const rows = Array.from(grouped.entries())
    .map(([label, count]) => ({ label, count, tables: Math.max(1, Math.ceil(count / 10)) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 6);
  const total = Array.from(grouped.values()).reduce((sum, count) => sum + count, 0);
  return { total, tableCount: Math.max(1, Math.ceil(total / 10)), rows };
}

// 금액 입력 파싱 — 빈 칸은 undefined, "0"은 0으로 유지, 음수·비정상값은 거부.
function parseAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function GuestAddBlock({
  side, onSideChange, onAddOne, onAddBulk, primary,
}: {
  side: GuestSide;
  onSideChange: (s: GuestSide) => void;
  onAddOne: (name: string, side: GuestSide) => void;
  onAddBulk: (names: string[], side: GuestSide) => void;
  primary?: boolean;
}) {
  const [name, setName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const bulkNames = bulkText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 ${primary ? "justify-center" : ""}`}>
        <span className="eyebrow">추가할 분</span>
        <div className="flex gap-4">
          {(["groom", "bride", "shared"] as GuestSide[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSideChange(s)}
              className={side === s ? "seg-active" : "seg"}
            >
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {!bulkOpen ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onAddOne(name, side);
              setName("");
            }}
            className={primary ? "space-y-3" : "flex items-end gap-3 border-b border-hair pb-2"}
          >
            <input
              className={`input ${primary ? "text-center" : "flex-1"} text-[14px]`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="하객 이름 또는 호칭"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className={
                primary
                  ? "btn-primary px-8 py-3.5 text-[13px] disabled:opacity-40"
                  : "text-[12px] text-ink underline underline-offset-4 pb-3 hover:text-gold disabled:opacity-40 whitespace-nowrap"
              }
            >
              {primary ? "첫 하객 추가하기 →" : "추가 →"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className={`text-[12px] text-soft underline underline-offset-4 hover:text-ink ${primary ? "block mx-auto" : ""}`}
          >
            여러 명 한 번에 붙여넣기 →
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <textarea
            className="input-boxed text-[13px] min-h-[120px]"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"이름을 줄바꿈 또는 쉼표로 구분해 붙여넣으세요.\n예시:\n김민준\n이서연, 박도윤\n최지우"}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { setBulkOpen(false); setBulkText(""); }}
              className="text-[12px] text-soft underline underline-offset-4 hover:text-ink"
            >
              한 명씩 추가로
            </button>
            <button
              type="button"
              disabled={bulkNames.length === 0}
              onClick={() => {
                onAddBulk(bulkNames, side);
                setBulkText("");
                setBulkOpen(false);
              }}
              className="btn-primary px-6 py-2.5 text-[12px] disabled:opacity-40 whitespace-nowrap"
            >
              {bulkNames.length > 0 ? `${bulkNames.length}명 추가 →` : "이름을 입력하세요"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// CSV 셀 이스케이프 — 쉼표·따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 내부 따옴표는 두 번 반복.
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function guestMatchKey(name: string, side: GuestSide) {
  return `${name.trim().toLowerCase()}|${side}`;
}

function rsvpToGuestPatch(row: RsvpRow): Partial<Guest> {
  return {
    status: row.attending ? "참석" : "불참",
    partyCount: row.attending ? Math.max(1, row.guests ?? 1) : 1,
    meal: row.attending ? row.meal !== "식사 안 함" : false,
    invitedAt: row.created_at?.split("T")[0],
    notes: rsvpNote(row),
  };
}

function rsvpNote(row: RsvpRow): string | undefined {
  const parts = [
    row.meal ? `식사: ${row.meal}` : "",
    row.message ? `메시지: ${row.message}` : "",
    row.created_at ? `RSVP: ${row.created_at.split("T")[0]}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : undefined;
}

function mergeNotes(current?: string, incoming?: string) {
  if (!incoming) return current;
  if (!current) return incoming;
  if (current.includes(incoming)) return current;
  return `${current}\n${incoming}`;
}

function Stat({ label, value, accent, muted, unit, hint }: { label: string; value: number; accent?: boolean; muted?: boolean; unit?: string; hint?: string }) {
  const display = unit === "원" ? `${Math.round(value / 10000).toLocaleString()}` : value.toLocaleString();
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className={`font-serif text-xl tabular-nums ${accent ? "text-ink font-semibold" : muted ? "text-soft" : "text-ink"}`}>
        {display}
        {unit && <span className="text-[11px] text-soft ml-1">{unit === "원" ? "만원" : unit}</span>}
      </div>
      {hint && <div className="text-[11px] text-soft mt-0.5">{hint}</div>}
    </div>
  );
}

function GuestRow({ g, onChange, onRemove }: { g: Guest; onChange: (p: Partial<Guest>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3.5">
      <button onClick={() => setOpen((o) => !o)} className="row-tap w-full text-left flex items-baseline justify-between gap-3 -mx-4 px-4 py-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[15px] text-ink truncate">{g.name}</span>
            <span className="eyebrow">{SIDE_LABEL[g.side]}</span>
          </div>
          <div className="text-[12px] text-soft mt-1 space-x-2">
            {g.category && <span>{GUEST_CATEGORY_LABEL[g.category]}</span>}
            {g.relation && <span>{g.category ? "· " : ""}{g.relation}</span>}
            {g.group && <span>· {g.group}</span>}
            <span className={g.status === "참석" ? "text-ink" : ""}>· {STATUS_LABEL[g.status]}</span>
            {g.giftKRW != null && g.giftKRW > 0 && (
              <span className="tabular-nums">· {g.giftKRW.toLocaleString()}원</span>
            )}
          </div>
        </div>
        <div className="text-soft text-[11px] flex-shrink-0">{open ? "−" : "+"}</div>
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-hair space-y-4">
          <input
            className="input text-[14px]"
            value={g.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="이름"
          />
          <input
            className="input text-[13px]"
            value={g.relation ?? ""}
            onChange={(e) => onChange({ relation: e.target.value })}
            placeholder="관계 (예: 회사 동료, 대학 동기, 친척)"
          />
          <input
            className="input text-[13px]"
            value={g.group ?? ""}
            onChange={(e) => onChange({ group: e.target.value || undefined })}
            placeholder="테이블 묶음 (예: 신랑 회사, 신부 대학 친구)"
          />

          <div>
            <label className="label">신랑/신부 측</label>
            <div className="flex gap-5">
              {(["groom", "bride", "shared"] as GuestSide[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ side: s })}
                  className={g.side === s ? "seg-active" : "seg"}
                >
                  {SIDE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">분류 <span className="text-mute normal-case tracking-normal">· 예상 인원에 포함</span></label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {GUEST_CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onChange({ category: g.category === key ? undefined : key })}
                  className={g.category === key ? "seg-active" : "seg"}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">참석 여부</label>
            <div className="flex gap-5 flex-wrap">
              {(Object.keys(STATUS_LABEL) as GuestStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ status: s })}
                  className={g.status === s ? "seg-active" : "seg"}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">인원 (본인 포함)</label>
              <input
                type="number"
                min={1}
                max={99}
                className="input text-[13px] tabular-nums"
                value={g.partyCount ?? 1}
                onChange={(e) => onChange({ partyCount: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
              />
            </div>
            <div>
              <label className="label">축의금 (원)</label>
              <input
                type="number"
                min={0}
                className="input text-[13px] tabular-nums"
                value={g.giftKRW ?? ""}
                onChange={(e) => onChange({ giftKRW: parseAmount(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>

          <input
            className="input text-[13px]"
            value={g.phone ?? ""}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="연락처"
          />

          <label className="flex items-center gap-2 text-[13px] text-soft">
            <input
              type="checkbox"
              checked={g.meal !== false}
              onChange={(e) => onChange({ meal: e.target.checked })}
              className="accent-ink"
            />
            식권 사용 (식대 정산에 포함)
          </label>

          <textarea
            className="input-boxed text-[13px] min-h-[50px]"
            value={g.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="메모"
          />

          <div className="flex items-center justify-between pt-2 border-t border-hair">
            <span className="text-[11px] text-soft">
              {g.invitedAt ? `초대 ${g.invitedAt}` : "아직 초대장 미전송"}
            </span>
            <button onClick={onRemove} className="text-[11px] text-soft hover:text-gold underline underline-offset-4">
              삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
