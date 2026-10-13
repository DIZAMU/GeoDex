# SETUP.md: repo setup for Claude Code

Execute these steps in order, in the current directory. Show each command before running it. If a step fails or a check does not pass, stop, report what failed and the exact fix, and wait for the author.

Target: private GitHub repo `DIZAMU/GeoDex`, created empty. No README, license, .gitignore or template from GitHub.

## 1. Check the starting folder

The current directory must contain exactly:
```
PLAN.md
CLAUDE.md
SETUP.md
content/VOICE.md
```
- If any file is missing, stop and list what is missing.
- If a `.git` folder already exists, stop and ask before continuing.

## 2. Check prerequisites

Run and report versions:
```
git --version
gh --version
node --version
pnpm --version
```
- **Node:** must be 24 or newer. If missing or older, stop and tell the author how to install Node 24 LTS for this OS.
- **pnpm:** if missing, install it with `npm install -g pnpm`. Exception: on NixOS, do not install globally. Stop and propose a `flake.nix` devShell with Node 24 and pnpm instead.
- **gh:** if missing, stop and give the install command for this OS.

## 3. Check GitHub auth

```
gh auth status
```
- If not logged in, stop and tell the author to run `gh auth login` themselves (it is interactive).
- Confirm the logged-in account is `DIZAMU`. If it is a different account, stop.

## 4. Commit identity (repo-local, not global)

Get the noreply email from the API so the author's real email never appears in commits:
```
GH_ID=$(gh api user --jq .id)
git init -b main
git config user.name "DIZAMU"
git config user.email "${GH_ID}+DIZAMU@users.noreply.github.com"
git config user.name && git config user.email
```

## 5. .gitignore

Create `.gitignore` with exactly:
```
node_modules/
dist/
.env*
!.env.example
data/raw/
src/generated/
playwright-report/
test-results/
.DS_Store
```

## 6. First commit

```
git add PLAN.md CLAUDE.md SETUP.md content/VOICE.md .gitignore
git status
git commit -m "docs: add build plan, Claude Code rules, voice guide and setup"
```
`git status` before committing must show only these 5 files. If it shows anything else, stop.

## 7. Create the private repo and push

Do not pass `--add-readme`, `--license`, `--gitignore` or `--template`.
```
gh repo create GeoDex --private --source=. --remote=origin --push \
  --description "Spaced-repetition geography trainer. Local-first PWA, English and Norwegian."
```
If a repo named `GeoDex` already exists on the account, stop. Do not overwrite or reuse it.

## 8. Repo settings

```
gh repo edit DIZAMU/GeoDex \
  --enable-issues=true \
  --enable-wiki=false \
  --enable-projects=false \
  --add-topic geography \
  --add-topic spaced-repetition \
  --add-topic fsrs \
  --add-topic pwa \
  --add-topic react \
  --add-topic typescript \
  --add-topic local-first
```

## 9. Verify

```
gh repo view DIZAMU/GeoDex --json name,visibility,defaultBranchRef,hasIssuesEnabled,hasWikiEnabled,repositoryTopics
git log --oneline
git remote -v
```
All of these must hold:
- Name is `GeoDex`.
- Visibility is `PRIVATE`.
- Default branch is `main`.
- Wiki is disabled.
- 7 topics are set.
- There is exactly 1 commit.
- `origin` points to `DIZAMU/GeoDex`.

Report the results as a short checklist.

## 10. Hand off to Phase 0

1. Tell the author to switch to plan mode (Shift+Tab until the status bar shows plan mode).
2. Once in plan mode, read `CLAUDE.md` and `PLAN.md` in full.
3. Present a plan for Phase 0 only:
   - Its tasks and acceptance criteria, restated.
   - Every file you will create.
   - Every dependency with its version.
   - Anything in the plan you think is wrong or outdated, with a proposed fix.
4. Do not write code until the author approves.

## Out of scope for this file

These need the author in a browser and happen later:
- **Cloudflare Pages (end of Phase 0):** connect the repo in the Cloudflare dashboard. Build command `pnpm build`, output directory `dist`, environment variable `NODE_VERSION=24`.
- **Supabase (Phase 4):**
  - Create the project in an EU region.
  - Put the URL and publishable key in `.env.local` and in Cloudflare's environment variables. Never commit them.
  - Sign in once to create the account, then disable new sign-ups.
