import { useState } from "react";

export interface DesignToken {
  name: string;
  value: string;
}

function readTokens(): DesignToken[] {
  const tokens: DesignToken[] = [];
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ":root") continue;
      for (const name of rule.style) {
        if (name.startsWith("--")) tokens.push({ name, value: rule.style.getPropertyValue(name).trim() });
      }
    }
  }
  return tokens;
}

/** Whatever is really in the stylesheet, so that the specimen cannot show a list that has fallen behind. */
export function useDesignTokens(): readonly DesignToken[] {
  const [tokens] = useState(readTokens);
  return tokens;
}
