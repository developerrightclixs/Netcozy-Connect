export function WorkspaceLoader({
  fullScreen = false,
  property = false,
}: {
  fullScreen?: boolean;
  property?: boolean;
}) {
  return (
    <div
      className={
        "workspace-loader" + (fullScreen ? " workspace-loader-full" : "")
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="loader-constellation" aria-hidden="true">
        <div className="loader-halo" />
        <div className="loader-orbit">
          <span />
        </div>
        <svg className="loader-connections" viewBox="0 0 300 180" fill="none">
          <path
            d="M57 55 150 90 245 46M150 90 229 143M150 90 69 139"
            stroke="currentColor"
            strokeDasharray="3 7"
          />
        </svg>
        <span className="loader-satellite loader-satellite-one">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="12" cy="8" r="3" />
            <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
          </svg>
        </span>
        <span className="loader-satellite loader-satellite-two">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z" />
          </svg>
        </span>
        <span className="loader-satellite loader-satellite-three">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M5 8h14v12H5zM9 8V4h6v4M5 13h14" />
          </svg>
        </span>
        <span className="loader-spark" />
        <span className="loader-monogram">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 18V6l12 12V6" />
          </svg>
        </span>
      </div>
      <p className="loader-eyebrow">YOUR NEXT CONNECTION STARTS HERE</p>
      <h2>
        {property
          ? "Opening your property workspace"
          : "Loading your workspace"}
        <span className="loader-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </h2>
      <p className="loader-description">
        A little space for your next big opportunity.
      </p>
      <div className="loader-preview" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <span key={n}>
            <b />
            <i />
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}
