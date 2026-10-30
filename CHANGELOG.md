# Changelog

## 9.4.0 — 2026-10-30

- Add a lyric-focused Sing workspace with multi-role highlighting and readable other voices.
- Support bracketed singer tags, separately attributed parts within one line, and optional saved `speakerIds` assignments. Untagged lines stay neutral.
- Add previous/next own-line navigation, single-line and selected-passage loops with pickup, text sizes, and pitch-preserving speed controls.
- Ignore blocking pause markers during singing practice without changing production settings; restore the previous workspace and retain the current playhead on exit.
- Center followed lyrics inside their scroll container, including edge lines; browsing pauses follow until explicitly resumed.
- Contain long sidebar song titles, scroll overflowing selected/hovered titles, and honor reduced motion.
- Keep personal singing preferences local and provide English, Simplified Chinese and Traditional Chinese UI.

Validated with twenty automated suites and a short independent-browser smoke check, as requested. Full device/browser coverage and real-team singing sessions remain future work. Existing version-1 files remain supported. No private music, lyrics or production data is included.

## 9.3.0 — 2026-10-30

- Give the timeline the full workspace width and combine its tabs and zoom controls.
- Move actor delay, movement duration and absolute timing above the movement note.
- Move the stage hint outside the canvas; place entrance labels outward and clarify backstage labels.
- Redraw stage labels and timeline geometry when their containers resize, while preserving drag coordinates.
- Add four musical-inspired appearance palettes under More → Appearance: Phantom, RENT, Hamilton and Dear Evan Hansen. Hamilton is the initial default; the browser remembers later choices.
- Keep appearance separate from production content, actor colors, editing state and portable data.
- Unify typography, controls, focus and selection; simplify repeated borders and decorative gradients.
- Keep lyrics beside the stage in medium windows and provide drawers for side panels in narrow windows.
- Add 120 ms control feedback and 180 ms opacity reveals. Reduced motion disables those effects and makes lyric following immediate.

The design review used Impeccable guidance through manual critique and implementation, without its launcher or automated detector. Nineteen automated suites cover the existing editing workflows plus appearance persistence, Hamilton defaults and reduced-motion lyric following. See DESIGN-REVIEW.md for actual browser checks, layout tradeoffs and limits. Existing version-1 production files remain supported.

## 9.2.0 — 2026-10-30

- Keep optional production versions under More, with dates, times, names and descriptions.
- View or export past versions; restore with an automatic backup and Undo.
- Retain available historical MP3 bytes under content-derived asset names and identify music that was unavailable at capture.
- Add optional edition labels and change summaries to cast shares, and mark later data changes.
- Save the full history while sharing only current production data by default.
- Collect existing notes in one rehearsal list without duplicating shared text; add notes at the current step.
- Distinguish discussion, decisions and manual rehearsal checks; flag checks after related edits and identify broken links.
- Preview selected role/time-filtered notes and export a printable HTML notes sheet.
- Fix missing MP3 media types after ZIP extraction and normalize untyped/octet-stream files before playback.
- Retain imported audio in the assets available to draft recovery.
- Carry corresponding source with portable exports when embedded in the release app.
- Document the upgrade flow: save work, open the new HTML, then import data.

Validated with 18 automated suites and own-browser simulated editing, save/reimport, version restore/Undo and audio playback. Strict media-type regression covers the import fix; this is not a claim that every Safari version or browser/OS combination was tested. Real-team rehearsal validation remains pending.

## 9.1.0 — 2026-10-29

- Open song settings directly from Opening, including an empty song.
- Create productions, songs, actors and props with in-app forms.
- Place newly included cast members at separate opening positions.
- Seek beyond existing steps and extend the editing range without adding playback time.
- Pinch over the timeline to zoom around the pointer; retain horizontal browsing.
- Keep path editing open through Undo and Redo.
- Use consistent English step/movement terms and neutral timeline timing labels.
- Use Stagebook.html as the English portable entry point and support it in folder saves.
- Reopen saved packages at the production and song selected during export, with explicit library-saving scope.
- Fix deleting the active song or production so switching and Undo remain usable.
- Drag wall/backstage points and marks visually; move JSON into advanced settings.
- Remove ineffective reordering controls in timed mode; label prop details correctly.
- Expand musical-theatre and external-AI workflows, verify the AI guide import examples, and retain desktop exploration notes.

## 9.0.0 — 2026-10-29

This multilingual preview succeeds the local v8 editing release. The production data format remains version 1.

### Added

- English, Simplified Chinese and Traditional Chinese interface switching.
- Remembered browser preference and a language default in exported HTML.
- Localized menus, dialogs, shortcuts, validation messages and user guides.
- A shared offline translation system with protected production-text interpolation.
- An ongoing-development section and roadmap for future updates.

### Improved

- Longer labels wrap in menus and inspectors; compact toolbars remain scrollable.
- Compact lyric-panel controls make room for translated labels.
- The language selector stays accessible in narrow windows; sharing moves into More when needed.
- Switching language preserves the playhead, view, actor selection, zoom and existing production text.
- Lyric-panel caches refresh when the language changes.

### Retained from v8

- All new-action commands insert at the current playhead without changing the view.
- Actors have independent delays and movement durations.
- Endpoint editing preserves music time; deletion repairs automatically linked future starts.
- Offline audio and production data survive complete package round trips.

Public release assets contain generic samples only. Source is licensed GPL-3.0-only.
