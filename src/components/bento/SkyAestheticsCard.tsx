import { dateLocale } from "../../i18n/locale";
import { useMemo, useState } from "react";
import { Sunrise, Sunset, Sparkles, FlaskConical } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { solarWindows } from "../../lib/meteorology/ephemeris";
import {
  skyAesthetics,
  type SkyAestheticInputs,
} from "../../lib/meteorology/skyAesthetics";
import { value, type PanelProps } from "../../types/telemetry";
export default function SkyAestheticsCard({
  weather: w,
  air,
  city,
}: PanelProps) {
  const [event, setEvent] = useState<0 | 1>(1),
    [experiment, setExperiment] = useState(false),
    [custom, setCustom] = useState<Partial<SkyAestheticInputs>>({}),
    [color, setColor] = useState(0);
  const windows = useMemo(
      () =>
        solarWindows(
          new Date(w.current.time * 1000),
          city.latitude,
          city.longitude,
          w.timezone,
        ),
      [w.current.time, city.latitude, city.longitude, w.timezone],
    ),
    at = windows.sunrise[event],
    timestamp = at ? +at : w.current.time * 1000,
    i = Math.max(
      0,
      w.hourly.time.findIndex((t) => +new Date(t) >= timestamp),
    ),
    ai = air?.hourly.time.findIndex((t) => +new Date(t) >= timestamp) ?? -1,
    aod = air ? value(air.hourly, "aerosol_optical_depth", ai) : NaN;
  const actual: SkyAestheticInputs = {
      high: value(w.hourly, "cloud_cover_high", i),
      mid: value(w.hourly, "cloud_cover_mid", i),
      low: value(w.hourly, "cloud_cover_low", i),
      aod: Number.isFinite(aod) ? aod : 0.12,
      humidity: value(w.hourly, "relative_humidity_2m", i),
    },
    input = experiment ? { ...actual, ...custom } : actual,
    look = skyAesthetics(input);
  return (
    <Glass
      title="What color could the sky become?"
      eyebrow="SKY AESTHETICS · LIGHT POTENTIAL ESTIMATE"
      dive={{ title: "Sun & sky color", metric: "sun_elevation" }}
      className="span-8 sky-aesthetics"
    >
      <div className="aesthetic-top">
        <div className="chart-tabs">
          {[Sunrise, Sunset].map((Icon, j) => (
            <button
              key={j}
              className={event === j ? "selected" : ""}
              onClick={() => {
                setEvent(j as 0 | 1);
                setCustom({});
              }}
            >
              <Icon size={18} />
              {j ? "Sunset" : "Sunrise"}{" "}
              {windows.sunrise[j]?.toLocaleTimeString(dateLocale(), {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: w.timezone,
              }) ?? "Polar sky"}
            </button>
          ))}
        </div>
        <button
          aria-pressed={experiment}
          onClick={() => setExperiment(!experiment)}
        >
          <FlaskConical size={17} />
          {experiment ? "Return to forecast" : "Try a cloud recipe"}
        </button>
      </div>
      <div
        className="aesthetic-scene"
        style={{
          background: `linear-gradient(180deg,${look.palette.join(",")})`,
        }}
      >
        <div
          className="aesthetic-cloud aesthetic-cloud-high"
          style={{ opacity: input.high / 130 }}
        />
        <div
          className="aesthetic-cloud aesthetic-cloud-low"
          style={{ opacity: input.low / 150 }}
        />
        <span className="aesthetic-sun" />
        <div className="aesthetic-caption">
          <span>
            {experiment
              ? "YOUR LIGHT EXPERIMENT"
              : "A LITTLE CREATIVE FORECAST"}
          </span>
          <h3>{look.name}</h3>
          <b>
            {look.score}
            <small>/100 vividness potential</small>
          </b>
        </div>
      </div>
      <div className="sky-swatches">
        {look.palette.map((hex, j) => (
          <button
            key={j}
            aria-label={`Explore sky color ${hex}`}
            onClick={() => setColor(j)}
            className={color === j ? "selected" : ""}
          >
            <i style={{ background: hex }} />
            <span>{hex.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <p className="aesthetic-explanation">
        <Sparkles size={21} />
        {look.explanation} Aerosols influence the softness through Mie
        scattering; the final view also depends on the horizon and cloud timing.
      </p>
      {experiment && (
        <div className="aesthetic-sliders">
          {(["high", "mid", "low", "aod"] as const).map((key) => (
            <label key={key}>
              {key === "aod" ? "Aerosol haze" : `${key} cloud`}
              <b>
                {key === "aod"
                  ? input[key].toFixed(2)
                  : `${Math.round(input[key])}%`}
              </b>
              <input
                type="range"
                aria-label={`Sky experiment ${key}`}
                min="0"
                max={key === "aod" ? 1 : 100}
                step={key === "aod" ? 0.01 : 1}
                value={input[key]}
                onChange={(e) =>
                  setCustom((p) => ({ ...p, [key]: +e.target.value }))
                }
              />
            </label>
          ))}
        </div>
      )}
      <footer className="panel-note">
        High cloud {Math.round(input.high)}% · middle {Math.round(input.mid)}% ·
        low {Math.round(input.low)}% ·{" "}
        {Number.isFinite(aod)
          ? `AOD ${input.aod.toFixed(2)}`
          : "Aerosol assumption 0.12"}{" "}
        ·{" "}
        {at
          ? "Scattering-inspired color recipe"
          : "Polar conditions: no horizon crossing today"}
      </footer>
    </Glass>
  );
}
