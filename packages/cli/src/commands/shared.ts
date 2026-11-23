import { type Args, type OptionSpecs, quoteValue, UsageError } from "../args.ts";

export const LIST_OPTIONS: OptionSpecs = {
  limit: { type: "string", description: "Maximum number of results" },
};

/** Builds a query string from positional text plus convenience flags, such as --status todo. */
export function queryFrom(args: Args, flags: readonly string[] = []): string | undefined {
  const parts: string[] = [...args.positionals];
  for (const flag of flags) {
    const values = args.list(flag);
    if (values.length > 0) parts.push(`${flag}:${values.map(quoteValue).join(",")}`);
  }
  return parts.length === 0 ? undefined : parts.join(" ");
}

export function listInput(args: Args, flags: readonly string[] = []): { query?: string; limit?: number } {
  const query = queryFrom(args, flags);
  const limit = args.int("limit");
  return { ...(query === undefined ? {} : { query }), ...(limit === undefined ? {} : { limit }) };
}

/** Reads long text from --name, or from --name-file, where - means stdin. */
export async function textOption(args: Args, name: string): Promise<string | undefined> {
  const inline = args.str(name);
  const file = args.str(`${name}-file`);
  if (inline !== undefined && file !== undefined) {
    throw new UsageError(`Pass --${name} or --${name}-file, not both`);
  }
  if (file === undefined) return inline;
  return file === "-" ? await Bun.stdin.text() : await Bun.file(file).text();
}

/** Drops undefined values, so that nothing unset is sent to a strict input schema. */
export function compact(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
