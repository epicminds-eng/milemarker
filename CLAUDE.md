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
- No link or button announces that it is a link: never "Open in", "Link to", "Tap to", "Go to", "View", "Click" in a label — the label is the destination or the action noun ("Apple Maps", "Orbitz", "Log a charge"). Gate: `grep -n "Open in\|Link to\|Tap to\|Go to\|View \|Click" index.html` returns nothing.
- No tildes in rendered text; estimates read plain, the amber est. badge carries the meaning.
- Every build: `git pull` first · syntax-check (`node --check` on the extracted script) · Playwright at 390 and 1194 · bump the footer build number by one · commit · push · report the hash.
- Mockups are reference for LOOK, never STRUCTURE — a mockup never adds a tab, sub-tab, section, picker or nav row; raise it instead.
