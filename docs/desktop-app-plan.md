# Desktop edition: feasibility and implementation plan

Stagebook can become a desktop application without rewriting the stage editor. The current interface, movement model, translations and portable JSON packages can remain the shared core. A desktop shell would add installation and operating-system file handling.

This is a proposal, not a desktop release. No installer, release date or platform support commitment is announced here.

## Recommended first route

Start with a small **Electron** desktop pilot on macOS. Electron packages HTML, CSS and JavaScript with Chromium, which gives the editor a consistent browser engine across supported operating systems. That is useful for a local editor with audio playback, complex pointer interaction and portable exports. The tradeoff is a larger download and an additional runtime to maintain. See the [official introduction](https://www.electronjs.org/docs/latest/).

**Tauri** is a credible alternative when download size is the higher priority. It reuses the operating system’s webview rather than shipping a browser engine. It also adds Rust and platform build prerequisites, and requires testing the editor against each platform’s webview. The existing plain JavaScript front end can be reused with either approach. See [Tauri’s architecture](https://v2.tauri.app/start/) and [prerequisites](https://v2.tauri.app/start/prerequisites/).

## What a useful first desktop release should do

1. Open Stagebook from an application icon into a new or recent production.
2. Open an existing production package through a native file dialog or operating-system file association.
3. Save to a chosen project folder, and distinguish ordinary Save from Save a Copy and Export for Cast.
4. Keep imported MP3 references and project assets together when moving a production between computers.
5. Offer recovery after an interrupted session and a clear prompt before closing unsaved work.
6. Preserve the existing offline HTML/ZIP export so cast members can review a production without installing the desktop app.

A window that merely opens the current HTML would be a useful prototype, but native saving, recovery and asset handling are the parts that make it more convenient than opening a browser file.

## Concrete implementation sequence

### 1. Reuse the editor and isolate file operations

Keep the current editor build as the front end. Put desktop-specific operations behind a small adapter: open project, save project, select audio and reveal a saved file. The browser edition keeps its existing ZIP and folder methods. The desktop edition supplies native implementations.

### 2. Create the application shell

Use the official Electron tutorial and Electron Forge packaging workflow. Load the local editor rather than a remote website. Give the editor only the specific file operations it needs through a preload bridge, with context isolation and the renderer sandbox enabled. Imported production text stays data. See the [security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

Add the application name, icon, window sizing, standard Edit/File menus, keyboard shortcuts and recent-project list. Keep the same language preference and production format as the web edition.

### 3. Add durable project handling

Implement native open/save dialogs, asset copying, backups and recovery. Test opening an older Stagebook ZIP, importing MP3, saving, closing the application, reopening the saved project, moving its folder and exporting a cast package. A native wrapper must not quietly change the saved data format or leave audio dependent on its original location.

### 4. Test the desktop-specific behavior

Verify a fresh installation, missing audio, cancelled dialogs, unsaved-close decisions, projects with non-English filenames, large audio files, display scaling and trackpad gestures. Run the existing regression suite as well as mouse/keyboard rehearsal trials. Test macOS Apple Silicon and Intel builds before claiming support for both. Build and test Windows separately before announcing it.

### 5. Package and distribute

Use Electron Forge to produce application bundles and installers. For a public macOS download, configure Developer ID signing and notarization, then distribute a DMG through GitHub Releases with corresponding GPL source and release notes. Apple describes the notarization process [here](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution); Electron describes [packaging and signing](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging).

A direct GitHub download can come before an app-store submission. Automatic updating is a later milestone: first make installation, saving and recovery reliable. Certificate/account setup and installer signing need the maintainer’s own credentials; those are not part of this web release.

## Suggested milestones

- **Pilot:** one macOS window, native open/save and the existing rehearsal workflow.
- **Rehearsal build:** recovery, asset portability, recent projects and repeated real rehearsal trials.
- **Public desktop preview:** signed/notarized installer, clean-install checks and source distribution.
- **Later evaluation:** Windows, automatic updates and additional operating-system integration.

Priorities and scope remain subject to testing and feedback. Follow the [roadmap](ROADMAP.md) and Releases for completed work.
