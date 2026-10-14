# Release notes

One file per release, named `<tag>.md` (for example `phase-6.md`). The first line is the title (`# Title`), then a blank line, then the notes.

When a file lands on `main`, `.github/workflows/release.yml` creates the tag on that commit and publishes the GitHub Release from the file. Releases that already exist are skipped.
