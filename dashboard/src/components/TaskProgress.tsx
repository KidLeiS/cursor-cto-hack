export function TaskProgress({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{label ?? "Progress"}</span>
        <strong>{value}%</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label ?? "Task progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span className="progress-value" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
