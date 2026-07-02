import type { SearchLink } from "../lib/searchLinks";

export default function SearchLinks({ links, label }: { links: SearchLink[]; label?: string; }) {
  if (links.length === 0) return null;
  return (
    <div>
      {label && <div className="eyebrow mb-3">{label}</div>}
      <div className="flex gap-2 flex-wrap">
        {links.map((l) => (
          <span key={l.name} className="inline-flex max-w-[190px] flex-col gap-1">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center border border-hair bg-paper px-3 text-[12px] text-ink transition hover:border-ink hover:text-gold active:opacity-70"
            >
              {l.name} ↗
            </a>
            {l.note && <span className="text-[12px] leading-snug text-soft">{l.note}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
