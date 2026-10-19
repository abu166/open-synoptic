import { request } from "./openMeteoClient.ts";
import type { City } from "../types/telemetry.ts";
import { verificationStats } from "../lib/planning/history.ts";
export interface MemberForecast {
  hourly: { time: number[]; [key: string]: (number | null)[] };
  provenance?: { fetchedAt: number; source: string };
}
export function fetchMembers(c: City, signal?: AbortSignal) {
  return request<MemberForecast>(
    `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${c.latitude}&longitude=${c.longitude}&hourly=temperature_2m,precipitation,wind_gusts_10m&models=icon_global&forecast_days=7&timeformat=unixtime`,
    signal,
  );
}
export function memberSummary(
  data: MemberForecast,
  time: number,
  gustLimit: number,
) {
  const i = data.hourly.time.findIndex((t) => t * 1000 === time);
  const samples = (field: string) =>
    i < 0
      ? []
      : Object.keys(data.hourly)
          .filter(
            (k) => k === field || new RegExp(`^${field}_member\\d+$`).test(k),
          )
          .flatMap((k) => {
            const n = data.hourly[k][i];
            return n !== null && Number.isFinite(n) ? [n] : [];
          });
  const rain = samples("precipitation"),
    gust = samples("wind_gusts_10m"),
    temp = samples("temperature_2m").sort((a, b) => a - b);
  return {
    rainN: rain.length,
    gustN: gust.length,
    tempN: temp.length,
    wet: rain.length ? rain.filter((n) => n >= 0.1).length / rain.length : null,
    gust: gust.length
      ? gust.filter((n) => n > gustLimit).length / gust.length
      : null,
    low: temp.length ? temp[Math.floor((temp.length - 1) * 0.1)] : null,
    high: temp.length ? temp[Math.ceil((temp.length - 1) * 0.9)] : null,
  };
}
export interface VerificationRow {
  model: string;
  lead: number;
  variable: string;
  n: number;
  mae: number | null;
  bias: number | null;
}
export async function fetchVerification(
  c: City,
  signal?: AbortSignal,
): Promise<{ start: string; end: string; rows: VerificationRow[] }> {
  // ERA5 has a publication delay. Keep the evaluation period seven days behind today.
  const day = 86400000,
    end = new Date(Date.now() - 7 * day).toISOString().slice(0, 10),
    start = new Date(Date.now() - 21 * day).toISOString().slice(0, 10);
  const variables = ["temperature_2m", "wind_speed_10m", "precipitation"];
  const models = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"];
  const fields = variables
    .flatMap((v) => [1, 3].map((l) => `${v}_previous_day${l}`))
    .join(",");
  type Response = {
    hourly: { time: number[]; [key: string]: (number | null)[] };
  };
  const coords = `latitude=${c.latitude}&longitude=${c.longitude}&start_date=${start}&end_date=${end}&timeformat=unixtime&timezone=UTC`;
  const [predicted, actual] = await Promise.all([
    request<Response>(
      `https://previous-runs-api.open-meteo.com/v1/forecast?${coords}&hourly=${fields}&models=${models.join(",")}`,
      signal,
    ),
    request<Response>(
      `https://archive-api.open-meteo.com/v1/archive?${coords}&hourly=${variables.join(",")}&models=era5`,
      signal,
    ),
  ]);
  const index = new Map(actual.hourly.time.map((t, i) => [t, i]));
  const rows = models.flatMap((model) =>
    [1, 3].flatMap((lead) =>
      variables.map((variable) => {
        const predictions =
          predicted.hourly[`${variable}_${model}_previous_day${lead}`] ??
          predicted.hourly[`${variable}_previous_day${lead}_${model}`] ??
          [];
        const truth = predicted.hourly.time.map((t) => {
          const i = index.get(t);
          return i === undefined
            ? null
            : (actual.hourly[variable]?.[i] ?? null);
        });
        return {
          model,
          lead,
          variable,
          ...verificationStats(predictions, truth),
        };
      }),
    ),
  );
  return { start, end, rows };
}
