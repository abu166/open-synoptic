import { useMemo, useState } from "react";
import {
  Moon,
  Sunrise,
  Download,
  ChevronLeft,
  ChevronRight,
  Stars,
} from "lucide-react";
import type { PanelProps } from "../../types/telemetry";
import { value } from "../../types/telemetry";
import {
  lunarPhase,
  lunarPosition,
  solarPosition,
  solarWindows,
} from "../../lib/meteorology/ephemeris";
import {
  lightWindows,
  nextMoonPhase,
  moonCrossings,
  phaseName,
} from "../../lib/planning/sky";
import { zonedMidnight } from "../../lib/meteorology/time";
import { skyAesthetics } from "../../lib/meteorology/skyAesthetics";
import { calendarEvent, downloadFile } from "../../lib/planning/plans";
import { dateLocale } from "../../i18n/locale";
export default function SkyPlanner({ weather: w, city, air }: PanelProps) {
  const [day, setDay] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const zone = w.timezone,
    base = w.current.time * 1000;
  const date = useMemo(
    () =>
      new Date(
        +zonedMidnight(new Date(base), zone) + day * 86400000 + 12 * 3600000,
      ),
    [base, zone, day],
  );
  const windows = useMemo(
    () => lightWindows(date, city.latitude, city.longitude, zone),
    [date, city.latitude, city.longitude, zone],
  );
  const crossings = useMemo(
    () => moonCrossings(date, city.latitude, city.longitude, zone),
    [date, city.latitude, city.longitude, zone],
  );
  const solar = useMemo(
    () =>
      solarWindows(date, city.latitude, city.longitude, zone).sunrise.map(
        (time) => ({
          time: +time,
          rising:
            solarPosition(
              new Date(+time + 60000),
              city.latitude,
              city.longitude,
            ).elevation >
            solarPosition(
              new Date(+time - 60000),
              city.latitude,
              city.longitude,
            ).elevation,
        }),
      ),
    [date, city.latitude, city.longitude, zone],
  );
  const moon = lunarPhase(date);
  const phases = useMemo(
    () =>
      (
        [
          ["Full moon", 180],
          ["New moon", 0],
          ["First quarter", 90],
          ["Last quarter", 270],
        ] as const
      )
        .map(([name, target]) => ({
          name,
          time: nextMoonPhase(new Date(base), target),
        }))
        .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity)),
    [base],
  );
  const clock = (t: number) =>
    new Date(t).toLocaleTimeString(dateLocale(), {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
    });
  const stamp = (t: number) =>
    new Date(t).toLocaleString(dateLocale(), {
      timeZone: zone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const selection =
    windows.find((x) => `${x.start}` === selected) ??
    windows.find((x) => x.kind === "Evening golden hour") ??
    windows[0];
  const midpoint = selection ? (selection.start + selection.end) / 2 : +date;
  const i = w.hourly.time.findIndex(
    (t) => Math.abs(Date.parse(t) - midpoint) <= 1800000,
  );
  const ai =
    air?.hourly.time.findIndex(
      (t) => Math.abs(Date.parse(t) - midpoint) <= 1800000,
    ) ?? -1;
  const low = value(w.hourly, "cloud_cover_low", i),
    mid = value(w.hourly, "cloud_cover_mid", i),
    high = value(w.hourly, "cloud_cover_high", i),
    humidity = value(w.hourly, "relative_humidity_2m", i);
  const aod =
    air && ai >= 0 ? value(air.hourly, "aerosol_optical_depth", ai) : NaN;
  const quality = [low, mid, high, humidity].every(Number.isFinite)
    ? skyAesthetics({
        low,
        mid,
        high,
        humidity,
        aod: Number.isFinite(aod) ? aod : 0.12,
      })
    : undefined;
  const moonAbove = lunarPosition(
    new Date(midpoint),
    city.latitude,
    city.longitude,
  ).elevation;
  const illumination = lunarPhase(new Date(midpoint)).illumination;
  function exportWindow() {
    if (!selection) return;
    downloadFile(
      "aetheris-sky.ics",
      calendarEvent(
        `${selection.kind} · ${city.name}`,
        selection.start,
        selection.end,
        `Astronomical estimate. ${zone}. Local terrain and clouds can change visibility.`,
        `sky-${city.latitude}-${selection.start}`,
      ),
    );
  }
  return (
    <section
      className="glass-card span-12 sky-planner"
      aria-label="Sky planner"
    >
      <header className="card-heading">
        <div>
          <span className="eyebrow">
            <Stars size={14} /> MAKE TIME FOR THE SKY
          </span>
          <h2>Golden light. Moonlit nights.</h2>
        </div>
        <div className="decision-actions">
          <button
            aria-label="Previous sky day"
            disabled={day === 0}
            onClick={() => setDay((d) => d - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {date.toLocaleDateString(dateLocale(), {
              timeZone: zone,
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <button
            aria-label="Next sky day"
            disabled={day === 6}
            onClick={() => setDay((d) => d + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </header>
      <div className="sky-layout">
        <div className="sky-light-panel">
          <div className="sky-horizon" aria-hidden="true">
            <span />
            <Sunrise size={46} />
          </div>
          <h3>Find your light</h3>
          <div className="sun-times">
            {solar.map((x) => (
              <span key={x.time}>
                <small>{x.rising ? "Sunrise" : "Sunset"}</small>
                <b>{clock(x.time)}</b>
              </span>
            ))}
            {!solar.length && (
              <p>No sunrise or sunset crossing this local day.</p>
            )}
          </div>
          <p>
            Golden hour: sun −4° to +6°. Blue hour: −6° to −4°. Dark sky: below
            −18°.
          </p>
          <div className="sky-window-list">
            {windows.map((x) => (
              <button
                key={`${x.kind}-${x.start}`}
                aria-pressed={selection === x}
                onClick={() => setSelected(`${x.start}`)}
              >
                <span>
                  {x.kind}
                  {x.clipped ? " · day boundary" : ""}
                </span>
                <strong>
                  {clock(x.start)}–{clock(x.end)}
                </strong>
              </button>
            ))}
          </div>
          {!windows.length && (
            <p>
              No golden, blue or astronomical dark interval on this local day.
              Polar daylight can keep the sun above these thresholds.
            </p>
          )}
          {selection && (
            <div className="sky-selection">
              <span className="eyebrow">{selection.kind}</span>
              <h3>
                {clock(selection.start)}–{clock(selection.end)}
              </h3>
              <p>
                {Math.round((selection.end - selection.start) / 60000)} minutes
                · sun azimuth{" "}
                {solarPosition(
                  new Date(midpoint),
                  city.latitude,
                  city.longitude,
                ).azimuth.toFixed(0)}
                ° at midpoint
              </p>
              <button onClick={exportWindow}>
                <Download size={15} /> Add this sky window to calendar
              </button>
              {selection.kind === "Dark sky" ? (
                <p>
                  {moonAbove > 0
                    ? `Moon above horizon (${moonAbove.toFixed(0)}°), ${Math.round(illumination * 100)}% lit. Moonlight can reduce faint-star visibility.`
                    : "Moon below horizon at the window midpoint."}{" "}
                  {Number.isFinite(low)
                    ? `Low cloud ${Math.round(low)}%.`
                    : "Cloud forecast unavailable."}{" "}
                  Light pollution is not modeled.
                </p>
              ) : quality ? (
                <>
                  <div className="sky-palette" aria-hidden="true">
                    {quality.palette.map((c) => (
                      <span key={c} style={{ background: c }} />
                    ))}
                  </div>
                  <h4>{quality.name}</h4>
                  <p>{quality.explanation}</p>
                  <p>
                    Low cloud {Math.round(low)}% · mid {Math.round(mid)}% · high{" "}
                    {Math.round(high)}%.{" "}
                    {Number.isFinite(aod)
                      ? "Forecast haze included."
                      : "Haze unavailable; a neutral assumption is used."}
                  </p>
                </>
              ) : (
                <p>
                  Weather-dependent viewing quality unavailable for this window.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="sky-moon-panel">
          <div
            className="moon-portrait"
            role="img"
            aria-label={`${phaseName(moon.angle)}, ${Math.round(moon.illumination * 100)}% illuminated`}
          >
            <div
              className="moon-sphere"
              style={{
                background:
                  moon.angle < 180
                    ? "linear-gradient(90deg,#172236 50%,#dbe1e9 50%)"
                    : "linear-gradient(90deg,#dbe1e9 50%,#172236 50%)",
              }}
            >
              <span
                style={{
                  transform: `scaleX(${Math.abs(1 - 2 * moon.illumination)})`,
                  background: moon.illumination < 0.5 ? "#172236" : "#dbe1e9",
                }}
              />
            </div>
          </div>
          <span className="eyebrow">
            <Moon size={14} /> LUNAR CALENDAR
          </span>
          <h3>{phaseName(moon.angle)}</h3>
          <p>
            {Math.round(moon.illumination * 100)}% illuminated at local noon ·{" "}
            {moon.age.toFixed(1)} days into an approximate cycle
          </p>
          <p>
            A full moon happens when the Moon is opposite the Sun in the sky and
            its Earth-facing side is almost completely sunlit. It rises roughly
            around sunset; exact timing varies.
          </p>
          <div className="moon-events">
            {crossings.events.map((x) => (
              <p key={x.time}>
                <span>{x.kind}</span>
                <strong>{clock(x.time)}</strong>
              </p>
            ))}
            {!crossings.events.length && (
              <p>
                {crossings.aboveAtMidnight
                  ? "Moon stays above the geometric horizon this day."
                  : "Moon stays below the geometric horizon this day."}
              </p>
            )}
          </div>
          <h4>Next lunar milestones</h4>
          {phases.map((p) => (
            <div className="moon-milestone" key={p.name}>
              <div>
                <strong>{p.name}</strong>
                <small>{p.time ? `≈ ${stamp(p.time)}` : "Unavailable"}</small>
              </div>
              {p.time && (
                <button
                  aria-label={`Export ${p.name}`}
                  onClick={() =>
                    downloadFile(
                      "aetheris-moon.ics",
                      calendarEvent(
                        p.name,
                        p.time!,
                        p.time! + 3600000,
                        `Approximate lunar phase instant; calendar duration is a reminder, not the length of the phase. ${city.name}.`,
                        `moon-${p.name}-${p.time}`,
                      ),
                    )
                  }
                >
                  <Download size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="panel-note">
        All times in {zone}. Compact astronomy approximations; phase times are
        estimates. Moonrise/set use the geometric center at 0° and omit
        refraction. Terrain, obstructions and light pollution are not modeled.
        Sky colors are a planning heuristic, not a guarantee.
      </p>
    </section>
  );
}
