import { useMemo, useState } from "react";
import type { WeddingData, Guest, GuestSide, GuestStatus } from "../lib/schema";
import { listRsvps, type RsvpRow } from "../lib/storage.supabase";

type Props = { data: WeddingData; update: (patch: any) => void };
type Filter = "all" | "groom" | "bride" | "attending" | "pending";

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter === "groom" && g.side !== "groom") return false;
      if (filter === "bride" && g.side !== "bride") return false;
      if (filter === "attending" && g.status !== "참석") return false;
      if (filter === "pending" && (g.status === "참석" || g.status === "불참")) return false;
      if (q && !(g.name.toLowerCase().includes(q) || (g.relation ?? "").toLowerCase().includes(q))) return false;
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

  const removeGuest = (id: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      guests: (prev.guests ?? []).filter((g) => g.id !== id),
    }));
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
      <div className="page pt-20 pb-10 text-center space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">Guests</div>
          <h2 className="display-sm mb-4">
            누구를 모실까?<br />
            <span className="italic font-light text-gold">한 명씩 적어가요.</span>
          </h2>
          <p className="text-[13px] text-soft leading-relaxed">
            이름 · 관계 · 신랑/신부 측 · 축의금 · 식수까지<br />
            한 번에 관리되고 자동으로 집계됩니다.
          </p>
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
            <div className="eyebrow-gold mb-2">RSVP</div>
            <p className={`text-[11.5px] leading-relaxed mb-3 ${rsvpStatus === "fail" ? "text-gold" : "text-soft"}`}>
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
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">Guests</div>
        <h1 className="font-serif text-[2rem] leading-none">하객 명단</h1>
      </div>

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

      {/* 검색 + 추가 */}
      <div className="space-y-4">
        {data.preferences.mode === "supabase" && (
          <div className="border-y border-hair py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow-gold mb-1">RSVP</div>
              <p className={`text-[11.5px] leading-relaxed ${rsvpStatus === "fail" ? "text-gold" : "text-soft"}`}>
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
        <div className="flex items-center justify-between">
          <div className="flex gap-5 overflow-x-auto -mx-6 px-6 scrollbar-hide">
            {(["all", "groom", "bride", "attending", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[12px] tracking-wide whitespace-nowrap pb-1 transition ${
                  filter === f ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
                }`}
              >
                {f === "all" ? "전체" : f === "groom" ? "신랑" : f === "bride" ? "신부" : f === "attending" ? "참석" : "대기"}
              </button>
            ))}
          </div>
        </div>
        <GuestAddBlock
          side={addSide}
          onSideChange={setAddSide}
          onAddOne={addGuest}
          onAddBulk={bulkAddGuests}
        />
      </div>

      {/* 명단 */}
      {filtered.length === 0 ? (
        <p className="text-center text-[12.5px] text-soft py-8">조건에 맞는 하객이 없어요.</p>
      ) : (
        <ul className="divide-y divide-hair border-y border-hair">
          {filtered.map((g) => (
            <GuestRow key={g.id} g={g} onChange={(p) => updateGuest(g.id, p)} onRemove={() => removeGuest(g.id)} />
          ))}
        </ul>
      )}

      <p className="text-[10.5px] text-soft text-center pt-2">
        축의금 · 식수 합계는 자동 계산. 모드 1 에선 본인 휴대폰에만 저장.
      </p>
    </div>
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
              className={`text-[12px] tracking-wide pb-1 transition ${
                side === s ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
              }`}
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
                  ? "btn-primary px-8 py-3.5 text-[12.5px] disabled:opacity-40"
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
      <div className={`font-serif tabular-nums ${accent ? "text-2xl text-ink" : muted ? "text-lg text-soft" : "text-xl text-ink"}`}>
        {display}
        {unit && <span className="text-[11px] text-soft ml-1">{unit === "원" ? "만원" : unit}</span>}
      </div>
      {hint && <div className="text-[10.5px] text-soft mt-0.5">{hint}</div>}
    </div>
  );
}

function GuestRow({ g, onChange, onRemove }: { g: Guest; onChange: (p: Partial<Guest>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[15px] text-ink truncate">{g.name}</span>
            <span className="eyebrow">{SIDE_LABEL[g.side]}</span>
          </div>
          <div className="text-[11.5px] text-soft mt-1 space-x-2">
            {g.relation && <span>{g.relation}</span>}
            <span className={g.status === "참석" ? "text-gold" : ""}>· {STATUS_LABEL[g.status]}</span>
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

          <div>
            <label className="label">신랑/신부 측</label>
            <div className="flex gap-5">
              {(["groom", "bride", "shared"] as GuestSide[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ side: s })}
                  className={`text-[12px] tracking-wide pb-1 ${g.side === s ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
                >
                  {SIDE_LABEL[s]}
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
                  className={`text-[12px] tracking-wide pb-1 ${g.status === s ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
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

          <label className="flex items-center gap-2 text-[12.5px] text-soft">
            <input
              type="checkbox"
              checked={g.meal !== false}
              onChange={(e) => onChange({ meal: e.target.checked })}
              className="accent-ink"
            />
            식권 사용 (식대 정산에 포함)
          </label>

          <textarea
            className="input-boxed text-[12.5px] min-h-[50px]"
            value={g.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="메모"
          />

          <div className="flex items-center justify-between pt-2 border-t border-hair">
            <span className="text-[10.5px] text-soft">
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
