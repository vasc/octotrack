import { navigate } from "../../lib/router.ts";

export interface NavItemProps {
  label: string;
  to: string;
  current: boolean;
  count?: number;
  hot?: boolean;
}

export function NavItem({ label, to, current, count, hot = false }: NavItemProps) {
  return (
    <a
      className="nav-item"
      href={to}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      <span>{label}</span>
      {count === undefined || count === 0 ? null : (
        <span className="nav-count" data-hot={hot}>
          {count}
        </span>
      )}
    </a>
  );
}
