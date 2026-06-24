import type { CeremonyStep } from "../lib/schema";

// 한국 일반 예식홀 표준 식순(약 20~30분). 시간은 비워두고 담당·음악 칸만 안내로 채운다.
// 사용자는 자기 식에 맞게 단계를 더하고 빼고, 주례 없는 식이면 해당 줄을 지운다.
export function defaultCeremony(): CeremonyStep[] {
  const rows: Array<Omit<CeremonyStep, "id">> = [
    { title: "개식 선언", role: "사회자", notes: "하객 착석 안내 후 시작" },
    { title: "양가 어머니 화촉 점화", music: "잔잔한 입장 전 BGM" },
    { title: "신랑 입장", role: "신랑", music: "신랑 입장곡" },
    { title: "신부 입장", role: "신부 · 아버지 동반", music: "신부 입장곡" },
    { title: "맞절 · 인사", role: "신랑 신부" },
    { title: "혼인 서약", role: "신랑 신부", music: "서약 중 무반주 또는 잔잔한 BGM" },
    { title: "성혼 선언문 낭독", role: "주례 또는 사회자" },
    { title: "주례사 / 덕담", role: "주례 (없으면 양가 대표·부모님)" },
    { title: "축가", role: "축가자", music: "축가 곡" },
    { title: "양가 부모님께 인사", role: "신랑 신부" },
    { title: "내빈께 인사", role: "신랑 신부" },
    { title: "신랑 신부 행진", role: "신랑 신부", music: "행진곡 (퇴장)" },
    { title: "폐식 · 단체사진 안내", role: "사회자", notes: "원판·단체 촬영 동선 안내" },
  ];
  return rows.map((r, i) => ({ id: `ceremony-${i}`, ...r }));
}
