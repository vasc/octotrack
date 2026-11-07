import { splitRefs } from "../../lib/format.ts";
import { RefLink } from "./RefLink.tsx";

/** Plain text in which every ref is clickable. */
export function RefText({ text }: { text: string }) {
  return (
    <>
      {splitRefs(text).map((piece, index) =>
        piece.isRef ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one string never reorder
          <RefLink key={index} value={piece.text} />
        ) : (
          piece.text
        ),
      )}
    </>
  );
}
