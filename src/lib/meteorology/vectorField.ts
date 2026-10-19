export type MapFieldMode = "radar" | "wind" | "temperature" | "cloud";
export const windColor = (speed: number) =>
  speed < 10
    ? "#38bdf8"
    : speed < 25
      ? "#34d399"
      : speed < 45
        ? "#fbbf24"
        : speed < 65
          ? "#f43f5e"
          : "#d946ef";
export function cubic(a: number, b: number, c: number, d: number, t: number) {
  return (
    b +
    0.5 *
      t *
      (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)))
  );
}
export function bicubic(
  grid: number[],
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    tx = x - ix,
    ty = y - iy;
  const row = (dy: number) =>
    cubic(
      ...([-1, 0, 1, 2].map(
        (dx) =>
          grid[
            Math.max(0, Math.min(height - 1, iy + dy)) * width +
              Math.max(0, Math.min(width - 1, ix + dx))
          ],
      ) as [number, number, number, number]),
      tx,
    );
  return cubic(row(-1), row(0), row(1), row(2), ty);
}
export function fieldColor(
  mode: MapFieldMode,
  n: number,
): [number, number, number] {
  const stops =
    mode === "temperature"
      ? [
          [0, 70, 140, 250],
          [10, 55, 206, 219],
          [20, 245, 191, 83],
          [30, 248, 92, 85],
          [40, 201, 66, 182],
        ]
      : mode === "cloud"
        ? [
            [0, 20, 66, 116],
            [30, 55, 133, 172],
            [65, 139, 198, 214],
            [100, 224, 229, 245],
          ]
        : [
            [0, 56, 189, 248],
            [10, 52, 211, 153],
            [25, 251, 191, 36],
            [45, 244, 63, 94],
            [70, 217, 70, 239],
          ];
  if (n <= stops[0][0]) return stops[0].slice(1) as [number, number, number];
  for (let i = 1; i < stops.length; i++)
    if (n <= stops[i][0]) {
      const p = (n - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return stops[i]
        .slice(1)
        .map((v, k) =>
          Math.round(stops[i - 1][k + 1] + (v - stops[i - 1][k + 1]) * p),
        ) as [number, number, number];
    }
  return stops.at(-1)!.slice(1) as [number, number, number];
}
