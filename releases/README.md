# Release notes

One file per release, named `<tag>.md`. Tags are semantic versions so GitHub lists releases in order: phase N is `v0.N.0`, a follow-up release within it is `v0.N.M` (for example `v0.6.1.md`), and the portfolio release is `v1.0.0`. The first line is the title (`# Title`), then a blank line, then the notes.

When a file lands on `main`, `.github/workflows/release.yml` creates the tag on that commit and publishes the GitHub Release from the file. Releases that already exist are skipped.
