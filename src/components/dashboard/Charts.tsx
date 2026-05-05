import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LAPIS = "hsl(220 65% 22%)";
const ORANGE = "hsl(18 100% 50%)";
const PALETTE = [LAPIS, ORANGE, "hsl(220 50% 45%)", "hsl(40 80% 55%)", "hsl(220 30% 65%)", "hsl(0 60% 50%)"];

export const TrendChart = ({ rows, xKey, yKey }: { rows: any[]; xKey: string; yKey: string }) => {
  const data = rows.slice(0, 50).map((r) => ({ x: String(r[xKey]).slice(0, 12), y: Number(r[yKey]) || 0 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid stroke={LAPIS} strokeOpacity={0.1} />
        <XAxis dataKey="x" stroke={LAPIS} fontSize={10} tickLine={false} />
        <YAxis stroke={LAPIS} fontSize={10} tickLine={false} />
        <Tooltip contentStyle={{ background: "white", border: `2px solid ${LAPIS}`, borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
        <Line type="monotone" dataKey="y" stroke={ORANGE} strokeWidth={2.5} dot={{ fill: LAPIS, r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const DistChart = ({ rows, key1 }: { rows: any[]; key1: string }) => {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = String(r[key1] ?? "—");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const data = Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid stroke={LAPIS} strokeOpacity={0.1} />
        <XAxis dataKey="name" stroke={LAPIS} fontSize={10} angle={-30} textAnchor="end" interval={0} />
        <YAxis stroke={LAPIS} fontSize={10} />
        <Tooltip contentStyle={{ background: "white", border: `2px solid ${LAPIS}`, borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
        <Bar dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const PiePanel = ({ rows, key1 }: { rows: any[]; key1: string }) => {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const k = String(r[key1] ?? "—");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const data = Array.from(counts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label={{ fontSize: 10, fontFamily: "JetBrains Mono" }}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "white", border: `2px solid ${LAPIS}`, borderRadius: 0, fontFamily: "JetBrains Mono", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};
