import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Share2, Download } from "lucide-react";
import { getForecast } from "../../api/openMeteoClient";
import { cityKey } from "../../api/resilience";
import { usePlanningStore } from "../../store/usePlanningStore";
import { useWeatherStore } from "../../store/useWeatherStore";
import {
  evaluatePlan,
  calendarEvent,
  downloadFile,
  planLink,
  type Plan,
} from "../../lib/planning/plans";
import { forecastSample } from "../../lib/planning/provenance";
import { dateLocale, translate } from "../../i18n/locale";
import { temperature, speed, speedLabel } from "../../lib/units/converter";
import { timeLabel } from "./format";
import { ForecastCapture } from "./ForecastCapture";
import Confidence from "./Confidence";
export default function PlanCard({
  plan,
  onEdit,
  onRemove,
  now,
}: {
  plan: Plan;
  onEdit: (p: Plan) => void;
  onRemove: (p: Plan) => void;
  now: number;
}) {
  const store = usePlanningStore(),
    units = useWeatherStore((s) => s.units),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["forecast", plan.city.latitude, plan.city.longitude],
    queryFn: ({ signal }) => getForecast(plan.city, signal),
    staleTime: 600000,
    refetchInterval: 600000,
  });
  const result = useMemo(
    () => (query.data ? evaluatePlan(query.data, plan, now) : undefined),
    [query.data, plan, now],
  );
  const window = result?.best,
    closest = result?.closest;
  const zone = query.data?.timezone ?? plan.city.timezone;
  const feed = store.feed[cityKey(plan.city)] ?? [];
  const relevant = feed.filter((c) =>
    result?.windows.some(
      (w) =>
        (c.time >= w.start && c.time < w.end) ||
        (w.returnTime !== undefined &&
          c.time >= w.returnTime &&
          c.time < w.returnTime + plan.duration * 3600000),
    ),
  );
  const previous = store.history[cityKey(plan.city)]?.at(-2);
  const previousResult = useMemo(() => {
    if (!previous || !query.data) return;
    const w = structuredClone(query.data),
      lookup = new Map(previous.hours.map((h) => [h.time, h]));
    for (const [field, key] of [
      ["apparent_temperature", "temp"],
      ["precipitation_probability", "rain"],
      ["wind_gusts_10m", "gust"],
    ] as const)
      w.hourly[field] = w.hourly.time.map(
        (t) => lookup.get(Date.parse(t))?.[key] ?? null,
      );
    return evaluatePlan(w, plan, now);
  }, [previous, query.data, plan, now]);
  const changed =
    previousResult &&
    (!!previousResult.best !== !!window ||
      (previousResult.best &&
        window &&
        previousResult.best.start !== window.start));
  const status = window
    ? "Fits every hard limit"
    : closest
      ? "No window meets every limit"
      : "No eligible forecast hours";
  const exportPlan = () => {
    if (!window) return;
    const description = `${plan.city.name}. Forecast-based plan; check again before leaving. Rain ≤${plan.rain}%, gust ≤${plan.gust} km/h, feels-like ${plan.minTemp}–${plan.maxTemp}°C. ${planLink(plan, location.href)}`;
    let ics = calendarEvent(
      plan.name,
      window.start,
      window.end,
      description,
      `${plan.id}-${window.start}`,
    );
    if (window.returnTime) {
      const back = calendarEvent(
        `${plan.name} — return`,
        window.returnTime,
        window.returnTime + plan.duration * 3600000,
        description,
        `${plan.id}-${window.returnTime}`,
      );
      ics = ics.replace(
        "END:VCALENDAR\r\n",
        back.slice(back.indexOf("BEGIN:VEVENT")),
      );
    }
    downloadFile("aetheris-plan.ics", ics);
    setMessage(
      "Calendar downloaded. Exported events do not update automatically.",
    );
  };
  async function share() {
    const url = planLink(plan, location.href);
    try {
      await navigator.clipboard.writeText(url);
      setMessage(
        "Plan link copied. It includes your selected location and preferences.",
      );
    } catch {
      setMessage(url);
    }
  }
  const t = (n: number) =>
    `${temperature(n, units).toFixed(0)}°${units === "imperial" ? "F" : "C"}`;
  return (
    <article className="saved-plan">
      {query.data && <ForecastCapture weather={query.data} city={plan.city} />}
      <header>
        <div>
          <span className="eyebrow">
            {plan.city.name} · {plan.date || "Recurring"} · {plan.duration}h
          </span>
          <h3>{plan.name}</h3>
        </div>
        <div className="decision-actions">
          <button onClick={() => onEdit(plan)}>Edit</button>
          <button
            aria-label={`Delete ${plan.name}`}
            onClick={() => onRemove(plan)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <div className={`plan-status ${window ? "fits" : "blocked"}`}>
        {query.isPending
          ? "Checking your plan…"
          : query.isError
            ? "Forecast unavailable"
            : status}
      </div>
      {query.isError && (
        <button onClick={() => void query.refetch()}>Retry forecast</button>
      )}
      {window ? (
        <>
          <h4>
            {timeLabel(window.start, zone)} →{" "}
            {new Date(window.end).toLocaleTimeString(dateLocale(), {
              timeZone: zone,
              hour: "2-digit",
              minute: "2-digit",
            })}
          </h4>
          <p>
            Nearest qualifying day · windows ranked by your preferred
            temperature, rain and wind.
          </p>
          <div className="decision-metrics">
            <span>
              <b>{Math.round(window.rain)}%</b>maximum hourly rain risk
            </span>
            <span>
              <b>
                {speed(window.gust, units).toFixed(0)} {speedLabel(units)}
              </b>
              maximum gust
            </span>
            <span>
              <b>
                {t(window.cold)}–{t(window.hot)}
              </b>
              feels-like range
            </span>
          </div>
          {window.returnTime && (
            <p>
              Return: {timeLabel(window.returnTime, zone)} · coldest feels-like{" "}
              {t(window.returnCold!)}. Both journeys meet your limits.
            </p>
          )}
          <p>
            {window.cold < 10 ? "Prepare a warm layer. " : ""}
            {window.rain >= 20 ? "Carry rain protection. " : ""}
            {window.gust >= 25 ? "Expect exposed sections to feel windy. " : ""}
            {window.cold >= 10 && window.rain < 20 && window.gust < 25
              ? "Light layers suit this window."
              : ""}
          </p>
          <p>
            <strong>Backup: </strong>
            {result?.backup
              ? timeLabel(result.backup.start, zone)
              : "No separate qualifying window in this forecast."}
          </p>
          <div className="decision-actions">
            <button onClick={exportPlan}>
              <Download size={15} />
              Calendar
            </button>
            <button onClick={() => void share()}>
              <Share2 size={15} />
              Share plan
            </button>
          </div>
          <Confidence city={plan.city} window={window} gust={plan.gust} />
        </>
      ) : closest ? (
        <>
          <p>Closest option: {timeLabel(closest.start, zone)}</p>
          <p>
            <strong>Blocked by: </strong>
            {closest.failures.map((x) => translate(x)).join(" · ")}
          </p>
          <p>
            Try a shorter outing, a different day, or review the specific limit.
            No failed window is recommended.
          </p>
          {plan.duration > 0.5 && (
            <button
              onClick={() =>
                onEdit({
                  ...plan,
                  duration: Math.max(0.5, plan.duration - 0.5),
                })
              }
            >
              Try 30 minutes shorter
            </button>
          )}
        </>
      ) : !query.isPending && !query.isError ? (
        <p>
          Choose a date in the next seven days, enable a weekday, or widen your
          departure hours.
        </p>
      ) : null}
      {query.data && (
        <p className="panel-note">
          {query.data.provenance?.source === "cached"
            ? "Saved forecast"
            : "Live forecast"}{" "}
          · fetched{" "}
          {query.data.provenance
            ? timeLabel(query.data.provenance.fetchedAt, zone)
            : "time unavailable"}{" "}
          · {zone}
        </p>
      )}
      {query.data && (
        <details className="decision-details">
          <summary>Inspect the forecast inputs</summary>
          <p>
            Provider: {query.data.provenance?.provider ?? "Open-Meteo"} · model
            selection: {query.data.provenance?.model ?? "best_match"}. No
            generated scenarios enter the plan decision.
          </p>
          <div className="verification-scroll">
            <table className="input-table">
              <thead>
                <tr>
                  <th>Valid time</th>
                  <th>Input</th>
                  <th>Value</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {query.data.hourly.time.flatMap((time, i) => {
                  const at = Date.parse(time),
                    target = window ?? closest;
                  if (
                    !target ||
                    !(
                      (at >= target.start && at < target.end) ||
                      (target.returnTime !== undefined &&
                        at >= target.returnTime &&
                        at < target.returnTime + plan.duration * 3600000)
                    )
                  )
                    return [];
                  return (
                    [
                      "apparent_temperature",
                      "precipitation_probability",
                      "wind_gusts_10m",
                      "is_day",
                    ] as const
                  ).map((field) => {
                    const sample = forecastSample(query.data!, field, i);
                    return (
                      <tr key={`${time}-${field}`}>
                        <td>{timeLabel(at, zone)}</td>
                        <td>{field}</td>
                        <td>{sample.value ?? sample.missingReason}</td>
                        <td>{sample.source}</td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(changed || relevant.length > 0) && (
        <details className="decision-details">
          <summary>
            {changed
              ? "Your recommended window changed"
              : "Weather changes affecting this plan"}{" "}
            · {relevant.length}
          </summary>
          {changed && (
            <p>
              {previousResult?.best
                ? `Previous best: ${timeLabel(previousResult.best.start, zone)}.`
                : "Previously no window qualified."}{" "}
              {window
                ? `Current best: ${timeLabel(window.start, zone)}.`
                : "No window currently qualifies."}
            </p>
          )}
          {relevant.slice(0, 6).map((c) => (
            <p key={c.id}>
              {timeLabel(c.time, zone)} ·{" "}
              {c.field === "rain"
                ? "Rain risk"
                : c.field === "gust"
                  ? "Gust"
                  : "Feels-like"}
              : {c.before.toFixed(0)} → {c.after.toFixed(0)}{" "}
              {c.field === "rain" ? "%" : c.field === "gust" ? "km/h" : "°C"}
            </p>
          ))}
        </details>
      )}
      <details className="decision-details">
        <summary>Was this recommendation useful?</summary>
        <div className="decision-actions">
          {(["Helpful", "Too cold", "Too windy", "Too wet"] as const).map(
            (v) => (
              <button
                aria-pressed={store.feedback[plan.id] === v}
                key={v}
                onClick={() => store.respond(plan.id, v)}
              >
                {v}
              </button>
            ),
          )}
        </div>
        {store.feedback[plan.id] && (
          <>
            <p>Saved on this device. Feedback does not alter the forecast.</p>
            {store.feedback[plan.id] !== "Helpful" && (
              <button
                onClick={() =>
                  onEdit({
                    ...plan,
                    minTemp:
                      store.feedback[plan.id] === "Too cold"
                        ? Math.min(plan.maxTemp, plan.minTemp + 3)
                        : plan.minTemp,
                    gust:
                      store.feedback[plan.id] === "Too windy"
                        ? Math.max(0, plan.gust - 5)
                        : plan.gust,
                    rain:
                      store.feedback[plan.id] === "Too wet"
                        ? Math.max(0, plan.rain - 10)
                        : plan.rain,
                  })
                }
              >
                Review stricter personal limits
              </button>
            )}
          </>
        )}
      </details>
      <p role="status" className="decision-message">
        {message}
      </p>
    </article>
  );
}
