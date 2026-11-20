import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Contrast,
  CornerDownLeft,
  Ellipsis,
  GitBranch,
  GitMerge,
  GripVertical,
  Keyboard,
  type LucideIcon,
  MapPin,
  Menu,
  Minus,
  Octagon,
  Option,
  Plus,
  Square,
  Triangle,
  X,
} from "lucide-react";

/** Each icon the dashboard draws, from Lucide, and whether its shape is filled in. */
const ICONS = {
  plus: { shape: Plus },
  pin: { shape: MapPin },
  keyboard: { shape: Keyboard },
  grip: { shape: GripVertical },
  chevron: { shape: ChevronDown },
  pages: { shape: Menu },
  more: { shape: Ellipsis },
  /** Octotrack's own mark, beside its name in the bar. */
  mark: { shape: Octagon },
  appearance: { shape: Contrast },
  /** Done, passing, merged, chosen. */
  check: { shape: Check },
  /** Failing, refused, gone. */
  cross: { shape: X },
  /** Stuck, urgent, step in. */
  alert: { shape: Triangle, filled: true },
  /** Needs you, running. */
  dot: { shape: Circle, filled: true },
  /** Moving, asleep. */
  half: { shape: Contrast },
  /** Not started, quiet. */
  ring: { shape: Circle },
  /** Ended without being done. */
  dash: { shape: Minus },
  /** Stopped. */
  square: { shape: Square, filled: true },
  /** A link to a page here, or the step under way. */
  arrow: { shape: ArrowRight },
  /** A link that leaves the dashboard. */
  external: { shape: ArrowUpRight },
  /** The way back. */
  back: { shape: ChevronLeft },
  /** Opens, goes into. */
  forward: { shape: ChevronRight },
  /** The Return key. */
  enter: { shape: CornerDownLeft },
  /** The up arrow key. */
  up: { shape: ArrowUp },
  /** The down arrow key. */
  down: { shape: ArrowDown },
  /** The Option key. */
  option: { shape: Option },
  /** A branch of a plan: steps forking from a step. */
  branch: { shape: GitBranch },
  /** A step a branch joins: it waits for that branch. */
  joins: { shape: GitMerge },
} satisfies Record<string, { shape: LucideIcon; filled?: boolean }>;

export type IconName = keyof typeof ICONS;

/**
 * An icon from Lucide beside words, or alone inside a control that names itself: it is never read out on its own, and
 * it takes the text's own colour, so it follows the theme. No character from a font ever stands in for one.
 */
export function Icon({ name }: { name: IconName }) {
  const icon: { shape: LucideIcon; filled?: boolean } = ICONS[name];
  const Shape = icon.shape;
  return (
    <Shape
      className="ui-icon"
      // A filled shape is fill alone: an outline round it would round it into a blob at the size of words.
      fill={icon.filled === true ? "currentColor" : "none"}
      stroke={icon.filled === true ? "none" : "currentColor"}
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    />
  );
}
