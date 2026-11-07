import { setParams, useRoute } from "../lib/router.ts";
import { ActivityGallery } from "./ActivityGallery.tsx";
import { DecisionGallery } from "./DecisionGallery.tsx";
import { FoundationsGallery } from "./FoundationsGallery.tsx";
import { StatusGallery } from "./StatusGallery.tsx";
import { useDesignTokens } from "./useDesignTokens.ts";

const MODES = [
  { label: "Both", value: null },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

/**
 * The design language, rendered with the real components and real tokens, so that it cannot drift from the product.
 * Edit design/tokens.css and look here. It takes no data and makes no requests.
 */
export function DesignPage() {
  const { params } = useRoute();
  const tokens = useDesignTokens();
  const mode = params.get("theme");
  const themes = mode === "light" || mode === "dark" ? [mode] : ["light", "dark"];
  return (
    <div className="design-page">
      <header className="design-head">
        <h1 className="page-title">Octotrack design language</h1>
        <nav className="tabs" aria-label="Theme">
          {MODES.map(({ label, value }) => (
            <button
              type="button"
              key={label}
              className="tab"
              aria-pressed={mode === value}
              onClick={() => setParams({ theme: value })}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="design-columns">
        {themes.map((theme) => (
          <div className="design-column" data-theme={theme} key={theme}>
            <FoundationsGallery tokens={tokens} />
            <StatusGallery />
            <DecisionGallery />
            <ActivityGallery />
          </div>
        ))}
      </div>
    </div>
  );
}
