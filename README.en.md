# Stagebook

An offline workspace for stage blocking, movement timing, lyrics and rehearsal notes.

Place actors on a stage, draw their paths, arrange actions on a timeline, and share a complete production package with your cast. No account, server or installation is required. Music and lyrics are optional.

**Interface languages:** English · 简体中文 · 繁體中文. Switch languages in the top bar. Character names, lyrics and production notes stay exactly as written.

[Quick start](docs/quick-start.md) · [Roadmap](docs/ROADMAP.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

## Get started

Download **[Stagebook-v9.0.0-offline.zip](https://github.com/YiChenLu0119-prog/stagebook/releases/download/v9.0.0/Stagebook-v9.0.0-offline.zip)** from [Releases](https://github.com/YiChenLu0119-prog/stagebook/releases). Extract it and open **走台本.html** in a desktop browser. Choose the named offline asset; the Source code archives are for development.

Explore the generic sample, create a production from the application menu, or use **Import** to open a production ZIP or folder. End users do not need Python or Node.js.

## What you can do

- Drag actors and props; edit straight paths, curves and intermediate points.
- Define a shared stage, backstage areas, walls and entrances.
- Add an action at the playhead with **Add action** or `N`, keeping your current view.
- Give each actor an independent delay and movement duration; drag or resize their timeline clip.
- Keep lyrics beside the stage and edit text, timing and notes without leaving the workspace.
- Write individual or shared action notes and use an actor-focused rehearsal view.
- Use keyboard shortcuts, context menus, direct deletion, Undo and Redo.
- Locate path, boundary, timing and continuity issues by actor, step and time.
- Export blocking, lyrics and connected audio together for offline rehearsal and further editing.

## Language and layout

The app remembers your language choice in this browser. Exported HTML also carries the current language; a viewer's saved personal preference takes priority. Switching languages keeps the playhead, actor selection, view, zoom and production data.

Menus and field labels wrap to accommodate longer text. Compact windows keep the language selector accessible, allow toolbars to scroll, and put **Share with cast** in the More menu when the top bar is tight. Desktop mouse and keyboard use remains the main focus; complete touch and mobile editing is not yet verified.

## Ongoing development

Stagebook will continue to evolve through real rehearsals and hands-on feedback. This preview establishes the editing workflow and a shared localization system; it is a starting point for future releases.

See the [roadmap](docs/ROADMAP.md) for current areas of interest. Ideas can change as the editor is used, so the roadmap is not a release schedule. Report a specific workflow in Issues, or watch Releases to follow new versions.

## Files and privacy

The app has no built-in cloud sync, analytics, login or networked AI. Browser drafts are recovery aids; save a package for a durable copy. Direct folder saving depends on browser support, with ZIP import/export available otherwise.

Data is plain JSON and can be edited by an external assistant following [AI-GUIDE.md](AI-GUIDE.md). The app does not transcribe audio, align lyrics automatically or edit the soundtrack. Each song accepts one MP3.

Public downloads contain generic examples only, with no commercial soundtrack, full song lyrics or private production files. Exported HTML can embed production data and audio, so review it before sharing. See [data and privacy](docs/data-and-privacy.md).

Geometry checks use a schematic stage. They do not simulate body sizes, actor collisions or prop handling; confirm the blocking in rehearsal.

## Build and contribute

```sh
python3 build.py
node scripts/check.cjs
```

Open `dist/走台本.html` after building. No third-party build packages are required. See [development notes](docs/development.md) for packaging, tests and translation contributions.

## License

Application source is licensed under **GNU General Public License v3.0 only**, SPDX identifier `GPL-3.0-only`. See [LICENSE](LICENSE). Imported music, lyrics, scripts and production material have their own permissions and sharing requirements.
