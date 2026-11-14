const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/**
 * The calmest screen, and the most common good state: nothing waits on the developer. It says who is working and
 * where the next ask likely comes from, as E-States draws it.
 */
export function NothingNeedsYou({
  working,
  next,
}: {
  /** Agents running on lines now. */
  working: number;
  /** The first working line with a step still to do, where the next ask likely comes from. */
  next: { title: string; step: string | null } | null;
}) {
  const who =
    working === 0
      ? "No agent is working right now."
      : `${WORDS[working] ?? working} agent${working === 1 ? " is" : "s are"} working.`;
  const where =
    next === null
      ? ""
      : ` The likely next ask is on ${next.title}${next.step === null ? "" : `, at its step: ${next.step}`}.`;
  return (
    <section className="calm" aria-label="Nothing needs you">
      <h2 className="calm-title">Nothing needs you.</h2>
      <p className="muted">
        {who}
        {where}
      </p>
    </section>
  );
}
