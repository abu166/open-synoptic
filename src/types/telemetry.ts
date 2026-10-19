import { dateKey } from "../lib/meteorology/time.ts";
export interface City {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
}
export type Units = "metric" | "imperial" | "aviation";
export interface Series {
  time: string[];
  [key: string]: Array<number | null> | string[];
}
export interface CurrentWeather extends Record<string, number> {
  time: number;
  interval: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}
export type HourlyVariable =
  | "temperature_2m"
  | "relative_humidity_2m"
  | "dew_point_2m"
  | "apparent_temperature"
  | "precipitation_probability"
  | "precipitation"
  | "rain"
  | "showers"
  | "snowfall"
  | "snow_depth"
  | "weather_code"
  | "pressure_msl"
  | "surface_pressure"
  | "cloud_cover"
  | "cloud_cover_low"
  | "cloud_cover_mid"
  | "cloud_cover_high"
  | "visibility"
  | "evapotranspiration"
  | "et0_fao_evapotranspiration"
  | "vapour_pressure_deficit"
  | "wind_speed_10m"
  | "wind_speed_80m"
  | "wind_speed_120m"
  | "wind_direction_10m"
  | "wind_direction_80m"
  | "wind_gusts_10m"
  | "temperature_80m"
  | "soil_temperature_0cm"
  | "soil_moisture_0_to_1cm"
  | "uv_index"
  | "is_day"
  | "direct_radiation"
  | "diffuse_radiation"
  | "cape"
  | "lifted_index"
  | "freezing_level_height";
export type AirVariable =
  | "us_aqi"
  | "european_aqi"
  | "pm10"
  | "pm2_5"
  | "carbon_monoxide"
  | "nitrogen_dioxide"
  | "sulphur_dioxide"
  | "ozone"
  | "aerosol_optical_depth"
  | "dust"
  | "uv_index"
  | "uv_index_clear_sky"
  | "alder_pollen"
  | "birch_pollen"
  | "grass_pollen"
  | "mugwort_pollen"
  | "olive_pollen"
  | "ragweed_pollen";
export interface Forecast {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  current: CurrentWeather;
  hourly: Series;
  daily: Series;
  minutely_15: Series;
}
export interface AirQuality {
  current: Record<string, number>;
  hourly: Series;
}
export interface RadarFrame {
  time: number;
  path: string;
}
export interface RadarData {
  host: string;
  radar: { past: RadarFrame[]; nowcast?: RadarFrame[] };
  satellite?: { infrared: RadarFrame[] };
}
export interface Climate {
  source?: "archive" | "cached" | "estimated";
  period?: string;
  note?: string;
  mean: number;
  high: number;
  low: number;
  years: number;
  dailyMeans: number[];
  normalLow: number;
  normalHigh: number;
}
export interface PanelProps {
  weather: Forecast;
  air?: AirQuality;
  city: City;
}
export const value = (s: Series, key: string, i: number): number =>
  typeof s[key]?.[i] === "number" ? (s[key][i] as number) : NaN;
export const currentIndex = (w: Forecast) =>
  Math.max(
    0,
    w.hourly.time.findIndex(
      (t) => new Date(t).getTime() >= w.current.time * 1000,
    ),
  );

export const todayDailyIndex = (w: Forecast) =>
  Math.max(
    0,
    w.daily.time.findIndex((t) =>
      t.startsWith(dateKey(new Date(w.current.time * 1000), w.timezone)),
    ),
  );
export const todayMean = (w: Forecast) =>
  value(w.daily, "temperature_2m_mean", todayDailyIndex(w));
export interface EnsembleForecast {
  estimatedModels?: string[];
  modelSources?: Record<string, string>;
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: Series;
}
