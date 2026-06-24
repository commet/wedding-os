import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import {
  AGENT_REFERENCE_LINKS,
  buildAgentReport,
  type AgentFinding,
  type AgentSeverity,
} from "../lib/agentAdvisor";

type Props = { data: WeddingData };

const CATEGORY_LABELS: Record<AgentFinding["category"], string> = {
  legal: "법무",
  privacy: "개인정보",
  money: "비용",
  schedule: "일정",
  content: "콘텐츠",
  security: "보안",
  data: "데이터",
};

const SEVERITY_META: Record<AgentSeverity, { label: string; cls: string; dot: string }> = {
  danger: { label: "즉시 확인", cls: "text-gold", dot: "bg-gold" },
  warn: { label: "주의", cls: "text-ink", dot: "bg-ink" },
  info: { label: "대기", cls: "text-soft", dot: "bg-soft" },
  good: { label: "정상", cls: "text-sage", dot: "bg-sage" },
};

export default function Agent({ data }: Props) {
  const report = buildAgentReport(data);
  const priority = report.findings.filter((f) => f.severity === "danger" || f.severity === "warn");
  const ok = report.findings.filter((f) => f.severity === "good");

  return (
    <div className="page pt-8 pb-10 space-y-9">
      <header>
        <div className="eyebrow-gold mb-2">Wedding Agent</div>
        <h1 className="font-serif text-[2rem] leading-none">에이전트 점검</h1>
        <p className="text-[12.5px] text-soft leading-relaxed mt-4">
          법무·개인정보·저작권·비용·일정을 한 번에 훑습니다. 법률 자문은 아니며,
          실제 운영자 정보와 계약서는 최종 확인이 필요합니다.
        </p>
      </header>

      <section className="border-y border-hair py-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="eyebrow mb-2">Risk score</div>
            <div className="font-serif text-[4rem] leading-none tabular-nums">
              {report.score}
              <span className="text-[1rem] text-soft font-sans ml-1">/100</span>
            </div>
          </div>
          <div className="text-right text-[12px] leading-relaxed">
            <p className="text-gold">즉시 확인 {report.danger}</p>
            <p className="text-ink">주의 {report.warn}</p>
            <p className="text-sage">정상 {report.good}</p>
          </div>
        </div>
        <div className="h-2 bg-line overflow-hidden">
          <div className="h-full bg-ink transition-all" style={{ width: `${report.score}%` }} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="section-title">먼저 볼 항목</h2>
          <span className="eyebrow tabular-nums">{priority.length}개</span>
        </div>
        <div className="border-y border-hair divide-y divide-hair">
          {priority.length > 0 ? (
            priority.map((finding) => <FindingRow key={finding.id} finding={finding} />)
          ) : (
            <p className="py-6 text-[12.5px] text-soft">지금 바로 처리할 위험 항목은 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <details open>
          <summary className="list-none cursor-pointer flex items-baseline justify-between gap-4 min-h-11">
            <span className="section-title">전체 자동 점검 14개</span>
            <span className="text-[12px] text-soft underline underline-offset-4">펼쳐보기</span>
          </summary>
          <div className="mt-4 border-y border-hair divide-y divide-hair">
            {report.findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} compact />
            ))}
          </div>
        </details>
      </section>

      <section className="border-y border-hair py-5">
        <h2 className="section-title mb-3">정상 항목</h2>
        <div className="grid grid-cols-2 gap-3">
          {ok.slice(0, 6).map((finding) => (
            <div key={finding.id} className="bg-cream/40 p-3">
              <div className="eyebrow-gold mb-2">{CATEGORY_LABELS[finding.category]}</div>
              <p className="font-serif text-[15px] text-ink leading-tight">{finding.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">운영 전 참고 링크</h2>
        <ul className="border-y border-hair divide-y divide-hair">
          {AGENT_REFERENCE_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 py-3.5 text-[12.5px] text-ink active:opacity-70"
              >
                <span>{link.label}</span>
                <span className="text-soft">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FindingRow({ finding, compact = false }: { finding: AgentFinding; compact?: boolean }) {
  const meta = SEVERITY_META[finding.severity];
  const body = (
    <div className={`py-4 ${compact ? "" : "active:opacity-70"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 flex-shrink-0 ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className={`eyebrow ${meta.cls}`}>{meta.label}</span>
            <span className="eyebrow-gold">{CATEGORY_LABELS[finding.category]}</span>
            {typeof finding.count === "number" && (
              <span className="eyebrow tabular-nums">{finding.count}</span>
            )}
          </div>
          <h3 className="font-serif text-[16px] text-ink leading-tight">{finding.title}</h3>
          <p className="text-[12.5px] text-ink/85 leading-relaxed mt-1.5">{finding.summary}</p>
          {!compact && (
            <p className="text-[11.5px] text-soft leading-relaxed mt-2">{finding.detail}</p>
          )}
        </div>
        {finding.to && <span className="text-soft pt-1 flex-shrink-0">→</span>}
      </div>
    </div>
  );

  if (!finding.to) return body;
  return (
    <Link to={finding.to} className="block">
      {body}
      {!compact && finding.action && (
        <span className="sr-only">{finding.action}</span>
      )}
    </Link>
  );
}
