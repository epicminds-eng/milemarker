# Mile Marker

## Session handoff
- At session start, if HANDOFF.md exists in the repo root, read it before anything else.
- Before every commit, rewrite HANDOFF.md: status line, what changed this session, what's rough, where the pieces live, next step. Keep it under 40 lines. Never delete it.
- If the repo has no HANDOFF.md, create it with the first commit of the session.

## Repo law
- sf-move is read-only reference; Build N = one session, one verified commit.
- Cloud Claude Code sessions are OK for this repo — Chad works from his phone. A cloud session commits AND pushes; local gets `git pull` when he's next at the Mac.
- Build 1 was the only local build (file copy from sf-move). Builds 2+ run cloud.
- Bump the footer version + build date in index.html on every commit ("Mile Marker v1 · build YYYY-MM-DD · <hash|local>").
- Spacing in new component CSS comes from the --s1…--s6 / --r / --r2 scale tokens; percentages for anything that flexes; absolute hairlines only.
- Verify before claiming: every "Built" line in HANDOFF.md must be backed by `npm test` or a screenshot that was actually looked at.
