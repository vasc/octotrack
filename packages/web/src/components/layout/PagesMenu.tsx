import { Menu, MenuItem } from "../ui/Menu.tsx";

const PAGES = [
  { to: "/", name: "Lines" },
  { to: "/log", name: "Log" },
  { to: "/agents", name: "Agents" },
] as const;

/** Which page a path is: Lines unless it is the Log or Agents. */
function pageOf(path: string): string {
  return PAGES.find((page) => page.to !== "/" && path === page.to)?.to ?? "/";
}

/** The pages, behind one icon on a phone, where the bar has no room for their names; the page you are on is checked. */
export function PagesMenu({ path, onGo }: { path: string; onGo(to: string): void }) {
  const current = pageOf(path);
  const name = PAGES.find((page) => page.to === current)?.name ?? "Lines";
  return (
    <Menu label={`Pages: ${name}`} icon="more" menuLabel="Pages">
      {(close) =>
        PAGES.map((page) => (
          <MenuItem
            key={page.to}
            checked={page.to === current}
            onSelect={() => {
              close();
              onGo(page.to);
            }}
          >
            {page.name}
          </MenuItem>
        ))
      }
    </Menu>
  );
}
