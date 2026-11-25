"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { month: string; income: number; outgoing: number; net: number };

export function CashflowChart({ data }: { data: P[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "none", fontSize: 12, direction: "rtl" }}
            formatter={(v) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, direction: "rtl" }} />
          <Bar dataKey="income" name="الوارد" fill="#204f89" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="outgoing" name="المنصرف" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Line dataKey="net" name="صافي الأتعاب" stroke="#f15a27" strokeWidth={2} dot={{ r: 3, fill: "#f15a27", strokeWidth: 0 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
