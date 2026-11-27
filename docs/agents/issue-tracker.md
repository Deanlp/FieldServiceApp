# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `deanlp/fieldserviceapp`.

Locally, use the `gh` CLI. In Claude Code cloud sessions where `gh` is not authenticated, use the GitHub MCP tools (`issue_write`, `issue_read`, `list_issues`, `add_issue_comment`, `sub_issue_write`) for the same operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>`. Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's native issue dependencies. `gh issue edit <child> --add-blocked-by <blocker>`. Where unavailable, put `Blocked by: #<n>, #<n>` at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: post the explanation with `gh issue comment`, then `gh issue close <number>`.

File issues only into `deanlp/fieldserviceapp`. Never file into `mattpocock/skills`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`.
- **Child ticket**: a GitHub sub-issue of the map, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, it is assigned to the driving dev.
- **Frontier query**: the map's open, unassigned children with no open blockers; first in map order wins.
- **Claim**: assign the ticket to yourself, as the session's first write.
- **Resolve**: comment the answer, close the issue, then append a gist + link to the map's Decisions-so-far.
