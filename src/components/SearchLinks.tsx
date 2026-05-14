import type { SearchLink } from "../lib/searchLinks";

export default function SearchLinks({ links, label }: { links: SearchLink[]; label?: string; }) {
  if (links.length === 0) return null;
  return (
    <div>
      {label && <div className="text-xs text-soft mb-2">{label}</div>}
      <div className="flex gap-2 flex-wrap">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener"
            className="text-xs px-3 py-2 rounded-lg bg-cream border border-line active:bg-line"
          >
            {l.name} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
