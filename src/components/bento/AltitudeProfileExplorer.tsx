import { useState } from "react";
import { ArrowUpRight, Layers3 } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
export default function AltitudeProfileExplorer({ weather: w }: PanelProps) {
  const [height, setHeight] = useState(80),
    [lapse, setLapse] = useState(6.5),
    i = currentIndex(w),
    t = w.current.temperature_2m,
    t80 = value(w.hourly, "temperature_80m", i),
    v10 = w.current.wind_speed_10m,
    v80 = value(w.hourly, "wind_speed_80m", i),
    v120 = value(w.hourly, "wind_speed_120m", i),
    freezing = value(w.hourly, "freezing_level_height", i);
  const thermal = (z: number) =>
    z <= 80 && Number.isFinite(t80)
      ? t + ((t80 - t) * z) / 80
      : (Number.isFinite(t80) ? t80 : t - lapse * 0.08) -
        (lapse * (z - 80)) / 1000;
  const power = Math.max(
      0,
      Math.min(
        0.5,
        Math.log(Math.max(0.1, v80) / Math.max(0.1, v10)) / Math.log(8),
      ),
    ),
    wind = (z: number) =>
      z <= 80
        ? v10 + ((v80 - v10) * Math.max(0, z - 10)) / 70
        : z <= 120
          ? v80 + ((v120 - v80) * (z - 80)) / 40
          : Math.min(150, v120 * (z / 120) ** power);
  const temp = thermal(height),
    velocity = wind(height),
    pressure =
      w.current.pressure_msl *
      Math.exp((-9.80665 * height) / (287.05 * (273.15 + (t + temp) / 2))),
    y = (z: number) => 355 - (z / 3000) * 310,
    x = (n: number) => 70 + ((n - (t - 24)) / 32) * 460,
    path = Array.from(
      { length: 61 },
      (_, j) => `${j ? "L" : "M"}${x(thermal(j * 50))} ${y(j * 50)}`,
    ).join(" ");
  return (
    <Glass
      title="Take the forecast above the rooftops."
      eyebrow="ALTITUDE PROFILE EXPLORER"
      className="span-12 altitude-explorer"
      action={<Layers3 size={23} />}
    >
      <div className="altitude-explorer-layout">
        <div>
          <h3>Feel the change with height.</h3>
          <p>
            The first three wind levels come from the forecast. Explore the air
            above with an adjustable lapse-rate and wind-profile model.
          </p>
          <label>
            Inspection altitude <b>{height} m above ground</b>
            <input
              aria-label="Profile inspection altitude"
              type="range"
              min="10"
              max="3000"
              step="10"
              value={height}
              onChange={(e) => setHeight(+e.target.value)}
            />
          </label>
          <label>
            Assumed cooling rate above 80 m <b>{lapse.toFixed(1)} °C/km</b>
            <input
              aria-label="Atmospheric lapse rate"
              type="range"
              min="3"
              max="10"
              step=".1"
              value={lapse}
              onChange={(e) => setLapse(+e.target.value)}
            />
          </label>
          <div className="profile-readouts">
            <span>
              Air temperature <strong>{temp.toFixed(1)}°</strong>
            </span>
            <span>
              Wind profile{" "}
              <strong>
                {velocity.toFixed(1)}
                <small> km/h</small>
              </strong>
            </span>
            <span>
              Pressure model{" "}
              <strong>
                {pressure.toFixed(0)}
                <small> hPa</small>
              </strong>
            </span>
            <span>
              Forecast freezing level{" "}
              <strong>
                {Math.round(freezing)}
                <small> m</small>
              </strong>
            </span>
          </div>
          <div className="profile-provenance">
            <ArrowUpRight size={17} />
            {height <= 120
              ? "Wind interpolated between forecast levels at 10, 80 and 120 m."
              : "Above 120 m: illustrative wind extrapolation, not an observed atmospheric sounding."}
          </div>
        </div>
        <svg
          className="altitude-sounding"
          viewBox="0 0 600 400"
          aria-label="Temperature versus height profile. Use the altitude slider to inspect."
          onPointerMove={(e) => {
            if (e.buttons) {
              const r = e.currentTarget.getBoundingClientRect(),
                z =
                  ((355 - ((e.clientY - r.top) / r.height) * 400) / 310) * 3000;
              setHeight(Math.max(10, Math.min(3000, Math.round(z / 10) * 10)));
            }
          }}
        >
          <defs>
            <linearGradient id="soundingFill" x2="0" y2="1">
              <stop stopColor="#a8d8ff" stopOpacity=".35" />
              <stop offset="1" stopColor="#efba7a" stopOpacity=".05" />
            </linearGradient>
          </defs>
          <rect
            x="65"
            y="40"
            width="475"
            height="315"
            rx="15"
            fill="url(#soundingFill)"
          />
          {[0, 500, 1000, 1500, 2000, 2500, 3000].map((z) => (
            <g key={z}>
              <line x1="65" x2="540" y1={y(z)} y2={y(z)} stroke="#ffffff24" />
              <text
                x="52"
                y={y(z) + 5}
                textAnchor="end"
                fill="#deebf7"
                fontSize="14"
              >
                {z}m
              </text>
            </g>
          ))}
          {Array.from({ length: 8 }, (_, j) => t - 24 + j * 4).map((n) => (
            <g key={n}>
              <path d={`M${x(n)} 355l100 -310`} stroke="#b9d9ed14" />
              <text x={x(n)} y="382" fill="#ddecf5" fontSize="14">
                {n.toFixed(0)}°
              </text>
            </g>
          ))}
          <path d={path} stroke="#f9d29a" strokeWidth="3" fill="none" />
          {[10, 80, 120].map((z) => (
            <circle key={z} cx={x(thermal(z))} cy={y(z)} r="4" fill="#a2f7de" />
          ))}
          <line
            x1="65"
            x2="540"
            y1={y(height)}
            y2={y(height)}
            stroke="#a2f7de"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <circle cx={x(temp)} cy={y(height)} r="7" fill="#efffe6" />
          <text
            x="80"
            y={Math.max(28, y(height) - 12)}
            fill="#c4ffe0"
            fontSize="16"
          >
            {height}m · {temp.toFixed(1)}°
          </text>
          {freezing < 3000 && (
            <line
              x1="65"
              x2="540"
              y1={y(freezing)}
              y2={y(freezing)}
              stroke="#c1d7ff"
              strokeDasharray="3 6"
            />
          )}
        </svg>
      </div>
    </Glass>
  );
}
