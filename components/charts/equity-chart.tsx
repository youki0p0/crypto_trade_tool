"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import type { EquityPoint } from "@/lib/data/portfolio";
import { formatUSDT } from "@/lib/utils";

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length <= 1) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        決済済みの取引がまだありません。取引を決済すると資産推移が表示されます。
      </div>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    label: format(new Date(p.date), "MM/dd HH:mm"),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={72}
          tickFormatter={(v) => `${Math.round(Number(v)).toLocaleString()}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v: number | string) => [formatUSDT(Number(v)), "総資産"]}
          labelClassName="text-xs"
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="equity"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
