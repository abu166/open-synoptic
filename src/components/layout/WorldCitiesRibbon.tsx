import { dateLocale } from "../../i18n/locale";
import { useExperience } from "../../experience/ExperienceContext";
import { solarPosition } from "../../lib/meteorology/ephemeris";
import { cityMoment, initialCityTelemetry } from "../../api/resilience";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowRightLeft } from "lucide-react";
import { useWeatherStore } from "../../store/useWeatherStore";
import { fetchCityBatch, cityBatchKey } from "../../api/openMeteoClient";
import { temperature, fmt } from "../../lib/units/converter";
import WeatherIcon from "../ui/WeatherIcon";
export default function WorldCitiesRibbon({
  onSearch,
  onCompare,
}: {
  onSearch: () => void;
  onCompare: () => void;
}) {
  const experience = useExperience();
  const s = useWeatherStore(),
    [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const cities = [...s.saved].sort(
    (a, b) => a.latitude - b.latitude || a.longitude - b.longitude,
  );
  const query = useQuery({
    queryKey: cityBatchKey(cities),
    queryFn: ({ signal }) => fetchCityBatch(cities, signal),
    staleTime: 600000,
    refetchInterval: (query) =>
      query.state.data?.some((row) => row.source === "seasonal")
        ? 60000
        : 600000,
    initialData: () => cities.map((c) => initialCityTelemetry(c)),
    initialDataUpdatedAt: 0,
  });
  return (
    <div className="world-ribbon">
      {s.saved.map((c) => {
        const row =
          query.data.find(
            (r) =>
              r.city.latitude === c.latitude &&
              r.city.longitude === c.longitude,
          ) ?? initialCityTelemetry(c);
        const w = cityMoment(row, experience?.offset ?? 0),
          start = Math.max(
            0,
            w.hourly.time.findIndex((t) => t >= w.time),
          );
        const points = w.hourly.temperature
            .slice(start, start + 24)
            .filter(Number.isFinite),
          min = Math.min(...points),
          max = Math.max(...points);
        const date = new Date(+now + (experience?.offset ?? 0) * 3600000),
          hour = Number(
            date.toLocaleTimeString(dateLocale(), {
              timeZone: w.city.timezone || c.timezone,
              hour: "2-digit",
              hourCycle: "h23",
            }),
          ),
          elevation = solarPosition(date, c.latitude, c.longitude).elevation,
          sky =
            elevation < -6
              ? "night"
              : elevation < 8
                ? "golden"
                : (w.cloud ?? 70) < 50
                  ? "sunny"
                  : "silver";
        return (
          <button
            className={`city-tile sky-${sky} ${s.city.name === c.name ? "city-active" : ""}`}
            key={c.name}
            onClick={() => s.setCity(c)}
          >
            {sky === "night" && (
              <span className="mini-starfield" aria-hidden="true">
                {Array.from({ length: 18 }, (_, j) => (
                  <i
                    key={j}
                    style={{
                      left: `${(((j * 37 + c.latitude * 19) % 100) + 100) % 100}%`,
                      top: `${(((j * j * 17 + c.longitude * 7) % 100) + 100) % 100}%`,
                      width: j % 4 === 0 ? "2px" : "1px",
                      height: j % 4 === 0 ? "2px" : "1px",
                      opacity: (w.cloud ?? 0) > 70 ? 0.3 : 0.75,
                    }}
                  />
                ))}
              </span>
            )}
            {(w.cloud ?? 0) > 55 && (
              <span className="city-cloud" aria-hidden="true" />
            )}
            <div>
              <span className="city-name">
                {c.name}
                <span className="city-dot" />
              </span>
              <span className="city-clock">
                {date.toLocaleTimeString(dateLocale(), {
                  timeZone: w.city.timezone || c.timezone,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                <span>{c.country}</span>
              </span>
              <span className="city-provenance">
                {w.source === "seasonal"
                  ? "Seasonal estimate"
                  : w.source === "cached"
                    ? "Saved forecast"
                    : "Live forecast"}
              </span>
              <span className="city-period">
                {experience?.offset ? "Preview · " : ""}
                {hour < 5
                  ? "Night"
                  : hour < 12
                    ? "Morning"
                    : hour < 18
                      ? "Afternoon"
                      : hour < 22
                        ? "Evening"
                        : "Night"}
              </span>
            </div>
            {points && (
              <svg viewBox="0 0 70 28" className="sparkline">
                <polyline
                  points={points
                    .map(
                      (n, j) =>
                        `${j * 3},${25 - ((n - min) / (max - min || 1)) * 20}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            )}
            <WeatherIcon code={w.code} night={!w.isDay} size={35} />
            <b className="numeric">
              {fmt(temperature(w.temperature, s.units))}°
            </b>
          </button>
        );
      })}
      <div className="ribbon-actions">
        <button onClick={onSearch} title="Add location">
          <Plus size={17} />
        </button>
        <button onClick={onCompare} title="Compare locations">
          <ArrowRightLeft size={17} />
        </button>
      </div>
    </div>
  );
}
