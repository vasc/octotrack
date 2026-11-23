/**
 * What waits on you on a line, as a small pill at a row's end that leads to it: "5 for you" in the colour for what
 * needs you, "Step in" in the warning tone.
 */
export function Waits({
  label,
  tone = "attention",
  href,
  onGo,
}: {
  label: string;
  tone?: "attention" | "warn";
  href: string;
  onGo(href: string): void;
}) {
  return (
    <a
      className="ui-waits"
      data-tone={tone}
      href={href}
      onClick={(event) => {
        // The row it sits on opens the line; this opens what waits.
        event.stopPropagation();
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(href);
      }}
    >
      {label}
    </a>
  );
}
