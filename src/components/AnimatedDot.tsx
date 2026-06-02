interface AnimatedDotProps {
  key?: string | number;
  cx?: number;
  cy?: number;
  payload?: { week_number?: number };
  highlightWeek?: number;
}

export default function AnimatedDot({ key: _key, cx, cy, payload, highlightWeek }: AnimatedDotProps) {
  if (payload?.week_number !== highlightWeek) {
    return <circle cx={cx} cy={cy} r={4} fill="#0f766e" />;
  }

  return (
    <>
      <defs>
        <filter id="liveDataGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={5} fill="#0f766e" filter="url(#liveDataGlow)">
        <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </>
  );
}
