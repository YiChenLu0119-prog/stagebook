# Stagebook development guide for AI assistants

Use this guide when changing the Stagebook application. For creating or editing a
production package with an existing build, use [AI-GUIDE.md](AI-GUIDE.md). It
defines the import contract, song fields, asset paths and package examples.

## Make and verify a change

1. Read [CONTRIBUTING.md](CONTRIBUTING.md). Reproduce the problem with the bundled
   example or a minimal synthetic production. Record the browser, how the file
   was opened, the current mode and the relevant times.
2. Find the normal entry point in the source map below. Edit the files in `src/`.
   `build.py` composes the scripts, styles, locale catalogs and example data into
   one offline HTML document.
3. Build and run the checks.

   ```sh
   python3 build.py
   node scripts/check.cjs
   python3 validate.py dist
   ```

4. Open `dist/Stagebook.html` in an independent browser session. Use the actual
   buttons, keyboard or pointer involved in the task. For file or media changes,
   save a copy and open it again. Check real playback in the affected browser.

Use Python 3.10+ and Node.js 24. See [development notes](docs/development.md) for
release packaging. The app has no runtime CDN, network service or account
dependency. Preserve operation when the HTML is opened from disk.

## Source map

| Area | Start here |
| --- | --- |
| Data shape, event timing, route geometry and compatibility | `src/core.js` |
| Application state, action routing, stage and inspector | `src/app.js`, `src/human.js` |
| Timeline clips, scrub, zoom, keyboard and context menus | `src/timeline.js`, `src/editing.js` |
| Music attachment, loading and playback readiness | `src/audio.js`, `src/app.js` |
| Timed lyric editing and actor singing practice | `src/lyrics.js`, `src/practice.js` |
| Voice parts, notation and continuous practice ranges | `src/vocal.js`, `src/vocal-notation.js`, `src/vocal-range.js` |
| Lighting cues, countdown, lyric linking and sketches | `src/reminder.js`, `src/reminder-timeline.js` |
| Media attachments, full-song video and stage video export | `src/media.js`, `src/song-video.js`, `src/video-export.js` |
| Versions, rehearsal notes, handoffs and printable sheets | `src/rehearsal.js`, `src/io.js` |
| Import, export, folders, embedded assets and recovery drafts | `src/io.js`, `package_show.py`, `validate.py` |
| Help and user guidance | `src/human.js`, `src/index.html`. Builds with interactive help use `src/onboarding.js`. |
| Interface language, keyboard labels and responsive layout | `src/i18n.js`, `src/locales/`, `src/index.html`, `src/design.css` |

## State and playback

`lib` holds the editable production library. `show()` and `song()` resolve the
active selection. `action()` routes commands from the UI. Use `mutate()` for
ordinary document edits. It takes an undo snapshot, applies the edit, updates
the dirty flag and recovery draft, and renders the dependent UI. Longer
interactions such as dragging can snapshot once and update incrementally.
Include file state when changing asset references. Keep one gesture or command
as one Undo operation. Keep search, language and tutorial state out of the
production model and Undo history.

Read `renderAll()` for application-wide rendering. Playback and scrubbing have
narrower update paths. Reuse `seek()` and the existing playhead helpers so stage
positions, the selected blocking context, lyrics and the transport agree. The
score practice player and full-song video player have their own playback state.

Use `C.events()` and `C.moveEvents()` to interpret timing. A blocking step can have
several actor movements with independent starts and durations. Add a new step
at the playhead and preserve other start times. If insertion from the timeline
converts a sequential song into a timed song, retain its existing start times.
Keep the playhead stable when editing placements, notes or route points.

Use the app's existing route and removal helpers. Preserve endpoints and
the user's explicit route breaks when changing linked movements. Use the
audience-oriented stage helpers when labeling left/right stage regions.
Keep Walkthrough controls safe for actors reviewing their blocking. Apply
edit guards in the command handler as well as in the visible controls.

## Production packages and media

The app version and the `stagebook-library` data format version are independent.
For model changes, update the core validation and normalization, serializers,
generated schema in `build.py`, portable `validate.py`, and import documentation
together. Test older files without the new fields. Keep stable IDs, JSON shape
and relative references for existing actors, songs, lyrics and assets.

Validate imports before replacing the working library. Preserve the previous
asset when a replacement fails. Keep ZIP paths relative to their package and
reuse media reference collection when saving or sharing. Test the generated HTML
and the ZIP round trip, including the original media bytes. ZIP entries do not
preserve Blob MIME metadata. Resolve supported types when loading assets and
test actual decoding separately. Large linked-asset packages require the
companion directory beside the HTML. A release needs matching GPL source and
notices along with the packaged app.

Timed lyrics carry start and end times and can carry singer attribution.
Production-wide attribution belongs with the lyric. Personal singing marks and
notes stay with the browser profile. Keep other voices visible during practice.
Voice exercises live in the song's optional `vocalPractice` data. Use its
recording-aligned or relative timebase when combining or playing passages.

Lighting cues live with the song. A cue can point to a lyric ID and follow its
start time. Retain its fallback timestamp so it still works if that lyric is
removed. Drawings follow their associated cue and have current and upcoming
display states. Test a cue after changing or removing the linked lyric.

## Help and localization

In builds with interactive help, `featureCommands` in `src/onboarding.js` maps localized labels and aliases to
real actions and control selectors. Use existing action IDs and check that the
highlight is visible in the destination mode. Let help reveal edit, delete and
save controls so the user can choose when to apply them. Keep `tutorialSteps`
focused on controls that are available for the current song or provide a
usable fallback. Verify that exiting help restores usable keyboard focus.

Simplified Chinese UI text is the source. Use `tr()`, the `ui` template tag and
`data-i18n` attributes for interface text. Keep numbered placeholders, and
insert production names, lyric text and notes as opaque escaped values. Add a
locale to the selector, supported-language list, build inputs and relevant
tests. Review theater terminology in context and test long labels at narrow
widths. Keep language switching independent of playback, selection and
production data.

## Debugging prompts you can adapt

- **Timeline regression.** “With two overlapping movements, scrub while paused,
  add a step between existing cues, and Undo. Compare existing cue start times
  and the playhead before and after. Run `node tests/playback-insertion.test.cjs`.”
- **Missing audio.** “Import a ZIP with a synthetic MP3 and play it. Switch songs,
  attempt a failed replacement, then export and reopen. Identify where the bytes,
  MIME type and playback state diverge. Run `node tests/audio-roundtrip.test.cjs`.”
- **Lyric-linked cue.** “Add a lighting cue tied to a lyric, move the lyric, then
  remove it. Check the timeline, countdown, fallback time and drawing after
  reopening. Run `node tests/reminder.test.cjs`.”
- **Language or help regression.** “Switch languages with a song selected. At a
  narrow width, find a feature by a natural synonym, reveal its control and
  start and exit the tutorial. Check accessibility labels and unchanged
  production data. Run `node tests/i18n.test.cjs`.”

Keep production soundtracks, full lyrics, recovery drafts and personal paths
out of the source tree. Use synthetic fixtures or the project's public examples.
