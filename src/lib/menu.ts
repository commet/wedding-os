import type { WeddingData } from "./schema";
import { PLANNING_STATE_LABEL, planningStatusReport } from "./derived";

export type MenuItem = { to: string; label: string; sub: string };
export type MenuGroup = { title: string; items: MenuItem[] };

/**
 * 전역 메뉴의 단일 소스 — Dashboard 의 접이식 메뉴와 AppShell 의 "더보기" 시트가
 * 같은 정의를 공유한다. sub 카운트가 data 에 의존하므로 함수로 만든다.
 *
 * 메뉴 순서는 실제 결혼 준비 흐름을 따른다. 홈의 상태판은 "다음 행동"을 보여주고,
 * 이 메뉴는 어디로 이동할지 고르는 전체 지도 역할만 한다.
 */
export function buildMenuGroups(data: WeddingData): MenuGroup[] {
  const snapCount = data.sdm.filter((v) => v.category === "snap").length;
  const status = planningStatusReport(data);
  const byKey = new Map(status.sections.map((section) => [section.key, section]));
  const sub = (key: string, fallback: string) => {
    const section = byKey.get(key);
    if (!section) return fallback;
    return `${PLANNING_STATE_LABEL[section.state]} · ${section.detail}`;
  };

  return [
    {
      title: "01 시작 기준",
      items: [
        { to: "/invitation", label: "기본 정보·청첩장", sub: sub("basics", "이름 · 날짜 · 장소") },
        { to: "/budget", label: "예산", sub: sub("budget", "전체 비용 · 결제") },
        { to: "/checklist", label: "체크리스트", sub: sub("checklist", "준비 리듬 · 마감") },
      ],
    },
    {
      title: "02 후보 결정",
      items: [
        { to: "/venues", label: "예식장", sub: sub("venues", "후보 비교 · 답사") },
        { to: "/sdm", label: "스드메", sub: sub("sdm", "스튜디오 · 드레스 · 메이크업") },
        { to: "/snap", label: "본식 스냅", sub: sub("snap", snapCount > 0 ? `${snapCount}곳 담음` : "당일 촬영 · 원판 · 앨범") },
        { to: "/rings", label: "결혼반지", sub: sub("rings", "취향 후보 · 가격") },
        { to: "/trip", label: "신혼여행", sub: sub("trip", "지역 · 항공 · 숙소") },
      ],
    },
    {
      title: "03 초대 관리",
      items: [
        { to: "/guests", label: "하객", sub: sub("guests", "명단 · 회신 · 식수") },
        { to: "/share", label: "공유/백업", sub: sub("share", "공유 링크 · 백업") },
      ],
    },
    {
      title: "04 본식 당일",
      items: [
        { to: "/ceremony", label: "식순", sub: sub("ceremony", "진행표 · 음악 · 담당") },
        { to: "/video", label: "식전 영상", sub: sub("video", "사진 · BGM · 미리보기") },
      ],
    },
    {
      title: "05 설정",
      items: [
        {
          to: "/start-hosted",
          label: "함께 편집",
          sub: data.preferences.mode === "hosted" ? "편집·복구 링크" : "배우자 초대 · 다른 기기",
        },
        { to: "/ai", label: "AI 연결", sub: "복붙 모드 · API 키 · 로컬 LLM" },
        { to: "/settings", label: "설정", sub: "저장 방식 · 백업 · 로그인" },
      ],
    },
  ];
}
