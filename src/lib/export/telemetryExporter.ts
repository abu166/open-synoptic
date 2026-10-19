import type { Forecast, City } from "../../types/telemetry";
export function exportTelemetry(w: Forecast, c: City, format: "json" | "csv") {
  const keys = Object.keys(w.hourly);
  const data =
    format === "json"
      ? JSON.stringify(
          { location: c, forecast: w, exportedAt: new Date().toISOString() },
          null,
          2,
        )
      : [
          keys.join(","),
          ...w.hourly.time.map((_, i) =>
            keys.map((k) => w.hourly[k][i] ?? "").join(","),
          ),
        ].join("\n");
  const url = URL.createObjectURL(
    new Blob([data], {
      type: format === "json" ? "application/json" : "text/csv",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `aetheris-${c.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function syncLocation(c: City) {
  const u = new URL(location.href);
  u.searchParams.set("lat", String(c.latitude));
  u.searchParams.set("lon", String(c.longitude));
  u.searchParams.set("city", c.name);
  history.replaceState({}, "", u);
}
