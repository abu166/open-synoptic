import { apiLanguage } from "../i18n/locale.ts";
import {
  cityKey,
  initialCityTelemetry,
  parseCityBatch,
  readStored,
  writeStored,
  approximateClimate,
  parseEnsemble,
  type CityTelemetry,
} from "./resilience.ts";
import { dateKey } from "../lib/meteorology/time.ts";
import type {
  City,
  Forecast,
  AirQuality,
  Climate,
  EnsembleForecast,
} from "../types/telemetry";
export class DataServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "DataServiceError";
  }
}
const responseMemory = new Map<string, { expires: number; body: string }>();
async function requestUnshared<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const address = new URL(url),
    archive = address.hostname === "archive-api.open-meteo.com",
    ttl = archive
      ? 30 * 86400000
      : address.hostname === "api.rainviewer.com"
        ? 300000
        : 600000,
    key = `aetheris-data-v2:${url}`,
    cooldownKey = `aetheris-cooldown:${address.origin}`;
  const storage = () =>
    typeof localStorage === "undefined" ? undefined : localStorage;
  let cached = responseMemory.get(key);
  try {
    if (!cached) {
      const raw = storage()?.getItem(key);
      if (raw) cached = JSON.parse(raw);
    }
  } catch {}
  if (cached && cached.expires > Date.now())
    return JSON.parse(cached.body) as T;
  try {
    const until =
      typeof window === "undefined"
        ? 0
        : Number(window.sessionStorage.getItem(cooldownKey));
    if (until > Date.now() && cached) return JSON.parse(cached.body) as T;
    if (until > Date.now())
      throw new DataServiceError(
        "This public data service is taking a short rate-limit break. Other views remain available.",
        429,
      );
  } catch (error) {
    if (error instanceof DataServiceError) throw error;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
        : AbortSignal.timeout(45000),
    });
  } catch (error) {
    if (cached) return JSON.parse(cached.body) as T;
    throw error;
  }
  if (!response.ok) {
    if (response.status === 429)
      try {
        const retrySeconds = Number(response.headers.get("Retry-After")) || 180;
        if (typeof window !== "undefined")
          window.sessionStorage.setItem(
            cooldownKey,
            String(Date.now() + retrySeconds * 1000),
          );
      } catch {}
    if (cached) return JSON.parse(cached.body) as T;
    throw new DataServiceError(
      response.status === 429
        ? "The public data provider is temporarily rate limited. Please give it a little time."
        : `Data service returned ${response.status}`,
      response.status,
    );
  }
  const data = (await response.json()) as T,
    body = JSON.stringify(data),
    entry = { expires: Date.now() + ttl, body };
  responseMemory.set(key, entry);
  if (responseMemory.size > 50)
    responseMemory.delete(responseMemory.keys().next().value!);
  try {
    storage()?.setItem(key, JSON.stringify(entry));
  } catch {}
  return data;
}
const inFlight = new Map<string, Promise<unknown>>();
export async function request<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  let pending = inFlight.get(url);
  if (!pending) {
    pending = requestUnshared<T>(url).finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return structuredClone(await pending) as T;
}
export async function fetchCityBatch(
  cities: City[],
  signal?: AbortSignal,
): Promise<CityTelemetry[]> {
  if (!cities.length) return [];
  try {
    const latitude = cities.map((c) => c.latitude).join(","),
      longitude = cities.map((c) => c.longitude).join(",");
    const raw = await request<Parameters<typeof parseCityBatch>[0]>(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto&current=temperature_2m,weather_code,cloud_cover,is_day,wind_speed_10m&hourly=temperature_2m,weather_code,cloud_cover,wind_speed_10m&forecast_days=3&timeformat=unixtime`,
      signal,
    );
    return parseCityBatch(raw, cities);
  } catch (error) {
    if (signal?.aborted) throw error;
    return cities.map((c) => initialCityTelemetry(c));
  }
}
export const cityBatchKey = (cities: City[]) => [
  "city-batch-v4.1",
  ...cities.map(cityKey).sort(),
];
const hourly =
  "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,evapotranspiration,et0_fao_evapotranspiration,vapour_pressure_deficit,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_direction_10m,wind_direction_80m,wind_gusts_10m,temperature_80m,soil_temperature_0cm,soil_moisture_0_to_1cm,uv_index,is_day,direct_radiation,diffuse_radiation,cape,lifted_index,freezing_level_height";
const daily =
  "weather_code,temperature_2m_mean,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum,et0_fao_evapotranspiration";
const coords = (c: City) =>
  `latitude=${c.latitude}&longitude=${c.longitude}&timezone=auto`;
export const fetchForecast = (c: City, signal?: AbortSignal) =>
  request<Forecast>(
    `https://api.open-meteo.com/v1/forecast?${coords(c)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=${hourly}&daily=${daily}&minutely_15=temperature_2m,precipitation,rain,snowfall,weather_code,wind_speed_10m,wind_gusts_10m,visibility&forecast_days=14&past_days=2&timeformat=unixtime`,
    signal,
  );
export const normalizeForecast = (w: Forecast): Forecast => {
  for (const s of [w.hourly, w.minutely_15]) {
    s.time = (s.time as unknown as number[]).map((t) =>
      new Date(t * 1000).toISOString(),
    );
  }
  w.daily.time = (w.daily.time as unknown as number[]).map(
    (t) => `${dateKey(new Date(t * 1000), w.timezone)}T00:00:00Z`,
  );
  return w;
};
export const getForecast = async (c: City, signal?: AbortSignal) =>
  normalizeForecast(await fetchForecast(c, signal));
export async function fetchEnsemble(
  c: City,
  signal?: AbortSignal,
  primary?: Forecast,
): Promise<EnsembleForecast> {
  try {
    const raw = await request<EnsembleForecast>(
      `https://api.open-meteo.com/v1/forecast?${coords(c)}&hourly=temperature_2m,precipitation,wind_speed_10m&models=ecmwf_ifs04,ecmwf_ifs025,gfs_seamless,icon_seamless&forecast_days=4&timeformat=unixtime`,
      signal,
    );
    if (primary) return parseEnsemble(raw, primary);
    raw.hourly.time = (raw.hourly.time as unknown as number[]).map((t) =>
      new Date(t * 1000).toISOString(),
    );
    return raw;
  } catch (error) {
    if (primary && !signal?.aborted) return parseEnsemble(undefined, primary);
    throw error;
  }
}
const pollutants =
  "us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,uv_index_clear_sky,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen";
export const fetchAir = (c: City, signal?: AbortSignal) =>
  request<AirQuality>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?${coords(c)}&current=${pollutants}&hourly=${pollutants}&timeformat=unixtime`,
    signal,
  ).then((a) => {
    a.hourly.time = (a.hourly.time as unknown as number[]).map((t) =>
      new Date(t * 1000).toISOString(),
    );
    return a;
  });
export async function searchCities(name: string, signal?: AbortSignal) {
  const data = await request<{
    results?: Array<City & { country_code: string }>;
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=${apiLanguage()}&format=json`,
    signal,
  );
  return data.results ?? [];
}
export async function fetchClimate(
  c: City,
  signal?: AbortSignal,
  selectedDate = new Date(),
): Promise<Climate> {
  const date = dateKey(selectedDate, c.timezone).slice(5);
  const cacheKey = `aetheris-climate-v4:${c.latitude.toFixed(1)},${c.longitude.toFixed(1)}:${date}`;
  const saved = readStored<Climate>(cacheKey);
  if (saved) return { ...saved, source: "cached" };
  try {
    const data = await request<{
      daily: {
        time: string[];
        temperature_2m_mean: (number | null)[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
      };
    }>(
      `https://archive-api.open-meteo.com/v1/archive?${coords(c)}&start_date=2014-01-01&end_date=2023-12-31&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min&models=era5`,
      signal,
    );
    const rows = data.daily.time.flatMap((t, i) =>
      t.slice(5) === date &&
      data.daily.temperature_2m_max[i] != null &&
      data.daily.temperature_2m_min[i] != null &&
      data.daily.temperature_2m_mean[i] != null
        ? [
            {
              mean: data.daily.temperature_2m_mean[i]!,
              high: data.daily.temperature_2m_max[i]!,
              low: data.daily.temperature_2m_min[i]!,
            },
          ]
        : [],
    );
    if (!rows.length) throw new Error("Historical baseline unavailable");
    const dailyMeans = rows.map((r) => r.mean);
    const sorted = [...dailyMeans].sort((a, b) => a - b);
    const result: Climate = {
      source: "archive",
      period: "2014–2023",
      normalLow: sorted[Math.floor((sorted.length - 1) * 0.1)],
      normalHigh: sorted[Math.ceil((sorted.length - 1) * 0.9)],
      mean: dailyMeans.reduce((a, b) => a + b, 0) / rows.length,
      high: Math.max(...rows.map((r) => r.high)),
      low: Math.min(...rows.map((r) => r.low)),
      years: rows.length,
      dailyMeans,
    };
    writeStored(cacheKey, result);
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    return approximateClimate(c, selectedDate);
  }
}
export interface WindSample {
  latitude: number;
  longitude: number;
  current: {
    wind_speed_10m: number;
    wind_direction_10m: number;
    temperature_2m?: number;
    cloud_cover?: number;
  };
  hourly: {
    time: number[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    temperature_2m: (number | null)[];
    cloud_cover: (number | null)[];
  };
}
export async function fetchWindSamples(
  points: Array<{ latitude: number; longitude: number }>,
  signal?: AbortSignal,
) {
  const latitude = points.map((p) => p.latitude.toFixed(3)).join(","),
    longitude = points.map((p) => p.longitude.toFixed(3)).join(",");
  const data = await request<WindSample[] | WindSample>(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=wind_speed_10m,wind_direction_10m,temperature_2m,cloud_cover&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,cloud_cover&forecast_days=3&timeformat=unixtime`,
    signal,
  );
  return Array.isArray(data) ? data : [data];
}

export interface CityAirTelemetry {
  city: City;
  time: number[];
  aqi: (number | null)[];
  fetchedAt: number;
}
export async function fetchCityAirBatch(
  cities: City[],
  signal?: AbortSignal,
): Promise<CityAirTelemetry[]> {
  if (!cities.length) return [];
  try {
    const latitude = cities.map((c) => c.latitude).join(","),
      longitude = cities.map((c) => c.longitude).join(",");
    const raw = await request<
      | Array<{ hourly: { time: number[]; us_aqi: (number | null)[] } }>
      | { hourly: { time: number[]; us_aqi: (number | null)[] } }
    >(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=us_aqi&forecast_days=4&timeformat=unixtime`,
      signal,
    );
    const rows = Array.isArray(raw) ? raw : [raw];
    return cities.flatMap((city, i) => {
      const data = rows[i];
      if (!data?.hourly) return [];
      const result = {
        city,
        time: data.hourly.time.map((t) => t * 1000),
        aqi: data.hourly.us_aqi,
        fetchedAt: Date.now(),
      };
      writeStored(`aetheris-city-air:${cityKey(city)}`, result);
      return [result];
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return cities.flatMap((c) => {
      const stored = readStored<CityAirTelemetry>(
        `aetheris-city-air:${cityKey(c)}`,
      );
      return stored ? [stored] : [];
    });
  }
}
