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
  createLucideIcon,
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
  Option,
  Plus,
  Square,
  TextAlignStart,
  Triangle,
  Users,
  X,
} from "lucide-react";

/**
 * Octotrack's own mark, drawn on Lucide's 24 grid so it sits beside the other icons at their size and weight: two
 * octagonal lanes, each open on a different side, round a solid octagon. design/log.md says why.
 */
const Lanes = createLucideIcon("OctotrackLanes", [
  [
    "polyline",
    {
      points: "21.75,7.96 21.75,16.04 16.04,21.75 7.96,21.75 2.25,16.04 2.25,7.96 7.96,2.25 16.04,2.25",
      strokeWidth: "1.8",
      key: "outer",
    },
  ],
  [
    "polyline",
    {
      points: "6,14.49 6,9.52 9.52,6 14.49,6 18,9.52 18,14.49 14.49,18 9.52,18",
      strokeWidth: "1.8",
      key: "inner",
    },
  ],
  [
    "polygon",
    {
      points: "14.55,13.06 13.06,14.55 10.95,14.55 9.45,13.06 9.45,10.95 10.95,9.45 13.06,9.45 14.55,10.95",
      fill: "currentColor",
      stroke: "none",
      key: "centre",
    },
  ],
]);

/** Each icon the dashboard draws, from Lucide or drawn the same way, and whether its shape is filled in. */
const ICONS = {
  plus: { shape: Plus },
  pin: { shape: MapPin },
  keyboard: { shape: Keyboard },
  /** The Log, in the More menu: lines of what happened. */
  log: { shape: TextAlignStart },
  /** Agents, in the More menu. */
  agents: { shape: Users },
  grip: { shape: GripVertical },
  chevron: { shape: ChevronDown },
  pages: { shape: Menu },
  more: { shape: Ellipsis },
  /** Octotrack's own mark, beside its name in the bar. */
  mark: { shape: Lanes },
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
