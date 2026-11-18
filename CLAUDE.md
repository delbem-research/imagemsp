# CLAUDE.md

IMAGEM:SP: stack, architecture, conventions and quality gates are in [`README.md`](README.md).

## Flow

Work in this repo lives in the Flow project `proj_7x0hj7zhe7`; no other tracker holds it. Every session follows [Get Things Flowing](https://flow.ttoss.dev/docs/agents/protocol.md), the [delivery process](https://raw.githubusercontent.com/ttoss/ttoss/main/docs/website/docs/engineering/workflow/process.md) and this project's parameters in `.claude/flow.md`, started by `/flow` or not:

- Work through a task: the one you were given, or one you find (`list-tasks` with `query`) or propose before changing anything. Your run holds the task (GTF-S8).
- Apply the parameters on the way: `Before proposing` before the change; `Merge rule`; `Intake` for what you notice; `Decisions` for open choices.
- This codebase is yours: how it's built is your call, and you'll keep building on it. Improve the code your change touches; work you notice outside it is a task of its own by `Intake`, never part of this change.
- A task whose `implements` change is out keeps its title and brief: new or wider scope is a successor task, `derived_from` it. Before writing again to a task you wrote earlier, `get-task` it and send `if_unmodified_since` with the `updated_at` you read.
- The change carries the task's URL and the tasks it settles; before you stop, the task carries the change as an `implements` reference, `after_integration` (what integrating leaves), and its wait on the gates. After the verdict, the tick writes the task.
- Friction with a skill, GTF or a Flow tool → `flow-friction`, then continue.
