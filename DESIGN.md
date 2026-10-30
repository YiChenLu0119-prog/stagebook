# Stagebook visual system

An Operate surface for musical theatre, plays and student productions. Primary tasks: position performers, adjust route nodes and individual timing, read lyrics alongside the stage, rehearse offline and hand off portable files.

## Direction
A rehearsal desk: quiet dark tools around a legible paper stage. Musical identity comes from the neutral temperature and accent, never from imagery, moving scenery or actor recoloring. Four palettes: Phantom (ink/ivory/crimson), RENT (black/white/red), Hamilton (ink/antique gold, initial default), Dear Evan Hansen (midnight/sky blue). No rehearsal-room theme. These are interpretations, not official branding.

## Structure
A 54px production bar, 40px workspace bar, 196px navigation, 288px inspector and a full-width timeline. Lyrics remain beside the stage down to 600px. The left panel becomes a drawer below 1000px; the inspector becomes a drawer below 850px. Below 600px lyrics stack below the stage; full mobile editing remains unvalidated. Side panel contents scroll independently. Existing panel sizing, focus-stage and expand-timeline controls remain available.

## Typography and color
Offline system sans, with simplified/traditional Chinese fallbacks retained. Main heading 19px; regular controls 12–13px; lyric text 14px; secondary metadata 11–12px. Time is monospaced/tabular. Accent identifies selection, primary actions, focus and playhead. Actor and prop colors belong to the production and never change with appearance. Core colors are semantic CSS variables; do not encode theme identity in user data.

## Motion
120ms control color feedback and one 180ms opacity reveal for menus, dialogs and reappearing panels. No translating or scaling click targets, canvas elements, path handles or timeline clips. No entrance choreography. System reduced-motion disables transitions/animations; lyric auto-follow uses immediate scrolling under that preference. No motion dependency or online asset.

## Maintenance
Edit src/design.css (layout/tokens), src/appearance.js (browser-only preference) and source modules; build.py inlines them into the offline HTML. Source and app are GPL-3.0-only. Version 9.3 builds on public v9.2.0 and changes no production schema. README and roadmap remain English with future-work notes intact. See DESIGN-REVIEW.md for the rationale, browser evidence and limits.
