# Working on Octotrack

- Run `bun run check` before calling anything done: types, lint, and both test suites.
- A new capability starts as a contract in `packages/core/src/contracts.ts` and a handler in `packages/core/src/ops/`, then
  gets a CLI command in `packages/cli/src/commands/` that lists it in `ops`. A test fails if an operation has no command.
- `packages/core` must not import anything tied to a runtime. A test enforces this.
- Dashboard tests run separately with their own DOM preload: `bun run --cwd packages/web test`.
- Inside `waitFor`, do not use `expect(element).toBeNull()`. See the `gone` helper in
  `packages/web/test/integration.test.tsx` for why.
- Design decisions and their reasoning live in `docs/DESIGN.md`. Update it when one changes.
