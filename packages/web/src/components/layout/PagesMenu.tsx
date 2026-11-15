import { useMenu } from "../../hooks/useMenu.ts";
import { Icon } from "../ui/Icon.tsx";

const PAGES = [
  { to: "/", name: "Lines" },
  { to: "/log", name: "Log" },
  { to: "/agents", name: "Agents" },
] as const;

/** Which page a path is: Lines unless it is the Log or Agents. */
function pageOf(path: string): string {
  return PAGES.find((page) => page.to !== "/" && path === page.to)?.to ?? "/";
}

/**
 * The pages on a phone, behind one quiet button in the bar: Lines is the app, and the Log and Agents are places to look
 * now and then, so they get no bar of equal tabs. The page you are on is checked.
 */
export function PagesMenu({ path, onGo }: { path: string; onGo(to: string): void }) {
  const menu = useMenu();
  const current = pageOf(path);
  const name = PAGES.find((page) => page.to === current)?.name ?? "Lines";
  return (
    <span className="menu-wrap pages-menu" ref={menu.wrap}>
      <button
        ref={menu.button}
        type="button"
        className="btn btn-icon"
        aria-label={`Pages: ${name}`}
        title="Pages"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.toggle}
        onBlur={menu.leave}
      >
        <Icon name="more" />
      </button>
      {menu.open ? (
        <div className="menu menu-end" role="menu" aria-label="Pages" onKeyDown={menu.onMenuKey}>
          {PAGES.map((page) => (
            <button
              key={page.to}
              type="button"
              role="menuitemradio"
              aria-checked={page.to === current}
              className="menu-item"
              onBlur={menu.leave}
              // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on the page you are on
              autoFocus={page.to === current}
              onClick={() => {
                menu.close();
                onGo(page.to);
              }}
            >
              {page.name}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
