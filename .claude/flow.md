# Flow

`flow` parameters for IMAGEM:SP. Each value points to the rule that holds it; edit the rule, not this list.

- **Flow project id**: `proj_7x0hj7zhe7`.
- **Standing-decision task id**: `task_narxs91dg4`.
- **Repos**: `delbem-research/imagemsp`.
- **Runtime**: the [Claude Code sessions preset](skills/flow/references/runtime-claude-code-remote.md), sessions from `delbem-research/imagemsp`; run records by the `session-run.mjs` hook in `.claude/settings.json`.
- **Max runs**: 2.
- **Models**: child `claude-opus-5-5`; check `claude-sonnet-5-5`; review `claude-opus-5-5`.
- **Routines**: the Tick hourly on weekdays 09:00–18:00 `America/Sao_Paulo` (`/flow proj_7x0hj7zhe7`), a Claude Code routine on `delbem-research/imagemsp`, model `claude-opus-5-5`.
- **Intake**: default.
- **Ready brief**: default.
- **Decisions**: default.
- **Before proposing**: the CI's steps, `pnpm typecheck`, `pnpm lint` and `pnpm test` (`.github/workflows/pr.yml`); coverage never decreases (`README.md` § Quality).
- **Review**: none.
- **Merge rule**: default, squash merge with the PR title as the commit, the `pr` check green.
- **Release procedure**: every merge to `main` deploys, outside this repo.
- **Closing evidence**: `merged` (integrated, `pr` check green).
- **Delivery kinds**: default.
