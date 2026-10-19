import { dateLocale, localizedDate } from "../../i18n/locale";
import { useState, useMemo, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ArrowUp } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import WeatherIcon from "../ui/WeatherIcon";
import { dateKey } from "../../lib/meteorology/time";
import { wardrobe } from "../../lib/meteorology/humanWeather";
import {
  useExperience,
  selectedWeather,
} from "../../experience/ExperienceContext";
import { value, type PanelProps } from "../../types/telemetry";
import { useWeatherStore } from "../../store/useWeatherStore";
import { temperature, fmt } from "../../lib/units/converter";
function DailyForecastMatrix({ weather: w }: PanelProps) {
  const [expanded, setExpanded] = useState(-1),
    units = useWeatherStore((s) => s.units),
    experience = useExperience(),
    source = experience?.source ?? w,
    today = dateKey(new Date(source.current.time * 1000), w.timezone),
    start = Math.max(
      0,
      w.daily.time.findIndex((t) => t.startsWith(today)),
    ),
    days = w.daily.time.slice(start, start + 14),
    low = Math.min(
      ...days.map((_, j) => value(w.daily, "temperature_2m_min", start + j)),
    ),
    high = Math.max(
      ...days.map((_, j) => value(w.daily, "temperature_2m_max", start + j)),
    ),
    temp = (n: number) => fmt(temperature(n, units));
  const groups = useMemo(() => {
    const result: Record<
        string,
        Array<{ t: string; k: number; h: number }>
      > = {},
      hourFormat = new Intl.DateTimeFormat(dateLocale(), {
        hour: "2-digit",
        timeZone: w.timezone,
        hourCycle: "h23",
      });
    w.hourly.time.forEach((t, k) => {
      const date = dateKey(new Date(t), w.timezone);
      (result[date] ??= []).push({
        t,
        k,
        h: Number(hourFormat.format(new Date(t))),
      });
    });
    return result;
  }, [w.hourly, w.timezone]);
  const clock = (n: number) =>
    new Date(n * 1000).toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: w.timezone,
    });
  return (
    <Glass
      title="Fourteen days. Plenty of possibilities."
      eyebrow="A LITTLE FURTHER AHEAD"
      className="span-12 daily-card"
    >
      <p className="daily-intro">
        Open a day. Find the morning light, the afternoon warmth, and the layer
        you’ll want after sunset.
      </p>
      <div className="daily-list">
        {days.map((date, j) => {
          const i = start + j,
            min = value(w.daily, "temperature_2m_min", i),
            max = value(w.daily, "temperature_2m_max", i),
            prob = value(w.daily, "precipitation_probability_max", i),
            hours = groups[date.slice(0, 10)] ?? [];
          return (
            <motion.div
              layout
              className={`daily-day ${expanded === i ? "expanded" : ""}`}
              key={date}
            >
              <button
                className="daily-row"
                onClick={() => setExpanded(expanded === i ? -1 : i)}
                aria-expanded={expanded === i}
              >
                <span className="day-name">
                  {j === 0
                    ? "Today"
                    : localizedDate(new Date(date), {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                </span>
                <WeatherIcon
                  code={value(w.daily, "weather_code", i)}
                  size={32}
                />
                <span className={`rain-prob ${prob > 30 ? "wet" : ""}`}>
                  {fmt(prob)}%
                </span>
                <span className="numeric low-temp">{temp(min)}°</span>
                <div className="range-track">
                  <i
                    style={{
                      left: `${((min - low) / (high - low || 1)) * 100}%`,
                      width: `${Math.max(5, ((max - min) / (high - low || 1)) * 100)}%`,
                      background: `linear-gradient(90deg,hsl(${220 - (min - low) * 3},70%,75%),hsl(${70 - (max - low) * 2},85%,76%))`,
                    }}
                  />
                </div>
                <b className="numeric">{temp(max)}°</b>
                <ChevronDown
                  size={15}
                  style={{ rotate: expanded === i ? "180deg" : "0deg" }}
                />
              </button>
              <AnimatePresence initial={false}>
                {expanded === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="daily-inspector"
                  >
                    <div className="day-inspector-heading">
                      <h3>
                        {localizedDate(new Date(date), {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </h3>
                      <span>
                        {clock(value(w.daily, "sunrise", i))} sunrise ·{" "}
                        {clock(value(w.daily, "sunset", i))} sunset
                      </span>
                    </div>
                    <div className="day-parts">
                      {[
                        { name: "Morning", target: 8 },
                        { name: "Afternoon", target: 14 },
                        { name: "Evening", target: 19 },
                        { name: "Night", target: 23 },
                      ].map((part) => {
                        const h = hours.reduce<
                          (typeof hours)[number] | undefined
                        >(
                          (best, next) =>
                            !best ||
                            Math.abs(next.h - part.target) <
                              Math.abs(best.h - part.target)
                              ? next
                              : best,
                          undefined,
                        );
                        if (!h)
                          return (
                            <div className="day-part" key={part.name}>
                              <h3>{part.name}</h3>
                              <p>
                                Hourly detail is not available this far ahead.
                              </p>
                            </div>
                          );
                        const snapshot = selectedWeather(
                            source,
                            (+new Date(h.t) - source.current.time * 1000) /
                              3600000,
                          ),
                          layer = wardrobe(snapshot)[1];
                        return (
                          <div className="day-part" key={part.name}>
                            <div className="part-heading">
                              <h3>{part.name}</h3>
                              <WeatherIcon
                                code={value(w.hourly, "weather_code", h.k)}
                                night={!value(w.hourly, "is_day", h.k)}
                                size={36}
                              />
                            </div>
                            <strong className="numeric">
                              {temp(value(w.hourly, "temperature_2m", h.k))}°
                            </strong>
                            <p>
                              {fmt(value(w.hourly, "wind_speed_10m", h.k))} km/h
                              wind · gusts{" "}
                              {fmt(value(w.hourly, "wind_gusts_10m", h.k))} km/h
                              <br />
                              {fmt(value(w.hourly, "precipitation", h.k), 1)} mm
                              precipitation ·
                              {fmt(
                                value(w.hourly, "relative_humidity_2m", h.k),
                              )}
                              % humidity · UV{" "}
                              {fmt(value(w.hourly, "uv_index", h.k), 1)}
                            </p>
                            <small>{layer.recommendation}</small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="daily-human-tip">
                      {prob > 35
                        ? "Keep the waterproof layer close; plan your longer outing between the wetter hours."
                        : max - min > 9
                          ? "A day of layers: enjoy the afternoon warmth and keep something extra for the cooler return."
                          : max < 8
                            ? "Make warmth part of the plan: a good outer layer leaves more room to enjoy the day."
                            : "A gentle plan fits this day: find the brighter hours and keep your layers easy to adjust."}
                    </p>
                    <svg
                      className="full-day-curve"
                      viewBox="0 0 960 125"
                      preserveAspectRatio="none"
                      role="img"
                      aria-label="Full-day hourly temperature curve"
                    >
                      <defs>
                        <linearGradient id={`dailyCurve-${i}`} x2="0" y2="1">
                          <stop stopColor="#fbdca0" stopOpacity=".3" />
                          <stop
                            offset="1"
                            stopColor="#a9ddee"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M15 100 ${hours.map((h, j) => `L${15 + (j / (hours.length - 1 || 1)) * 930} ${85 - ((value(w.hourly, "temperature_2m", h.k) - min) / (max - min || 1)) * 60}`).join(" ")} L945 100Z`}
                        fill={`url(#dailyCurve-${i})`}
                      />
                      <polyline
                        points={hours
                          .map(
                            (h, j) =>
                              `${15 + (j / (hours.length - 1 || 1)) * 930},${85 - ((value(w.hourly, "temperature_2m", h.k) - min) / (max - min || 1)) * 60}`,
                          )
                          .join(" ")}
                        stroke="#ffe0a6"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                      />
                      {hours
                        .filter((h) => h.h % 6 === 0)
                        .map((h) => (
                          <text
                            key={h.t}
                            x={
                              15 +
                              (hours.indexOf(h) / (hours.length - 1 || 1)) * 930
                            }
                            y="120"
                            fill="#e4f0f9"
                            fontSize="14"
                          >
                            {h.h}:00 ·{" "}
                            {temp(value(w.hourly, "temperature_2m", h.k))}°
                          </text>
                        ))}
                    </svg>
                    <div className="metrics-grid">
                      <span>
                        Sunlight energy
                        <b>
                          {fmt(value(w.daily, "shortwave_radiation_sum", i), 1)}{" "}
                          MJ/m²
                        </b>
                      </span>
                      <span>
                        Plants’ water demand
                        <b>
                          {fmt(
                            value(w.daily, "et0_fao_evapotranspiration", i),
                            1,
                          )}{" "}
                          mm ET₀
                        </b>
                      </span>
                      <span>
                        Strongest gust
                        <b>
                          {fmt(value(w.daily, "wind_gusts_10m_max", i))} km/h
                        </b>
                      </span>
                      <span>
                        Wind comes from
                        <b>
                          <ArrowUp
                            size={17}
                            style={{
                              rotate: `${value(w.daily, "wind_direction_10m_dominant", i)}deg`,
                            }}
                          />
                          {fmt(
                            value(w.daily, "wind_direction_10m_dominant", i),
                          )}
                          °
                        </b>
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      <footer className="panel-note">
        Fourteen days of light, layers and changing air. Open a day to find your
        moment.
      </footer>
    </Glass>
  );
}

export default memo(
  DailyForecastMatrix,
  (a, b) =>
    a.weather.hourly === b.weather.hourly &&
    a.weather.daily === b.weather.daily &&
    dateKey(new Date(a.weather.current.time * 1000), a.weather.timezone) ===
      dateKey(new Date(b.weather.current.time * 1000), b.weather.timezone),
);
