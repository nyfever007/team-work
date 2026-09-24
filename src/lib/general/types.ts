// Client-safe constants for 일반 품의서.

export const VAT_MODES = ["included", "excluded", "none"] as const;
export type VatMode = (typeof VAT_MODES)[number];
export const VAT_LABEL: Record<VatMode, string> = { included: "VAT 포함", excluded: "VAT 별도", none: "VAT 해당 없음" };

/** 보존기간 in years; 0 = 영구. The printed row lists all of them with the chosen one checked. */
export const RETENTIONS = [1, 2, 3, 5, 0] as const;
export type Retention = (typeof RETENTIONS)[number];
export const RETENTION_LABEL: Record<Retention, string> = { 1: "1년", 2: "2년", 3: "3년", 5: "5년", 0: "영구" };

export function isRetention(v: unknown): v is Retention {
  return typeof v === "number" && (RETENTIONS as readonly number[]).includes(v);
}

/** Currencies for 금액. `amount` is stored in the currency's minor unit (원, cents…) so decimals never hit a float. */
export const CURRENCIES = ["KRW", "USD", "EUR", "JPY", "CNY", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_INFO: Record<Currency, { label: string; decimals: number }> = {
  KRW: { label: "원 (KRW)", decimals: 0 },
  USD: { label: "달러 (USD)", decimals: 2 },
  EUR: { label: "유로 (EUR)", decimals: 2 },
  JPY: { label: "엔 (JPY)", decimals: 0 },
  CNY: { label: "위안 (CNY)", decimals: 2 },
  GBP: { label: "파운드 (GBP)", decimals: 2 },
};

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** "1,250.50" from minor units. */
export function formatAmount(minor: number | null | undefined, currency: Currency): string {
  if (minor == null) return "";
  const d = CURRENCY_INFO[currency].decimals;
  return (minor / 10 ** d).toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Parse "1,250.5" → minor units (125050 for USD), or null for empty; NaN when invalid. */
export function parseAmount(text: string, currency: Currency): number | null {
  const t = text.replace(/[,\s]/g, "");
  if (!t) return null;
  const d = CURRENCY_INFO[currency].decimals;
  const re = d ? new RegExp(`^\\d+(\\.\\d{1,${d}})?$`) : /^\d+$/;
  if (!re.test(t)) return NaN;
  return Math.round(Number(t) * 10 ** d);
}

/** "1,100,000 원 (VAT 포함)" · "USD 1,250.50 (VAT 별도)" · "" when no amount. */
export function amountLine(minor: number | null, currency: Currency, vat: VatMode): string {
  if (minor == null) return "";
  const n = formatAmount(minor, currency);
  const base = currency === "KRW" ? `${n} 원` : `${currency} ${n}`;
  return `${base}${vat === "none" ? "" : ` (${VAT_LABEL[vat]})`}`;
}
