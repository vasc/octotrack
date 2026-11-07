import { DesignSection } from "./Example.tsx";
import type { DesignToken } from "./useDesignTokens.ts";

function withPrefix(tokens: readonly DesignToken[], prefix: string): readonly DesignToken[] {
  return tokens.filter((token) => token.name.startsWith(prefix));
}

function isColor(token: DesignToken): boolean {
  return token.value.startsWith("light-dark(");
}

/** The tokens as they really are: colors, type, space and shape. */
export function FoundationsGallery({ tokens }: { tokens: readonly DesignToken[] }) {
  return (
    <>
      <DesignSection title="Color">
        <div className="design-swatches">
          {tokens.filter(isColor).map((token) => (
            <div className="design-swatch" key={token.name}>
              <span style={{ background: `var(${token.name})` }} />
              <code>{token.name}</code>
            </div>
          ))}
        </div>
      </DesignSection>
      <DesignSection title="Type">
        {withPrefix(tokens, "--text-").map((token) => (
          <div key={token.name} style={{ fontSize: `var(${token.name})` }}>
            {token.name} ({token.value}) Which queue should the beta use?
          </div>
        ))}
        <code className="mono">--mono OCT-12 D-3 PR-7 kind:decision status:open</code>
      </DesignSection>
      <DesignSection title="Space">
        {withPrefix(tokens, "--space-")
          .filter((token) => token.name !== "--space-unit")
          .map((token) => (
            <div className="design-row" key={token.name}>
              <code className="design-label">{token.name}</code>
              <div className="design-bar" style={{ width: `var(${token.name})` }} />
            </div>
          ))}
      </DesignSection>
      <DesignSection title="Shape and elevation">
        <div className="design-row">
          {withPrefix(tokens, "--radius-").map((token) => (
            <div className="design-swatch" key={token.name}>
              <span style={{ borderRadius: `var(${token.name})` }} />
              <code>{token.name}</code>
            </div>
          ))}
        </div>
        <div className="design-row">
          {withPrefix(tokens, "--shadow-").map((token) => (
            <div className="card" key={token.name} style={{ boxShadow: `var(${token.name})` }}>
              <code>{token.name}</code>
            </div>
          ))}
        </div>
      </DesignSection>
    </>
  );
}
