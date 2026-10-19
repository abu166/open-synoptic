import type { CSSProperties } from "react";
import Glass from "../ui/GlassBentoCard";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import { beaufort, beaufortDescription } from "../../lib/meteorology/physics";
import { fmt, speed, speedLabel } from "../../lib/units/converter";
import { useWeatherStore } from "../../store/useWeatherStore";
export default function WindShearCompassCard({ weather: w }: PanelProps) {
  const c = w.current,
    u = useWeatherStore((s) => s.units),
    i = currentIndex(w),
    v80 = value(w.hourly, "wind_speed_80m", i),
    v120 = value(w.hourly, "wind_speed_120m", i);
  return (
    <Glass
      title="Feel the breeze. Read the gust."
      eyebrow="BOUNDARY LAYER"
      className="span-4 wind-card"
      style={
        {
          "--wind-duration": `${Math.max(1.2, 12 - c.wind_speed_10m / 5)}s`,
        } as CSSProperties
      }
    >
      <div className="wind-streamlines" aria-hidden="true">
        {Array.from({ length: 12 }, (_, j) => (
          <i
            key={j}
            style={{ top: `${j * 8}%`, animationDelay: `${-j * 0.7}s` }}
          />
        ))}
      </div>
      <p className="wind-human-note">
        {c.wind_gusts_10m > 40
          ? "A breeze with a temper. Keep a hand on loose layers."
          : c.wind_speed_10m > 18
            ? "You’ll notice it in your coat and on the ride home."
            : "A little movement in the leaves. A softer day to be outside."}
      </p>
      <div className="wind-content">
        <svg viewBox="0 0 200 200" className="wind-rose">
          <defs>
            <radialGradient id="rose">
              <stop stopColor="#83bce91a" />
              <stop offset="1" stopColor="#83bce900" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#rose)" />
          <circle
            cx="100"
            cy="100"
            r="87"
            fill="none"
            stroke="#d4f3ff55"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="100"
            r="74"
            fill="none"
            stroke="#a6dbf044"
            strokeWidth="1.5"
          />
          {[0, 1, 2].map((j) => (
            <circle
              className="gust-ripple"
              key={j}
              cx="100"
              cy="100"
              r="38"
              fill="none"
              stroke="#b2ebef"
              strokeWidth="1"
              style={{ animationDelay: `${j * 1.2}s` }}
            />
          ))}
          {Array.from({ length: 72 }, (_, j) => (
            <line
              key={j}
              x1="100"
              y1="18"
              x2="100"
              y2={j % 6 === 0 ? "27" : "22"}
              transform={`rotate(${j * 5} 100 100)`}
              stroke={j % 6 === 0 ? "#e0f4ff" : "#d2e9fa66"}
              strokeWidth={j % 6 === 0 ? 2 : 1}
            />
          ))}
          {["North", "East", "South", "West"].map((s, j) => (
            <text
              key={s === "North" ? "N" : s === "East" ? "E" : s === "South" ? "S" : "West"}
              x={100 + 94 * Math.sin((j * Math.PI) / 2)}
              y={104 - 94 * Math.cos((j * Math.PI) / 2)}
              textAnchor="middle"
              fontSize="13"
              fill={j === 0 ? "#ffe5b1" : "#d1e7f7"}
            >
              {s === "North" ? "N" : s === "East" ? "E" : s === "South" ? "S" : "West"}
            </text>
          ))}
          <g transform={`rotate(${c.wind_direction_10m} 100 100)`}>
            <g className="compass-needle-motion">
              <path d="M100 33L94 60h12Z" fill="#c0dbf8" />
              <path d="M100 167l-4-15h8Z" fill="#536a83" />
              <line x1="100" y1="53" x2="100" y2="70" stroke="#c0dbf8" />
            </g>
          </g>
          <text
            x="100"
            y="104"
            textAnchor="middle"
            fill="#e6edf7"
            fontSize="30"
            fontFamily="monospace"
          >
            {fmt(speed(c.wind_speed_10m, u))}
          </text>
          <text x="100" y="122" textAnchor="middle" fill="#8595a9" fontSize="9">
            {speedLabel(u)} · {fmt(c.wind_direction_10m)}°
          </text>
        </svg>
        <div className="wind-stats">
          <span>
            Peak gust
            <b className="numeric">
              {fmt(speed(c.wind_gusts_10m, u))}
              <small>{speedLabel(u)}</small>
            </b>
          </span>
          <span>
            Beaufort scale
            <b>
              {beaufort(c.wind_speed_10m)} <small>/ 12</small>
            </b>
          </span>
          <div className="status-pill">
            {beaufortDescription(c.wind_speed_10m)}
          </div>
        </div>
      </div>
      <div className="altitude-row altitude-tower">
        {[
          [10, c.wind_speed_10m],
          [80, v80],
          [120, v120],
        ].map(([alt, v]) => (
          <div key={alt}>
            <span>
              {alt} m ·{" "}
              {alt === 10
                ? "surface"
                : alt === 80
                  ? "drone / canopy"
                  : "upper mast"}
            </span>
            <div
              className="altitude-flow"
              style={
                {
                  "--flow-speed": `${Math.max(0.5, 8 - v / 8)}s`,
                } as CSSProperties
              }
            >
              {[0, 1, 2].map((j) => (
                <i key={j} style={{ animationDelay: `${-j * 0.7}s` }} />
              ))}
            </div>
            <div className="meter">
              <i style={{ width: `${Math.min(100, (v / 70) * 100)}%` }} />
            </div>
            <b>{fmt(speed(v, u))}</b>
          </div>
        ))}
      </div>
      <footer className="panel-note">
        80 m shear <b>{fmt(v80 - c.wind_speed_10m, 1)} km/h</b> above surface
      </footer>
    </Glass>
  );
}
