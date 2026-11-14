import type { PushState } from "../../hooks/usePush.ts";

const SAID: Readonly<Record<Exclude<PushState, "off">, string>> = {
  unsupported: "",
  on: "Buzzing this device for urgent questions and the top two lines",
  blocked: "Notifications are blocked for this site in the browser's settings",
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
    <span className="push-toggle">
      {state === "off" ? (
        <button type="button" className="btn" onClick={onTurnOn}>
          Buzz this device
        </button>
      ) : (
        <span className="muted">{SAID[state]}</span>
      )}
      {error === null ? null : <span className="error-text">{error}</span>}
    </span>
  );
}
