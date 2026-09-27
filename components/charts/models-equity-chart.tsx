"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { MODEL_COLORS } from "@/lib/models/colors";
import type { BacktestResult } from "@/lib/models/backtest";
import type { ModelDef } from "@/lib/models/types";

/**
 * 各モデルの資産曲線を「初期資金=100」に正規化して重ね描き。
 */
export function ModelsEquityChart({
  results,
  models,
}: {
  results: BacktestResult[];
  models: ModelDef[];
}) {
  if (results.length === 0 || results[0].equityCurve.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        バックテストを実行するとここに資産推移が表示されます。
      </div>
    );
  }

  const nameById = Object.fromEntries(models.map((m) => [m.id, m.name]));
  const len = results[0].equityCurve.length;
  const data: Record<string, number | string>[] = [];
  for (let i = 0; i < len; i++) {
    const row: Record<string, number | string> = {
      label: format(new Date(results[0].equityCurve[i].time), "MM/dd"),
    };
    for (const r of results) {
      const base = r.initialCapital || 1;
      const pt = r.equityCurve[i];
      if (pt) row[r.modelId] = Number(((pt.equity / base) * 100).toFixed(2));
    }
    data.push(row);
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={28} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={44}
          tickFormatter={(v) => `${v}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number | string, key) => [`${v}`, nameById[key as string] ?? key]}
        />
        <Legend
          formatter={(key) => nameById[key as string] ?? key}
          wrapperStyle={{ fontSize: 12 }}
        />
        {results.map((r) => (
          <Line
            key={r.modelId}
            type="monotone"
            dataKey={r.modelId}
            stroke={MODEL_COLORS[r.modelId] ?? "#888"}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
