import { parseArgs } from "node:util";

export class UsageError extends Error {}

export interface OptionSpec {
  type: "string" | "boolean";
  short?: string;
  multiple?: boolean;
  description: string;
}

export type OptionSpecs = Readonly<Record<string, OptionSpec>>;

export class Args {
  constructor(
    readonly positionals: readonly string[],
    private readonly values: Readonly<Record<string, string | boolean | (string | boolean)[] | undefined>>,
  ) {}

  str(name: string): string | undefined {
    const value = this.values[name];
    return typeof value === "string" ? value : undefined;
  }

  flag(name: string): boolean {
    return this.values[name] === true;
  }

  list(name: string): string[] {
    const value = this.values[name];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
    return [];
  }

  /** A list, or undefined when the option was not given, so that input objects stay minimal. */
  optionalList(name: string): string[] | undefined {
    const value = this.list(name);
    return value.length === 0 ? undefined : value;
  }

  int(name: string): number | undefined {
    const value = this.str(name);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new UsageError(`--${name} must be a whole number, got "${value}"`);
    return parsed;
  }

  requirePositional(index: number, label: string): string {
    const value = this.positionals[index];
    if (value === undefined) throw new UsageError(`Missing <${label}>`);
    return value;
  }

  requirePositionals(label: string): string[] {
    if (this.positionals.length === 0) throw new UsageError(`Missing <${label}>`);
    return [...this.positionals];
  }
}

/**
 * The standard parser takes anything starting with a dash for an option, which would reject the query language's own
 * negation, and any option value that happens to start with one. This resolves both before it sees them. One dash and a
 * single letter is an option, and anything longer with one dash is a negated query term. Positionals keep their order,
 * which matters when a query was not quoted.
 */
function disambiguate(argv: readonly string[], specs: OptionSpecs): string[] {
  const longNameOf = new Map(
    Object.entries(specs).flatMap(([name, spec]) =>
      spec.short === undefined ? [] : [[spec.short, name] as const],
    ),
  );
  const options: string[] = [];
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    const isLong = token.startsWith("--");
    const isShort = !isLong && token.length === 2 && token.startsWith("-");
    if (!isLong && !isShort) {
      if (token.startsWith("-") && token.length === 1) options.push(token);
      else positionals.push(token);
      continue;
    }
    const name = isLong ? token.slice(2) : longNameOf.get(token.charAt(1));
    const value = argv[index + 1];
    if (name !== undefined && specs[name]?.type === "string" && value !== undefined) {
      options.push(`--${name}=${value}`);
      index += 1;
    } else {
      options.push(token);
    }
  }
  return positionals.length === 0 ? options : [...options, "--", ...positionals];
}

export function parse(argv: readonly string[], specs: OptionSpecs): Args {
  const options = Object.fromEntries(
    Object.entries(specs).map(([name, spec]) => [
      name,
      {
        type: spec.type,
        ...(spec.short === undefined ? {} : { short: spec.short }),
        ...(spec.multiple === true ? { multiple: true } : {}),
      },
    ]),
  );
  try {
    const { values, positionals } = parseArgs({
      args: disambiguate(argv, specs),
      options,
      allowPositionals: true,
      strict: true,
    });
    return new Args(positionals, values);
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

const DURATION = /^(\d+)(ms|s|m|h|d)?$/;
const UNIT_MS: Readonly<Record<string, number>> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function parseDuration(value: string): number {
  const match = DURATION.exec(value);
  const amount = match?.[1];
  if (amount === undefined)
    throw new UsageError(`Invalid duration "${value}". Use for example 90s, 30m or 2h.`);
  return Number(amount) * (UNIT_MS[match?.[2] ?? "s"] ?? 1000);
}

/** Quotes a value so that it survives being put into a query string. */
export function quoteValue(value: string): string {
  return /[\s(),"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}
