import { useEffect, useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";

type FieldKind = "text" | "textarea" | "number" | "date" | "select";

type FieldOption = {
  value: string;
  label: string;
};

export type ResearchField<T extends object> = {
  key: Extract<keyof T, string>;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  options?: FieldOption[];
  span?: "full" | "half";
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
};

export type ResearchSection<T extends object> = {
  title: string;
  helper?: string;
  fields: ResearchField<T>[];
};

type Props<T extends object> = {
  title?: string;
  subtitle?: string;
  rawPlaceholder: string;
  draft: T;
  sections: ResearchSection<T>[];
  onDraftChange: (next: T) => void;
  onParse: (raw: string) => Partial<T>;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  applyHint?: string;
  defaultOpen?: boolean;
};

export default function ResearchInputPanel<T extends object>({
  title = "자료 붙여넣기",
  subtitle = "후기·견적·홈페이지 내용을 붙이면 필요한 칸만 먼저 채웁니다.",
  rawPlaceholder,
  draft,
  sections,
  onDraftChange,
  onParse,
  onApply,
  applyLabel = "확인한 내용 저장",
  applyDisabled = false,
  applyHint,
  defaultOpen = false,
}: Props<T>) {
  const [open, setOpen] = useState(defaultOpen);
  const [raw, setRaw] = useState("");
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const fields = useMemo(() => sections.flatMap((section) => section.fields), [sections]);
  const filledCount = fields.filter((field) => hasValue(draft[field.key])).length;

  useEffect(() => {
    if (parsedCount !== null && filledCount > 0) setFieldsOpen(true);
  }, [filledCount, parsedCount]);

  const setField = (field: ResearchField<T>, rawValue: string) => {
    const parsedNumber = Number(rawValue);
    const value = field.kind === "number"
      ? (rawValue === "" || !Number.isFinite(parsedNumber) ? undefined : parsedNumber)
      : (rawValue === "" ? undefined : rawValue);
    onDraftChange({ ...draft, [field.key]: value } as T);
  };

  const runParse = () => {
    if (!raw.trim()) {
      setParsedCount(0);
      return;
    }
    const parsed = compactPatch(onParse(raw));
    setParsedCount(Object.keys(parsed).length);
    onDraftChange({ ...draft, ...parsed });
  };

  return (
    <div className="border-y border-hair py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left"
        aria-expanded={open}
      >
          <span>
            <span className="eyebrow-gold block mb-1">{title}</span>
            <span className="text-[13px] text-soft leading-relaxed">
            {filledCount > 0 ? `채운 칸 ${filledCount}/${fields.length}` : subtitle}
          </span>
        </span>
        <span className="text-[12px] text-soft underline underline-offset-4">
          {open ? "접기" : "열기"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <div className="space-y-3">
            <div>
              <div className="section-title">원문 붙여넣기</div>
              <p className="mt-1 text-[12px] leading-relaxed text-soft break-keep">
                붙여넣은 내용에서 확인 가능한 칸만 채웁니다.
              </p>
            </div>
            <textarea
              className="input-boxed text-[14px] min-h-[126px]"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder={rawPlaceholder}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={runParse} className="btn-primary px-4 py-2 text-[13px]">
                읽고 칸 채우기
              </button>
              {raw && (
                <button
                  type="button"
                  onClick={() => {
                    setRaw("");
                    setParsedCount(null);
                  }}
                  className="btn-ghost text-[12px]"
                >
                  원문 지우기
                </button>
              )}
            </div>
            <p className="text-[12px] text-soft leading-relaxed">
              원문은 저장하지 않고, 확인한 사실·출처·계약 조건만 남깁니다.
              {parsedCount !== null && (
                <span className="text-ink"> 방금 {parsedCount}개 칸을 읽었어요.</span>
              )}
            </p>
          </div>

          <details
            open={fieldsOpen}
            onToggle={(event) => setFieldsOpen(event.currentTarget.open)}
            className="border-y border-hair py-3"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
              <span>
                <span className="section-title">채운 내용 확인·수정</span>
                <span className="mt-1 block text-[12px] text-soft">
                  직접 입력도 가능하지만, 필요한 칸만 열어 확인하면 됩니다.
                </span>
              </span>
              <span className="text-[12px] text-soft underline underline-offset-4">
                {fieldsOpen ? "접기" : "열기"}
              </span>
            </summary>
            <div className="mt-4 space-y-5">
              {sections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <div>
                    <div className="section-title">{section.title}</div>
                    {section.helper && <p className="mt-1 text-[12px] text-soft leading-relaxed">{section.helper}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {section.fields.map((field) => (
                      <ResearchFieldControl
                        key={field.key}
                        field={field}
                        value={draft[field.key]}
                        onChange={(next) => setField(field, next)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </details>

          {onApply && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={onApply}
                disabled={applyDisabled}
                className="btn-primary w-full py-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {applyLabel}
              </button>
              {applyDisabled && applyHint && (
                <p className="text-[11.5px] text-soft leading-relaxed">{applyHint}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResearchFieldControl<T extends object>({
  field,
  value,
  onChange,
}: {
  field: ResearchField<T>;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const kind = field.kind ?? "text";
  const className = field.span === "half" && kind !== "textarea" ? "" : "col-span-2";
  return (
    <div className={className}>
      <label className="label">{field.label}</label>
      {kind === "textarea" ? (
        <textarea
          className="input-boxed text-[12.5px] min-h-[52px]"
          value={stringValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      ) : kind === "select" ? (
        <select
          className="input text-[13px]"
          value={stringValue(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">미정</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={kind}
          inputMode={field.inputMode}
          className="input text-[13px]"
          value={stringValue(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  return String(value);
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function compactPatch<T extends object>(value: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (typeof entry === "string") return entry.trim().length > 0;
      return true;
    }),
  ) as Partial<T>;
}
