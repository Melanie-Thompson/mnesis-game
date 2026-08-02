import { ATB_MAX } from "../game/useGameStore";

export default function AtbClock({ atb, ready, size = 32 }: { atb: number; ready: boolean; size?: number }) {
  const pad = size * 0.28;
  const totalH = size + pad + size * 0.08;
  const cx = size / 2;
  const cy = pad + size / 2;
  const r = size / 2 - 2;
  const tickR = r - 3;
  const handLen = r - 6;
  const pct = Math.min(atb / ATB_MAX, 1);
  const angle = pct * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const hx = cx + handLen * Math.cos(rad);
  const hy = cy + handLen * Math.sin(rad);
  const color = ready ? "#50e850" : "#206020";

  const bellR = r * 0.28;
  const bellOffset = r * 0.52;
  const bellY = cy - r + bellR * 0.15;
  const hammerR = r * 0.07;

  function bellArc(bcx: number): string {
    const x1 = bcx - bellR;
    const x2 = bcx + bellR;
    return `M ${x1},${bellY} A ${bellR},${bellR} 0 0 1 ${x2},${bellY}`;
  }

  return (
    <svg
      width={size}
      height={totalH}
      viewBox={`0 0 ${size} ${totalH}`}
      style={{ flexShrink: 0 }}
    >
      {/* Left bell */}
      <g className={ready ? "atb-bell-left" : ""} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={bellArc(cx - bellOffset)} fill={color} opacity={0.7} />
      </g>
      {/* Right bell */}
      <g className={ready ? "atb-bell-right" : ""} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={bellArc(cx + bellOffset)} fill={color} opacity={0.7} />
      </g>
      {/* Hammer */}
      <line x1={cx} y1={cy - r} x2={cx} y2={bellY - bellR - hammerR} stroke={color} strokeWidth={1} />
      <circle cx={cx} cy={bellY - bellR - hammerR} r={hammerR} fill={color} />

      {/* Clock face */}
      <circle cx={cx} cy={cy} r={r} fill="#060806" stroke={color} strokeWidth={1.5} />

      {/* Tick marks */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * (Math.PI / 180);
        const isMajor = i % 3 === 0;
        const outerR = tickR;
        const innerR = isMajor ? tickR - 4 : tickR - 2;
        return (
          <line
            key={i}
            x1={cx + innerR * Math.cos(a)}
            y1={cy + innerR * Math.sin(a)}
            x2={cx + outerR * Math.cos(a)}
            y2={cy + outerR * Math.sin(a)}
            stroke={color}
            strokeWidth={isMajor ? 1.5 : 0.8}
            strokeLinecap="round"
          />
        );
      })}

      {/* Hand */}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2} fill={color} />

      {/* Legs */}
      <line x1={cx - r * 0.55} y1={cy + r - 1} x2={cx - r * 0.7} y2={cy + r + 4} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={cx + r * 0.55} y1={cy + r - 1} x2={cx + r * 0.7} y2={cy + r + 4} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
