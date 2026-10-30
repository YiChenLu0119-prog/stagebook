# Stagebook v9.3 design review

Date: 2026-10-30. The initial palette is Hamilton. The four choices are Phantom, RENT, Hamilton and Dear Evan Hansen.

## Method and provenance

The design work started from public v9.2.0. It consulted the [Impeccable](https://github.com/pbakaus/impeccable) README and guidance for critique, audit, polish, animation and operational interfaces. The review and implementation were performed manually in one context. Its launcher, downloaded engine and automated detector were not run; no detector score or complete dual review is claimed.

Version 9.3 integrates that reviewed source into the current public main branch. Release preparation updates version identifiers, English documentation and packaging, and strengthens the Hamilton-default regression. The production data schema remains version 1. Generic examples are used throughout.

## Findings and changes

| Priority | Observed friction | Implemented change |
| --- | --- | --- |
| P1 | At 1440 × 900, the timeline content area was about 932 × 68 px, leaving little room for actor tracks. | The timeline spans the workspace; tabs and zoom share a toolbar. The measured content area becomes about 1440 × 198 px. |
| P1 | The stage hint overlapped the audience label. After panel resizing, label sizes and timeline geometry could retain the old surface dimensions. | Move the hint outside the stage, redraw after container resizing, and preserve coordinate semantics during dragging. Place entrance labels outward and backstage labels above the stage layer. |
| P2 | Repeated borders, gradients and similarly weighted buttons diluted selection. | Simplify surfaces and unify controls, focus and selection around semantic color variables. |
| P2 | Actor timing followed the movement note. | Put delay, duration and absolute timing before the note while retaining shared instructions. |
| P2 | Small secondary text and cramped English labels reduced readability. | Unify control and metadata sizing, emphasize the time display and retain Chinese font fallbacks and wrapping. |
| P2 | Lyrics stacked below the stage in medium windows, consuming editing height. | Retain side-by-side lyrics in medium windows; use side-panel drawers in narrow windows and stack lyrics below 600 px. |
| P3 | Feedback lacked a consistent rhythm, and smooth lyric following ignored reduced motion. | Use 120 ms control-color feedback and 180 ms opacity reveals. Reduced motion disables effects and uses immediate lyric following. |

The paper stage, stable actor colors, independent movement timing, portable files and low-profile history entry are preserved.

## Tradeoffs

The wider timeline uses more vertical space. At the measured 1440 × 900 viewport, the default stage changed from about 648 × 410 px to 690 × 353 px: wider and shorter, rather than larger in every direction. Focus stage and the draggable divider remain available. Inspector contents still scroll.

## Appearance

| Palette | Interpretation |
| --- | --- |
| Phantom | Ink, ivory and crimson |
| RENT | Black, white and poster red |
| Hamilton | Ink and antique gold; initial default |
| Dear Evan Hansen | Midnight and sky blue |

More → Appearance stores a browser preference. It does not edit actor colors, production data, Undo state or shared content. These are original interpretations, without official logos, covers, full commercial lyrics or soundtracks.

## Browser evidence collected during design review

The reviewer used its own application browser and public examples. These are recorded checks of the design source, rather than a claim of testing every browser or device:

- Viewed English at 1440 × 900, Simplified Chinese at 1280 × 720, Traditional Chinese at 1024 × 768 and a 390 × 844 viewport; captured screenshots. At 1024 px the document stayed within that width and lyrics remained beside the stage. At 390 px the inspector drawer and scrolling toolbar were accessible.
- Switched all four palettes and checked selection. Hamilton was the default.
- Sought to 7.3 seconds and added a step while retaining the timeline view and playhead.
- Dragged Actor A, inserted an intermediate path point, and confirmed a three-point route.
- Entered a one-second delay and two-second movement with keyboard input and blur; the UI showed 8.3 → 10.3 seconds while the playhead stayed at 7.3. An earlier uncommitted fill was not used as evidence.
- Edited and undid a generic lyric beside the stage; the original text and playhead were retained.
- Saved and reimported a package; four steps, the actor delay/duration and three route points were preserved.
- Imported the repository's silent MP3 fixture; decoding reached Audio ready and playback advanced from 7.5 to the step-pause point at 11.3 seconds. This checks decoding and timing, not listening quality.
- Downloaded a cast package containing that MP3 and the edited timing/route.
- Added a generic note to rehearsal notes and opened a printable preview; no physical printer was used.
- Opened version history and its empty state. Browser history restore was not repeated in this review; existing regression tests cover restoration.
- No browser warning or error was observed in those recorded checks.

## Automated verification and limits

Nineteen suites cover the existing geometry, timing, editing, media, file round trips, history, notes and localization, plus appearance persistence and reduced-motion lyric following. Release preparation also checks a fresh Hamilton default, invalid/legacy preferences and unavailable storage without changing production data. Source/archive rebuild and public release checks are recorded during packaging.

Complete touch editing, all Safari/Chrome/Firefox versions, screen-reader behavior, a full WCAG audit, physical printing and performance benchmarks remain unverified. The user's operating-system reduced-motion setting was not changed; automated checks cover the lyric-follow behavior and the CSS contains the corresponding motion override. Visual judgments are separate from these executed checks.

See DESIGN.md for the maintained visual system and docs/ROADMAP.md for future work. This release remains a rehearsal preview awaiting broader real-team validation.
