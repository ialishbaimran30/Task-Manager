export default function GaugeRing({ percentage = 0, status = "Safe", size = 150 }) {
  const clamped = Math.min(percentage, 100);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const colorMap = {
    Safe: "var(--accent)",
    Warning: "var(--warn)",
    Critical: "var(--warn)",
    "Budget Exceeded": "var(--danger)",
  };
  const ringColor = colorMap[status] || "var(--accent)";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${ringColor})`,
            transition: "stroke-dashoffset 0.6s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="mono" style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          {clamped.toFixed(0)}%
        </span>
        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
          used
        </span>
      </div>
    </div>
  );
}