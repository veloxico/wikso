'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WpDatePickerProps {
  /** Value as `YYYY-MM-DDTHH:mm` (the same shape as `<input type="datetime-local">`). */
  value: string;
  onChange: (next: string) => void;
  /** Earliest selectable moment. Anything strictly before is disabled. */
  minDate?: Date;
  /** Placeholder shown when `value` is empty. */
  placeholder?: string;
  /** Format used in the trigger label. Defaults to `toLocaleString()`. */
  format?: (d: Date) => string;
  /** Optional id for label-association. */
  id?: string;
  /** Disable the picker entirely. */
  disabled?: boolean;
  /** Optional preset chips (label + factory). Defaults to In 1h / Tomorrow / Next week. */
  presets?: ReadonlyArray<{ label: string; build: () => Date }>;
  className?: string;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Pad number to 2 digits. */
const pad = (n: number) => String(n).padStart(2, '0');

/** Convert a Date → the `YYYY-MM-DDTHH:mm` string the input contract uses. */
function toLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse the contract string → Date, or null. */
function parseLocalString(s: string): Date | null {
  if (!s) return null;
  // Force local-time parsing — `new Date("2025-01-01T12:00")` already does this,
  // but normalise edge cases (some browsers return invalid for missing seconds).
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return isNaN(date.getTime()) ? null : date;
}

/** Default preset list — relative to "now" at click time. */
const DEFAULT_PRESETS: WpDatePickerProps['presets'] = [
  {
    label: 'In 1 hour',
    build: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    label: 'Tomorrow 9 AM',
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Next week',
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    },
  },
  {
    label: 'In 30 days',
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d;
    },
  },
];

/**
 * Warm-paper date+time picker. Same value contract as `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) so it drops in without changes to the consuming form state.
 *
 * Closes on outside-click and Escape. Arrow keys move within the day grid when open.
 */
export function WpDatePicker({
  value,
  onChange,
  minDate,
  placeholder = 'Pick a date…',
  format,
  id,
  disabled,
  presets = DEFAULT_PRESETS,
  className,
}: WpDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = useMemo(() => parseLocalString(value), [value]);

  // The month being viewed in the grid — independent of the selection, so the
  // user can browse around without changing what they've picked.
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parsed ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Keep the grid synced if the value flips externally while closed.
  // Deliberate setState-in-effect: the popover-month is derived from the
  // current value, but we don't want to disturb the user's browse position
  // while the popover is open.
  useEffect(() => {
    if (open) return;
    const d = parsed ?? new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [open, parsed]);

  // Time inputs are local strings so users can type "0" without it normalising.
  const [hourStr, setHourStr] = useState(() => pad(parsed?.getHours() ?? 12));
  const [minStr, setMinStr] = useState(() => pad(parsed?.getMinutes() ?? 0));

  // Re-sync the time inputs when the external value changes.
  useEffect(() => {
    if (parsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHourStr(pad(parsed.getHours()));
      setMinStr(pad(parsed.getMinutes()));
    }
  }, [parsed]);

  // ── Outside click + Escape ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Day grid (always 6 weeks for layout stability) ───────────────────────
  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = first.getDay(); // 0..6 (Sun-first)
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(1 - startOffset + i);
      days.push(d);
    }
    return days;
  }, [viewMonth]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const minDay = useMemo(() => {
    if (!minDate) return null;
    const m = new Date(minDate);
    m.setHours(0, 0, 0, 0);
    return m;
  }, [minDate]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // ── Commit helpers ───────────────────────────────────────────────────────
  const commitFromDay = useCallback(
    (day: Date) => {
      const h = Math.min(23, Math.max(0, Number(hourStr) || 0));
      const m = Math.min(59, Math.max(0, Number(minStr) || 0));
      const next = new Date(day);
      next.setHours(h, m, 0, 0);
      // Auto-bump if minDate would be violated when same day was clicked.
      if (minDate && next.getTime() < minDate.getTime()) {
        next.setTime(minDate.getTime());
        // Keep minutes on a clean increment.
        next.setSeconds(0, 0);
      }
      // If the click was on a leading/trailing other-month cell, follow
      // the user into that month so they don't have to re-orient. Only
      // shifts when the day actually belongs to a different month than
      // the currently-viewed one.
      if (
        day.getMonth() !== viewMonth.getMonth() ||
        day.getFullYear() !== viewMonth.getFullYear()
      ) {
        setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      }
      onChange(toLocalString(next));
    },
    [hourStr, minStr, minDate, viewMonth, onChange],
  );

  const commitFromTime = useCallback(
    (h: string, m: string) => {
      const base = parsed ?? today;
      const date = new Date(base);
      date.setHours(
        Math.min(23, Math.max(0, Number(h) || 0)),
        Math.min(59, Math.max(0, Number(m) || 0)),
        0,
        0,
      );
      // Honour minDate the same way commitFromDay does — otherwise a
      // user could type a past time on the day == minDate and bypass
      // the disabled-day grid validation.
      if (minDate && date.getTime() < minDate.getTime()) {
        date.setTime(minDate.getTime());
        date.setSeconds(0, 0);
      }
      onChange(toLocalString(date));
    },
    [parsed, today, minDate, onChange],
  );

  const handlePreset = useCallback(
    (build: () => Date) => {
      const d = build();
      // Round to nearest 5 minutes for tidier presets.
      d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
      onChange(toLocalString(d));
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange],
  );

  // ── Trigger label ────────────────────────────────────────────────────────
  const labelText = useMemo(() => {
    if (!parsed) return placeholder;
    if (format) return format(parsed);
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [parsed, placeholder, format]);

  const monthLabel = useMemo(
    () =>
      viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [viewMonth],
  );

  const shiftMonth = (delta: number) =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  // ── Keyboard nav inside the grid ─────────────────────────────────────────
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const focused = document.activeElement as HTMLElement | null;
    if (!focused?.dataset?.idx) return;
    const idx = Number(focused.dataset.idx);
    let target = idx;
    if (e.key === 'ArrowLeft') target = idx - 1;
    else if (e.key === 'ArrowRight') target = idx + 1;
    else if (e.key === 'ArrowUp') target = idx - 7;
    else if (e.key === 'ArrowDown') target = idx + 7;
    else return;
    e.preventDefault();
    const next = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-idx="${target}"]`,
    );
    next?.focus();
  };

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      {/* Trigger row — wrapper div so the clear "x" can sit as a sibling
          of the trigger button instead of nested inside (nested <button>
          is invalid HTML and breaks keyboard / a11y semantics). */}
      <div style={{ position: 'relative' }}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className="wp-dp-trigger"
          data-open={open ? 'true' : undefined}
          data-empty={!parsed ? 'true' : undefined}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          style={parsed && !disabled ? { paddingRight: 32 } : undefined}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Calendar
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: parsed ? 'var(--accent)' : 'var(--ink-4)' }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {labelText}
            </span>
          </span>
        </button>
        {parsed && !disabled ? (
          <button
            type="button"
            className="wp-dp-clear"
            onClick={handleClear}
            aria-label="Clear date"
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date and time"
          className="wp-datepicker"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
          }}
        >
          {/* Header: prev / month label / next */}
          <div className="wp-dp-head">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week strip */}
          <div className="wp-dp-grid" aria-hidden>
            {DOW.map((d, i) => (
              <div key={`${d}-${i}`} className="wp-dp-dow">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="wp-dp-grid" onKeyDown={onGridKey}>
            {grid.map((d, i) => {
              const isOther = d.getMonth() !== viewMonth.getMonth();
              const isToday = isSameDay(d, today);
              const isSelected = parsed ? isSameDay(d, parsed) : false;
              const isDisabled = minDay
                ? d.getTime() < minDay.getTime()
                : false;
              return (
                <button
                  key={i}
                  type="button"
                  className="wp-dp-day"
                  data-idx={i}
                  data-other={isOther ? 'true' : undefined}
                  data-today={isToday ? 'true' : undefined}
                  data-selected={isSelected ? 'true' : undefined}
                  data-disabled={isDisabled ? 'true' : undefined}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && commitFromDay(d)}
                  aria-pressed={isSelected}
                  aria-label={d.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div className="wp-dp-time">
            <span className="label">Time</span>
            <span className="digits">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Hour"
                maxLength={2}
                value={hourStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setHourStr(v);
                  if (v.length) commitFromTime(v, minStr);
                }}
                onBlur={() => {
                  const norm = pad(Math.min(23, Math.max(0, Number(hourStr) || 0)));
                  setHourStr(norm);
                  commitFromTime(norm, minStr);
                }}
              />
              <span className="colon">:</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Minute"
                maxLength={2}
                value={minStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setMinStr(v);
                  if (v.length) commitFromTime(hourStr, v);
                }}
                onBlur={() => {
                  const norm = pad(Math.min(59, Math.max(0, Number(minStr) || 0)));
                  setMinStr(norm);
                  commitFromTime(hourStr, norm);
                }}
              />
            </span>
          </div>

          {/* Presets — quick-select chips */}
          {presets && presets.length > 0 ? (
            <div className="wp-dp-presets">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="wp-dp-preset"
                  onClick={() => handlePreset(p.build)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
