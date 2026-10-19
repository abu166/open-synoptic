import { value, type Forecast } from "../../types/telemetry.ts";
export function forecastSample(
  weather: Forecast,
  field: string,
  index: number,
) {
  const n = value(weather.hourly, field, index),
    p = weather.provenance;
  return {
    value: Number.isFinite(n) ? n : null,
    validTime: weather.hourly.time[index] ?? null,
    provider: p?.provider ?? "Open-Meteo",
    model: p?.model ?? "best_match",
    fetchedAt: p?.fetchedAt ?? null,
    source: p?.source ?? "unknown",
    missingReason: Number.isFinite(n) ? null : "Provider sample unavailable",
  };
}
