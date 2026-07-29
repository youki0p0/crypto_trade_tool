import { z } from "zod";

export const TRADABLE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;

export const orderSchema = z
  .object({
    symbol: z.enum(TRADABLE_SYMBOLS),
    side: z.enum(["long", "short"]),
    type: z.enum(["market", "limit"]),
    quantity: z.coerce
      .number()
      .positive("数量は正の数で入力してください")
      .finite(),
    leverage: z.coerce
      .number()
      .min(1, "レバレッジは1以上")
      .max(20, "レバレッジは最大20倍"),
    limitPrice: z.coerce.number().positive().finite().optional(),
  })
  .refine((v) => v.type !== "limit" || (v.limitPrice != null && v.limitPrice > 0), {
    message: "指値注文には指値価格が必要です",
    path: ["limitPrice"],
  });

export type OrderInput = z.infer<typeof orderSchema>;

export const SYMBOL_LABELS: Record<(typeof TRADABLE_SYMBOLS)[number], string> = {
  BTCUSDT: "BTC/USDT",
  ETHUSDT: "ETH/USDT",
  SOLUSDT: "SOL/USDT",
};
