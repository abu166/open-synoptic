import { localizedDate } from "../../i18n/locale";
import { MapPin, Wind, ArrowUpRight, MoveUpRight } from "lucide-react";
import { value, todayDailyIndex, type PanelProps } from "../../types/telemetry";
import { useWeatherStore } from "../../store/useWeatherStore";
import { temperature, fmt } from "../../lib/units/converter";
import { weatherDescription } from "../../lib/meteorology/wmoCodes";
import { weatherStory } from "../../lib/meteorology/humanWeather";
import { useExperience } from "../../experience/ExperienceContext";
import WeatherIcon from "../ui/WeatherIcon";
import AnimatedNumber from "../ui/AnimatedNumber";
export default function HeroSynopticCard({
  weather: w,
  city,
  anomaly,
}: { anomaly?: number } & PanelProps) {
  const units = useWeatherStore((s) => s.units),
    experience = useExperience(),
    c = w.current,
    story = weatherStory(w, city.name),
    i = todayDailyIndex(w),
    t = (n: number) => temperature(n, units),
    future = (experience?.offset ?? 0) > 0;
  const open = () =>
    experience?.openDive({
      title: "Your weather, translated",
      metric: "temperature_2m",
    });
  return (
    <section
      className="hero-card span-12"
      id="overview"
      onClick={(e) => {
        if (!(e.target as Element).closest("button,a,input")) open();
      }}
    >
      <div className="hero-top">
        <span className="eyebrow">
          <span className="live-dot" />
          {future ? "A MOMENT AHEAD" : "YOUR LITTLE CORNER OF EARTH"}
        </span>
        <button
          className="coordinate"
          onClick={() =>
            experience?.openDive({ title: "Your location & conditions" })
          }
        >
          <MapPin size={16} />
          {Math.abs(city.latitude).toFixed(2)}° {city.latitude >= 0 ? "N" : "S"}{" "}
          · {Math.abs(city.longitude).toFixed(2)}°{" "}
          {city.longitude >= 0 ? "E" : "W"}
        </button>
      </div>
      <div className="hero-main">
        <div>
          <div className="location-line">
            <h1>{city.name}</h1>
            <span className="country-badge">{city.country}</span>
          </div>
          <p className="hero-date">
            {localizedDate(new Date(c.time * 1000), {
              weekday: "long",
              month: "long",
              day: "numeric",
              timeZone: w.timezone,
            })}{" "}
            · {weatherDescription(c.weather_code)}
          </p>
          <div className="hero-temperature">
            <AnimatedNumber value={t(c.temperature_2m)} />
            <span>°</span>
            <WeatherIcon code={c.weather_code} night={!c.is_day} size={125} />
          </div>
          <div className="hero-extremes">
            <span>
              High <b>{fmt(t(value(w.daily, "temperature_2m_max", i)))}°</b> Low{" "}
              <b>{fmt(t(value(w.daily, "temperature_2m_min", i)))}°</b>
            </span>
            <span className="hero-feels">
              Feels like <b>{fmt(t(c.apparent_temperature))}°</b>
            </span>
          </div>
          <div className="thermal-pill">
            <Wind size={17} />
            {c.apparent_temperature < c.temperature_2m - 2
              ? "The breeze adds a little bite."
              : c.apparent_temperature > c.temperature_2m + 2
                ? "Humidity makes the warmth linger."
                : "The air feels close to the thermometer."}
          </div>
        </div>
        <div className="hero-editorial">
          <div className="hero-chapter">
            <span className="live-dot" />
            {story.vibe}
          </div>
          <h2 className="hero-emotion">{story.headline}</h2>
          <p className="hero-story">{story.detail}</p>
          <button
            className="hero-story-action"
            onClick={() =>
              experience?.openDive({ title: "What to wear & how you’ll feel" })
            }
          >
            {story.action}
            <MoveUpRight size={20} />
          </button>
        </div>
      </div>
      <div className="hero-bottom">
        <span>
          {Number.isFinite(anomaly)
            ? `${Math.abs(anomaly!).toFixed(1)}° ${anomaly! > 0 ? "warmer" : "cooler"} than this date’s climate normal`
            : "Small details. A bigger sense of the day."}
        </span>
        <button className="hero-forecast-label" onClick={open}>
          {future
            ? "Explore this forecast moment"
            : "Get the story behind the sky"}
          <ArrowUpRight size={19} />
        </button>
      </div>
    </section>
  );
}
