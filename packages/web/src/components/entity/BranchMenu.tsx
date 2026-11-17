import type { PlanBranch, PlanStep } from "@octotrack/core/schemas";
import { Menu, MenuAction, MenuGroup, MenuItem } from "../ui/Menu.tsx";

/**
 * A branch's More: which later step it holds up, or none, ticked; then changing it, making it its own line, and removing
 * it. A branch that became a line offers only its hold and Remove.
 */
export function BranchMenu({
  branch,
  later,
  onHoldsUp,
  onEdit,
  onPromote,
  onRemove,
  busy = false,
  failed,
}: {
  branch: PlanBranch;
  /** The steps after the one it forks from, in its sequence: what it may hold up. */
  later: readonly PlanStep[];
  onHoldsUp(step: string | null): void;
  /** Left out for a branch that became a line: its steps are that line's now. */
  onEdit?: (() => void) | undefined;
  onPromote?: (() => void) | undefined;
  onRemove(): void;
  /** A change to it is on its way. */
  busy?: boolean;
  /** Why its last change did not work, until the next try. */
  failed?: string | undefined;
}) {
  return (
    <Menu
      label={`More: branch ${branch.address}, ${branch.title}`}
      icon="more"
      menuLabel={`Branch ${branch.address}`}
      busy={busy ? "Changing…" : undefined}
      failed={failed === undefined ? undefined : `Not changed: ${failed}`}
    >
      {(close) => (
        <>
          <MenuGroup label="Holds up">
            {later.map((step) => (
              <MenuItem
                key={step.id}
                checked={branch.holdsUp === step.address}
                onSelect={() => {
                  close();
                  if (branch.holdsUp !== step.address) onHoldsUp(step.address);
                }}
              >
                Step {step.address}, {step.title}
              </MenuItem>
            ))}
            <MenuItem
              checked={branch.holdsUp === null}
              onSelect={() => {
                close();
                if (branch.holdsUp !== null) onHoldsUp(null);
              }}
            >
              Nothing
            </MenuItem>
          </MenuGroup>
          <MenuGroup label="This branch">
            {onEdit === undefined ? null : (
              <MenuAction
                onSelect={() => {
                  close();
                  onEdit();
                }}
              >
                Rename or change its steps…
              </MenuAction>
            )}
            {onPromote === undefined ? null : (
              <MenuAction
                onSelect={() => {
                  close();
                  onPromote();
                }}
              >
                Make it its own line…
              </MenuAction>
            )}
            <MenuAction
              onSelect={() => {
                close();
                onRemove();
              }}
            >
              Remove the branch
            </MenuAction>
          </MenuGroup>
        </>
      )}
    </Menu>
  );
}
