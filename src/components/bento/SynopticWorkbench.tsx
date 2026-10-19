import { dateLocale, translate, useLanguage } from "../../i18n/locale";
import { useExperience } from "../../experience/ExperienceContext";
import { parseEnsemble } from "../../api/resilience";
import WeatherIcon from "../ui/WeatherIcon";
import { useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import Glass from "../ui/GlassBentoCard";
import { fetchEnsemble } from "../../api/openMeteoClient";
import { useWeatherStore } from "../../store/useWeatherStore";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import { temperature, speed } from "../../lib/units/converter";
const modes = [
  "Temperature",
  "Precipitation",
  "Wind profile",
  "Cloud layers",
  "Instability",
];
const colors = ["#94bff1", "#dcc49b", "#72c9c1", "#a993e2", "#e5a498"];
function SynopticWorkbench({
  weather: w,
  city,
  forceEnsemble = false,
}: PanelProps & { forceEnsemble?: boolean }) {
  useLanguage();
  const [mode, setMode] = useState(0),
    s = useWeatherStore(),
    experience = useExperience(),
    i = currentIndex(experience?.source ?? w);
  const ensembleEnabled = s.ensemble || forceEnsemble;
  const ensemble = useQuery({
    queryKey: ["ensemble-v4.1", city.latitude, city.longitude],
    queryFn: ({ signal }) =>
      fetchEnsemble(city, signal, experience?.source ?? w),
    enabled: ensembleEnabled,
    staleTime: 1800000,
    refetchInterval: (query) =>
      query.state.data?.estimatedModels?.length ? 180000 : 1800000,
  });
  const modelData =
    ensemble.data ?? parseEnsemble(undefined, experience?.source ?? w);
  const keys = [
    ["temperature_2m", "apparent_temperature", "dew_point_2m"],
    ["precipitation_probability", "rain", "snowfall"],
    ["wind_speed_10m", "wind_speed_80m", "wind_speed_120m", "wind_gusts_10m"],
    [
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "freezing_level_height",
    ],
    [
      "cape",
      "direct_radiation",
      "diffuse_radiation",
      "vapour_pressure_deficit",
    ],
  ][mode];
  const names: Record<string, string> = {
    temperature_2m: "Temperature",
    apparent_temperature: "Feels like",
    dew_point_2m: "Dew point",
    precipitation_probability: "Probability",
    rain: "Rain · mm",
    snowfall: "Snow · cm",
    wind_speed_10m: "Surface · 10m",
    wind_speed_80m: "Altitude · 80m",
    wind_speed_120m: "Altitude · 120m",
    wind_gusts_10m: "Gusts",
    cloud_cover_low: "Low clouds",
    cloud_cover_mid: "Mid clouds",
    cloud_cover_high: "High clouds",
    freezing_level_height: "Freezing level · m",
    cape: "CAPE · J/kg",
    direct_radiation: "Direct · W/m²",
    diffuse_radiation: "Diffuse · W/m²",
    vapour_pressure_deficit: "VPD · kPa",
  };
  const data = w.hourly.time.slice(i, i + 48).map((t, j) => {
    const r: Record<string, number | string | number[]> = {
      slot: j,
      isDay: value(w.hourly, "is_day", i + j),
      code: value(w.hourly, "weather_code", i + j),
      time: new Date(t).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: w.timezone,
      }),
    };
    r.thermal = temperature(value(w.hourly, "temperature_2m", i + j), s.units);
    r.humidity = value(w.hourly, "relative_humidity_2m", i + j);
    r.wind = speed(value(w.hourly, "wind_speed_10m", i + j), s.units);
    r.cloud = value(w.hourly, "cloud_cover", i + j);
    r.rainChance = value(w.hourly, "precipitation_probability", i + j);
    r.energy = value(w.hourly, "cape", i + j);
    keys.forEach((k) => {
      const v = value(w.hourly, k, i + j);
      r[k] =
        mode === 0
          ? temperature(v, s.units)
          : mode === 2
            ? speed(v, s.units)
            : v;
    });
    {
      const ei = modelData.hourly.time.indexOf(t);
      for (const model of ["ecmwf_ifs04", "gfs_seamless", "icon_seamless"])
        r[model] = temperature(
          value(modelData.hourly, `temperature_2m_${model}`, ei),
          s.units,
        );
    }
    const spread = ["ecmwf_ifs04", "gfs_seamless", "icon_seamless"]
      .map((m) => r[m])
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (spread.length > 1)
      r.spread = [Math.min(...spread), Math.max(...spread)];
    return r;
  });
  return (
    <Glass
      title="Watch the next two days unfold."
      eyebrow="FORECAST ANALYSIS"
      className="span-8 workbench"
      action={<span className="tiny-badge">HOURLY RESOLUTION</span>}
    >
      <div className="chart-tabs">
        {modes.map((m, j) => (
          <button
            key={m}
            className={mode === j ? "selected" : ""}
            onClick={() => setMode(j)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="chart-legend">
        {keys.map((k, j) => (
          <span key={k}>
            <i style={{ background: colors[j] }} />
            {names[k]}
          </span>
        ))}
        {ensembleEnabled && mode === 0 && (
          <span>
            + ECMWF · GFS · ICON{" "}
            {modelData.estimatedModels?.length
              ? "· scenario estimates fill gaps"
              : "· model runs"}
          </span>
        )}
      </div>
      <p className="chart-story">
        {
          [
            "Trace the warmth, the feels-like air and the moisture line. Wider model spread means more disagreement.",
            "See when rain is likely and how much water or snow is forecast to arrive.",
            "Surface calm can hide stronger winds above. Compare the altitude layers before heading out.",
            "Low clouds shape your view; middle and high decks shape the light. The dotted line follows the freezing level.",
            "Sunlight powers the afternoon; CAPE describes energy available for rising air. Neither alone predicts a storm.",
          ][mode]
        }
      </p>
      <div className="workbench-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            key={mode}
            data={data}
            margin={{ top: 45, right: 5, bottom: 0, left: -10 }}
          >
            <defs>
              {colors.map((color, j) => (
                <linearGradient
                  key={j}
                  id={`modeFill-${j}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop stopColor={color} stopOpacity=".5" />
                  <stop
                    offset=".6"
                    stopColor={colors[(j + 1) % 5]}
                    stopOpacity=".16"
                  />
                  <stop offset="1" stopColor={color} stopOpacity="0" />
                </linearGradient>
              ))}
              <linearGradient id="thermalFill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#ffe4ac" stopOpacity=".55" />
                <stop offset=".45" stopColor="#aedfee" stopOpacity=".2" />
                <stop offset="1" stopColor="#80b7ee" stopOpacity="0" />
              </linearGradient>
              <filter
                id="forecastGlow"
                x="-20%"
                y="-40%"
                width="140%"
                height="180%"
              >
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="#ffffff08" vertical={false} />
            <XAxis
              dataKey="slot"
              type="number"
              domain={[0, 47]}
              ticks={[0, 8, 16, 24, 32, 40, 47]}
              tickFormatter={(n) => String(data[Number(n)]?.time ?? "")}
              tick={{ fill: "#e3eff8", fontSize: 14 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#e3eff8", fontSize: 14 }}
              axisLine={false}
              tickLine={false}
              unit={mode === 0 ? "°" : ""}
            />
            {mode > 0 && mode !== 2 && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#e3eff8", fontSize: 14 }}
                axisLine={false}
                tickLine={false}
              />
            )}
            {mode === 4 && <YAxis yAxisId="vpd" hide domain={[0, 6]} />}
            {data.map((row, j) =>
              row.isDay === 0 ? (
                <ReferenceArea
                  key={`night-${j}`}
                  x1={Math.max(0, j - 0.5)}
                  x2={Math.min(47, j + 0.5)}
                  yAxisId="left"
                  fill="#14254d"
                  fillOpacity={0.2}
                  strokeOpacity={0}
                />
              ) : null,
            )}
            <ReferenceLine
              yAxisId="left"
              x={Math.max(
                0,
                Math.min(
                  47,
                  (w.current.time * 1000 - +new Date(w.hourly.time[i])) /
                    3600000,
                ),
              )}
              stroke="#ffe0a0"
              strokeWidth={2}
              strokeDasharray="5 4"
              label={{
                value: translate("YOUR MOMENT"),
                fill: "#ffe0a0",
                position: "insideTopRight",
                fontSize: 14,
              }}
            />
            <Tooltip
              cursor={{ stroke: "#e0f9ff", strokeWidth: 2 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload;
                return active && row ? (
                  <div className="crosshair-inspector">
                    <strong>
                      {row.time} · {w.timezone}
                    </strong>
                    <div>
                      <span>
                        Temperature <b>{Number(row.thermal).toFixed(1)}°</b>
                      </span>
                      <span>
                        Humidity <b>{row.humidity}%</b>
                      </span>
                      <span>
                        Wind <b>{Number(row.wind).toFixed(1)}</b>
                      </span>
                      <span>
                        Cloud <b>{row.cloud}%</b>
                      </span>
                      <span>
                        Rain chance <b>{row.rainChance}%</b>
                      </span>
                      <span>
                        Storm energy <b>{row.energy} J/kg</b>
                      </span>
                    </div>
                  </div>
                ) : null;
              }}
            />
            {ensembleEnabled && mode === 0 && (
              <Area
                yAxisId="left"
                dataKey="spread"
                name="Model range"
                stroke="none"
                fill="#9fc6ee"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
            )}
            {keys.map((k, j) =>
              mode === 1 && j > 0 ? (
                <Bar
                  key={k}
                  dataKey={k}
                  name={names[k]}
                  yAxisId="right"
                  stackId="precip"
                  fill={colors[j]}
                  radius={[2, 2, 0, 0]}
                />
              ) : mode === 3 && j < 3 ? (
                <Area
                  key={k}
                  yAxisId="left"
                  type="monotone"
                  dataKey={k}
                  name={names[k]}
                  stackId="clouds"
                  fill={`url(#modeFill-${j})`}
                  fillOpacity={0.65}
                  stroke={colors[j]}
                  strokeWidth={3}
                  isAnimationActive={false}
                />
              ) : j === 0 ? (
                <Area
                  key={k}
                  yAxisId="left"
                  type="monotone"
                  dataKey={k}
                  name={names[k]}
                  stroke={colors[j]}
                  fill={
                    mode === 0 ? "url(#thermalFill)" : `url(#modeFill-${mode})`
                  }
                  filter="url(#forecastGlow)"
                  dot={
                    mode === 0
                      ? (dot: {
                          cx?: number;
                          cy?: number;
                          index?: number;
                          payload?: Record<string, number | string | number[]>;
                        }) => {
                          const { cx = 0, cy = 0, index = 0, payload } = dot;
                          return index % 3 === 0 ? (
                            <g
                              key={index}
                              transform={`translate(${cx - 16} ${cy - 40})`}
                            >
                              <WeatherIcon
                                code={Number(payload?.code)}
                                night={!payload?.isDay}
                                size={32}
                              />
                            </g>
                          ) : (
                            <g key={index} />
                          );
                        }
                      : false
                  }
                  strokeWidth={3}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={k}
                  yAxisId={
                    mode === 4
                      ? j === 3
                        ? "vpd"
                        : "right"
                      : mode === 3 && j === 3
                        ? "right"
                        : "left"
                  }
                  type="monotone"
                  dataKey={k}
                  name={names[k]}
                  stroke={colors[j]}
                  strokeWidth={3}
                  strokeDasharray={j === 1 ? "4 4" : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ),
            )}
            {ensembleEnabled &&
              mode === 0 &&
              ["ecmwf_ifs04", "gfs_seamless", "icon_seamless"].map((m, j) => (
                <Line
                  key={m}
                  yAxisId="left"
                  dataKey={m}
                  name={
                    j === 0
                      ? modelData.estimatedModels?.includes(m)
                        ? "ECMWF slot · estimated"
                        : modelData.modelSources?.[m] === "ecmwf_ifs025"
                          ? "ECMWF IFS 0.25°"
                          : "ECMWF IFS 0.4°"
                      : ["", "GFS", "DWD ICON"][j]
                  }
                  stroke={colors[j + 2]}
                  dot={false}
                  strokeWidth={3}
                  strokeDasharray="3 3"
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {ensembleEnabled && (
        <p className="ensemble-source small">
          {modelData.estimatedModels?.length
            ? "Gap-filled slots use pressure, cloud variability and forecast horizon to form low / central / high scenario estimates."
            : "Shaded envelope: actual ECMWF / GFS / ICON minimum–maximum. ECMWF uses the current 0.25° run when the legacy 0.4° feed has no samples. Hover for the hour’s field notes."}
        </p>
      )}
      {mode === 2 && (
        <div className="wind-vectors">
          {w.hourly.time
            .slice(i, i + 48)
            .filter((_, j) => j % 6 === 0)
            .map((t, j) => (
              <span
                key={t}
                title={`${value(w.hourly, "wind_direction_10m", i + j * 6)}°`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 20 20"
                  style={{
                    transform: `rotate(${value(w.hourly, "wind_direction_10m", i + j * 6)}deg)`,
                  }}
                >
                  <path d="M10 2l-4 9h3v7h2v-7h3Z" fill="currentColor" />
                </svg>
                {new Date(t).toLocaleTimeString(dateLocale(), {
                  hour: "2-digit",
                  timeZone: w.timezone,
                })}
              </span>
            ))}
        </div>
      )}
      <div className="chart-bottom">
        <span>LOCAL TIME · {w.timezone}</span>
        <span>
          {ensembleEnabled ? "MULTI-MODEL COMPARISON" : "BEST-MATCH MODEL"}{" "}
          <span className="live-dot" />
        </span>
      </div>
    </Glass>
  );
}

export default memo(
  SynopticWorkbench,
  (a, b) =>
    a.weather.hourly === b.weather.hourly &&
    currentIndex(a.weather) === currentIndex(b.weather) &&
    a.city.latitude === b.city.latitude &&
    a.city.longitude === b.city.longitude &&
    a.forceEnsemble === b.forceEnsemble,
);
