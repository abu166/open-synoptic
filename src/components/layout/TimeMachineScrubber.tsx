import { dateLocale, localizedDate } from "../../i18n/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Sun, Moon, Clock3 } from "lucide-react";
import { solarPosition } from "../../lib/meteorology/ephemeris";
import { currentIndex, value, type Forecast } from "../../types/telemetry";
import { temperature, fmt } from "../../lib/units/converter";
import { useWeatherStore } from "../../store/useWeatherStore";
import WeatherIcon from "../ui/WeatherIcon";
export default function TimeMachineScrubber({
  weather,
  offset,
  onChange,
}: {
  weather: Forecast;
  offset: number;
  onChange: (n: number) => void;
}) {
  const [playing, setPlaying] = useState(false),
    [floating, setFloating] = useState(false),
    frame = useRef(0),
    root = useRef<HTMLElement>(null),
    units = useWeatherStore((s) => s.units);
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min(1, (now - start) / 15000);
      onChange(Math.round(p * 96) / 4);
      if (p < 1) frame.current = requestAnimationFrame(animate);
      else setPlaying(false);
    };
    frame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, onChange]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) =>
        setFloating(
          !entry.isIntersecting && entry.boundingClientRect.bottom < 0,
        ),
      { threshold: 0 },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const time = weather.current.time * 1000 + offset * 3600000,
    clock = (n: number) =>
      new Date(n).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: weather.timezone,
      });
  const samples = useMemo(() => {
    const start = currentIndex(weather);
    return Array.from({ length: 25 }, (_, h) => {
      const i = Math.min(start + h, weather.hourly.time.length - 1),
        t = weather.current.time * 1000 + h * 3600000,
        elevation = solarPosition(
          new Date(t),
          weather.latitude,
          weather.longitude,
        ).elevation;
      return {
        temperature: value(weather.hourly, "temperature_2m", i),
        code: value(weather.hourly, "weather_code", i),
        elevation,
        time: t,
      };
    });
  }, [weather]);
  const min = Math.min(...samples.map((s) => s.temperature)),
    max = Math.max(...samples.map((s) => s.temperature));
  const trackBackground = `linear-gradient(90deg,${samples.map((s, i) => `${s.elevation < -6 ? "#1b235a" : s.elevation < 0 ? "#a64b78" : s.elevation < 9 ? "#f1a35a" : "#32a4de"} ${(i / 24) * 100}%`).join(",")})`;
  const change = (n: number) => {
    setPlaying(false);
    onChange(n);
  };
  const play = () => {
    if (playing) setPlaying(false);
    else {
      onChange(0);
      setPlaying(true);
    }
  };
  const range = (compact = false) => (
    <input
      aria-label={
        compact ? "Floating time-travel hours" : "Hours into the forecast"
      }
      aria-valuetext={`${offset === 0 ? "Now" : `${offset} hours ahead`}, ${clock(time)}`}
      type="range"
      min="0"
      max="24"
      step=".25"
      value={offset}
      onChange={(e) => change(+e.target.value)}
    />
  );
  const deck = (
    <motion.div
      className="cinema-controls"
      layoutId={!floating ? "cinema-deck" : undefined}
    >
      <button className="cinema-play" aria-pressed={playing} onClick={play}>
        {playing ? <Pause size={20} /> : <Play size={20} />}
        <span>
          {playing ? "Pause the day" : "Play 24h cinema"}
          <small>A whole day in 15 seconds</small>
        </span>
      </button>
      <div className="timeline-track">
        <div className="solar-spectrum" style={{ background: trackBackground }}>
          <svg
            viewBox="0 0 720 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="deckThermal" x2="0" y2="1">
                <stop stopColor="#ffe6a6" stopOpacity=".35" />
                <stop offset="1" stopColor="#ffe6a6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M0 80 ${samples.map((s, i) => `L${i * 30} ${66 - ((s.temperature - min) / (max - min || 1)) * 40}`).join(" ")} L720 80Z`}
              fill="url(#deckThermal)"
            />
            <polyline
              points={samples
                .map(
                  (s, i) =>
                    `${i * 30},${66 - ((s.temperature - min) / (max - min || 1)) * 40}`,
                )
                .join(" ")}
              fill="none"
              stroke="#fff2c9"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="spectrum-hours">
            {samples
              .filter((_, i) => i % 3 === 0)
              .map((s) => (
                <span key={s.time}>
                  <WeatherIcon
                    code={s.code}
                    night={s.elevation < 0}
                    size={22}
                  />
                  <b>{fmt(temperature(s.temperature, units))}°</b>
                </span>
              ))}
          </div>
        </div>
        {range()}
        <div className="timeline-labels">
          {[0, 6, 12, 18, 24].map((h) => (
            <button key={h} onClick={() => change(h)}>
              {h === 0
                ? "Now"
                : clock(weather.current.time * 1000 + h * 3600000)}
              {h === 24 ? " +1d" : ""}
            </button>
          ))}
        </div>
      </div>
      <button aria-label="Return to live weather" onClick={() => change(0)}>
        <RotateCcw size={21} />
      </button>
    </motion.div>
  );
  return (
    <>
      <section
        ref={root}
        className="time-machine span-12"
        aria-label="Atmospheric time machine"
      >
        <div className="time-machine-head">
          <div>
            <span className="eyebrow">
              <Clock3 size={16} /> YOUR PERSONAL CINEMA DECK
            </span>
            <h2>A day. A thousand little changes.</h2>
          </div>
          <div className="time-readout">
            <span className={`time-state ${offset > 0 ? "forecast" : ""}`}>
              {offset === 0 ? "LIVE MOMENT" : "FORECAST PREVIEW"}
            </span>
            <strong>{clock(time)}</strong>
            <span>
              {localizedDate(new Date(time), {
                weekday: "long",
                timeZone: weather.timezone,
              })}
            </span>
          </div>
        </div>
        {deck}
        <p className="cinema-insight">
          {samples[Math.round(offset)].elevation < 0 ? (
            <Moon size={17} />
          ) : (
            <Sun size={17} />
          )}{" "}
          {offset === 0
            ? "Start here. See how the rest of your day unfolds."
            : `${fmt(temperature(samples[Math.round(offset)].temperature, units))}° at ${clock(time)}. Every forecast panel follows this moment.`}
        </p>
      </section>
      {createPortal(
        <AnimatePresence>
          {floating && (
            <motion.aside
              className="floating-cinema-dock"
              layoutId="cinema-deck"
              aria-label="Floating atmospheric time machine"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
            >
              <button
                aria-label={
                  playing ? "Pause floating cinema" : "Play floating cinema"
                }
                onClick={play}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div>
                <span>
                  {offset === 0 ? "NOW" : "PREVIEW"} <b>{clock(time)}</b>
                </span>
                <div
                  className="dock-range"
                  style={{ background: trackBackground }}
                >
                  {range(true)}
                </div>
              </div>
              <strong>
                {fmt(
                  temperature(samples[Math.round(offset)].temperature, units),
                )}
                °
              </strong>
              <button
                aria-label="Reset floating time machine"
                onClick={() => change(0)}
              >
                <RotateCcw size={18} />
              </button>
            </motion.aside>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
