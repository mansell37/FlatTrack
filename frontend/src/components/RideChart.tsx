export interface Sample {
  p?: number; // power, watts
  c?: number; // cadence, rpm
  t?: number; // ERG target at sample time, watts
  b?: number; // workout block index at sample time
}

const W = 1000;

function path(values: (number | undefined)[], max: number, h: number): string {
  const pts: string[] = [];
  const n = values.length;
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n <= 1 ? 0 : (i / (n - 1)) * W;
    const y = h - Math.min(1, v / max) * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(" ");
}

function Strip({
  values,
  target,
  max,
  h,
  cls,
  colorVar,
  title,
  unit,
  latest,
}: {
  values: (number | undefined)[];
  target?: (number | undefined)[];
  max: number;
  h: number;
  cls: string;
  colorVar: string;
  title: string;
  unit: string;
  latest: number | null;
}) {
  return (
    <div className={`strip ${cls}`}>
      <div className="strip-head">
        <span className="strip-title" style={{ color: `var(${colorVar})` }}>● {title}</span>
        <span className="strip-latest">
          {latest != null ? `${latest} ${unit}` : ""}
        </span>
        <span className="strip-max">max {Math.round(max)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="strip-svg">
        {/* recessive quartile gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={h * f} y2={h * f} className="gridline" vectorEffect="non-scaling-stroke" />
        ))}
        {target && (
          <polyline
            points={path(target, max, h)}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
        )}
        <polyline
          points={path(values, max, h)}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * Live ride telemetry: power (with the dashed ERG target) and cadence as two
 * stacked strips, each on its own scale — never a dual-axis overlay.
 */
export default function RideChart({ samples }: { samples: Sample[] }) {
  if (samples.length < 2) {
    return (
      <div className="ride-chart empty muted">
        Power &amp; cadence chart appears as you ride…
      </div>
    );
  }

  const powers = samples.map((s) => s.p);
  const targets = samples.map((s) => s.t);
  const cadences = samples.map((s) => s.c);
  const maxP = Math.max(150, ...powers.map((v) => v ?? 0), ...targets.map((v) => v ?? 0)) * 1.05;
  const maxC = Math.max(100, ...cadences.map((v) => v ?? 0)) * 1.1;
  const last = <T,>(a: (T | undefined)[]) => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i] as T;
    return null;
  };

  return (
    <div className="ride-chart">
      <Strip
        values={powers}
        target={targets}
        max={maxP}
        h={190}
        cls="pwr"
        colorVar="--chart-pwr"
        title="Power"
        unit="W"
        latest={last(powers)}
      />
      <Strip
        values={cadences}
        max={maxC}
        h={90}
        cls="cad"
        colorVar="--chart-cad"
        title="Cadence"
        unit="rpm"
        latest={last(cadences) != null ? Math.round(last(cadences)!) : null}
      />
      <div className="ride-chart-legend">
        <span className="lg" style={{ color: "var(--chart-pwr)" }}>● Power</span>
        <span className="lg muted">╌ Target</span>
        <span className="lg" style={{ color: "var(--chart-cad)" }}>● Cadence</span>
      </div>
    </div>
  );
}
