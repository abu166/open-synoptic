import { useExperience } from "../../experience/ExperienceContext";
import { useDialog } from "../../lib/ui/useDialog";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowRightLeft } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useWeatherStore } from "../../store/useWeatherStore";
import {
  fetchCityBatch,
  cityBatchKey,
  fetchCityAirBatch,
} from "../../api/openMeteoClient";
import {
  initialCityTelemetry,
  cityMoment,
  cityKey,
} from "../../api/resilience";
import { temperature, speed, fmt, speedLabel } from "../../lib/units/converter";
export default function CityComparisonModal({
  onClose,
  embedded = false,
}: {
  onClose: () => void;
  embedded?: boolean;
}) {
  useDialog(!embedded);
  const experience = useExperience(),
    offset = experience?.offset ?? 0,
    s = useWeatherStore(),
    [selected, setSelected] = useState(s.saved.slice(0, 3).map((c) => c.name)),
    [mode, setMode] = useState("temperature_2m"),
    all = [...s.saved].sort(
      (a, b) => a.latitude - b.latitude || a.longitude - b.longitude,
    ),
    cities = s.saved.filter((c) => selected.includes(c.name));
  const q = useQuery({
    queryKey: cityBatchKey(all),
    queryFn: ({ signal }) => fetchCityBatch(all, signal),
    staleTime: 600000,
    initialData: () => all.map((c) => initialCityTelemetry(c)),
    initialDataUpdatedAt: 0,
  });
  const air = useQuery({
    queryKey: ["city-air-batch-v4", ...all.map(cityKey)],
    queryFn: ({ signal }) => fetchCityAirBatch(all, signal),
    staleTime: 1800000,
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.aqi.some(Number.isFinite))
        ? 1800000
        : 180000,
  });
  const rows = cities.map((c) =>
    cityMoment(
      q.data.find((r) => cityKey(r.city) === cityKey(c)) ??
        initialCityTelemetry(c),
      offset,
    ),
  );
  const aq = (j: number, time: number) => {
    const a = air.data?.find((a) => cityKey(a.city) === cityKey(cities[j])),
      i = a?.time.findIndex((t) => t >= time) ?? -1;
    return a?.aqi[i] ?? NaN;
  };
  const data = Array.from({ length: 48 }, (_, i) => {
    const row: Record<string, number | string | null> = { hour: `+${i}h` };
    rows.forEach((w, j) => {
      const time =
          (experience?.weather.current.time ?? w.time / 1000) * 1000 +
          i * 3600000,
        k = w.hourly.time.findIndex((t) => t >= time);
      row[w.city.name] =
        mode === "us_aqi"
          ? Number.isFinite(aq(j, time))
            ? aq(j, time)
            : null
          : mode === "temperature_2m"
            ? temperature(w.hourly.temperature[k] ?? w.temperature, s.units)
            : Number.isFinite(w.hourly.wind?.[k])
              ? speed(w.hourly.wind![k], s.units)
              : null;
    });
    return row;
  });
  const a = rows[0],
    b = rows[1];
  return (
    <div
      className={embedded ? "workspace-comparison" : "modal-backdrop"}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className="comparison-modal"
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label="Compare locations"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">SIDE-BY-SIDE COMPARISON ARENA</span>
            <h2>
              <ArrowRightLeft size={23} /> One planet. Different possibilities.
            </h2>
          </div>
          {!embedded && (
            <button aria-label="Close comparison" onClick={onClose}>
              <X size={22} />
            </button>
          )}
        </header>
        <div className="hotspots">
          {s.saved.map((c) => (
            <button
              className={selected.includes(c.name) ? "active" : ""}
              key={cityKey(c)}
              onClick={() =>
                setSelected((p) =>
                  p.includes(c.name)
                    ? p.length > 1
                      ? p.filter((n) => n !== c.name)
                      : p
                    : [...p.slice(-2), c.name],
                )
              }
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="comparison-stats">
          {rows.map((w, j) => (
            <div key={cityKey(w.city)}>
              <h3>{w.city.name}</h3>
              <b className="numeric">
                {fmt(temperature(w.temperature, s.units))}°
              </b>
              <span>
                {Number.isFinite(w.wind)
                  ? `${fmt(speed(w.wind!, s.units))} ${speedLabel(s.units)}`
                  : "Wind field is refreshing"}{" "}
                ·{" "}
                {Number.isFinite(aq(j, w.time))
                  ? `AQI ${fmt(aq(j, w.time))}`
                  : "Air samples are refreshing"}
              </span>
              <small>
                {w.source === "seasonal"
                  ? "Seasonal temperature guide"
                  : w.source === "cached"
                    ? "Saved forecast"
                    : "Live forecast"}
              </small>
            </div>
          ))}
        </div>
        {a && b && (
          <p className="comparison-delta">
            {a.city.name} is{" "}
            {fmt(
              Math.abs(
                temperature(a.temperature, s.units) -
                  temperature(b.temperature, s.units),
              ),
              1,
            )}
            ° {a.temperature > b.temperature ? "warmer" : "colder"} than{" "}
            {b.city.name}.
            {Number.isFinite(a.wind) && Number.isFinite(b.wind) && (
              <>
                {" "}
                The wind is{" "}
                {fmt(
                  Math.abs(speed(a.wind!, s.units) - speed(b.wind!, s.units)),
                  1,
                )}{" "}
                {speedLabel(s.units)}{" "}
                {a.wind! > b.wind! ? "stronger" : "lighter"}.
              </>
            )}
          </p>
        )}
        <div className="chart-tabs">
          {[
            ["temperature_2m", "Temperature"],
            ["wind_speed_10m", "Wind speed"],
            ["us_aqi", "Air quality"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={mode === key ? "selected" : ""}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="comparison-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#ffffff18" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#d0e5f4"
                interval={7}
                fontSize={14}
              />
              <YAxis stroke="#d0e5f4" fontSize={14} />
              <Tooltip
                contentStyle={{
                  background: "#163449e8",
                  border: "1px solid #ffffff40",
                  borderRadius: 15,
                }}
              />
              {rows.map((w, j) => (
                <Line
                  key={cityKey(w.city)}
                  dataKey={w.city.name}
                  type="monotone"
                  stroke={["#9fe9e7", "#ffd8a0", "#cdb3ff"][j]}
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <footer className="panel-note">
          48 hours aligned to the same instant · up to three places · saved
          forecasts stay with you between visits.
        </footer>
      </div>
    </div>
  );
}
