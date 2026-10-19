import { type Forecast, value } from "../../types/telemetry.ts";
export interface Snapshot {
  capturedAt: number;
  fingerprint: string;
  hours: {
    time: number;
    temp: number | null;
    rain: number | null;
    gust: number | null;
  }[];
}
export interface Change {
  id: string;
  at: number;
  time: number;
  field: "temp" | "rain" | "gust";
  before: number;
  after: number;
}
export function snapshot(w: Forecast, capturedAt = Date.now()): Snapshot {
  const n = (v: number) => (Number.isFinite(v) ? v : null);
  const hours = w.hourly.time.flatMap((t, i) =>
    Date.parse(t) >= capturedAt && Date.parse(t) < capturedAt + 7 * 86400000
      ? [
          {
            time: Date.parse(t),
            temp: n(value(w.hourly, "apparent_temperature", i)),
            rain: n(value(w.hourly, "precipitation_probability", i)),
            gust: n(value(w.hourly, "wind_gusts_10m", i)),
          },
        ]
      : [],
  );
  return { capturedAt, fingerprint: JSON.stringify(hours), hours };
}
export function changes(old: Snapshot, next: Snapshot): Change[] {
  const lookup = new Map(old.hours.map((h) => [h.time, h]));
  return next.hours
    .flatMap((h) => {
      const before = lookup.get(h.time);
      if (!before) return [];
      return (["temp", "rain", "gust"] as const).flatMap((field) => {
        const a = before[field],
          b = h[field],
          threshold = field === "temp" ? 3 : field === "rain" ? 20 : 10;
        return a !== null && b !== null && Math.abs(b - a) >= threshold
          ? [
              {
                id: `${h.time}:${field}:${b}`,
                at: next.capturedAt,
                time: h.time,
                field,
                before: a,
                after: b,
              },
            ]
          : [];
      });
    })
    .sort((a, b) => a.time - b.time);
}
export function updateHistory(
  history: Snapshot[],
  next: Snapshot,
  feed: Change[],
) {
  const last = history.at(-1);
  if (
    last?.fingerprint === next.fingerprint ||
    (last && next.capturedAt - last.capturedAt < 300000)
  )
    return { history, feed };
  const incoming = last ? changes(last, next) : [];
  const newFeed = incoming.filter(
    (c) =>
      !feed.some(
        (f) =>
          f.time === c.time &&
          f.field === c.field &&
          next.capturedAt - f.at < 3 * 3600000,
      ),
  );
  return {
    history: [
      ...history.filter((h) => next.capturedAt - h.capturedAt < 7 * 86400000),
      next,
    ].slice(-24),
    feed: [...newFeed, ...feed]
      .filter(
        (c) =>
          c.time > next.capturedAt && next.capturedAt - c.at < 7 * 86400000,
      )
      .slice(0, 60),
  };
}
export function verificationStats(
  predicted: (number | null)[],
  actual: (number | null)[],
) {
  const pairs = predicted.flatMap((p, i) =>
    p !== null &&
    Number.isFinite(p) &&
    actual[i] !== null &&
    Number.isFinite(actual[i])
      ? [[p, actual[i]!]]
      : [],
  );
  return {
    n: pairs.length,
    mae: pairs.length
      ? pairs.reduce((s, [p, a]) => s + Math.abs(p - a), 0) / pairs.length
      : null,
    bias: pairs.length
      ? pairs.reduce((s, [p, a]) => s + p - a, 0) / pairs.length
      : null,
  };
}
