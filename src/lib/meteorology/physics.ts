export const wetBulb = (t: number, rh: number) =>
  t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
  Math.atan(t + rh) -
  Math.atan(rh - 1.676331) +
  0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
  4.686035;
export const saturationPressure = (t: number) =>
  0.6108 * Math.exp((17.27 * t) / (t + 237.3));
export const vaporPressureDeficit = (t: number, rh: number) =>
  saturationPressure(t) * (1 - rh / 100);
export const airDensity = (t: number, rh: number, p: number) => {
  const vapor = ((saturationPressure(t) * rh) / 100) * 1000;
  return (
    (p * 100 - vapor) / (287.05 * (t + 273.15)) +
    vapor / (461.495 * (t + 273.15))
  );
};
export const windChill = (t: number, v: number) =>
  t <= 10 && v > 4.8
    ? 13.12 + 0.6215 * t - 11.37 * v ** 0.16 + 0.3965 * t * v ** 0.16
    : t;
export const heatIndex = (t: number, r: number) => {
  const f = t * 1.8 + 32;
  return t < 27
    ? t
    : (-42.379 +
        2.04901523 * f +
        10.14333127 * r -
        0.22475541 * f * r -
        0.00683783 * f * f -
        0.05481717 * r * r +
        0.00122874 * f * f * r +
        0.00085282 * f * r * r -
        0.00000199 * f * f * r * r -
        32) /
        1.8;
};
export const beaufort = (v: number) =>
  [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118].filter((x) => v >= x).length;
export const beaufortDescription = (v: number) =>
  [
    "Calm",
    "Light air",
    "Light breeze",
    "Gentle breeze",
    "Moderate breeze",
    "Fresh breeze",
    "Strong breeze",
    "Near gale",
    "Gale",
    "Strong gale",
    "Storm",
    "Violent storm",
    "Hurricane",
  ][beaufort(v)];
export const stability = (cape: number, lifted: number) =>
  cape > 2500 || lifted < -6
    ? "Severe convection"
    : cape > 1000 || lifted < -3
      ? "Unstable"
      : cape > 100
        ? "Marginal convection"
        : "Stable atmosphere";
