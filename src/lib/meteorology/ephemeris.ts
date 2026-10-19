import { zonedMidnight } from "./time.ts";
const rad = Math.PI / 180,
  dayMs = 86400000,
  obliquity = 23.4397 * rad;
const julianDays = (date: Date) => +date / dayMs - 10957.5;
function sunCoordinates(d: number) {
  const mean = (357.5291 + 0.98560028 * d) * rad;
  const center =
    (1.9148 * Math.sin(mean) +
      0.02 * Math.sin(2 * mean) +
      0.0003 * Math.sin(3 * mean)) *
    rad;
  const longitude = mean + center + (180 + 102.9372) * rad;
  return {
    longitude,
    declination: Math.asin(Math.sin(longitude) * Math.sin(obliquity)),
    rightAscension: Math.atan2(
      Math.sin(longitude) * Math.cos(obliquity),
      Math.cos(longitude),
    ),
  };
}
function moonCoordinates(d: number) {
  const L = (218.316 + 13.176396 * d) * rad,
    M = (134.963 + 13.064993 * d) * rad,
    F = (93.272 + 13.22935 * d) * rad;
  const longitude = L + 6.289 * rad * Math.sin(M),
    latitude = 5.128 * rad * Math.sin(F);
  return {
    longitude,
    distance: 385001 - 20905 * Math.cos(M),
    declination: Math.asin(
      Math.sin(latitude) * Math.cos(obliquity) +
        Math.cos(latitude) * Math.sin(obliquity) * Math.sin(longitude),
    ),
    rightAscension: Math.atan2(
      Math.sin(longitude) * Math.cos(obliquity) -
        Math.tan(latitude) * Math.sin(obliquity),
      Math.cos(longitude),
    ),
  };
}
function horizontal(
  date: Date,
  lat: number,
  lon: number,
  coordinates: { declination: number; rightAscension: number },
) {
  const phi = lat * rad,
    d = julianDays(date),
    hourAngle =
      (280.16 + 360.9856235 * d) * rad + lon * rad - coordinates.rightAscension;
  const elevation =
    Math.asin(
      Math.sin(phi) * Math.sin(coordinates.declination) +
        Math.cos(phi) * Math.cos(coordinates.declination) * Math.cos(hourAngle),
    ) / rad;
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(phi) -
        Math.tan(coordinates.declination) * Math.cos(phi),
    ) /
      rad +
      180) %
    360;
  return { elevation, azimuth };
}
export function solarPosition(date: Date, lat: number, lon: number) {
  return horizontal(date, lat, lon, sunCoordinates(julianDays(date)));
}
export function lunarPosition(date: Date, lat: number, lon: number) {
  return horizontal(date, lat, lon, moonCoordinates(julianDays(date)));
}
export function solarWindows(
  date: Date,
  lat: number,
  lon: number,
  timezone = "UTC",
) {
  const start = zonedMidnight(date, timezone),
    crossings: Record<string, Date[]> = {};
  for (const [name, alt] of Object.entries({
    sunrise: -0.833,
    civil: -6,
    nautical: -12,
    astronomical: -18,
    golden: 6,
    blue: -4,
  })) {
    crossings[name] = [];
    let prev = solarPosition(start, lat, lon).elevation - alt;
    for (let m = 5; m <= 1500; m += 5) {
      const d = new Date(+start + m * 60000),
        n = solarPosition(d, lat, lon).elevation - alt;
      if (n * prev < 0) {
        let low = +d - 300000,
          high = +d;
        for (let j = 0; j < 12; j++) {
          const mid = (low + high) / 2,
            v = solarPosition(new Date(mid), lat, lon).elevation - alt;
          if (v * prev > 0) low = mid;
          else high = mid;
        }
        const crossing = new Date((low + high) / 2);
        if (+crossing < +start + 86400000) crossings[name].push(crossing);
      }
      prev = n;
    }
  }
  return crossings;
}
export function lunarPhase(date: Date) {
  const d = julianDays(date),
    s = sunCoordinates(d),
    m = moonCoordinates(d);
  const elongation = Math.acos(
    Math.sin(s.declination) * Math.sin(m.declination) +
      Math.cos(s.declination) *
        Math.cos(m.declination) *
        Math.cos(s.rightAscension - m.rightAscension),
  );
  const incidence = Math.atan2(
    149598000 * Math.sin(elongation),
    m.distance - 149598000 * Math.cos(elongation),
  );
  const angle = ((((m.longitude - s.longitude) / rad) % 360) + 360) % 360,
    cycle = 29.530588853,
    age = (angle / 360) * cycle;
  return {
    age,
    angle,
    illumination: (1 + Math.cos(incidence)) / 2,
    nextNew: cycle - age,
    nextFull: (cycle / 2 - age + cycle) % cycle,
  };
}
