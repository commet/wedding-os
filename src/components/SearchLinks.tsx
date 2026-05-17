import type { SearchLink } from "../lib/searchLinks";

export default function SearchLinks({ links, label }: { links: SearchLink[]; label?: string; }) {
  if (links.length === 0) return null;
  return (
    <div>
      {label && <div className="eyebrow mb-3">{label}</div>}
      <div className="flex gap-4 flex-wrap">
        {links.map((l) => (
          <span key={l.name} className="inline-flex flex-col gap-1">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-ink underline underline-offset-4 hover:text-gold"
            >
              {l.name} ↗
            </a>
            {l.note && <span className="text-[10.5px] leading-snug text-soft max-w-[180px]">{l.note}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
