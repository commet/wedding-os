import type { WeddingData } from "./schema";

export type MenuItem = { to: string; label: string; sub: string };
export type MenuGroup = { title: string; items: MenuItem[] };

/**
 * 전역 메뉴의 단일 소스 — Dashboard 의 접이식 메뉴와 AppShell 의 "더보기" 시트가
 * 같은 정의를 공유한다. sub 카운트가 data 에 의존하므로 함수로 만든다.
 *
 * 메뉴 순서는 실제 결혼 준비 흐름을 따른다 — 먼저 큰 예약을 잡고(결정·예약),
 * 청첩장·영상을 만들고(함께 만들기), 그 뒤 꾸준히 관리. 도구·설정은 뒤로.
 */
export function buildMenuGroups(data: WeddingData): MenuGroup[] {
  const venueCount = (data.venues ?? []).length;
  const sdmCount = data.sdm.filter((v) => v.category !== "snap").length;
  const snapCount = data.sdm.filter((v) => v.category === "snap").length;
  const budgetCount = (data.budget ?? []).length;
  const guestCount = (data.guests ?? []).length;
  const guestAttending = (data.guests ?? []).filter((g) => g.status === "참석").length;
  const checklistTotal = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const checklistDone = data.checklist.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  return [
    {
      title: "결정 · 예약",
      items: [
        { to: "/venues", label: "예식장", sub: venueCount > 0 ? `${venueCount}곳 담음` : "후보 비교 · 답사" },
        { to: "/sdm", label: "스드메", sub: sdmCount > 0 ? `${sdmCount}곳 담음` : "스튜디오 · 드레스 · 메이크업" },
        { to: "/snap", label: "본식 스냅", sub: snapCount > 0 ? `${snapCount}곳 담음` : "당일 촬영 · 원판 · 앨범" },
        { to: "/rings", label: "결혼반지", sub: `${data.rings.length}개 후보` },
        { to: "/trip", label: "신혼여행", sub: `${data.honeymoon.regions.length}곳 · 항공 ${data.flights.length} · 숙소 ${data.hotels.length}` },
      ],
    },
    {
      title: "함께 만들기",
      items: [
        { to: "/invitation", label: "모바일 청첩장", sub: "정보 입력 · 하객용 링크" },
        { to: "/ceremony", label: "식순", sub: `당일 진행표 · 음악 · 담당${(data.ceremony?.length ?? 0) > 0 ? ` · ${data.ceremony!.length}단계` : ""}` },
        { to: "/video", label: "식전영상", sub: "사진 · BGM · 자연어 편집" },
      ],
    },
    {
      title: "꾸준히 관리",
      items: [
        { to: "/checklist", label: "체크리스트", sub: checklistTotal > 0 ? `${checklistDone}/${checklistTotal} 완료 · ${progress}%` : "일정 · 할 일" },
        { to: "/budget", label: "비용 관리", sub: budgetCount > 0 ? `${budgetCount}개 항목` : "예산 · 결제 · 초과 비용" },
        { to: "/guests", label: "하객 명단", sub: guestCount > 0 ? `${guestCount}명 · 참석 ${guestAttending}` : "이름 · 축의금 · 식수" },
      ],
    },
    {
      title: "도구",
      items: [
        { to: "/share", label: "공유 센터", sub: "청첩장 · 초대 링크 · 백업" },
        {
          to: "/start-hosted",
          label: "함께 편집",
          sub: data.preferences.mode === "hosted" ? "편집·복구 링크" : "배우자 초대 · 다른 기기",
        },
        { to: "/ai", label: "AI 연결", sub: "복붙 모드 · API 키 · 로컬 LLM" },
      ],
    },
    {
      title: "설정 · 정보",
      items: [
        { to: "/settings", label: "설정", sub: "저장 방식 · 백업 · 로그인" },
        { to: "/setup", label: "직접 저장소", sub: "Supabase 직접 운영" },
        { to: "/trust", label: "투명성", sub: "운영자도 못 보는 구조" },
        { to: "/privacy", label: "개인정보 · 보안", sub: "처리방침 · 안내" },
        { to: "/contact", label: "문의", sub: "오류 신고 · 도움 요청" },
      ],
    },
  ];
}
