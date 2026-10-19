import { dateLocale, localizedDate } from "../../i18n/locale";
import { windChill, heatIndex } from "../../lib/meteorology/physics";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, FlaskConical, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { useDialog } from "../../lib/ui/useDialog";
import {
  useExperience,
  selectedWeather,
  selectedAir,
  type DiveRequest,
} from "../../experience/ExperienceContext";
import { metrics, metricsForCard } from "../../experience/metricCatalog";
import { currentIndex, value, type Forecast } from "../../types/telemetry";
import {
  activities,
  activityBreakdown,
  scores,
  scoreColor,
} from "../../lib/meteorology/activityScorer";
import { fmt } from "../../lib/units/converter";
export default function TelemetryDeepDiveModal({
  request,
  onClose,
}: {
  request: DiveRequest;
  onClose: () => void;
}) {
  useDialog();
  const experience = useExperience()!;
  const w =
      request.time === undefined
        ? experience.weather
        : selectedWeather(
            experience.source,
            (request.time - experience.source.current.time * 1000) / 3600000,
          ),
    air =
      request.time === undefined
        ? experience.air
        : selectedAir(experience.air, request.time),
    index = currentIndex(w),
    isActivity = request.activity !== undefined;
  const choices = useMemo(() => {
    const list = metricsForCard(request.title),
      requested = metrics.find((m) => m.key === request.metric);
    return requested
      ? [requested, ...list.filter((m) => m.key !== requested.key)]
      : list;
  }, [request.title, request.metric]);
  const [key, setKey] = useState(choices[0].key),
    [pro, setPro] = useState(false),
    [tab, setTab] = useState<"curve" | "simulate">("curve"),
    [temperature, setTemperature] = useState(w.current.temperature_2m),
    [humidity, setHumidity] = useState(w.current.relative_humidity_2m),
    [wind, setWind] = useState(w.current.wind_speed_10m),
    [custom, setCustom] = useState<number | null>(null);
  const definition = metrics.find((m) => m.key === key) ?? choices[0],
    analysis = activityBreakdown(
      w,
      index,
      air?.current.us_aqi,
      undefined,
      air?.current.aerosol_optical_depth,
    )[request.activity ?? 0];
  const scenario = useMemo(() => {
    const gamma =
      Math.log(humidity / 100) +
      (17.625 * temperature) / (243.04 + temperature);
    const fields = {
      temperature_2m: temperature,
      apparent_temperature:
        temperature < 10
          ? windChill(temperature, wind)
          : temperature >= 27
            ? heatIndex(temperature, humidity)
            : temperature,
      dew_point_2m: (243.04 * gamma) / (17.625 - gamma),
      relative_humidity_2m: humidity,
      wind_speed_10m: wind,
      wind_speed_80m:
        wind +
        Math.max(
          0,
          value(w.hourly, "wind_speed_80m", index) - w.current.wind_speed_10m,
        ),
      wind_speed_120m:
        wind +
        Math.max(
          0,
          value(w.hourly, "wind_speed_120m", index) - w.current.wind_speed_10m,
        ),
      wind_gusts_10m:
        wind *
        Math.max(
          1,
          w.current.wind_gusts_10m / Math.max(1, w.current.wind_speed_10m),
        ),
      ...(custom !== null ? { [key]: custom } : {}),
    };
    const hourly = { ...w.hourly };
    for (const [field, n] of Object.entries(fields)) {
      if (!hourly[field]) continue;
      hourly[field] = hourly[field].map((v, i) =>
        i === index ? n : v,
      ) as number[];
    }
    return {
      ...w,
      hourly,
      current: {
        ...w.current,
        temperature_2m: temperature,
        relative_humidity_2m: humidity,
        wind_speed_10m: wind,
      },
    } as Forecast;
  }, [w, index, temperature, humidity, wind, key, custom]);
  const scenarioAir = useMemo(() => {
    if (!air || custom === null || !air.hourly[key]) return air;
    const ai = air.hourly.time.indexOf(w.hourly.time[index]);
    return {
      ...air,
      current: { ...air.current, [key]: custom },
      hourly: {
        ...air.hourly,
        [key]: air.hourly[key].map((v, j) =>
          j === ai ? custom : v,
        ) as number[],
      },
    };
  }, [air, custom, key, w, index]);
  const simulated = activityBreakdown(
      scenario,
      index,
      air?.current.us_aqi,
      undefined,
      air?.current.aerosol_optical_depth,
    )[request.activity ?? 0],
    metricValue = definition.read(
      tab === "simulate" ? scenario : w,
      tab === "simulate" ? scenarioAir : air,
      index,
    );
  const chart = Array.from({ length: 24 }, (_, j) => {
    const i = Math.min(index + j, w.hourly.time.length - 1),
      time = w.hourly.time[i],
      ai = air?.hourly.time.indexOf(time) ?? -1,
      n = isActivity
        ? scores(
            w,
            i,
            air && ai >= 0 ? value(air.hourly, "us_aqi", ai) : undefined,
            undefined,
            air && ai >= 0
              ? value(air.hourly, "aerosol_optical_depth", ai)
              : undefined,
          )[request.activity!]
        : definition.read(w, air, i);
    return {
      timestamp: +new Date(time),
      time: new Date(time).toLocaleTimeString(dateLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: w.timezone,
      }),
      value: Number.isFinite(n) ? n : null,
      day: value(w.hourly, "is_day", i),
    };
  });
  const activeAnalysis = tab === "simulate" ? simulated : analysis;
  const normalPosition = (n: number) =>
    ((n - definition.range[0]) / (definition.range[1] - definition.range[0])) *
    100;
  return (
    <div className="modal-backdrop dive-backdrop" onClick={onClose}>
      <motion.div
        className="dive-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${request.title} deep dive`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 45, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: "spring", stiffness: 260, damping: 29 }}
      >
        <header>
          <div>
            <span className="eyebrow">
              <Sparkles size={17} /> THE STORY BEHIND THE NUMBER
            </span>
            <h2>
              {isActivity
                ? `${activities[request.activity!]} · find your moment`
                : request.title}
            </h2>
          </div>
          <button aria-label="Close deep dive" onClick={onClose}>
            <X size={23} />
          </button>
        </header>
        <div className="dive-language">
          <button
            className={!pro ? "selected" : ""}
            onClick={() => setPro(false)}
          >
            Explain it simply
          </button>
          <button
            className={pro ? "selected" : ""}
            onClick={() => setPro(true)}
          >
            Pro meteorologist
          </button>
          <span>
            {localizedDate(new Date(w.current.time * 1000), {
              timeZone: w.timezone,
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {experience.city.name}
          </span>
        </div>
        {!isActivity && (
          <div className="metric-choices">
            {choices.map((m) => (
              <button
                className={key === m.key ? "active" : ""}
                key={m.key}
                onClick={() => {
                  setKey(m.key);
                  setCustom(null);
                  setTab("curve");
                }}
              >
                {m.label}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        )}
        <div className="dive-content">
          <div className="dive-narrative">
            <span className="eyebrow">
              {isActivity ? "YOUR CURRENT FIT" : definition.label}
            </span>
            <div
              className="dive-big-number"
              style={{
                color: isActivity
                  ? scoreColor(activeAnalysis.score)
                  : "#ffe5ac",
              }}
            >
              {fmt(
                isActivity ? activeAnalysis.score : metricValue,
                isActivity ? 0 : Math.abs(metricValue) < 10 ? 1 : 0,
              )}
              <span>{isActivity ? "/ 100" : definition.unit}</span>
            </div>
            {isActivity ? (
              <>
                <h3>
                  {activeAnalysis.score >= 70
                    ? "There’s a good moment here."
                    : activeAnalysis.score >= 40
                      ? "A few things are working against you."
                      : "The sky has other plans for this hour."}
                </h3>
                <p>
                  {pro
                    ? "The model starts at 100 and subtracts each weighted environmental penalty below. The reported result is rounded and clamped to 0–100. These weights are planning heuristics, not calibrated probabilities."
                    : "Start with a perfect 100. Each condition takes a little away. Sometimes one thing—like daylight when you want stars—takes a lot away. Tap the day ahead to see the better hours."}
                </p>
                <div className="score-equation">
                  100 −{" "}
                  {fmt(
                    activeAnalysis.factors.reduce(
                      (sum, f) => sum + f.points,
                      0,
                    ),
                    1,
                  )}{" "}
                  points = {fmt(activeAnalysis.raw, 1)}
                  <small>
                    Shown as {fmt(activeAnalysis.score)}/100 after limiting to
                    the score range.
                  </small>
                </div>
              </>
            ) : (
              <>
                <h3>{definition.meaning}</h3>
                <p>{pro ? definition.pro : definition.plain}</p>
                <div className="metric-reference">
                  <span>
                    Reference band{" "}
                    <b>
                      {definition.reference[0]}–{definition.reference[1]}{" "}
                      {definition.unit}
                    </b>
                  </span>
                  <div className="reference-track">
                    <i
                      style={{
                        left: `${normalPosition(definition.reference[0])}%`,
                        width: `${normalPosition(definition.reference[1]) - normalPosition(definition.reference[0])}%`,
                      }}
                    />
                    {Number.isFinite(metricValue) && (
                      <b
                        style={{
                          left: `${Math.max(0, Math.min(100, normalPosition(metricValue)))}%`,
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <span>
                      {definition.range[0]} {definition.unit}
                    </span>
                    <span>
                      {definition.range[1]} {definition.unit}
                    </span>
                  </div>
                  <small>
                    This is a contextual guide, not a universal safe/unsafe
                    threshold.
                  </small>
                </div>
              </>
            )}
          </div>
          <div className="dive-interactive">
            <div className="chart-tabs">
              <button
                className={tab === "curve" ? "selected" : ""}
                onClick={() => setTab("curve")}
              >
                The next 24 hours
              </button>
              {(isActivity ||
                !["sun_elevation", "moon_illumination", "daily_mean"].includes(
                  key,
                )) && (
                <button
                  className={tab === "simulate" ? "selected" : ""}
                  onClick={() => setTab("simulate")}
                >
                  <FlaskConical size={16} /> What if?
                </button>
              )}
            </div>
            {tab === "curve" ? (
              <>
                <div className="dive-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chart}
                      margin={{ top: 20, right: 12, bottom: 10, left: -10 }}
                    >
                      <defs>
                        <linearGradient
                          id="deepCurve"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop stopColor="#ffe2a1" stopOpacity={0.5} />
                          <stop
                            offset="1"
                            stopColor="#9dcde6"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#ffffff20" vertical={false} />
                      <XAxis
                        dataKey="time"
                        interval={5}
                        stroke="#e5eef5"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#e5eef5"
                        tickLine={false}
                        axisLine={false}
                        width={55}
                      />
                      {isActivity && (
                        <ReferenceArea
                          y1={70}
                          y2={100}
                          fill="#b5ebbd"
                          fillOpacity={0.06}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          background: "#28465f",
                          border: "1px solid #ffffff50",
                          borderRadius: 12,
                          color: "#fff",
                        }}
                      />
                      <Area
                        dataKey="value"
                        name={isActivity ? "Activity fit" : definition.label}
                        type="monotone"
                        stroke="#ffe1a2"
                        strokeWidth={3}
                        fill="url(#deepCurve)"
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="small">
                  {isActivity
                    ? "More green means fewer trade-offs. Every hour is calculated from the actual forecast."
                    : "Your local time. Gaps mean the provider does not have that reading."}
                </p>
                {isActivity && (
                  <div className="score-timeline dive-timeline">
                    {chart.map((h, j) => (
                      <button
                        key={j}
                        style={{ background: scoreColor(h.value ?? NaN) }}
                        title={`${h.time}: ${fmt(h.value ?? NaN)}/100`}
                        onClick={() =>
                          experience.openDive({ ...request, time: h.timestamp })
                        }
                        aria-label={`${h.time}, score ${fmt(h.value ?? NaN)}, explore conditions`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="what-if-panel">
                <span className="tiny-badge">
                  YOUR EXPERIMENT · NOT A FORECAST
                </span>
                <p>Change the air. See which parts of the story move.</p>
                {[
                  {
                    label: "Air temperature",
                    n: temperature,
                    set: setTemperature,
                    min: -25,
                    max: 42,
                    unit: "°C",
                  },
                  {
                    label: "Relative humidity",
                    n: humidity,
                    set: setHumidity,
                    min: 5,
                    max: 100,
                    unit: "%",
                  },
                  {
                    label: "Surface wind",
                    n: wind,
                    set: setWind,
                    min: 0,
                    max: 100,
                    unit: "km/h",
                  },
                ].map((control) => (
                  <label key={control.label}>
                    {control.label}
                    <b className="numeric">
                      {fmt(control.n, 1)} {control.unit}
                    </b>
                    <input
                      aria-label={`What-if ${control.label}`}
                      type="range"
                      min={control.min}
                      max={control.max}
                      step=".5"
                      value={control.n}
                      onChange={(e) => control.set(+e.target.value)}
                    />
                  </label>
                ))}
                {!isActivity &&
                  (w.hourly[key] || air?.hourly[key]) &&
                  ![
                    "temperature_2m",
                    "relative_humidity_2m",
                    "wind_speed_10m",
                  ].includes(key) && (
                    <label>
                      {definition.label}
                      <b className="numeric">
                        {fmt(custom ?? definition.read(w, air, index), 1)}{" "}
                        {definition.unit}
                      </b>
                      <input
                        aria-label={`What-if ${definition.label}`}
                        type="range"
                        min={definition.range[0]}
                        max={definition.range[1]}
                        step={(definition.range[1] - definition.range[0]) / 100}
                        value={custom ?? definition.read(w, air, index)}
                        onChange={(e) => setCustom(+e.target.value)}
                      />
                    </label>
                  )}
                <button
                  onClick={() => {
                    setTemperature(w.current.temperature_2m);
                    setHumidity(w.current.relative_humidity_2m);
                    setWind(w.current.wind_speed_10m);
                    setCustom(null);
                  }}
                >
                  Reset to this moment
                </button>
                <small>
                  Only this experiment changes. Your city’s actual forecast
                  stays intact.
                </small>
              </div>
            )}
          </div>
        </div>
        {isActivity && (
          <section className="dive-factor-section">
            <h3>Every little thing that changes the score.</h3>
            <div className="dive-factors">
              {activeAnalysis.factors.map((f) => (
                <div key={f.label}>
                  <div className="factor-label">
                    <span>
                      <strong>{f.label}</strong>
                      <small>{f.observation}</small>
                    </span>
                    <b>−{fmt(f.points, 1)} pts</b>
                  </div>
                  <div className="factor-bar">
                    <i style={{ width: `${Math.min(100, f.points)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <footer className="panel-note">
          {pro
            ? "Forecast source: Open-Meteo. Derived formulas, assumptions, and activity weights are documented in the source."
            : "No mysterious AI score. Just the forecast, transparent math, and a little context."}
          {request.title.toLowerCase().includes("pressure") && (
            <a
              href="https://americanmigrainefoundation.org/resource-library/seasonal-migraine/"
              target="_blank"
              rel="noreferrer"
            >
              Weather sensitivity guidance ↗
            </a>
          )}
        </footer>
      </motion.div>
    </div>
  );
}
