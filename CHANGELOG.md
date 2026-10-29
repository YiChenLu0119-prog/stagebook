# Changelog

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
