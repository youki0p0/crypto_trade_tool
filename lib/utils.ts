import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 数値を日本円表記に整形（例: ¥1,234,567） */
export function formatJPY(value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
    ...opts,
  }).format(Number.isFinite(value) ? value : 0);
}

/** USDT / 一般数値の整形 */
export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatUSDT(value: number, digits = 2): string {
  return `${formatNumber(value, digits)} USDT`;
}

/** パーセント整形（0.2031 -> 20.31%） */
export function formatPercent(ratio: number, digits = 2): string {
  return `${formatNumber(ratio * 100, digits)}%`;
}
