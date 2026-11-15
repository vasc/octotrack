import { LineBox } from "../ui/LineBox.tsx";
import { TextBox } from "../ui/TextBox.tsx";

/**
 * A task's named outcomes, a short one-line box for each in a row, so none can add rows to the list sent back, then a
 * note for anything that surprised.
 */
export function OutcomeFields({
  fields,
  values,
  onValue,
  note,
  onNote,
}: {
  fields: readonly string[];
  values: Readonly<Record<string, string>>;
  onValue(name: string, value: string): void;
  note: string;
  onNote(note: string): void;
}) {
  return (
    <>
      <div className="outcome-fields">
        {fields.map((name) => (
          <div key={name} className="outcome-field">
            <span aria-hidden="true">{name}</span>
            <LineBox label={name} value={values[name] ?? ""} onChange={(value) => onValue(name, value)} />
          </div>
        ))}
      </div>
      <div className="outcome-field">
        <span aria-hidden="true">Note, if anything surprised you</span>
        <TextBox label="Note, if anything surprised you" value={note} onChange={onNote} />
      </div>
    </>
  );
}
