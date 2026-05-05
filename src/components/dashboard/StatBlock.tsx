export const StatBlock = ({ index, label, value, suffix }: { index: string; label: string; value: string; suffix?: string }) => (
  <div className="p-8 bg-white border-r-2 border-b-2 border-lapis last:border-r-0 md:[&:nth-child(3)]:border-r-0">
    <span className="font-mono text-xs uppercase text-muted-foreground">{index} // {label}</span>
    <div className="mt-4 flex items-baseline gap-2">
      <span className="text-5xl font-extrabold tracking-tighter text-lapis">{value}</span>
      {suffix && <span className="font-mono text-sm font-bold tracking-tighter text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);
