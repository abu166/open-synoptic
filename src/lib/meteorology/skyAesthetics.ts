export interface SkyAestheticInputs {
  high: number;
  mid: number;
  low: number;
  aod: number;
  humidity: number;
}
export function skyAesthetics(input: SkyAestheticInputs) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n)),
    texture = input.high * 0.6 + input.mid * 0.4,
    canvas = Math.max(0, 1 - Math.abs(texture - 45) / 60),
    obstruction = input.low * 0.65,
    haze =
      Math.max(0, input.aod - 0.12) * 65 +
      Math.max(0, input.humidity - 75) * 0.5;
  const score = Math.round(clamp(32 + canvas * 61 - obstruction - haze));
  const palette =
    score > 72
      ? ["#202246", "#713c85", "#cb537e", "#f48c67", "#ffd1a0"]
      : score > 42
        ? ["#5c688e", "#a795b6", "#d7b2bc", "#edc7b0", "#f4dfc4"]
        : ["#394b67", "#61758d", "#879cae", "#b0bdc5", "#d9d7cd"];
  return {
    score,
    palette,
    name:
      score > 72
        ? "Crimson & violet afterglow"
        : score > 42
          ? "A softer peach possibility"
          : "Silver, pewter & quiet light",
    texture,
    obstruction,
    haze,
    explanation:
      input.low > 65
        ? "A thick low deck can hide the horizon. Expect softer silver light, with small breaks making the difference."
        : texture > 20
          ? "High and middle cloud can catch sunlight above a clearer horizon. Shorter wavelengths scatter away, leaving warmer light on the cloud canvas."
          : "A mostly open sky favors a cleaner color gradient. Fewer clouds means less texture to catch the last warm light.",
  };
}
