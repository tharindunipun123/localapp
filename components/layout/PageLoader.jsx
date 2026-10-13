export function PageLoader({ label = "Loading" }) {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="page-loader-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-icon.png" alt="" width={40} height={40} />
      </div>
      <div className="page-loader-bar" aria-hidden="true">
        <span />
      </div>
      <p className="page-loader-copy">{label}</p>
    </div>
  );
}
