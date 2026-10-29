# Changelog

## Unreleased — 9.0.0

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
