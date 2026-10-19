import { dateLocale } from "../../i18n/locale";
import { useExperience } from "../../experience/ExperienceContext";
import { dateKey, zonedMidnight } from "../../lib/meteorology/time.ts";
import { Sunrise, Sunset } from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import Glass from "../ui/GlassBentoCard";
import {
  solarPosition,
  solarWindows,
  lunarPhase,
  lunarPosition,
} from "../../lib/meteorology/ephemeris";
import type { PanelProps } from "../../types/telemetry";
import { fmt } from "../../lib/units/converter";
export default function EphemerisHorizonCard({ city, weather: w }: PanelProps) {
  const experience = useExperience();
  const [liveTime, setClock] = useState(Date.now());
  const now = new Date(experience?.offset ? w.current.time * 1000 : liveTime);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const windows = useMemo(
    () => solarWindows(now, city.latitude, city.longitude, city.timezone),
    [dateKey(now, city.timezone), city.latitude, city.longitude, city.timezone],
  );
  const yesterday = useMemo(
    () =>
      solarWindows(
        new Date(+now - 86400000),
        city.latitude,
        city.longitude,
        city.timezone,
      ),
    [dateKey(now, city.timezone), city.latitude, city.longitude, city.timezone],
  );
  const moonPos = lunarPosition(now, city.latitude, city.longitude);
  const sun = solarPosition(now, city.latitude, city.longitude),
    moon = lunarPhase(now),
    rise = windows.sunrise[0],
    set = windows.sunrise[1],
    day = rise && set ? (+set - +rise) / 1000 : NaN,
    old =
      yesterday.sunrise.length === 2
        ? (+yesterday.sunrise[1] - +yesterday.sunrise[0]) / 1000
        : NaN;
  const midnight = zonedMidnight(now, city.timezone);
  const position = Math.max(0, Math.min(1, (+now - +midnight) / 86400000));
  const sunPath = Array.from({ length: 97 }, (_, i) => {
    const elevation = solarPosition(
      new Date(+midnight + i * 900000),
      city.latitude,
      city.longitude,
    ).elevation;
    return `${i === 0 ? "M" : "L"}${10 + (i / 96) * 340},${95 - elevation * 0.85}`;
  }).join(" ");
  const moonPath = Array.from({ length: 97 }, (_, i) => {
    const elevation = lunarPosition(
      new Date(+midnight + i * 900000),
      city.latitude,
      city.longitude,
    ).elevation;
    return `${i === 0 ? "M" : "L"}${10 + (i / 96) * 340},${95 - elevation * 0.85}`;
  }).join(" ");
  const clock = (d?: Date) =>
    d
      ? d.toLocaleTimeString(dateLocale(), {
          timeZone: city.timezone,
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Polar day/night";
  const next = windows.golden.find((d) => +d > +now);
  const nextSunrise = solarWindows(
    new Date(+now + 86400000),
    city.latitude,
    city.longitude,
    city.timezone,
  ).sunrise[0];
  const event =
    rise && +rise > +now
      ? { name: "Sunrise", at: rise }
      : set && +set > +now
        ? { name: "Sunset", at: set }
        : nextSunrise
          ? { name: "Sunrise", at: nextSunrise }
          : null;
  const countdown = event ? Math.max(0, (+event.at - +now) / 60000) : 0;
  return (
    <Glass
      title="Chase a little light."
      eyebrow="CELESTIAL EPHEMERIS"
      className="span-4 ephemeris-card"
    >
      <div className="sun-summary">
        <b className="numeric">
          {Number.isFinite(day)
            ? `${Math.floor(day / 3600)}h ${Math.floor((day % 3600) / 60)}m`
            : "Polar cycle"}
        </b>
        <span>
          of daylight{" "}
          <small>
            {Number.isFinite(day - old)
              ? `${day >= old ? "+" : "−"}${Math.floor(Math.abs(day - old) / 60)}m ${Math.round(Math.abs(day - old) % 60)}s vs yesterday`
              : ""}
          </small>
        </span>
      </div>
      {event && (
        <div className="sun-countdown">
          <span>{event.name} in</span>
          <strong className="numeric">
            {Math.floor(countdown / 60)}h {Math.floor(countdown % 60)}m
          </strong>
        </div>
      )}
      <svg viewBox="0 0 360 122" className="horizon-svg">
        <defs>
          <linearGradient id="sunArea" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ebc789" stopOpacity=".22" />
            <stop offset="1" stopColor="#ebc789" stopOpacity="0" />
          </linearGradient>
          <filter id="sunGlow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <path d={sunPath} stroke="#d7bd8d" strokeWidth="1.5" fill="none" />
        <path
          d={moonPath}
          stroke="#9eabce55"
          strokeWidth="1"
          strokeDasharray="3 5"
          fill="none"
        />
        <line
          x1="10"
          y1="95"
          x2="350"
          y2="95"
          stroke="#9eabce33"
          strokeDasharray="3 4"
        />
        <g
          transform={`translate(${10 + 340 * position} ${95 - sun.elevation * 0.85})`}
        >
          <g className="solar-rays">
            {Array.from({ length: 8 }, (_, j) => (
              <path
                key={j}
                d="M0 -10v-4"
                transform={`rotate(${j * 45})`}
                stroke="#ffe7ad"
                strokeWidth="1.2"
              />
            ))}
          </g>
        </g>
        <circle
          cx={10 + 340 * position}
          cy={95 - sun.elevation * 0.85}
          r="13"
          fill="#f5d491"
          opacity=".3"
          filter="url(#sunGlow)"
        />
        <circle
          cx={10 + 340 * position}
          cy={95 - sun.elevation * 0.85}
          r="5"
          fill="#f5d491"
        />
        <circle
          cx={10 + 340 * position}
          cy={95 - moonPos.elevation * 0.85}
          r="3"
          fill="#b6c4dc"
        />
        <text x="180" y="23" fill="#c2c9d1" textAnchor="middle" fontSize="10">
          {fmt(sun.elevation, 1)}° elevation
        </text>
        <text x="180" y="118" fill="#7f8b9c" textAnchor="middle" fontSize="8">
          AZIMUTH {fmt(sun.azimuth)}°
        </text>
      </svg>
      <div className="sun-times">
        <span>
          <Sunrise size={16} />
          <small>SUNRISE</small>
          <b>{clock(rise)}</b>
        </span>
        <span>
          <Sunset size={16} />
          <small>SUNSET</small>
          <b>{clock(set)}</b>
        </span>
      </div>
      <div className="moon-row">
        <svg width="35" height="35" viewBox="0 0 40 40">
          <defs>
            <filter id="moonTexture">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".18"
                numOctaves="3"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <clipPath id="moonDisc">
              <circle cx="20" cy="20" r="16" />
            </clipPath>
          </defs>
          <circle cx="20" cy="20" r="16" fill="#182435" />
          <g clipPath="url(#moonDisc)">
            <rect
              x={moon.angle < 180 ? 20 : 4}
              y="4"
              width="16"
              height="32"
              fill="#d4dce7"
            />
            <ellipse
              cx="20"
              cy="20"
              rx={16 * Math.abs(1 - 2 * moon.illumination)}
              ry="16"
              fill={moon.illumination < 0.5 ? "#182435" : "#d4dce7"}
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              filter="url(#moonTexture)"
              opacity=".18"
            />
          </g>
        </svg>
        <div>
          <b>{moon.age < 14.77 ? "Waxing" : "Waning"} moon</b>
          <small>
            {fmt(moon.illumination * 100)}% illuminated · {fmt(moon.age, 1)}{" "}
            days old
          </small>
        </div>
        <span className="numeric">
          {fmt(moon.nextFull, 1)}d<small>TO FULL ≈</small>
        </span>
      </div>
      <div className="ephemeris-footer">
        {next
          ? `Golden hour in ${Math.floor((+next - +now) / 3600000)}h ${Math.floor(((+next - +now) % 3600000) / 60000)}m · `
          : ""}
        Civil {clock(windows.civil[0])} / {clock(windows.civil[1])}
        <br />
        Nautical {clock(windows.nautical[0])} · Astro{" "}
        {clock(windows.astronomical[0])} · Moon {fmt(moonPos.elevation)}°<br />
        Blue hour {clock(windows.blue[0])} / {clock(windows.blue[1])} · New moon
        ≈ {fmt(moon.nextNew, 1)}d
      </div>
    </Glass>
  );
}
