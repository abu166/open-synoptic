export default function WeatherIcon({
  code = 0,
  size = 36,
  night = false,
}: {
  code?: number;
  size?: number;
  night?: boolean;
}) {
  const cloud = code > 1,
    rain = (code >= 50 && code < 70) || code >= 80,
    snow = (code >= 70 && code < 80) || code === 85 || code === 86;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-label={night ? "Night weather" : "Weather conditions"}
    >
      <defs>
        <radialGradient id={`sun-${code}-${size}`}>
          <stop stopColor="#ffe9a2" />
          <stop offset="1" stopColor="#ffb63f" />
        </radialGradient>
      </defs>
      {night ? (
        <path d="M38 8a20 20 0 1 0 17 30A22 22 0 0 1 38 8" fill="#ccddfa" />
      ) : (
        <g className="sun-icon">
          <circle cx="30" cy="26" r="12" fill={`url(#sun-${code}-${size})`} />
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={i}
              d="M30 5v4"
              transform={`rotate(${i * 45} 30 26)`}
              stroke="#efc66f"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      {cloud && (
        <path
          d="M17 45h31a10 10 0 0 0 0-20 15 15 0 0 0-28-3 12 12 0 0 0-3 23"
          fill="#aebfcf"
          stroke="#d9e4ef"
          strokeWidth="1.2"
        />
      )}
      {rain &&
        [23, 34, 45].map((x) => (
          <path
            key={x}
            d={`M${x} 49l-3 7`}
            stroke="#81bbfa"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      {snow &&
        [23, 35, 46].map((x) => (
          <circle key={x} cx={x} cy="53" r="2" fill="white" />
        ))}
      {code >= 95 && (
        <path d="M35 36l-8 14h8l-4 12 17-19h-10l5-7" fill="#ffd97b" />
      )}
    </svg>
  );
}
