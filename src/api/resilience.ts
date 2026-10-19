import type {
  City,
  Forecast,
  Climate,
  EnsembleForecast,
} from "../types/telemetry.ts";
import { value, currentIndex } from "../types/telemetry.ts";
import { solarPosition } from "../lib/meteorology/ephemeris.ts";
export const MODEL_IDS = [
  "ecmwf_ifs04",
  "gfs_seamless",
  "icon_seamless",
] as const;
export interface CityTelemetry {
  city: City;
  time: number;
  temperature: number;
  code: number;
  wind?: number;
  cloud: number;
  isDay: boolean;
  hourly: {
    time: number[];
    temperature: number[];
    code: number[];
    cloud: number[];
    wind?: number[];
  };
  source: "live" | "cached" | "seasonal";
  fetchedAt: number;
}
export function readStored<T>(key: string): T | undefined {
  try {
    const raw =
      typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return;
  }
}
export function writeStored(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* Storage can be disabled or full; the in-memory query cache remains usable. */
  }
}
export const cityKey = (c: Pick<City, "latitude" | "longitude">) =>
  `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)}`;
export function seasonalContext(c: City, date: Date) {
  const day =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
    86400000;
  const latitude = Math.abs(c.latitude),
    amplitude = 3 + 23 * Math.sin((latitude * Math.PI) / 180) ** 1.3;
  const seasonal = Math.cos(
    (2 * Math.PI * (day - (c.latitude >= 0 ? 205 : 23))) / 365.2425,
  );
  const mean =
    27 -
    latitude * 0.57 +
    amplitude * seasonal -
    Math.max(0, c.elevation ?? 0) * 0.0065;
  return { mean, amplitude, uncertainty: 4 + latitude / 15 };
}
export function initialCityTelemetry(c: City, now = Date.now()): CityTelemetry {
  const saved = readStored<CityTelemetry>(`aetheris-city-v4:${cityKey(c)}`);
  if (saved && Number.isFinite(saved.temperature))
    return { ...saved, city: c, source: "cached" };
  const climate = seasonalContext(c, new Date(now));
  const time = Array.from(
    { length: 72 },
    (_, i) => Math.floor(now / 3600000) * 3600000 + i * 3600000,
  );
  const temperature = time.map(
    (t) =>
      climate.mean +
      Math.sin(
        (solarPosition(new Date(t - 2 * 3600000), c.latitude, c.longitude)
          .elevation *
          Math.PI) /
          180,
      ) *
        5,
  );
  return {
    city: c,
    time: now,
    temperature: temperature[0],
    code: 3,
    cloud: 50,
    isDay: solarPosition(new Date(now), c.latitude, c.longitude).elevation > 0,
    hourly: {
      time,
      temperature,
      code: time.map(() => 3),
      cloud: time.map(() => 50),
    },
    source: "seasonal",
    fetchedAt: now,
  };
}
interface RawCity {
  timezone?: string;
  current: {
    time: number;
    temperature_2m: number;
    weather_code: number;
    cloud_cover: number;
    is_day: number;
    wind_speed_10m?: number;
  };
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    weather_code: number[];
    cloud_cover: number[];
    wind_speed_10m?: (number | null)[];
  };
}
export function parseCityBatch(
  raw: RawCity | RawCity[],
  cities: City[],
  now = Date.now(),
): CityTelemetry[] {
  const rows = Array.isArray(raw) ? raw : [raw];
  return cities.map((city, i) => {
    const row = rows[i];
    if (!row || !Number.isFinite(row.current?.temperature_2m))
      return initialCityTelemetry(city, now);
    const result: CityTelemetry = {
      city: { ...city, timezone: row.timezone || city.timezone },
      time: row.current.time * 1000,
      temperature: row.current.temperature_2m,
      code: row.current.weather_code,
      wind: row.current.wind_speed_10m,
      cloud: row.current.cloud_cover,
      isDay: !!row.current.is_day,
      hourly: {
        time: row.hourly.time.map((t) => t * 1000),
        temperature: row.hourly.temperature_2m.map((t) => t ?? NaN),
        code: row.hourly.weather_code,
        cloud: row.hourly.cloud_cover,
        wind: row.hourly.wind_speed_10m?.map((n) => n ?? NaN),
      },
      source: now - row.current.time * 1000 > 10800000 ? "cached" : "live",
      fetchedAt: now,
    };
    writeStored(`aetheris-city-v4:${cityKey(city)}`, result);
    return result;
  });
}
export function cityMoment(row: CityTelemetry, offset: number): CityTelemetry {
  if (!offset) return row;
  const target = row.time + offset * 3600000,
    i = row.hourly.time.findIndex((t) => t >= target),
    k = i < 0 ? row.hourly.time.length - 1 : i;
  return {
    ...row,
    time: target,
    temperature: Number.isFinite(row.hourly.temperature[k])
      ? row.hourly.temperature[k]
      : row.temperature,
    code: row.hourly.code[k] ?? row.code,
    wind: Number.isFinite(row.hourly.wind?.[k])
      ? row.hourly.wind![k]
      : row.wind,
    cloud: row.hourly.cloud[k] ?? row.cloud,
    isDay:
      solarPosition(new Date(target), row.city.latitude, row.city.longitude)
        .elevation > 0,
  };
}
export function parseEnsemble(
  raw: EnsembleForecast | undefined,
  primary: Forecast,
): EnsembleForecast {
  const source = raw?.hourly,
    time = primary.hourly.time;
  const sourceTimes =
    source?.time.map((t) =>
      typeof t === "number"
        ? new Date(t * 1000).toISOString()
        : new Date(t).toISOString(),
    ) ?? [];
  const lookup = new Map(sourceTimes.map((t, i) => [t, i]));
  const hourly: EnsembleForecast["hourly"] = { time: [...time] };
  const estimatedModels: string[] = [],
    modelSources: Record<string, string> = {};
  const anchor = currentIndex(primary);
  for (const [j, model] of MODEL_IDS.entries()) {
    let estimated = false;
    for (const field of ["temperature_2m", "precipitation", "wind_speed_10m"]) {
      hourly[`${field}_${model}`] = time.map((t, i) => {
        const k = lookup.get(t);
        const aliases =
          model === "ecmwf_ifs04" ? ["ecmwf_ifs04", "ecmwf_ifs025"] : [model];
        for (const alias of aliases) {
          const real =
            k === undefined
              ? NaN
              : Number(source?.[`${field}_${alias}`]?.[k] ?? NaN);
          if (Number.isFinite(real)) {
            modelSources[model] = alias;
            return real;
          }
        }
        if (i >= anchor && i < anchor + 72) estimated = true;
        const base = value(primary.hourly, field, i),
          horizon = Math.max(0, i - anchor);
        const pressure = Math.abs(
          value(primary.hourly, "pressure_msl", i) -
            value(primary.hourly, "pressure_msl", Math.max(0, i - 3)),
        );
        const clouds = Array.from({ length: 6 }, (_, j) =>
            value(primary.hourly, "cloud_cover", Math.max(0, i - j)),
          ).filter(Number.isFinite),
          meanCloud = clouds.reduce((a, b) => a + b, 0) / (clouds.length || 1),
          cloud = Math.sqrt(
            clouds.reduce((sum, n) => sum + (n - meanCloud) ** 2, 0) /
              (clouds.length || 1),
          );
        const sigma =
          0.45 +
          Math.sqrt(horizon / 12) * 0.65 +
          (Number.isFinite(pressure) ? pressure * 0.09 : 0) +
          (Number.isFinite(cloud) ? cloud * 0.012 : 0);
        const offset = [-0.95, 0.15, 1.05][j] * sigma;
        return Number.isFinite(base)
          ? field === "temperature_2m"
            ? base + offset
            : Math.max(
                0,
                base + offset * (field === "precipitation" ? 0.13 : 1.5),
              )
          : null;
      });
    }
    if (estimated) estimatedModels.push(model);
  }
  return {
    latitude: primary.latitude,
    longitude: primary.longitude,
    timezone: primary.timezone,
    hourly,
    estimatedModels,
    modelSources,
  };
}
export function approximateClimate(c: City, date: Date): Climate {
  const { mean, uncertainty } = seasonalContext(c, date);
  return {
    mean,
    low: mean - uncertainty * 2,
    high: mean + uncertainty * 2,
    normalLow: mean - uncertainty,
    normalHigh: mean + uncertainty,
    years: 0,
    dailyMeans: [],
    source: "estimated",
    period: "Latitude / season reference",
    note: "A broad latitude, season and elevation estimate. Bounds are illustrative seasonal ranges, not historical records.",
  };
}
