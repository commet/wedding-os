// 업체/브랜드 카드 공통 액션 — 구글 검색 / 인스타 검색 / 카카오맵 / (선택) 공식 사이트.
// 정확한 공식 URL을 따로 안 적어도, 사용자가 한 번에 들어갈 수 있는 안정적 진입점들.

type Props = {
  name: string;          // 업체/브랜드명 (필수)
  query?: string;        // 검색에 사용할 추가 키워드 (예: 반지 모델)
  region?: string;       // 카카오맵 검색에 도움
  officialUrl?: string;  // 공식 사이트 (있으면)
  size?: "sm" | "xs";
};

export default function VendorActions({ name, query, region, officialUrl, size = "xs" }: Props) {
  const fullQuery = query ? `${name} ${query}` : name;
  const mapQuery = region ? `${name} ${region}` : name;
  // 인스타는 explore/tags 패턴이 비로그인 상태에서도 200. 핸들 추측보다 안전.
  // 태그는 공백·괄호 제거된 핵심 이름만.
  const tag = name.replace(/\([^)]*\)/g, "").replace(/[\s·]+/g, "").trim();
  const google = `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`;
  const instagram = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
  const kakaoMap = `https://map.kakao.com/link/search/${encodeURIComponent(mapQuery)}`;

  const cls = size === "sm"
    ? "text-xs px-2.5 py-1.5"
    : "text-[11px] px-2 py-1";

  return (
    <div className="flex gap-1.5 flex-wrap">
      {officialUrl && (
        <a href={officialUrl} target="_blank" rel="noopener"
           className={`${cls} rounded-md bg-gold/10 border border-gold/30 text-gold`}>
          🏠 공식
        </a>
      )}
      <a href={google} target="_blank" rel="noopener"
         className={`${cls} rounded-md bg-white border border-line text-soft`}>
        🌐 구글
      </a>
      <a href={instagram} target="_blank" rel="noopener"
         className={`${cls} rounded-md bg-white border border-line text-soft`}>
        📷 인스타
      </a>
      <a href={kakaoMap} target="_blank" rel="noopener"
         className={`${cls} rounded-md bg-white border border-line text-soft`}>
        🗺️ 지도
      </a>
    </div>
  );
}
