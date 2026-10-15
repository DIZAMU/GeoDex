# Release notes

One file per release, named `<tag>.md`. Tags are semantic versions so GitHub lists releases in order: phase N is `v0.N.0`, a follow-up release within it is `v0.N.M` (for example `v0.6.1.md`), and the portfolio release is `v1.0.0`. The first line is the title (`# Title`), then a blank line, then the notes.

When a file lands on `main`, `.github/workflows/release.yml` creates the tag on that commit and publishes the GitHub Release from the file. Releases that already exist are skipped. The same workflow renames the early `phase-N` tags to `v0.N.0` once (DECISIONS.md 040).

## One-time: version tags for the early releases

The workflow's token may not create tags on older commits, so the author creates them once from a clone, with their own GitHub login:

```sh
git fetch origin --tags
for t in $(git tag -l 'phase-*'); do
  n="${t#phase-}"
  case "$n" in *.*) v="v0.$n" ;; *) v="v0.$n.0" ;; esac
  git tag "$v" "$t^{}"
done
git push origin --tags
```

Then run the Release workflow (Actions, Release, Run workflow). It moves each release onto its new tag and deletes the old `phase-*` tag.
