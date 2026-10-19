import { dateLocale } from "../../i18n/locale";
import { useState } from "react";
import { Bike, Navigation, Camera, Stars } from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import { airDensity } from "../../lib/meteorology/physics";
import { solarPosition, lunarPhase } from "../../lib/meteorology/ephemeris";
import { scores, scoreColor } from "../../lib/meteorology/activityScorer";
import { fmt } from "../../lib/units/converter";
import { useExperience } from "../../experience/ExperienceContext";
export default function LifestylePlanners({ weather: w, air }: PanelProps) {
  const [mode, setMode] = useState<"ride" | "run" | "drone" | "light">("ride"),
    [speed, setSpeed] = useState(25),
    [pace, setPace] = useState(6),
    [heading, setHeading] = useState(w.current.wind_direction_10m),
    experience = useExperience(),
    i = currentIndex(w),
    rho = airDensity(
      w.current.temperature_2m,
      w.current.relative_humidity_2m,
      w.current.surface_pressure,
    ),
    direction = ((w.current.wind_direction_10m - heading) * Math.PI) / 180,
    headwind = (w.current.wind_speed_10m * Math.cos(direction)) / 3.6,
    velocity = mode === "run" ? 1000 / (pace * 60) : speed / 3.6,
    relative = Math.max(0, velocity + headwind),
    drag = 0.5 * rho * (mode === "run" ? 0.5 : 0.32) * relative ** 2,
    calmDrag = 0.5 * rho * (mode === "run" ? 0.5 : 0.32) * velocity ** 2,
    extraPower = (drag - calmDrag) * velocity;
  return (
    <Glass
      title="A little planning. A better day outside."
      eyebrow="YOUR PERSONAL FIELD NOTES"
      className="span-12 lifestyle-planners"
    >
      <div className="chart-tabs planner-tabs">
        {(
          [
            { key: "ride", name: "On two wheels", Icon: Bike },
            { key: "run", name: "On your feet", Icon: Bike },
            { key: "drone", name: "Above the rooftops", Icon: Navigation },
            { key: "light", name: "Chasing the light", Icon: Camera },
          ] as const
        ).map(({ key, name, Icon }) => (
          <button
            className={mode === key ? "selected" : ""}
            key={key}
            onClick={() => setMode(key)}
          >
            <Icon size={19} />
            {name}
          </button>
        ))}
      </div>
      {mode === "ride" || mode === "run" ? (
        <div className="planner-grid">
          <div className="planner-story">
            <span className="eyebrow">
              {mode === "ride"
                ? "THE WIND RIDES WITH YOU"
                : "YOUR PACE, MEETS THE AIR"}
            </span>
            <h3>
              {headwind > 2
                ? "Save a little for the way home."
                : headwind < -2
                  ? "A little push from the weather."
                  : "A fairly neutral breeze."}
            </h3>
            <p>
              Choose your direction and{" "}
              {mode === "run" ? "usual pace" : "cruising speed"}. We’ll separate
              the headwind from the crosswind and show what the air adds.
            </p>
            <div className="drag-result">
              <strong className="numeric">
                {extraPower > 0 ? "+" : ""}
                {fmt(extraPower)}
                <span>W</span>
              </strong>
              <span>
                {extraPower >= 0
                  ? "extra aerodynamic power"
                  : "aerodynamic power saved"}{" "}
                against the calm-air case
              </span>
            </div>
            <p className="small">
              This simple drag model holds your{" "}
              {mode === "run" ? "pace" : "speed"} fixed. It does not predict
              fatigue, race pace, rolling resistance, hills, or energy from a
              tailwind beyond zero relative airspeed.
            </p>
          </div>
          <div className="planner-controls">
            {mode === "ride" ? (
              <label>
                Your cruising speed<b>{speed} km/h</b>
                <input
                  type="range"
                  aria-label="Cycling speed"
                  min="8"
                  max="50"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                />
              </label>
            ) : (
              <label>
                Your running pace<b>{pace.toFixed(1)} min/km</b>
                <input
                  type="range"
                  aria-label="Running pace"
                  min="3"
                  max="10"
                  step=".1"
                  value={pace}
                  onChange={(e) => setPace(+e.target.value)}
                />
              </label>
            )}
            <label>
              Your travel heading<b>{Math.round(heading)}°</b>
              <input
                type="range"
                aria-label="Travel heading"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => setHeading(+e.target.value)}
              />
            </label>
            <div className="planner-readouts">
              <span>
                Headwind component<b>{fmt(headwind * 3.6, 1)} km/h</b>
              </span>
              <span>
                Crosswind component
                <b>
                  {fmt(
                    Math.abs(w.current.wind_speed_10m * Math.sin(direction)),
                    1,
                  )}{" "}
                  km/h
                </b>
              </span>
              <span>
                Air density<b>{fmt(rho, 3)} kg/m³</b>
              </span>
              <span>
                Relative airspeed<b>{fmt(relative * 3.6, 1)} km/h</b>
              </span>
            </div>
            <button
              onClick={() =>
                experience?.openDive({ title: "Endurance", activity: 0 })
              }
            >
              Find the better three-hour window ↗
            </button>
          </div>
        </div>
      ) : mode === "drone" ? (
        <div className="drone-planner">
          <div>
            <span className="eyebrow">THE AIR CHANGES AS YOU CLIMB</span>
            <h3>
              A calm street can hide
              <br />a livelier sky.
            </h3>
            <p>
              Compare modeled winds above ground. Local obstacles, aircraft
              limits, airspace rules, visibility, and gusts still decide whether
              flying is appropriate.
            </p>
            <button
              onClick={() =>
                experience?.openDive({ title: "Drone flight", activity: 1 })
              }
            >
              See every flight-weather factor ↗
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Altitude</th>
                <th>Wind</th>
                <th>Compared with ground</th>
              </tr>
            </thead>
            <tbody>
              {[10, 80, 120].map((alt) => {
                const n = value(w.hourly, `wind_speed_${alt}m`, i);
                return (
                  <tr key={alt}>
                    <td>{alt} m AGL</td>
                    <td>
                      <strong>{fmt(n, 1)} km/h</strong>
                    </td>
                    <td>{fmt(n - w.current.wind_speed_10m, 1)} km/h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="drone-key-metrics">
            <span>
              Peak gust<strong>{fmt(w.current.wind_gusts_10m)} km/h</strong>
            </span>
            <span>
              Visibility
              <strong>
                {fmt(value(w.hourly, "visibility", i) / 1000, 1)} km
              </strong>
            </span>
            <span>
              Storm energy
              <strong>{fmt(value(w.hourly, "cape", i))} J/kg</strong>
            </span>
          </div>
        </div>
      ) : (
        <div className="light-planner">
          <div>
            <Stars size={33} />
            <h3>The right light is a moving target.</h3>
            <p>
              Golden-hour photography prefers the sun near the horizon.
              Stargazing starts with darkness and clear clouds. These hours are
              pulled straight from your forecast.
            </p>
          </div>
          <div className="light-hour-grid">
            {w.hourly.time.slice(i, i + 24).map((time, j) => {
              const k = i + j,
                ss = scores(
                  w,
                  k,
                  air?.current.us_aqi,
                  undefined,
                  air?.current.aerosol_optical_depth,
                ),
                el = solarPosition(
                  new Date(time),
                  w.latitude,
                  w.longitude,
                ).elevation,
                moon = lunarPhase(new Date(time));
              return (
                <button
                  key={time}
                  onClick={() =>
                    experience?.openDive({
                      title: el > -6 ? "Photography" : "Stargazing",
                      activity: el > -6 ? 3 : 2,
                      time: +new Date(time),
                    })
                  }
                >
                  <strong>
                    {new Date(time).toLocaleTimeString(dateLocale(), {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: w.timezone,
                    })}
                  </strong>
                  <span style={{ color: scoreColor(ss[3]) }}>
                    <Camera size={15} />
                    {fmt(ss[3])}
                  </span>
                  <span style={{ color: scoreColor(ss[2]) }}>
                    <Stars size={15} />
                    {fmt(ss[2])}
                  </span>
                  <small>
                    {fmt(el)}° sun · {fmt(moon.illumination * 100)}% moon
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Glass>
  );
}
