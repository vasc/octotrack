import type { PushState } from "../../hooks/usePush.ts";
import { Button } from "../ui/Button.tsx";
import { Note } from "../ui/Note.tsx";

const SAID: Readonly<Record<Exclude<PushState, "off" | "unsupported">, string>> = {
  on: "Buzzing this device",
  blocked: "Notifications blocked",
  "turning-on": "Turning on…",
};

/** Whether this device is buzzed, and the one control that turns it on. */
export function PushToggle({
  state,
  error,
  onTurnOn,
}: {
  state: PushState;
  error: string | null;
  onTurnOn(): void;
}) {
  if (state === "unsupported") return null;
  return (
    <>
      {state === "off" ? <Button onClick={onTurnOn}>Buzz this device</Button> : <Note>{SAID[state]}</Note>}
      {error === null ? null : <Note error>{error}</Note>}
    </>
  );
}
