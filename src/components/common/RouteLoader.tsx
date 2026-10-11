import React from "react";
import "./RouteLoader.css";

/**
 * Suspense fallback for lazily-loaded routes.
 *
 * Ships its own stylesheet on purpose: the previous version reused
 * `.home-loader-container` / `.spinner` from Home.css, which is a separate
 * code-split chunk — so a cold deep link to any non-home route rendered an
 * unstyled, invisible loader.
 */
export const RouteLoader: React.FC<{ label?: string }> = ({ label = "جارٍ التحميل… / Loading…" }) => (
  <div className="route-loader" role="status" aria-live="polite">
    <span className="route-loader-spinner" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);
