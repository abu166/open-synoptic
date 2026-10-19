import {
  todayMean,
  type Climate,
  type PanelProps,
} from "../../types/telemetry";
import { approximateClimate } from "../../api/resilience";
import Glass from "../ui/GlassBentoCard";
import { fmt } from "../../lib/units/converter";
export default function ClimateAnomalyCard({
  weather: w,
  city,
  climate,
}: { climate?: Climate; loading: boolean; error: boolean } & PanelProps) {
  const c =
      climate ?? approximateClimate(city, new Date(w.current.time * 1000)),
    estimate = c.source === "estimated",
    delta = todayMean(w) - c.mean;
  return (
    <Glass
      title="A longer perspective"
      eyebrow={
        estimate ? "SEASONAL CONTEXT · ESTIMATED" : "TEN-YEAR CLIMATE CONTEXT"
      }
      className="span-4 climate-card"
    >
      <div className="climate-number">
        <b className="numeric">
          {delta > 0 ? "+" : ""}
          {fmt(delta, 1)}°
        </b>
        <span>
          {delta >= 0 ? "warmer" : "cooler"} than{" "}
          {estimate ? "the seasonal reference" : "the date’s ten-year mean"}
        </span>
      </div>
      <p className="small">
        {estimate
          ? "A latitude, elevation and season guide while the archive catches up."
          : `${c.years} calendar-date samples · ${c.period} · ${c.source === "cached" ? "saved archive" : "ERA5 archive"}`}
      </p>
      <div className="climate-track">
        <span>
          {estimate
            ? "ILLUSTRATIVE SEASONAL RANGE"
            : "CALENDAR-DATE ARCHIVE RANGE"}
        </span>
        <div>
          <i
            style={{
              left: `${Math.max(0, Math.min(100, ((todayMean(w) - c.low) / (c.high - c.low || 1)) * 100))}%`,
            }}
          />
        </div>
        <p>
          <span>
            {fmt(c.low)}°
            <small>{estimate ? "LOWER RANGE" : "BASELINE LOW"}</small>
          </span>
          <span>
            {fmt(c.mean, 1)}°<small>DAILY MEAN</small>
          </span>
          <span>
            {fmt(c.high)}°
            <small>{estimate ? "UPPER RANGE" : "BASELINE HIGH"}</small>
          </span>
        </p>
      </div>
      <footer className="panel-note">
        {estimate
          ? "Seasonal estimates are approximate; archive-derived comparisons appear automatically when retrieved."
          : `Typical range: ${fmt(c.normalLow, 1)}° to ${fmt(c.normalHigh, 1)}° · same calendar date, ${c.period}`}
      </footer>
    </Glass>
  );
}
