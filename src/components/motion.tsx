"use client";

import { MotionConfig, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

/** Honours the OS "reduce motion" setting for every motion component below it. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + slight rise on mount. `delay` in seconds for simple staggering. */
export function FadeIn({ delay = 0, y = 8, className, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return <motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay }} className={className} {...props} />;
}

/** Horizontal progress bar that animates to `value` (0–1). */
export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn("h-full rounded-full bg-success", barClassName)} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: EASE }} />
    </div>
  );
}

/** Circular progress (0–1) with a centred label. */
export function ProgressRing({ value, size = 72, stroke = 7, children, className }: { value: number; size?: number; stroke?: number; children?: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-brand/12" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          className={v >= 1 ? "stroke-success" : "stroke-brand"}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
