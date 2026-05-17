// idb:<id> · data: · http(s) 를 모두 받아 안전하게 렌더링.
// idb: 는 useImageSrc 가 blob: 으로 해석 → safeMediaSrc 통과.

import { useImageSrc } from "../lib/imageStore";
import { safeMediaSrc } from "../lib/security";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | undefined | null;
  /** 해석 실패/거절 시 표시할 폴백 (없으면 아무것도 안 그림) */
  fallback?: React.ReactNode;
};

export default function SafeImg({ src, fallback = null, alt = "", ...rest }: Props) {
  const resolved = useImageSrc(src);
  const safe = safeMediaSrc(resolved);
  if (!safe) return <>{fallback}</>;
  return <img src={safe} alt={alt} {...rest} />;
}
