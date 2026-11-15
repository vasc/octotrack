import { type ReactNode, useState } from "react";
import { Actions } from "../components/ui/Actions.tsx";
import { Button } from "../components/ui/Button.tsx";

export function DesignSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="design-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** One component in one state, with a label saying which. */
export function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="design-example">
      <span className="design-label">{label}</span>
      {children}
    </div>
  );
}

/** A sheet in one state: it draws over the whole page, so it waits behind a button until asked for. */
export function SheetExample({ label, children }: { label: string; children(close: () => void): ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Example label={label}>
      <Actions>
        <Button onClick={() => setOpen(true)}>Open {label}</Button>
      </Actions>
      {open ? children(() => setOpen(false)) : null}
    </Example>
  );
}
