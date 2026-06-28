// 한글 제목 줄바꿈 다듬기.
//
// 원리: word-break:keep-all 은 어절(띄어쓰기) 중간을 안 끊고, text-wrap:balance 는
// 줄 길이를 균등화하지만, "한 명씩" 처럼 1음절 어절이 다음 어절과 의미적으로 한 덩어리인
// 경우를 보장하지 못한다. 그래서 줄 끝에 "한" 만 외톨이로 남는 일이 생긴다.
//
// 한국어 조판 관용을 코드로:
//   1) 1음절 어절은 다음 어절과 비분리 공백(NBSP)으로 붙인다. (관형사/수사/부사: 한, 두, 그, 이, 저, 더, 못, 안, 잘 …)
//   2) 마지막 어절이 1~2음절이면 직전 어절과 붙인다. (끝줄 orphan 방지)
// 이렇게 하면 "한 명씩 적어보세요" 는 항상 "한 명씩" 이 같은 줄에 머문다.

const NBSP = " ";

export function koBreak(text: string): string {
  if (!text || text.includes("\n")) return text; // 의도된 줄바꿈이 있으면 건드리지 않는다
  const words = text.split(" ").filter((w) => w.length > 0);
  if (words.length < 2) return text;

  let out = words[0];
  for (let i = 1; i < words.length; i++) {
    const prevLen = [...words[i - 1]].length;
    const curLen = [...words[i]].length;
    const isLast = i === words.length - 1;
    const glue = prevLen <= 1 || (isLast && curLen <= 2);
    out += (glue ? NBSP : " ") + words[i];
  }
  return out;
}
