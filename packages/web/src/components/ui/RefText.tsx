import { splitRefs } from "../../lib/format.ts";
import { RefLink } from "./RefLink.tsx";

/** Plain text in which every ref is clickable: it opens the item, or does what the page asks of a ref. */
export function RefText({ text, onRef }: { text: string; onRef?: (ref: string) => void }) {
  return (
    <>
      {splitRefs(text).map((piece, index) =>
        piece.isRef ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one string never reorder
          <RefLink key={index} value={piece.text} {...(onRef === undefined ? {} : { onPick: onRef })} />
        ) : (
          piece.text
        ),
      )}
    </>
  );
}
