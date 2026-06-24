type Props = {
  /** 장소명 또는 주소 — 좌표 없이 텍스트로 검색해 임베드한다. */
  query: string;
  /** 지도 높이 (Tailwind h-* 클래스). 기본 h-44. */
  heightClass?: string;
  label?: string;
};

/**
 * 키 없는 구글 지도 임베드.
 * 구글 레거시 공개 엔드포인트(maps?q=...&output=embed)는 API 키·계정 없이 동작하고,
 * 좌표가 없어도 장소명/주소 텍스트로 검색해 보여준다. (CSP frame-src 에 허용됨)
 * 운영자/사용자 키를 코드에 박지 않는다는 원칙에 부합.
 */
export default function MapEmbed({ query, heightClass = "h-44", label }: Props) {
  const q = query.trim();
  if (!q) return null;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&hl=ko&output=embed`;
  return (
    <div className="border border-hair bg-cream/30">
      <iframe
        src={src}
        title={label ?? `${q} 지도`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={`block w-full ${heightClass} border-0`}
      />
    </div>
  );
}
