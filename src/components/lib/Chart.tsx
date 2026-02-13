import React from 'react';

interface ChartProps {
  title: string;
  labels: string[];
  values: number[];
  variant?: 'bar' | 'line';
}

const BAR_WIDTHS = ['w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'];

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((value) => Math.max(0, Math.min(1, value / max)));
}

export const Chart: React.FC<ChartProps> = ({ title, labels, values, variant = 'bar' }) => {
  const data = labels.map((label, index) => ({
    label,
    value: values[index] ?? 0,
  }));
  const normalized = normalize(data.map((item) => item.value));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="text-xs uppercase tracking-wide text-slate-500">{variant} chart</span>
      </header>
      {variant === 'bar' ? (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid grid-cols-[100px_1fr] items-center gap-3 text-sm">
              <span className="text-slate-600">{item.label}</span>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full bg-blue-600 ${BAR_WIDTHS[Math.min(BAR_WIDTHS.length - 1, Math.floor(normalized[index] * 4))]}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4">
          <svg viewBox="0 0 200 60" className="h-24 w-full" aria-hidden="true">
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              points={normalized
                .map((value, index) => {
                  const x = (index / Math.max(1, normalized.length - 1)) * 190 + 5;
                  const y = 50 - value * 40;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
            {normalized.map((value, index) => {
              const x = (index / Math.max(1, normalized.length - 1)) * 190 + 5;
              const y = 50 - value * 40;
              return <circle key={`point-${index}`} cx={x} cy={y} r={3} fill="#2563eb" />;
            })}
          </svg>
          <div className="mt-3 flex justify-between text-xs text-slate-500">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
