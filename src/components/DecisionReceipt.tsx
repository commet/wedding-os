import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import {
  decisionAgreement,
  decisionReceiptForSection,
  type DecisionReceipt as DecisionReceiptModel,
  type ReceiptTone,
} from "../lib/decisionReceipts";
import type { DecisionSection } from "../lib/derived";

type Props = {
  data?: WeddingData;
  receipt?: DecisionReceiptModel;
  sectionId?: DecisionSection;
  defaultOpen?: boolean;
  className?: string;
};

const TONE_LABEL: Record<ReceiptTone, string> = {
  ready: "정리됨",
  watch: "확인 중",
  blocked: "막힘",
};

export default function DecisionReceipt({ data, receipt, sectionId, defaultOpen = false, className = "" }: Props) {
  const model = receipt ?? (data && sectionId ? decisionReceiptForSection(data, sectionId) : undefined);
  if (!model) return null;
  const agreement = decisionAgreement(model);

  return (
    <details data-decision-receipt className={`decision-receipt decision-receipt-${model.tone} ${className}`} open={defaultOpen}>
      <summary className="decision-receipt-summary">
        <span className="min-w-0">
          <span className="decision-receipt-kicker">
            <span>결정 영수증</span>
            <span className={`decision-receipt-stamp decision-receipt-stamp-${model.tone}`}>{model.stamp}</span>
          </span>
          <span className="decision-receipt-title">{model.decision}</span>
          <span className="decision-receipt-meta">{model.title} · {TONE_LABEL[model.tone]}</span>
        </span>
        <span className="decision-receipt-toggle" aria-hidden="true">열기</span>
      </summary>

      <div className="decision-receipt-body">
        <div className="decision-agreement" data-decision-agreement>
          <div className="decision-agreement-head">
            <span className="decision-agreement-kicker">{agreement.title}</span>
            <strong>{agreement.question}</strong>
          </div>
          <div className="decision-agreement-grid">
            <div className="decision-agreement-evidence">
              <span>{agreement.evidenceLabel}</span>
              <b>{agreement.evidence}</b>
            </div>
            <div className="decision-agreement-options">
              {agreement.choices.map((choice) => (
                <button key={choice} type="button">{choice}</button>
              ))}
            </div>
          </div>
          <p className="decision-agreement-boundary">{agreement.boundary}</p>
        </div>

        <div className="decision-receipt-grid">
          <ReceiptColumn label="이미 아는 것" values={model.reasons} />
          <ReceiptColumn label="오늘 확인할 것" values={model.openQuestions} accent />
        </div>

        <div className="decision-perspectives" aria-label="관점별 확인">
          {model.perspectives.map((perspective) => (
            <div key={`${model.sectionId}-${perspective.key}`} className={`decision-perspective decision-perspective-${perspective.tone ?? model.tone}`}>
              <span className="decision-perspective-label">{perspective.label}</span>
              <span className="decision-perspective-summary">{perspective.summary}</span>
            </div>
          ))}
        </div>

        <div className="decision-receipt-action">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-soft">다음 행동</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink break-keep">{model.nextAction}</p>
          </div>
          <Link to={model.to} className="decision-receipt-link">
            이동
          </Link>
        </div>
      </div>
    </details>
  );
}

function ReceiptColumn({ label, values, accent = false }: { label: string; values: string[]; accent?: boolean }) {
  return (
    <div className={`decision-receipt-column ${accent ? "decision-receipt-column-accent" : ""}`}>
      <div className={accent ? "eyebrow-gold" : "eyebrow"}>{label}</div>
      <ul className="mt-2 space-y-1.5">
        {values.slice(0, 4).map((value) => (
          <li key={value} className="text-[12.5px] leading-relaxed text-ink/85 break-keep">
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
