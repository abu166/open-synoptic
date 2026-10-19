import { useState } from "react";
import Glass from "../ui/GlassBentoCard";
import type { PanelProps } from "../../types/telemetry";
import { fmt } from "../../lib/units/converter";
export default function AirQualityPollenCard({ air, weather: w }: PanelProps) {
  const [tab, setTab] = useState(false),
    c = air?.current,
    aqi = c?.us_aqi;
  const label =
    aqi === undefined
      ? "Unavailable"
      : aqi <= 50
        ? "Clear air — room to breathe"
        : aqi <= 100
          ? "A little care in the air"
          : aqi <= 150
            ? "Sensitive groups"
            : aqi <= 200
              ? "Unhealthy"
              : "Very unhealthy";
  const color =
    aqi === undefined
      ? "#8191a4"
      : aqi <= 50
        ? "#8ccbb4"
        : aqi <= 100
          ? "#e0c487"
          : "#e4a39d";
  const keys = tab
    ? [
        "alder_pollen",
        "birch_pollen",
        "grass_pollen",
        "mugwort_pollen",
        "olive_pollen",
        "ragweed_pollen",
      ]
    : [
        "pm2_5",
        "pm10",
        "nitrogen_dioxide",
        "ozone",
        "sulphur_dioxide",
        "carbon_monoxide",
      ];
  const names = tab
    ? ["Alder", "Birch", "Grass", "Mugwort", "Olive", "Ragweed"]
    : ["PM₂.₅", "PM₁₀", "NO₂", "O₃", "SO₂", "CO"];
  return (
    <Glass
      title="Take a deeper breath."
      eyebrow="ATMOSPHERIC COMPOSITION"
      className="span-4"
      action={<span className="tiny-badge">CAMS</span>}
    >
      <div className="aqi-header">
        <svg width="115" height="92" viewBox="0 0 120 100">
          <path
            d="M15 80a48 48 0 1 1 90 0"
            fill="none"
            stroke="#ffffff0c"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M15 80a48 48 0 1 1 90 0"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${Math.min(100, ((aqi ?? 0) / 200) * 100)} 100`}
          />
          <text
            x="60"
            y="58"
            textAnchor="middle"
            fill="#e8eef5"
            fontSize="30"
            fontFamily="monospace"
          >
            {fmt(aqi ?? NaN)}
          </text>
          <text x="60" y="77" textAnchor="middle" fill="#8492a5" fontSize="8">
            US AQI
          </text>
        </svg>
        <div>
          <span className="status-pill" style={{ color }}>
            {label}
          </span>
          <p className="small muted">
            {aqi === undefined
              ? "Waiting for air-quality telemetry."
              : aqi <= 50
                ? "Air quality is satisfactory."
                : aqi <= 100
                  ? "Sensitive people: reduce prolonged exertion."
                  : "Limit strenuous outdoor activity."}
          </p>
          <span className="small muted">
            European AQI{" "}
            <b className="numeric">{fmt(c?.european_aqi ?? NaN)}</b>
          </span>
        </div>
      </div>
      <div className="chart-tabs compact">
        <button
          className={!tab ? "selected" : ""}
          onClick={() => setTab(false)}
        >
          Pollutants
        </button>
        <button className={tab ? "selected" : ""} onClick={() => setTab(true)}>
          Bio-allergens
        </button>
      </div>
      <div className="pollutant-grid" key={tab ? "pollen" : "pollution"}>
        {keys.map((k, j) => {
          const n = c?.[k];
          const points = (air?.hourly[k] as (number | null)[] | undefined)
            ?.filter((v): v is number => typeof v === "number")
            .slice(
              Math.max(
                0,
                air?.hourly.time.findIndex(
                  (t) => +new Date(t) >= w.current.time * 1000,
                ) ?? 0,
              ),
              Math.max(
                0,
                air?.hourly.time.findIndex(
                  (t) => +new Date(t) >= w.current.time * 1000,
                ) ?? 0,
              ) + 24,
            );
          const lo = points ? Math.min(...points) : 0,
            hi = points ? Math.max(...points) : 1;
          return (
            <div key={k}>
              <span>{names[j]}</span>
              <b className="numeric">
                {fmt(n ?? NaN, 1)}
                <small>{tab ? "gr/m³" : "µg/m³"}</small>
              </b>
              {points && points.length > 1 && (
                <svg className="pollutant-spark" viewBox="0 0 70 15">
                  <polyline
                    points={points
                      .map(
                        (n, j) =>
                          `${(j / (points.length - 1)) * 70},${14 - ((n - lo) / (hi - lo || 1)) * 12}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth=".8"
                    opacity=".5"
                  />
                </svg>
              )}
              <div className="meter">
                <i
                  style={{
                    width: `${n == null ? 0 : Math.min(100, (n / (tab ? 100 : j === 5 ? 1000 : 100)) * 100)}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <footer className="panel-note">
        AOD <b>{fmt(c?.aerosol_optical_depth ?? NaN, 2)}</b>
        <span>
          Dust <b>{fmt(c?.dust ?? NaN, 1)} µg/m³</b>
        </span>
      </footer>
      {tab && (
        <p className="small muted">
          Pollen coverage is regional; — means unavailable.
        </p>
      )}
    </Glass>
  );
}
