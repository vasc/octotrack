import type { PushState } from "../../hooks/usePush.ts";
import { Button } from "../ui/Button.tsx";
import { Note } from "../ui/Note.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Icon } from "../ui/Icon.tsx";

/** Why this device cannot buzz yet, and what to do about it. */
const REFUSED: Readonly<Record<"blocked" | "dismissed" | "unsupported" | "no-key", string>> = {
  blocked:
    "Notifications are blocked for this site. Allow them in the browser's site settings, then press again.",
  dismissed: "You dismissed the browser's question; press again to be asked once more.",
  unsupported: "This browser cannot buzz. On iPhone, add Octotrack to the home screen first.",
  "no-key": "This tracker does not send notifications: it has no push key.",
};

/**
 * Whether this device is buzzed: Buzz this device, Turning on…, then Buzzing this device with Stop; or why it cannot,
 * with what to do, and the button again where pressing again can help.
 */
export function PushToggle({
  state,
  error,
  onTurnOn,
  onTurnOff,
}: {
  state: PushState;
  error: string | null;
  onTurnOn(): void;
  onTurnOff(): void;
}) {
  const again = <Button onClick={onTurnOn}>Buzz this device</Button>;
  return (
    <>
      {state === "off" ? again : null}
      {state === "turning-on" ? <Note>Turning on…</Note> : null}
      {state === "on" ? (
        <Note>
          <Icon name="check" /> Buzzing this device · <TextLink onClick={onTurnOff}>Stop</TextLink>
        </Note>
      ) : null}
      {state === "blocked" || state === "dismissed" ? (
        <>
          <Note>{REFUSED[state]}</Note>
          {again}
        </>
      ) : null}
      {state === "unsupported" ? <Note>{REFUSED.unsupported}</Note> : null}
      {state === "no-key" ? <Note error>{REFUSED["no-key"]}</Note> : null}
      {error === null ? null : <Note error>{error}</Note>}
    </>
  );
}
