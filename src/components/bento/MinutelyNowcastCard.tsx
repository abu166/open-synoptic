import { CloudRain, Eye, Wind, Sun } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import WeatherIcon from "../ui/WeatherIcon";
import { value, currentIndex, type PanelProps } from "../../types/telemetry";
import { fmt, temperature } from "../../lib/units/converter";
import { useWeatherStore } from "../../store/useWeatherStore";
export default function MinutelyNowcastCard({ weather: w }: PanelProps) {
  const u = useWeatherStore((s) => s.units),
    now = w.current.time * 1000,
    start = Math.max(
      0,
      w.minutely_15.time.findIndex(
        (t) => +new Date(t) >= Math.floor(now / 900000) * 900000,
      ),
    ),
    rows = w.minutely_15.time
      .slice(start, start + 9)
      .map((t, j) => ({ t, i: start + j })),
    rates = rows.map((r) => value(w.minutely_15, "precipitation", r.i) * 4),
    max = Math.max(...rates.filter(Number.isFinite), 0),
    peak = rates.indexOf(max),
    i = currentIndex(w);
  const skyRows = Array.from({ length: 9 }, (_, j) => {
    const timestamp = now + j * 900000,
      hi = Math.min(w.hourly.time.length - 1, i + Math.floor(j / 4)),
      mi = rows[j]?.i;
    return {
      timestamp,
      cloud: value(w.hourly, "cloud_cover", hi),
      code: value(w.hourly, "weather_code", hi),
      day: value(w.hourly, "is_day", hi),
      temp:
        mi === undefined
          ? value(w.hourly, "temperature_2m", hi)
          : value(w.minutely_15, "temperature_2m", mi),
      gust:
        mi === undefined
          ? value(w.hourly, "wind_gusts_10m", hi)
          : value(w.minutely_15, "wind_gusts_10m", mi),
      visibility:
        mi === undefined
          ? value(w.hourly, "visibility", hi)
          : value(w.minutely_15, "visibility", mi),
    };
  });
  return (
    <Glass
      title={
        max > 0.01 ? "Rain has a rhythm." : "A little window of possibility."
      }
      eyebrow="YOUR NEXT TWO HOURS"
      className="span-8 nowcast-card"
      action={<CloudRain size={23} />}
    >
      <div className="nowcast-status">
        <span className="live-dot" />
        {max > 0.01
          ? `Precipitation peaks in ${Math.max(0, Math.round((+new Date(rows[peak].t) - now) / 60000))} minutes`
          : "Dry skies. Make a little room for outside."}
      </div>
      <p className="small">
        {max > 0.01
          ? `Peak equivalent intensity: ${fmt(max, 1)} mm/h. Explore each quarter hour below.`
          : "Follow the small changes in light, cloud, temperature, and the breeze."}
      </p>
      {max > 0.01 ? (
        <div className="precip-graph">
          <div className="graph-axis">
            <span>{fmt(max, 1)}</span>
            <span>mm/h</span>
            <span>0</span>
          </div>
          <div className="precip-bars">
            {rows.map((r, j) => (
              <div
                key={r.t}
                title={`${fmt(rates[j], 2)} mm/h · Snow ${fmt(value(w.minutely_15, "snowfall", r.i) * 4, 1)} cm/h · Visibility ${fmt(value(w.minutely_15, "visibility", r.i) / 1000, 1)} km`}
              >
                <span
                  style={{ height: `${Math.max(2, (rates[j] / max) * 100)}%` }}
                />
                <small>{j % 2 === 0 ? `${j * 15}m` : ""}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="microclimate-strip">
            {skyRows.map((r, j) => (
              <div
                className={`micro-sky ${r.day ? "" : "night"}`}
                key={r.timestamp}
                title={`Cloud ${fmt(r.cloud)}% · Gusts ${fmt(r.gust)} km/h · Visibility ${fmt(r.visibility / 1000, 1)} km`}
              >
                <span>{j === 0 ? "Now" : `${j * 15} min`}</span>
                <WeatherIcon code={r.code} night={!r.day} size={40} />
                <strong className="numeric">
                  {fmt(temperature(r.temp, u), 1)}°
                </strong>
                <div
                  className="cloud-thickness"
                  aria-label={`${fmt(r.cloud)} percent cloud cover`}
                >
                  <i style={{ width: `${r.cloud}%` }} />
                </div>
                <small>{fmt(r.cloud)}% cloud</small>
                <div
                  className="gust-ripple"
                  style={{
                    animationDuration: `${Math.max(0.6, 5 - r.gust / 10)}s`,
                  }}
                />
                <small>{fmt(r.gust)} km/h</small>
              </div>
            ))}
          </div>
          <div className="sky-strip-caption">
            <span>
              <Sun size={15} /> Breaks in cloud:{" "}
              {skyRows.some((r) => r.cloud < 60)
                ? "some lighter moments"
                : "mostly veiled"}
            </span>
            <span>
              <Wind size={15} /> Hourly clouds · quarter-hour surface forecast
            </span>
          </div>
        </>
      )}
      <div className="nowcast-footer">
        <span>
          <Eye size={17} /> Room to see
        </span>
        <b className="numeric">
          {fmt(skyRows[0]?.visibility / 1000, 1)} km visibility
        </b>
      </div>
    </Glass>
  );
}
