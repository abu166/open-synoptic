import { useEffect, useRef, useState } from "react";
export default function AnimatedNumber({
  value,
  digits = 0,
}: {
  value: number;
  digits?: number;
}) {
  const ref = useRef(value),
    [n, set] = useState(value);
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      velocity = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      velocity += (value - ref.current) * 85 * dt;
      velocity *= Math.exp(-15 * dt);
      ref.current += velocity * dt;
      set(ref.current);
      if (Math.abs(ref.current - value) > 0.01 || Math.abs(velocity) > 0.01)
        frame = requestAnimationFrame(tick);
      else {
        ref.current = value;
        set(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className="numeric">
      {Number.isFinite(n) ? n.toFixed(digits) : "—"}
    </span>
  );
}
