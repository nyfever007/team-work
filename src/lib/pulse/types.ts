// Client-safe constants for the weekly anonymous 펄스 체크.

export const PULSE_WORKLOAD = [
  { value: 1, label: "여유", emoji: "🌤️" },
  { value: 2, label: "적당", emoji: "🙂" },
  { value: 3, label: "바쁨", emoji: "😐" },
  { value: 4, label: "벅참", emoji: "😣" },
  { value: 5, label: "과중", emoji: "🥵" },
] as const;

export const PULSE_MOOD = [
  { value: 1, label: "지침", emoji: "😞" },
  { value: 2, label: "별로", emoji: "😕" },
  { value: 3, label: "보통", emoji: "😐" },
  { value: 4, label: "좋음", emoji: "🙂" },
  { value: 5, label: "최고", emoji: "😄" },
] as const;

/** Team results (and comments) are shown only when at least this many teammates answered, so no one is identifiable. */
export const PULSE_MIN_RESPONSES = 3;

export const isPulseValue = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
