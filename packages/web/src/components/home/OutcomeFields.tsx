import { Field, FieldRow } from "../ui/Field.tsx";

/** A task's named outcomes, a one-line box for each side by side, then a note for anything that surprised. */
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
      <FieldRow>
        {fields.map((name) => (
          <Field
            key={name}
            label={name}
            value={values[name] ?? ""}
            onChange={(value) => onValue(name, value)}
          />
        ))}
      </FieldRow>
      <Field label="Note" value={note} onChange={onNote} multiline />
    </>
  );
}
