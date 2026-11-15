import { Field } from "./Field.tsx";

export interface TextBoxProps {
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string | undefined;
  onSubmit?: (() => void) | undefined;
  autoFocus?: boolean;
}

/** Several lines that grow as they are typed, where the box's place says what it is for: a Field with its label hidden. */
export function TextBox(props: TextBoxProps) {
  return <Field {...props} hideLabel multiline />;
}
