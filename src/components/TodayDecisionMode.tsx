import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { decisionAgreement, todayDecisions, type ReceiptTone } from "../lib/decisionReceipts";

const TONE_COPY: Record<ReceiptTone, { label: string; verb: string }> = {
  ready: { label: "결론 직전", verb: "확정하기" },
  watch: { label: "확인 필요", verb: "확인하기" },
  blocked: { label: "막힘 해소", verb: "풀어내기" },
};

export default function TodayDecisionMode({ data }: { data: WeddingData }) {
  const items = todayDecisions(data, undefined, 4);
  if (items.length === 0) return null;
  const [primary, ...rest] = items;
  const agreement = decisionAgreement(primary);
  const tone = TONE_COPY[primary.tone];
  const question = primary.openQuestions[0] ?? agreement.question;
  const reason = primary.reasons[0] ?? primary.todayReason;
  const secondaryReason = primary.reasons[1] ?? agreement.evidence;
  const firstChoice = agreement.choices[0] ?? primary.nextAction;
  const secondChoice = agreement.choices[1] ?? primary.nextAction;

  return (
    <section className="today-decision-mode" data-today-decision-mode>
      <div className="today-decision-head">
        <div className="min-w-0">
          <div className="home-kicker">오늘의 정리</div>
          <h2 className="today-decision-heading">오늘 닫을 결정 하나</h2>
        </div>
        <span className={`today-decision-state today-decision-state-${primary.tone}`}>{tone.label}</span>
      </div>

      <Link to={primary.to} className="today-decision-primary row-tap" aria-label={`${primary.decision} ${tone.verb}`}>
        <span className="min-w-0">
          <span className="today-decision-section">{primary.title}</span>
          <span className="today-decision-title">{primary.decision}</span>
          <span className="today-decision-reason">{agreement.question}</span>
        </span>
        <span aria-hidden="true" className="today-decision-arrow">→</span>
      </Link>

      <div className="today-decision-brief" aria-label="오늘 결정 판단 기준">
        <div>
          <span>근거</span>
          <b>{reason}</b>
        </div>
        <div>
          <span>오늘 확인</span>
          <b>{question}</b>
        </div>
        <div>
          <span>넘기지 말 것</span>
          <b>{agreement.boundary}</b>
        </div>
      </div>

      <div className="today-decision-choice" aria-label="오늘 선택지">
        <span>{firstChoice}</span>
        <span>{secondChoice}</span>
      </div>

      <div className="today-decision-footer">
        <span>{secondaryReason}</span>
        <Link to={primary.to}>{primary.nextAction}</Link>
      </div>

      {rest.length > 0 && (
        <div className="today-decision-queue" aria-label="다음 후보 결정">
          {rest.slice(0, 3).map((item) => (
            <Link key={item.sectionId} to={item.to} className="today-decision-chip">
              <span>{item.stamp}</span>
              <b>{item.nextAction}</b>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
