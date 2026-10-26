import { z } from "zod";

export const taxModeSchema = z.enum(["current_progressive", "separate_2028"]);

export const taxFormSchema = z.object({
  cryptoProfit: z
    .number({ invalid_type_error: "数値を入力してください" })
    .finite("有効な数値を入力してください"),
  otherIncome: z
    .number({ invalid_type_error: "数値を入力してください" })
    .min(0, "0以上で入力してください")
    .finite("有効な数値を入力してください"),
  mode: taxModeSchema,
});

export type TaxFormValues = z.infer<typeof taxFormSchema>;

export const TAX_MODE_LABELS: Record<z.infer<typeof taxModeSchema>, string> = {
  current_progressive: "現行・総合課税（累進）",
  separate_2028: "2028年以降・分離課税 20.315%（想定）",
};
