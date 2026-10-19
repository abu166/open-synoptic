import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Compass,
  ArrowUpRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import type { City, Forecast } from "../../types/telemetry";
import { cityKey } from "../../api/resilience";
import { usePlanningStore } from "../../store/usePlanningStore";
import {
  defaultPlan,
  evaluatePlan,
  importPlan,
  validatePlan,
  type Plan,
} from "../../lib/planning/plans";
import { dateLocale } from "../../i18n/locale";
import { timeLabel } from "./format";
import { ForecastCapture } from "./ForecastCapture";
import PlanCard from "./PlanCard";
export default function PlanningHub({
  weather,
  city,
  detailed = false,
  onOpen,
}: {
  weather: Forecast;
  city: City;
  detailed?: boolean;
  onOpen?: () => void;
}) {
  const store = usePlanningStore(),
    [now, setNow] = useState(Date.now()),
    [draft, setDraft] = useState<Plan | null>(() =>
      detailed ? (importPlan(location.search) ?? null) : null,
    ),
    [error, setError] = useState(""),
    [removed, setRemoved] = useState<Plan | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const currentPlans = store.plans.filter(
    (p) => cityKey(p.city) === cityKey(city),
  );
  const p = currentPlans[0] ?? defaultPlan(city),
    result = useMemo(
      () => evaluatePlan(weather, p, now, 24),
      [weather, p, now],
    );
  const feed = (store.feed[cityKey(city)] ?? []).filter((c) => c.time >= now);
  const set = <K extends keyof Plan>(key: K, value: Plan[K]) =>
    setDraft((p) => (p ? { ...p, [key]: value } : p));
  function save() {
    if (!draft) return;
    if (!draft.id && store.plans.length >= 30) {
      setError("You have 30 saved plans. Remove a plan before adding another.");
      return;
    }
    const final = {
      ...draft,
      name: draft.name.trim(),
      id: draft.id || crypto.randomUUID(),
      createdAt: draft.createdAt || Date.now(),
    };
    if (!validatePlan(final)) {
      setError(
        "Check the hours, temperature range and selected weekdays. The full outing must fit before the latest finish.",
      );
      return;
    }
    store.save(final);
    setDraft(null);
    setError("");
    const url = new URL(location.href);
    url.searchParams.delete("plan");
    history.replaceState({}, "", url);
  }
  return (
    <section
      className={`glass-card span-12 decision-hub ${detailed ? "expanded" : ""}`}
      aria-label="Daily planning"
    >
      <ForecastCapture weather={weather} city={city} />
      <header className="card-heading">
        <div>
          <span className="eyebrow">
            <Compass size={14} /> YOUR DAY, DECIDED
          </span>
          <h2>
            {detailed
              ? "Plans that follow the weather."
              : "A little preparation. A better day."}
          </h2>
        </div>
        {onOpen && (
          <button onClick={onOpen}>
            My plans <ArrowUpRight size={17} />
          </button>
        )}
      </header>
      <div className="decision-briefing">
        <div>
          <span className="eyebrow">WHAT MATTERS</span>
          <h3>
            {feed.length
              ? `${feed.length} meaningful forecast changes`
              : "Your next outdoor opportunity"}
          </h3>
          <p>
            {feed.length
              ? "Review changes before committing to a departure."
              : "Rain, gusts, feels-like temperature and daylight checked together."}
          </p>
        </div>
        <div>
          <span className="eyebrow">WHEN TO GO</span>
          <h3>
            {result.best
              ? timeLabel(result.best.start, weather.timezone)
              : "A little flexibility needed"}
          </h3>
          <p>
            {currentPlans.length
              ? p.name
              : "Default one-hour outing · 07:00–20:00 · daylight"}{" "}
            ·{" "}
            {result.best
              ? "All hard limits met."
              : "No full window meets your current limits."}
          </p>
        </div>
        <div>
          <span className="eyebrow">WHAT TO PREPARE</span>
          <h3>
            {result.best
              ? result.best.cold < 10
                ? "Bring a warm layer"
                : result.best.rain >= 20
                  ? "Pack rain protection"
                  : "Keep your layers light"
              : "Review your constraints"}
          </h3>
          <p>
            {result.best
              ? `Rain up to ${Math.round(result.best.rain)}% · gust up to ${Math.round(result.best.gust)} km/h.`
              : "Open your plans to inspect the limiting conditions."}
          </p>
        </div>
      </div>
      <p className="panel-note">
        {weather.provenance?.source === "cached"
          ? "Saved forecast — check freshness"
          : "Provider forecast"}{" "}
        ·{" "}
        {weather.provenance
          ? timeLabel(weather.provenance.fetchedAt, weather.timezone)
          : "Fetch time unavailable"}{" "}
        · Recommendations update while this app is open. All times use the plan
        location.
      </p>
      {detailed && (
        <>
          <div className="decision-toolbar">
            <h3>
              <CalendarDays size={20} /> Your saved plans{" "}
              <small>{store.plans.length}/30</small>
            </h3>
            <button
              onClick={() => {
                setDraft(defaultPlan({ ...city, timezone: weather.timezone }));
                setError("");
              }}
            >
              <Plus size={16} />
              New plan
            </button>
          </div>
          {draft && (
            <form
              className="plan-editor"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <h3>
                {draft.id ? "Edit plan" : "Create a plan"} · {draft.city.name}
              </h3>
              <p>
                Plan up to seven days ahead. Hard limits apply to every sampled
                hour, including the return journey. Controls use °C and km/h.
              </p>
              <div className="plan-form-grid">
                <label>
                  Plan name
                  <input
                    autoFocus
                    required
                    maxLength={80}
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </label>
                <label>
                  Date (empty repeats weekly)
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </label>
                <label>
                  Outing / journey length (hours)
                  <input
                    type="number"
                    min="0.5"
                    max="6"
                    step="0.5"
                    value={draft.duration}
                    onChange={(e) => set("duration", +e.target.value)}
                  />
                </label>
                <label>
                  Earliest departure (local hour)
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={draft.startHour}
                    onChange={(e) => set("startHour", +e.target.value)}
                  />
                </label>
                <label>
                  Latest outward finish (local hour)
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={draft.endHour}
                    onChange={(e) => set("endHour", +e.target.value)}
                  />
                </label>
                <label>
                  Return departure after (hours; 0 = none)
                  <input
                    type="number"
                    min="0"
                    max="18"
                    step="1"
                    value={draft.returnAfter}
                    onChange={(e) => set("returnAfter", +e.target.value)}
                  />
                </label>
                <label>
                  Maximum hourly rain risk (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.rain}
                    onChange={(e) => set("rain", +e.target.value)}
                  />
                </label>
                <label>
                  Maximum gust (km/h)
                  <input
                    type="number"
                    min="0"
                    max="150"
                    value={draft.gust}
                    onChange={(e) => set("gust", +e.target.value)}
                  />
                </label>
                <label>
                  Minimum feels-like (°C)
                  <input
                    type="number"
                    min="-70"
                    max="60"
                    value={draft.minTemp}
                    onChange={(e) => set("minTemp", +e.target.value)}
                  />
                </label>
                <label>
                  Maximum feels-like (°C)
                  <input
                    type="number"
                    min="-70"
                    max="60"
                    value={draft.maxTemp}
                    onChange={(e) => set("maxTemp", +e.target.value)}
                  />
                </label>
                <label>
                  Preferred feels-like (°C, soft preference)
                  <input
                    type="number"
                    min="-70"
                    max="60"
                    value={draft.preferredTemp}
                    onChange={(e) => set("preferredTemp", +e.target.value)}
                  />
                </label>
                <label className="plan-check">
                  <input
                    type="checkbox"
                    checked={draft.daylight}
                    onChange={(e) => set("daylight", e.target.checked)}
                  />
                  Require daylight
                </label>
              </div>
              <fieldset>
                <legend>Allowed weekdays</legend>
                <div className="decision-actions">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      type="button"
                      key={d}
                      aria-pressed={draft.days.includes(d)}
                      onClick={() =>
                        set(
                          "days",
                          draft.days.includes(d)
                            ? draft.days.filter((x) => x !== d)
                            : [...draft.days, d],
                        )
                      }
                    >
                      {new Intl.DateTimeFormat(dateLocale(), {
                        weekday: "short",
                        timeZone: "UTC",
                      }).format(new Date(Date.UTC(2026, 9, 18 + d)))}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p>
                Hourly forecasts approximate partial-hour trips conservatively.
                Exported calendar entries are snapshots.
              </p>
              <p role="alert">{error}</p>
              <div className="decision-actions">
                <button type="submit">Save plan</button>
                <button type="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {!store.plans.length && !draft && (
            <div className="plan-empty">
              <CalendarDays size={34} />
              <h3>Give the forecast something to plan for.</h3>
              <p>
                Save a commute, a run, a family walk or an outdoor event. Your
                limits stay on this device.
              </p>
              <button
                onClick={() =>
                  setDraft(defaultPlan({ ...city, timezone: weather.timezone }))
                }
              >
                Create your first plan
              </button>
            </div>
          )}
          <div role="status">
            {removed && (
              <p>
                Plan removed.{" "}
                <button
                  onClick={() => {
                    store.save(removed);
                    setRemoved(null);
                  }}
                >
                  Undo
                </button>
              </p>
            )}
          </div>
          <div className="saved-plans-grid">
            {store.plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onRemove={(p) => {
                  setRemoved(p);
                  store.remove(p.id);
                }}
                onEdit={(p) => {
                  setDraft(p);
                  setError("");
                  setTimeout(
                    () =>
                      document.querySelector(".plan-editor")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                    0,
                  );
                }}
                now={now}
              />
            ))}
          </div>
          <details className="decision-details">
            <summary>
              <RefreshCw size={14} /> What changed in {city.name}? ·{" "}
              {feed.length}
            </summary>
            <p>
              Compared at the same forecast hour. Thresholds: 3°C feels-like, 20
              percentage points of rain risk, or 10 km/h gusts. Repeated changes
              for the same hour are quiet for three hours.
            </p>
            {!feed.length && (
              <p>
                No significant changes yet. A second fresh forecast is needed
                for comparison.
              </p>
            )}
            {feed.slice(0, 12).map((c) => (
              <p key={c.id}>
                {timeLabel(c.time, weather.timezone)} ·{" "}
                {c.field === "rain"
                  ? "Rain risk"
                  : c.field === "gust"
                    ? "Gust"
                    : "Feels-like"}{" "}
                {c.before.toFixed(0)} → {c.after.toFixed(0)}{" "}
                {c.field === "rain" ? "%" : c.field === "gust" ? "km/h" : "°C"}
              </p>
            ))}
            {!!feed.length && (
              <button onClick={() => store.clearFeed(cityKey(city))}>
                Clear change feed
              </button>
            )}
          </details>
        </>
      )}
    </section>
  );
}
