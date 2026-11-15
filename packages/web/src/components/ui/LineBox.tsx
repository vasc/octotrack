import { Field } from "./Field.tsx";

/** One line, such as a measurement, where the box's place says what it is for: a Field with its label hidden. */
export function LineBox(props: {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string | undefined;
}) {
  return <Field {...props} hideLabel />;
}
