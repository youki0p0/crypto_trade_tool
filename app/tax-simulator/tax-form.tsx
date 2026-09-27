"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  taxFormSchema,
  type TaxFormValues,
  TAX_MODE_LABELS,
} from "@/lib/tax/schema";
import { calculateTax } from "@/lib/tax/calc";
import { formatJPY, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Check, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TaxForm() {
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<TaxFormValues>({
    resolver: zodResolver(taxFormSchema),
    mode: "onChange",
    defaultValues: {
      cryptoProfit: 1_000_000,
      otherIncome: 4_000_000,
      mode: "current_progressive",
    },
  });

  const values = watch();

  const result = useMemo(() => {
    return calculateTax({
      cryptoProfit: Number(values.cryptoProfit) || 0,
      otherIncome: Number(values.otherIncome) || 0,
      mode: values.mode,
    });
  }, [values.cryptoProfit, values.otherIncome, values.mode]);

  // 保存状態
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error" | "unauth"
  >("idle");

  async function handleSave() {
    setSaveState("saving");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaveState("unauth");
        return;
      }
      const { error } = await supabase.from("tax_simulations").insert({
        user_id: user.id,
        crypto_profit: Number(values.cryptoProfit) || 0,
        other_income: Number(values.otherIncome) || 0,
        tax_mode: values.mode,
        tax_amount: Math.round(result.taxAmount),
        net_profit: Math.round(result.netProfit),
      });
      if (error) throw error;
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 入力 */}
      <Card>
        <CardHeader>
          <CardTitle>入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="cryptoProfit">暗号資産の想定年間利益（円）</Label>
            <Input
              id="cryptoProfit"
              type="number"
              inputMode="numeric"
              step={10000}
              {...register("cryptoProfit", { valueAsNumber: true })}
            />
            {errors.cryptoProfit && (
              <p className="text-xs text-destructive">
                {errors.cryptoProfit.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              損失はマイナスで入力（例: -300000）。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherIncome">
              他の課税所得（給与所得控除後などの概算・円）
            </Label>
            <Input
              id="otherIncome"
              type="number"
              inputMode="numeric"
              step={10000}
              {...register("otherIncome", { valueAsNumber: true })}
            />
            {errors.otherIncome && (
              <p className="text-xs text-destructive">
                {errors.otherIncome.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              分離課税モードでは結果に影響しません。
            </p>
          </div>

          <div className="space-y-2">
            <Label>税率モード</Label>
            <div className="grid gap-2">
              {(
                Object.keys(TAX_MODE_LABELS) as (keyof typeof TAX_MODE_LABELS)[]
              ).map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    value={mode}
                    {...register("mode")}
                    className="accent-primary"
                  />
                  {TAX_MODE_LABELS[mode]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 結果 */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>シミュレーション結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResultRow
              label="概算税額"
              value={formatJPY(result.taxAmount)}
              tone="loss"
            />
            <ResultRow
              label="手取り利益"
              value={formatJPY(result.netProfit)}
              tone="profit"
              emphasize
            />
            <ResultRow
              label="実効税率"
              value={formatPercent(result.effectiveRate)}
            />

            <Separator />
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">内訳（概算）</p>
              <div className="flex justify-between">
                <span>所得税{values.mode === "current_progressive" ? "（限界差分）" : "（15%）"}</span>
                <span>{formatJPY(result.breakdown.incomeTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>復興特別所得税</span>
                <span>{formatJPY(result.breakdown.reconstructionTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>住民税</span>
                <span>{formatJPY(result.breakdown.residentTax)}</span>
              </div>
            </div>

            <Separator />
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saveState === "saving"} className="gap-2">
                {saveState === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saveState === "saved" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                結果を保存
              </Button>
              {saveState === "saved" && (
                <span className="text-sm text-[hsl(var(--profit))]">保存しました</span>
              )}
              {saveState === "unauth" && (
                <span className="text-sm text-muted-foreground">
                  保存にはログインが必要です
                </span>
              )}
              {saveState === "error" && (
                <span className="text-sm text-destructive">保存に失敗しました</span>
              )}
            </div>
          </CardContent>
        </Card>

        {values.mode === "separate_2028" && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              2028年以降の分離課税（20.315%）は{" "}
              <strong>議論段階の想定であり未確定</strong>です。実際の税制は変わる可能性があります。
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ※ 本結果は概算です。各種所得控除・社会保険料控除・均等割・損益通算の細則は
          考慮していません。正確な申告は国税庁の情報や税理士にご確認ください。
        </p>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
  emphasize?: boolean;
}) {
  const color =
    tone === "profit"
      ? "text-[hsl(var(--profit))]"
      : tone === "loss"
        ? "text-[hsl(var(--loss))]"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-bold tabular-nums ${color} ${emphasize ? "text-2xl" : "text-lg"}`}
      >
        {value}
      </span>
    </div>
  );
}
