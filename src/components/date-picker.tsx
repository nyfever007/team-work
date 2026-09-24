"use client";

import { useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange, Matcher } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Date keys are YYYY-MM-DD (Asia/Seoul) everywhere; the picker works in local Date objects.
// Convert with local getters so a key never shifts by a day across time zones.
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function keyToDate(key: string | null | undefined): Date | undefined {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function label(d: Date, withYear: boolean) {
  return `${withYear ? `${d.getFullYear()}년 ` : ""}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;

// Sunday red / Saturday blue, like the app's other calendars.
const WEEKEND = { sunday: { dayOfWeek: [0] }, saturday: { dayOfWeek: [6] } };
const WEEKEND_CLASS = { sunday: "text-red-600", saturday: "text-blue-600" };

type Common = {
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Earliest / latest selectable key. */
  min?: string;
  max?: string;
  "aria-invalid"?: boolean;
};

function bounds(min?: string, max?: string): Matcher[] {
  const out: Matcher[] = [];
  const lo = keyToDate(min);
  const hi = keyToDate(max);
  if (lo) out.push({ before: lo });
  if (hi) out.push({ after: hi });
  return out;
}

function Trigger({ id, disabled, empty, text, className, invalid }: { id?: string; disabled?: boolean; empty: boolean; text: string; className?: string; invalid?: boolean }) {
  return (
    <PopoverTrigger asChild>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-invalid={invalid}
        className={cn("h-9 w-full justify-start gap-2 px-3 font-normal", empty && "text-muted-foreground", className)}
      >
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className="truncate">{text}</span>
      </Button>
    </PopoverTrigger>
  );
}

type SingleProps = Common & {
  /** Hidden input name for form submission. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
  /** Year/month dropdowns, for far-away dates such as 입사일. */
  dropdown?: boolean;
};

/** Single date. Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). */
export function DatePicker({ name, value, defaultValue, onChange, dropdown, id, disabled, placeholder = "날짜 선택", className, min, max, ...rest }: SingleProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const key = value ?? inner;
  const selected = keyToDate(key);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={key} />}
      <Trigger id={id} disabled={disabled} empty={!selected} text={selected ? label(selected, true) : placeholder} className={className} invalid={rest["aria-invalid"]} />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ko}
          selected={selected}
          defaultMonth={selected}
          captionLayout={dropdown ? "dropdown" : "label"}
          startMonth={dropdown ? new Date(1990, 0) : undefined}
          endMonth={dropdown ? new Date(new Date().getFullYear() + 2, 11) : undefined}
          disabled={bounds(min, max)}
          modifiers={WEEKEND}
          modifiersClassNames={WEEKEND_CLASS}
          onSelect={(d) => {
            if (!d) return;
            const k = dateToKey(d);
            setInner(k);
            onChange?.(k);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export type KeyRange = { start: string; end: string };

type RangeProps = Common & {
  /** Hidden input names for form submission. */
  startName?: string;
  endName?: string;
  value?: KeyRange;
  defaultValue?: Partial<KeyRange>;
  onChange?: (range: KeyRange) => void;
  /** Months shown side by side (2 on wide screens). */
  months?: 1 | 2;
};

/**
 * Start/end range in one popover. First click = start, second = end (clicking the same day twice = one day).
 * Submits `startName` / `endName` hidden inputs so server actions keep reading the same fields.
 */
export function DateRangePicker({ startName, endName, value, defaultValue, onChange, months = 2, id, disabled, placeholder = "기간 선택", className, min, max, ...rest }: RangeProps) {
  const [inner, setInner] = useState<Partial<KeyRange>>(defaultValue ?? {});
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const cur = value ?? inner;
  const from = keyToDate(cur.start);
  const to = keyToDate(cur.end);
  const selected: DateRange | undefined = draft ?? (from ? { from, to: to ?? from } : undefined);

  const text = from ? (to && dateToKey(to) !== dateToKey(from) ? `${label(from, false)} ~ ${label(to, from.getFullYear() !== to.getFullYear())} · ${days(from, to)}일` : `${label(from, false)} · 1일`) : placeholder;

  const commit = (r: KeyRange) => {
    setInner(r);
    onChange?.(r);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Closing with only a start picked commits a one-day range rather than losing the click.
        if (!o && draft?.from && !draft.to) commit({ start: dateToKey(draft.from), end: dateToKey(draft.from) });
        if (!o) setDraft(undefined);
      }}
    >
      {startName && <input type="hidden" name={startName} value={cur.start ?? ""} />}
      {endName && <input type="hidden" name={endName} value={cur.end ?? cur.start ?? ""} />}
      <Trigger id={id} disabled={disabled} empty={!from} text={text} className={className} invalid={rest["aria-invalid"]} />
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span>{draft?.from && !draft.to ? "종료일을 선택하세요" : "시작일을 선택하세요"}</span>
          {from && (
            <span className="font-medium text-foreground tabular-nums">
              {draft?.from ? label(draft.from, false) : text}
            </span>
          )}
        </div>
        <Calendar
          mode="range"
          locale={ko}
          numberOfMonths={months}
          selected={selected}
          defaultMonth={from}
          disabled={bounds(min, max)}
          modifiers={WEEKEND}
          modifiersClassNames={WEEKEND_CLASS}
          onSelect={(_, day) => {
            // Every pick starts from a clean slate: first click = start, second click = end.
            if (!draft) {
              setDraft({ from: day, to: undefined });
              return;
            }
            const start = draft.from!;
            const [a, b] = day < start ? [day, start] : [start, day];
            setDraft(undefined);
            commit({ start: dateToKey(a), end: dateToKey(b) });
            setOpen(false);
          }}
        />
        {from && (
          <div className="flex justify-end border-t px-2 py-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
              <XIcon />
              닫기
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
