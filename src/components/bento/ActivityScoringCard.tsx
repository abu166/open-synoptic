import { dateLocale } from "../../i18n/locale";
import {
  Bike,
  Navigation,
  Stars,
  Camera,
  Sprout,
  HeartPulse,
  ArrowUpRight,
} from "lucide-react";
import Glass from "../ui/GlassBentoCard";
import {
  activities,
  activityBreakdown,
  bestWindow,
  scores,
  scoreColor,
} from "../../lib/meteorology/activityScorer";
import { currentIndex, value, type PanelProps } from "../../types/telemetry";
import { useExperience } from "../../experience/ExperienceContext";
import { fmt } from "../../lib/units/converter";
const icons = [Bike, Navigation, Stars, Camera, Sprout, HeartPulse];
export default function ActivityScoringCard({ weather: w, air }: PanelProps) {
  const i = currentIndex(w),
    analyses = activityBreakdown(
      w,
      i,
      air?.current.us_aqi,
      undefined,
      air?.current.aerosol_optical_depth,
    ),
    experience = useExperience();
  const timeline = Array.from({ length: 24 }, (_, j) => {
    const k = Math.min(i + j, w.hourly.time.length - 1),
      ai = air?.hourly.time.indexOf(w.hourly.time[k]) ?? -1;
    return {
      time: w.hourly.time[k],
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
  });
  return (
    <Glass
      title="Make a little plan. Find your moment."
      eyebrow="OUTDOOR INTELLIGENCE, MADE PERSONAL"
      className="span-12 activity-card"
      dive={{ title: "Endurance", activity: 0 }}
    >
      <p className="activity-intro">
        Good weather means something different to everyone. See what’s helping,
        what’s holding you back, and when the balance changes.
      </p>
      <div className="activity-grid">
        {activities.map((a, j) => {
          const Icon = icons[j],
            analysis = analyses[j],
            color = scoreColor(analysis.score),
            best = bestWindow(
              w,
              j,
              air?.current.us_aqi,
              undefined,
              air?.current.aerosol_optical_depth,
            ),
            factors = [...analysis.factors]
              .sort((a, b) => b.points - a.points)
              .slice(0, 3);
          return (
            <button
              key={a}
              className="activity-item"
              onClick={() => experience?.openDive({ title: a, activity: j })}
            >
              <div className="activity-heading">
                <Icon size={26} />
                <ArrowUpRight size={20} />
              </div>
              <h3>{a}</h3>
              <div className="activity-score" style={{ color }}>
                <b className="numeric">{fmt(analysis.score)}</b>
                <span>
                  / 100
                  <small>
                    {!analysis.available
                      ? "Some data unavailable"
                      : analysis.score >= 70
                        ? "A good window"
                        : analysis.score >= 40
                          ? "A few trade-offs"
                          : "Wait for a better moment"}
                  </small>
                </span>
              </div>
              <div className="meter">
                <i
                  style={{
                    width: `${analysis.available ? analysis.score : 0}%`,
                    background: color,
                  }}
                />
              </div>
              <div className="activity-factors">
                {factors.map((f) => (
                  <div key={f.label}>
                    <div className="factor-label">
                      <span>
                        {f.label}
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
              <div
                className="score-timeline"
                aria-label="24-hour score timeline"
              >
                {timeline.map((h) => (
                  <i
                    key={h.time}
                    title={`${new Date(h.time).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", timeZone: w.timezone })}: ${fmt(h.scores[j])}/100`}
                    style={{ background: scoreColor(h.scores[j]) }}
                  />
                ))}
              </div>
              <div className="score-timeline-labels">
                <span>Now</span>
                <span>+12h</span>
                <span>+24h</span>
              </div>
              <div className="activity-window">
                <span>YOUR BEST THREE-HOUR WINDOW</span>
                <b>
                  {new Date(best).toLocaleTimeString(dateLocale(), {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: w.timezone,
                  })}{" "}
                  –{" "}
                  {new Date(+new Date(best) + 10800000).toLocaleTimeString(
                    dateLocale(),
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: w.timezone,
                    },
                  )}
                </b>
              </div>
            </button>
          );
        })}
      </div>
      <footer className="panel-note">
        Tap an activity to see what’s helping, what’s holding you back, and the
        hour when the balance changes.
      </footer>
    </Glass>
  );
}
