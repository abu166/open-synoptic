export default function BentoSkeletonGrid() {
  return (
    <div
      className="dashboard loading-grid"
      aria-label="Loading live telemetry"
      aria-busy="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className={`glass-card skeleton ${i === 0 ? "span-8" : "span-4"}`}
        >
          <div className="skeleton-line" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
