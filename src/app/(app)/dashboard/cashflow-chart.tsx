"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { month: string; income: number; outgoing: number; net: number };

export function CashflowChart({ data }: { data: P[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-3)", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--color-ink-3)", fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip
            cursor={{ fill: "var(--color-mute-soft)" }}
            contentStyle={{ border: "1px solid var(--color-line)", background: "var(--color-surface)", color: "var(--color-ink)", borderRadius: 8, boxShadow: "none", fontSize: 12, direction: "rtl" }}
            formatter={(v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
          <Bar dataKey="income" name="الوارد" fill="var(--color-navy)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="outgoing" name="المنصرف" fill="var(--color-line-strong)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Line dataKey="net" name="صافي الأتعاب" stroke="var(--color-orange)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-orange)", strokeWidth: 0 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
