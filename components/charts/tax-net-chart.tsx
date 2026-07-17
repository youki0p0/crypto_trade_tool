"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import type { TaxSimulation } from "@/types/database";
import { formatJPY } from "@/lib/utils";

export function TaxNetChart({ data }: { data: TaxSimulation[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        保存された税シミュレーションがありません。税シミュレーターで結果を保存してください。
      </div>
    );
  }

  // 古い順に並べて推移として表示
  const chartData = [...data]
    .reverse()
    .map((s, i) => ({
      label: format(new Date(s.created_at), "MM/dd"),
      key: `${i}`,
      net: s.net_profit,
      tax: s.tax_amount,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={72}
          tickFormatter={(v) => `${Math.round(Number(v) / 10000)}万`}
        />
        <Tooltip
          formatter={(v: number | string, name) => [
            formatJPY(Number(v)),
            name === "net" ? "手取り" : "税額",
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="net" stackId="a" fill="hsl(var(--profit))" name="net" radius={[0, 0, 0, 0]} />
        <Bar dataKey="tax" stackId="a" fill="hsl(var(--loss))" name="tax" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
