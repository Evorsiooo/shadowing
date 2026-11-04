# Euno's animation engine

The files in `core/` and `web/` are copied from the Bible Strong avatar lab by Stéphane Montlouis-Calixte:

- Source: https://github.com/smontlouis/bible-strong-avatar-lab
- Commit: `79fe9ba06e4874b11394b8e8a3f2c493c9d197ba` (25 August 2026)
- `core/` is `packages/avatar-core/src`, without its tests
- `web/` is `packages/avatar-web/src`, without its tests
- Licence: GNU Affero General Public License v3.0 only (`AGPL-3.0-only`), in `LICENSE` next to this file

The only change is in `web/index.ts`: it imports the core with the relative path `../core/index.ts` instead of the
package name `@bible-strong/avatar-core`. Nothing else in the engine was edited.

Euno himself (his shape, colours, expressions and animations) is the definition in `../euno.avatar.json`, made with the
lab's editor. `../entry.mjs` and `../static.mjs` are this app's glue: the first exposes the engine to the app as
`window.EunoEngine`, the second draws a single frame as plain SVG for the logo, the icons and the server's pages.
`../ajv-stub.js` replaces the schema validator the engine imports, which the app doesn't need.

The engine is AGPL-3.0 and is sent to every visitor's browser, so the licence asks that visitors can get the
corresponding source (this repository, https://github.com/Evorsiooo/shadowing).
