'use client';

/** Big, tappable radio group. Used for condition, age band and fruit quality. */
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n';

export function ChoiceGroup({
  legendKey,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legendKey: MessageKey;
  options: ReadonlyArray<{
    value: string;
    labelKey: MessageKey;
    hintKey?: MessageKey;
    color?: string;
  }>;
  value: string;
  onChange: (value: string) => void;
  columns?: number;
}) {
  const t = useT();
  const legend = t(legendKey);

  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={legend}
      >
        {options.map((option) => {
          const hint = option.hintKey ? t(option.hintKey) : '';
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              onClick={() => onChange(option.value)}
              className={`flex min-h-14 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition ${
                value === option.value
                  ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-600/30'
                  : 'border-stone-300 bg-white hover:border-stone-400'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                {option.color ? (
                  <span
                    aria-hidden
                    className="size-3 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: option.color }}
                  />
                ) : null}
                {t(option.labelKey)}
              </span>
              {hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
