"use client";

/**
 * Bandeau d'échec. La phrase dit ce qui n'a pas été fait ; le détail
 * technique reste en petit, pour pouvoir être recopié et signalé.
 */
export default function ErrorBanner({
  message,
  detail,
  actionLabel,
  onAction,
}: {
  message: string;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <p>{message}</p>
        {detail && <p className="error-banner-detail">Détail : {detail}</p>}
      </div>
      <button className="btn-ghost" onClick={onAction}>{actionLabel}</button>
    </div>
  );
}
