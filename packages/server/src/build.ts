/**
 * Which build this is. A compiled binary has it fixed at build time with --define; anything run from a checkout is
 * "dev". Kept in a plain constant so that the CLI and the server read the same value.
 */
export const BUILD_ID: string = process.env.OCTO_BUILD_ID ?? "dev";
