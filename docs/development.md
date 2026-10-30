# Development, localization and packaging

Stagebook uses plain JavaScript, CSS and HTML. Python builds a single offline HTML application. No frontend packages, server or online assets are required at runtime.

## Build and check

Use Python 3.10+ and Node.js 24. The release preparation was checked with Python 3.14.5 and Node.js 24.19.0.

```sh
python3 build.py
node scripts/check.cjs
```

Open `dist/走台本.html` after building. Edit `src`, not the generated HTML. The build emits `Stagebook-dev-bundle.zip` for development; use the neat package below for releases.

## Source layout

- `core.js`: data, geometry and time semantics.
- `app.js` and `human.js`: application state, stage interaction and actor editing.
- `timeline.js` and `editing.js`: clips, shortcuts, context menus and path points.
- `audio.js` and `lyrics.js`: media state and persistent lyric editing.
- `rehearsal.js`: edition labels, optional production history and selected rehearsal notes sheets.
- `io.js`: folder access, ZIPs, embedded audio and draft recovery.
- `i18n.js` and `locales`: interface translation, preferences and localized help.
- `index.html` and `style.css`: layout, controls and language-aware wrapping.

Application version 9.2.0 is separate from the production data format, which remains `stagebook-library` version 1.

## Localization

English and Traditional Chinese catalogs are JSON files in `src/locales`. Simplified Chinese UI literals are the source messages. `tr` handles literal UI strings; the `ui` template tag translates static fragments before inserting opaque values. Never translate a completed string containing user-supplied text. Keep all numbered placeholders and file paths unchanged.

Static controls declare `data-i18n` and localized attribute keys. Language changes refresh generated panels and language-sensitive caches without editing the production or adding Undo entries. Add a locale through the supported-language list, catalog build inputs, selector and tests; do not add network translation calls.

Review terminology in context. Test long labels, plural/count wording, ARIA labels, dialog sizes, menus, empty states and existing user text that happens to equal a UI label. Keep timecode notation unambiguous and use the selected locale for human-readable dates.

## Release packaging

```sh
python3 package_show.py dist release-build Stagebook-v9.2.0-offline.zip --neat --english
python3 validate.py release-build
```

The output folder must be new or empty. Preserve the source data. English release packages contain “Stagebook.html” and “演出资料”; the latter contains editable data and technical documentation. The corresponding source archive in its technical folder includes LICENSE. The full GPL text is also embedded in the HTML and preserved by subsequent app exports.

Distribute the complete corresponding source as `Stagebook-v9.2.0-source.zip` alongside the offline asset. Include source, build scripts, generic examples, documentation and license; exclude generated output and private production material.

## Verification limits

Eighteen automated suites cover geometry, timing, media state, file round trips, lyrics, playback context, editing, deletion continuity and localization. Audio readiness is simulated; byte-preserving round trips do not replace real browser decoding or listening.

For interface changes, use your own independent test browser. Exercise seek, insert, drag, notes, independent timing, language switching, deletion, Undo/Redo, export and reopen. Do not use someone else's working session. Complete mobile editing and every browser/OS combination are not yet verified.

Production manifests may contain an optional `workspace` object with `showId` and `songId`, used only to reopen the selected production and song. Older packages without it remain supported; production content and timing format remain version 1.


## History and media compatibility

The optional handoff, version and rehearsal-list metadata is defined in AI-GUIDE.md and the generated schema. Version snapshots contain full song objects and cannot contain recursive history. Do not duplicate the source text of a shared note. Keep schemas, normalization, file serializers and the portable validator consistent when adding fields.

ZIP files do not preserve Blob MIME types. Mark extracted MP3s as audio/mpeg, and normalize untyped resources before creating playback URLs. The strict-MIME media test rejects an untyped Blob instead of silently accepting it. Imported media is retained in pending assets so the existing recovery-draft writer can store it. Actual browser decoding and listening remain separate checks.

Release HTML embeds its corresponding source archive. Its capsule identifies the source ZIP filename; subsequent exports keep it in the technical folder. Older capsules without a name retain the legacy filename. The public release uses generic samples only.
