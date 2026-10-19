import { dateLocale } from "../../i18n/locale";
import { useMemo, useState } from "react";
import { CalendarRange, ArrowUpRight } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { useExperience } from "../../experience/ExperienceContext";
import {
  activities,
  scores,
  scoreColor,
} from "../../lib/meteorology/activityScorer";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
export default function OutdoorHourFinder({ weather: w, air }: PanelProps) {
  const [duration, setDuration] = useState(3),
    [minimum, setMinimum] = useState(60),
    [rainLimit, setRain] = useState(40),
    [gustLimit, setGust] = useState(35),
    [selected, setSelected] = useState([0, 5]),
    experience = useExperience(),
    i = currentIndex(w);
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, j) => {
        const k = Math.min(i + j, w.hourly.time.length - 1),
          t = w.hourly.time[k],
          ai = air?.hourly.time.indexOf(t) ?? -1;
        return {
          time: +new Date(t),
          label: new Date(t).toLocaleTimeString(dateLocale(), {
            hour: "2-digit",
            timeZone: w.timezone,
          }),
          rain: value(w.hourly, "precipitation_probability", k),
          gust: value(w.hourly, "wind_gusts_10m", k),
          scores: scores(
            w,
            k,
            air && ai >= 0 ? value(air.hourly, "us_aqi", ai) : undefined,
            undefined,
            air && ai >= 0
              ? value(air.hourly, "aerosol_optical_depth", ai)
              : undefined,
          ),
        };
      }),
    [w, air, i],
  );
  const windows = hours.slice(0, 25 - duration).map((h, j) => {
      const slice = hours.slice(j, j + duration),
        fit = slice.map((x) => Math.min(...selected.map((a) => x.scores[a]))),
        average = fit.reduce((a, b) => a + b, 0) / fit.length,
        qualifies = slice.every(
          (x, k) =>
            fit[k] >= minimum && x.rain <= rainLimit && x.gust <= gustLimit,
        );
      return { start: j, time: h.time, average, qualifies };
    }),
    best = [...windows]
      .filter((p) => p.qualifies)
      .sort((a, b) => b.average - a.average)[0],
    closest = [...windows].sort((a, b) => b.average - a.average)[0];
  return (
    <Glass
      title="Find the hour everyone can look forward to."
      eyebrow="OUTDOOR EVENT & ACTIVITY HOUR FINDER"
      className="span-12 event-hour-finder"
      dive={{ title: activities[selected[0]], activity: selected[0] }}
    >
      <div className="event-controls">
        <label>
          Outing length <b>{duration}h</b>
          <input
            aria-label="Event duration"
            type="range"
            min="1"
            max="6"
            value={duration}
            onChange={(e) => setDuration(+e.target.value)}
          />
        </label>
        <label>
          Minimum activity fit <b>{minimum}/100</b>
          <input
            aria-label="Minimum event fit"
            type="range"
            min="20"
            max="90"
            value={minimum}
            onChange={(e) => setMinimum(+e.target.value)}
          />
        </label>
        <label>
          Maximum rain risk <b>{rainLimit}%</b>
          <input
            aria-label="Maximum event rain risk"
            type="range"
            min="0"
            max="100"
            value={rainLimit}
            onChange={(e) => setRain(+e.target.value)}
          />
        </label>
        <label>
          Maximum gust <b>{gustLimit} km/h</b>
          <input
            aria-label="Maximum event wind gust"
            type="range"
            min="10"
            max="70"
            value={gustLimit}
            onChange={(e) => setGust(+e.target.value)}
          />
        </label>
      </div>
      <div className="event-selection">
        {activities.map((a, j) => (
          <button
            key={a}
            aria-pressed={selected.includes(j)}
            className={selected.includes(j) ? "selected" : ""}
            onClick={() =>
              setSelected((p) =>
                p.includes(j)
                  ? p.length > 1
                    ? p.filter((n) => n !== j)
                    : p
                  : [...p, j],
              )
            }
          >
            {a}
          </button>
        ))}
      </div>
      <div className="event-recommendation">
        <CalendarRange size={27} />
        <div>
          <h3>
            {best
              ? `${hours[best.start].label}:00–${new Date(best.time + duration * 3600000).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", timeZone: w.timezone })}: a little room for your plan.`
              : "A day that asks for a little flexibility."}
          </h3>
          <p>
            {best
              ? `All ${duration} hours meet your rain, wind and selected activity thresholds. Average fit ${Math.round(best.average)}/100.`
              : `No full window meets every filter. The closest activity-fit window starts at ${hours[closest.start].label}:00; try easing a filter to compare the trade-offs.`}
          </p>
        </div>
        <button
          onClick={() => {
            const t = (best ?? closest).time;
            experience?.selectTime(t);
            experience?.openDive({
              title: activities[selected[0]],
              activity: selected[0],
              time: t,
            });
          }}
        >
          Explore this window <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="activity-hour-matrix">
        <div className="matrix-hours">
          <strong>LOCAL TIME</strong>
          {hours.map((h, j) => (
            <span key={j}>{j % 3 === 0 ? h.label : ""}</span>
          ))}
        </div>
        {activities.map((a, j) => (
          <div
            className={`matrix-activity ${selected.includes(j) ? "included" : ""}`}
            key={a}
          >
            <strong>{a}</strong>
            {hours.map((h, k) => (
              <button
                key={h.time}
                aria-label={`${a}, ${h.label}:00, fit ${Math.round(h.scores[j])} out of 100`}
                title={`${h.label}:00 · ${Math.round(h.scores[j])}/100 · rain ${h.rain}% · gust ${Math.round(h.gust)} km/h`}
                className={
                  best && k >= best.start && k < best.start + duration
                    ? "best-window"
                    : ""
                }
                style={{ background: scoreColor(h.scores[j]) }}
                onClick={() =>
                  experience?.openDive({ title: a, activity: j, time: h.time })
                }
              />
            ))}
          </div>
        ))}
      </div>
      <footer className="panel-note">
        Each colored hour opens its exact factor breakdown · green has fewer
        trade-offs · all filters apply to every hour of your outing.
      </footer>
    </Glass>
  );
}
