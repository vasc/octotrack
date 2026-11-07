import { openEntity } from "../../lib/router.ts";

/** A ref anywhere on screen opens that item in the inspector. */
export function RefLink({ value }: { value: string }) {
  return (
    <button type="button" className="ref" onClick={() => openEntity(value)}>
      {value}
    </button>
  );
}
