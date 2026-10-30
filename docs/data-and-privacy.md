# Data, privacy and production material

Stagebook processes production files in the browser. It has no built-in login, telemetry or cloud storage service.

## What is saved

JSON files contain stage geometry, cast, props, songs, movements, lyrics and notes. Exported HTML carries a production snapshot and may embed connected audio. A complete ZIP also contains the audio as a file. Sharing the HTML can therefore share the same material as sharing the ZIP.

IndexedDB stores recovery drafts and pending audio locally in the browser. Private browsing, storage limits or clearing browser data can remove drafts. Save a package for a durable copy. Folder saving backs up existing JSON and checks for external edits before writing.

The interface language is a browser preference, separate from production JSON. Exported HTML includes a default language. Switching languages does not translate or change production text.

## Public examples and tests

The public sample uses generic actors, schematic paths and instructional text. It includes no soundtrack, commercial lyrics or private production notes. A synthetic silent MP3 is included only as a test fixture; media readiness is mocked in the automated round-trip checks.

## Sharing and permissions

Source code uses GPL-3.0-only; see [LICENSE](../LICENSE). This does not determine the permissions for music, lyrics, scripts or other files imported by a user. Sending files to an external assistant or hosting service places them within that service's processing scope.

When reporting a problem, prefer the generic sample. Remove private notes, personal information and production media from screenshots and reproduction packages.


## Production history and note sheets

A regular Save includes manually kept history, older notes and referenced historical audio. Share with cast excludes that history by default, while an exported past version contains the selected old production. Review which file you send. Deleting current text does not remove it from older snapshots.

The rehearsal list references original notes. Filtering a printable sheet limits that sheet's contents; it does not restrict access to a whole production package. Discussion/decision/check labels are local records, not authenticated receipts, permissions or safety assurances. Edition markers identify local snapshots and do not establish a team-wide latest version.
