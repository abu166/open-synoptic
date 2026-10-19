import type { Units } from "../../types/telemetry";
export const temperature = (n: number, u: Units) =>
  u === "imperial" ? (n * 9) / 5 + 32 : n;
export const speed = (n: number, u: Units) =>
  u === "imperial" ? n / 1.609344 : u === "aviation" ? n / 1.852 : n;
export const pressure = (n: number, u: Units) =>
  u === "imperial" ? n / 33.8639 : n;
export const distance = (n: number, u: Units) =>
  u === "imperial" ? n / 1609.344 : n;
export const speedLabel = (u: Units) =>
  u === "imperial" ? "mph" : u === "aviation" ? "kt" : "km/h";
export const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toFixed(d) : "—";
