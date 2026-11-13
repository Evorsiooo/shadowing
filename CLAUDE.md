# Working on Euno Shadowing

UI changes: read `docs/LAYOUT.md` first and follow its "Checklist for every UI change". In short: build, run
`node scripts/test-layout.mjs --shots out`, then open and look at the screenshots of every screen you touched at the sizes listed
there, fix what you see, and say in the pull request what you did and did not check. The automatic check catches overflow, overlaps,
cut-off text, holes and a page that scrolls when it should fit; it cannot tell that something looks wrong.

`dist/` is committed: run `npm run build` and commit its changes with the source.
