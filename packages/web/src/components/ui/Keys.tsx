import { Icon, type IconName } from "./Icon.tsx";

/** Keys drawn as an icon where they have one, Return and the arrows, their names still there for a screen reader. */
const KEY_ICONS: Readonly<Record<string, IconName>> = {
  Return: "enter",
  Up: "up",
  Down: "down",
  Option: "option",
};

export function Keys({ keys }: { keys: string }) {
  return (
    <kbd className="ui-keys">
      {keys.split(" ").map((key, index) => {
        const icon = KEY_ICONS[key];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a key can repeat in one chord, and the order never changes
          <span key={index}>
            {index === 0 ? null : " "}
            {icon === undefined ? (
              key
            ) : (
              <>
                <Icon name={icon} />
                <span className="ui-hidden">{key}</span>
              </>
            )}
          </span>
        );
      })}
    </kbd>
  );
}
