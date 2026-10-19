import {
  value,
  type Forecast,
  type CurrentWeather,
  type AirQuality,
} from "../types/telemetry.ts";
export function selectedWeather(source: Forecast, offset: number): Forecast {
  if (offset === 0) return source;
  const timestamp = source.current.time * 1000 + offset * 3600000;
  let i = source.hourly.time.findIndex((t) => +new Date(t) >= timestamp);
  if (i < 0) i = source.hourly.time.length - 1;
  const previous = Math.max(0, i - 1),
    span =
      +new Date(source.hourly.time[i]) -
      +new Date(source.hourly.time[previous]),
    fraction = span
      ? Math.max(
          0,
          Math.min(
            1,
            (timestamp - +new Date(source.hourly.time[previous])) / span,
          ),
        )
      : 0;
  const current: CurrentWeather = { ...source.current, time: timestamp / 1000 };
  for (const key of Object.keys(current)) {
    if (key === "time" || key === "interval") continue;
    const a = value(source.hourly, key, previous),
      b = value(source.hourly, key, i);
    if (Number.isFinite(a) && Number.isFinite(b))
      current[key] = ["weather_code", "is_day", "wind_direction_10m"].includes(
        key,
      )
        ? fraction < 0.5
          ? a
          : b
        : a + (b - a) * fraction;
    else if (Number.isFinite(b)) current[key] = b;
    else if (["rain", "snowfall", "showers", "precipitation"].includes(key))
      current[key] = NaN;
    else if (source.hourly[key]) current[key] = NaN;
  }
  return { ...source, current };
}
export function selectedAir(
  source: AirQuality | undefined,
  timestamp: number,
): AirQuality | undefined {
  if (!source) return;
  const index = source.hourly.time.findIndex((t) => +new Date(t) >= timestamp);
  if (index < 0) return source;
  const current = { ...source.current };
  Object.keys(current).forEach((key) => {
    if (key === "time" || key === "interval") return;
    const n = value(source.hourly, key, index);
    current[key] = n;
  });
  return { ...source, current };
}
export const selectedIndex = (w: Forecast) => {
  const target = w.current.time * 1000;
  let i = w.hourly.time.findIndex((t) => +new Date(t) >= target);
  if (i < 0) i = w.hourly.time.length - 1;
  return Math.max(0, i);
};
