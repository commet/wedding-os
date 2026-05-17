import type { SearchLink } from "../lib/searchLinks";

export default function SearchLinks({ links, label }: { links: SearchLink[]; label?: string; }) {
  if (links.length === 0) return null;
  return (
    <div>
      {label && <div className="eyebrow mb-3">{label}</div>}
      <div className="flex gap-4 flex-wrap">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-ink underline underline-offset-4 hover:text-gold"
          >
            {l.name} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
