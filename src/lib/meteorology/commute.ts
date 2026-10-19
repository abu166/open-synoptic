import {
  currentIndex,
  value,
  type Forecast,
  type AirQuality,
} from "../../types/telemetry.ts";
import { dateKey } from "./time.ts";
import { wardrobe } from "./humanWeather.ts";
import { vaporPressureDeficit, wetBulb, windChill } from "./physics.ts";
export const outingWindows = [
  { key: "now", label: "Right now", start: 0, end: 0 },
  { key: "morning", label: "Morning commute", start: 8, end: 10 },
  { key: "lunch", label: "Lunch walk", start: 12, end: 14 },
  { key: "evening", label: "Evening return", start: 18, end: 21 },
  { key: "day", label: "Full day out", start: 8, end: 22 },
] as const;
export type OutingWindow = (typeof outingWindows)[number]["key"];
export function commuteOutfit(w: Forecast, key: OutingWindow) {
  const window = outingWindows.find((p) => p.key === key)!,
    start = currentIndex(w),
    now = w.current.time * 1000,
    format = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: w.timezone,
    }),
    today = dateKey(new Date(now), w.timezone);
  let indices: number[] = [];
  if (key === "now") indices = [start];
  else {
    const candidates = w.hourly.time
      .map((t, i) => ({
        i,
        time: +new Date(t),
        date: dateKey(new Date(t), w.timezone),
        hour: Number(format.format(new Date(t))),
      }))
      .filter(
        (h) =>
          h.date >= today && h.hour >= window.start && h.hour <= window.end,
      );
    const target = candidates.some((h) => h.date === today && h.time >= now)
      ? today
      : candidates.find((h) => h.date > today)?.date;
    indices = candidates.filter((h) => h.date === target).map((h) => h.i);
  }
  if (!indices.length) indices = [start];
  const read = (field: string) =>
      indices.map((i) => value(w.hourly, field, i)).filter(Number.isFinite),
    min = (a: number[], fallback: number) =>
      a.length ? Math.min(...a) : fallback,
    max = (a: number[], fallback: number) =>
      a.length ? Math.max(...a) : fallback;
  const temps = read("temperature_2m"),
    feels = read("apparent_temperature"),
    rain = max(read("precipitation_probability"), 0),
    wind = max(read("wind_gusts_10m"), w.current.wind_gusts_10m),
    cold = min(feels, w.current.apparent_temperature),
    warm = max(temps, w.current.temperature_2m),
    low = min(temps, w.current.temperature_2m),
    snow = max(read("snowfall"), 0);
  const worst = indices.reduce(
    (best, i) =>
      value(w.hourly, "apparent_temperature", i) <
      value(w.hourly, "apparent_temperature", best)
        ? i
        : best,
    indices[0],
  );
  const snapshot: Forecast = {
    ...w,
    current: {
      ...w.current,
      temperature_2m: low,
      apparent_temperature: cold,
      wind_gusts_10m: wind,
      snowfall: snow,
      weather_code: snow > 0 ? 73 : w.current.weather_code,
    },
  };
  const layers = wardrobe(snapshot).map((layer) =>
    layer.key === "umbrella"
      ? {
          ...layer,
          recommendation:
            rain > 35
              ? wind > 40
                ? "A hood beats an umbrella"
                : "Take a compact umbrella"
              : "Leave it by the door",
          reason: `${Math.round(rain)}% peak rain risk across your outing. ${wind > 40 ? "Strong gusts favor a fitted hood." : ""}`,
        }
      : layer.key === "shoes"
        ? {
            ...layer,
            recommendation:
              snow > 0
                ? "Warm shoes with extra grip"
                : rain > 35
                  ? "Water-resistant shoes"
                  : "Comfortable everyday sneakers",
            reason:
              snow > 0
                ? "Snow is in this window’s forecast."
                : rain > 35
                  ? "Plan for a few wet pavements."
                  : "A dry-ground forecast for this outing.",
          }
        : layer,
  );
  const clock = (i: number) =>
    new Date(w.hourly.time[i]).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: w.timezone,
    });
  return {
    indices,
    layers,
    cold,
    warm,
    low,
    rain,
    wind,
    snow,
    worst,
    from: clock(indices[0]),
    to: clock(indices.at(-1)!),
    date: dateKey(new Date(w.hourly.time[indices[0]]), w.timezone),
    tip:
      warm - cold > 7
        ? `${Math.round(warm)}° at the warm end, but a ${Math.round(cold)}° feels-like low near ${clock(worst)}. Pack a removable warm layer.`
        : rain > 35
          ? `${Math.round(rain)}% peak rain risk. Make your outer layer weather-ready.`
          : `A ${Math.round(cold)}° feels-like floor. ${layers[1].recommendation} keeps the plan simple.`,
  };
}
const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
export function physiologyCues(w: Forecast, air?: AirQuality) {
  const i = currentIndex(w),
    t = value(w.hourly, "temperature_2m", i),
    rh = value(w.hourly, "relative_humidity_2m", i),
    dew = value(w.hourly, "dew_point_2m", i),
    vpd = vaporPressureDeficit(t, rh),
    delta =
      w.current.pressure_msl -
      value(w.hourly, "pressure_msl", Math.max(0, i - 24)),
    hasParticles = Number.isFinite(air?.current.pm2_5),
    a = hasParticles ? air!.current.pm2_5 : 0;
  const trace = Array.from({ length: 25 }, (_, j) => {
    const k = Math.max(1, i - 24 + j);
    return (
      value(w.hourly, "pressure_msl", k) -
      value(w.hourly, "pressure_msl", k - 1)
    );
  });
  const light = Array.from({ length: 24 }, (_, j) => {
    const k = Math.min(i + j, w.hourly.time.length - 1),
      radiation =
        value(w.hourly, "direct_radiation", k) +
        value(w.hourly, "diffuse_radiation", k);
    return {
      time: w.hourly.time[k],
      radiation,
      score: clamp((Math.log1p(Math.max(0, radiation)) / Math.log(801)) * 100),
    };
  });
  const best = light.reduce((a, b) => (b.score > a.score ? b : a), light[0]),
    wet = wetBulb(t, rh),
    chill = windChill(t, w.current.wind_speed_10m);
  return {
    delta,
    trace,
    light,
    best,
    dew,
    vpd,
    pm: a,
    cues: [
      {
        key: "pressure",
        title: "Pressure-change intensity",
        value: clamp(
          Math.abs(delta) * 5 + Math.max(...trace.map(Math.abs)) * 12,
        ),
        detail: `${delta > 0 ? "+" : ""}${delta.toFixed(1)} hPa over 24h. ${Math.abs(delta) > 6 ? "A useful cue if weather shifts are one of your personal sensitivities." : "A relatively steady atmospheric rhythm."}`,
        metric: "pressure_msl",
        series: trace,
        unit: "hPa/h",
      },
      {
        key: "light",
        title: "Daylight & alertness opportunity",
        value: light[0].score,
        detail: `${Math.round(light[0].radiation)} W/m² forecast daylight. Your brightest outdoor break is near ${new Date(best.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: w.timezone })}.`,
        metric: "direct_radiation",
        series: light.map((p) => p.score),
        unit: "light /100",
      },
      {
        key: "breath",
        title: "Airway drying & particle exposure",
        value: clamp(Math.max(0, 5 - dew) * 3 + vpd * 15 + a * 0.6),
        detail: `${dew.toFixed(1)}° dew point · ${hasParticles ? `${a.toFixed(1)} µg/m³ PM₂.₅.` : "Moisture-based exposure cue."} ${dew < 3 ? "Cool, dry air can feel sharp on the nose. A soft scarf may feel welcome." : "The moisture balance feels gentler on a slow walk."}`,
        metric: "vapour_pressure_deficit",
        series: Array.from({ length: 24 }, (_, j) => {
          const k = Math.min(i + j, w.hourly.time.length - 1);
          return Math.max(0, 5 - value(w.hourly, "dew_point_2m", k)) * 3;
        }),
        unit: "dry-air cue",
      },
      {
        key: "thermal",
        title: "Outdoor thermoregulation load",
        value: clamp(
          Math.max(0, 10 - chill) * 3 +
            Math.max(0, wet - 20) * 6 +
            Math.max(0, w.current.wind_gusts_10m - 25) * 0.5,
        ),
        detail: `${chill.toFixed(1)}° wind-chill equivalent · ${wet.toFixed(1)}° wet-bulb. ${chill < 5 ? "Protect hands and ears; layers do the quiet work." : wet > 23 ? "Keep the pace gentle and find some shade." : "A comfortable pace leaves room to enjoy the air."}`,
        metric: "wet_bulb",
        series: Array.from({ length: 24 }, (_, j) => {
          const k = Math.min(i + j, w.hourly.time.length - 1);
          return (
            Math.max(0, 10 - value(w.hourly, "apparent_temperature", k)) * 3
          );
        }),
        unit: "thermal cue",
      },
    ],
  };
}
