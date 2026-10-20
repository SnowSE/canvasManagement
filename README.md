# Canvas Management
> Who wants to click around in Canvas when they can just edit markdown files? ;-)

## Only this computer can open it

CanvasManager runs a small server on your computer that sends requests to Canvas with your token and reads and writes your course files. It should only answer requests from its own pages on this computer: it refuses requests from other websites, and the example `docker-compose.yml` in this repo (and the one `get-started.ps1` writes) publishes it on `127.0.0.1`, so other machines can't reach it.

**If your `docker-compose.yml` is from before October 2026, it listens on every network your computer is on**, and the app shows an amber *Possibly open to your network* bar across the top of every page until it's fixed. Run `get-started.ps1` again and let it write a new `docker-compose.yml`, or use the `ports` and `environment` lines from the example below (the bar shows how, keeping your port). See [getting-started](https://snowse.github.io/canvasManagement/getting-started.html#setup-local-only) to open it from another machine on purpose.

## Handouts

Illustrated guides for instructors using CanvasManager:

- [Getting Started with CanvasManager](https://snowse.github.io/canvasManagement/getting-started.html):
  setup, course settings, the calendar, editing assignments, quizzes, pages
  and lectures, publishing, Compare with Canvas, images, git, and the error
  list.
- [Group Assignments & Student Schedules](https://snowse.github.io/canvasManagement/group-assignments-and-student-schedules.html):
  group sets, per-student due dates, the date picker and settings
  autocomplete.

The handouts are served by GitHub Pages from [`docs/`](docs/). Each one is a
single self-contained HTML file with its screenshots built in, so it can also
be downloaded and emailed as is.

Changes that users can see update these handouts and the editor help in the
same commit or PR. See [CLAUDE.md](CLAUDE.md#keep-the-docs-current).

## Canvas HTML Hack

<https://nowucca.com/2020/07/04/working-around-canvas-limitations.html>

## Getting Started and Usage (v3)

### Quick setup

[`get-started.ps1`](get-started.ps1) walks you through a new install:

1. Checks for Docker and git, and offers to install either one that is missing.
2. Asks for a [GitHub token](#github-token-gh_token) (required) and checks it.
3. Sets up three git repos side by side in one folder (`~/CanvasManager` by
   default). For each, name an existing repo to clone, or press Enter and it
   creates a private one on GitHub:
   - `CanvasManagerConfig`, the app config: `docker-compose.yml`,
     `globalSettings.yml` and [`restart.ps1`](#restart-script). Its `.env`
     (tokens, port, uid) stays on the computer and is never committed.
   - `CanvasCourses`, your courses.
   - `FacultyFiles`, static files such as [images](#images).

   The compose file mounts the other two as `../CanvasCourses` and
   `../FacultyFiles`, so the config repo works on any computer.
4. Asks for your Canvas token and checks it, a custom port if you want one
   (3000 otherwise), your time zone, and optionally an
   [AI endpoint](#error-list-and-ai-explanations).
5. Writes the files, commits and pushes the config repo, starts the container
   and opens the app.
6. Offers to run `restart.ps1` after every reboot (a Startup-folder shortcut on
   Windows, a LaunchAgent on macOS, a systemd service or cron on Linux).

Run it again any time to change an answer. It finds your existing setup,
offers the current answers as defaults and saves a `.bak` of any file it
replaces. Repos it clones or creates over https get a git credential helper
that reads `GH_TOKEN` from the config repo's `.env`, so pushing from your own
terminal works too, and a new token in `.env` is all a renewal takes.

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/SnowSE/canvasManagement/main/get-started.ps1 -OutFile get-started.ps1
powershell -ExecutionPolicy Bypass -File .\get-started.ps1
```

Linux or macOS, which need [PowerShell 7](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
first (`brew install --cask powershell`, or `sudo snap install powershell --classic`):

```sh
curl -fsSLO https://raw.githubusercontent.com/SnowSE/canvasManagement/main/get-started.ps1
pwsh ./get-started.ps1
```

The rest of this section is what the script sets up, for doing it by hand.

### By hand

All class data files are stored in markdown files in a folder. I recommend making this folder a git repo. Here's an example docker compose:

```yml
services:
  canvas_manager:
    image: snowcollege/canvas_management:4
    user: "${DOCKER_UID:-1000}:${DOCKER_GID:-1000}"
    container_name: canvas-manager
    ports:
      # only this computer can open it (anyone who can reach it acts as you)
      - "${CANVAS_MANAGER_ADDRESS:-127.0.0.1}:${CANVAS_MANAGER_PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      # where the port is published, so the app can warn if it's open
      - CANVAS_MANAGER_ADDRESS=${CANVAS_MANAGER_ADDRESS:-127.0.0.1}
      - CANVAS_MANAGER_PORT=${CANVAS_MANAGER_PORT:-3000}
      - storageDirectory=/app/storage
      - TZ=America/Denver
      - NEXT_PUBLIC_ENABLE_FILE_SYNC=true
    volumes:
      - ./globalSettings.yml:/app/globalSettings.yml
      - ~/projects/faculty:/app/storage
      - ~/projects/facultyFiles:/app/public/images/facultyFiles
```

The `globalSettings.yml` file specifies which folders in your storage directory you want to display in the UI. This way you can have old classes files stored, but not bring them into the UI unless you need to (like when you are planning a new semester, you might want to see the old semester).

`globalSettings.yml` can start like this, this file will be edited as you add classes to manage.

```yml
courses: []
```

### Which user the container runs as

`user:` sets the account the container runs as, and it should be the account
that owns your storage folder on the host. If those do not match, either the
container cannot write to the folder -- canvas manager fails when it tries to
save -- or, if the folder is permissive enough for it to write anyway, the
files it creates come out owned by the container's account rather than yours,
and you cannot edit them on the host.

On a single-user Linux machine that account is usually `1000:1000`, which is
the default in the compose file above, so you can leave it alone. Check with
`id -u` and `id -g`; if they print anything else, set `DOCKER_UID` and
`DOCKER_GID` in your `.env`:

```sh
# .env, alongside CANVAS_TOKEN
DOCKER_UID=1001
DOCKER_GID=1002
```

or pass them one command at a time:

```sh
DOCKER_UID=$(id -u) DOCKER_GID=$(id -g) docker compose up
```

### GitHub token (`GH_TOKEN`)

[`get-started.ps1`](#quick-setup) requires a GitHub token, since it creates
and clones your repos with it. Setting up by hand, you only need one for:

- the Classroom 50 (GitHub Classroom) buttons in course settings, and
- pulling and pushing a course repo that lives on GitHub (see [Git](#git)).

These run `gh` and `git` on the server, inside the container, so the token has
to be in the container's environment. Running `gh auth login` on your own
machine does nothing for them.

To get one:

1. Open
   [github.com/settings/tokens/new?scopes=admin:org,repo,workflow](https://github.com/settings/tokens/new?scopes=admin:org,repo,workflow&description=canvasManager%20classroom50).
   This makes a classic personal access token with the scopes the app needs
   already checked: `repo` for pulling and pushing, plus `admin:org` and
   `workflow` for Classroom 50. If you only want git, `repo` is enough.
2. Pick an expiration, click **Generate token** and copy it. GitHub shows it
   only once.
3. Put it in the same `.env` file as `CANVAS_TOKEN`, next to your
   `docker-compose.yml`:

   ```sh
   # .env
   CANVAS_TOKEN=paste-your-canvas-token-here
   GH_TOKEN=ghp_...
   ```

4. Recreate the container. Environment variables are read only when the
   container starts, so editing `.env` alone changes nothing:

   ```sh
   docker compose up -d --force-recreate
   ```

   (or run the [restart script](#restart-script) below).

If the token expires or is revoked, the Classroom 50 settings page says GitHub
rejected it; make a new one and repeat steps 3 and 4. Keep `.env` out of git:
both tokens act as you.

### Restart script

A small script that waits for Docker, pulls the newest image and recreates the
container saves typing, and is how you pick up an update when the
[update banner](#update-indicator) appears or after you change `.env`.
[`get-started.ps1`](#quick-setup) writes this one for you; otherwise save it
as `restart.ps1` next to your `docker-compose.yml`:

```powershell
#!/usr/bin/env pwsh

# Docker Desktop can take a while to start after a reboot or login
Write-Host "Waiting for Docker..."
while ($true) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Write-Host "Docker not ready, retrying in 5s..."
    Start-Sleep -Seconds 5
}

# run compose from the folder this script is in, wherever it is called from
Set-Location $PSScriptRoot

docker compose down
docker compose pull
docker compose up -d --remove-orphans
```

Run it with `./restart.ps1` (Linux or macOS with PowerShell 7 installed; run
`chmod +x restart.ps1` once first) or `pwsh ./restart.ps1` on Windows. If
Windows refuses to run scripts, use
`powershell -ExecutionPolicy Bypass -File .\restart.ps1`.

To start canvas manager after every reboot, let `get-started.ps1` set it up,
or do the same by hand: put a shortcut to
`powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File <path>\restart.ps1`
in your Startup folder (`shell:startup`) on Windows, or run it from a systemd
service ordered after `docker.service` on Linux. Docker Desktop itself has to
start at sign-in too (Settings > General). `restart: unless-stopped` in the
compose file brings the container back whenever Docker starts, without
pulling a newer image.


## Images

Mount your faculty files folder at `/app/public/images/facultyFiles`
(`get-started.ps1` does this for its `FacultyFiles` repo):

```yml
    volumes:
      - ../FacultyFiles:/app/public/images/facultyFiles
```

Keep images in their own repo, not in your course repo, or the course repo
fills up with large binaries. In markdown, an image's path is its path inside
that folder with `/images/facultyFiles/` in front. Letter case has to match
exactly (the container is case-sensitive even when Windows and macOS are not),
and a space is written `%20`:

```md
![formulas](/images/facultyFiles/1405/lab-04-simple-math-formulas.png)
![diagram](/images/facultyFiles/1405/Lab%2004%20Diagram.png)
```

Images on the web are written with their full `https://` address.

When you add or update an assignment, quiz or page in Canvas, canvas manager
uploads each local image it references to the Canvas course and keeps a lookup
table (`assets` in the course's `settings.yml`) from the image's path to its
Canvas URL and a hash of the file, so an image is uploaded once and again only
when the file changes. Images on the web, including Mermaid diagrams, are left
as links and never copied into Canvas files.

**An image that won't show up is explained in the preview**, in its place:
wrong letter case, a close file name, a path without `/images/facultyFiles/`,
a space in the path, or a faculty files folder that isn't mounted, usually
with the path to use instead. Publishing stops with the same explanation. The
handout's
[When an image won't show up](https://snowse.github.io/canvasManagement/getting-started.html#images-troubleshooting)
goes through each message.

How it works: the production server only serves files that were in `public/`
when the image was built, so `src/routes/images.$.tsx` serves
`/images/...` from the mounted folder at request time, and
`src/features/canvas/services/files/publicImageFiles.ts` diagnoses a path that
doesn't resolve. `NEXT_PUBLIC_ENABLE_FILE_SYNC` (the image upload on publish)
is set when the Docker image is built; the line in the compose file is only
read by the file-watching server.

## Git

When the storage folder is (inside) a git repository, the course page shows a
git button for committing that course's folder, pulling and pushing, and each
editor's footer menu has a File history page. The image has `git` installed.

- Commits need a name and email. If git has none configured in the container,
  the app asks for them and saves them with `git config --global`, so give the
  container a persistent `HOME` (or mount a `.gitconfig`) to keep them.
- Pull and push use the repository's remote. With `GH_TOKEN` set and no ssh
  key in the container's `~/.ssh`, GitHub remotes written as
  `git@github.com:...` are reached over https with that token through `gh`, so
  the token needs write access to the repo. See
  [GitHub token](#github-token-gh_token) for making one.
- Pulls merge only when git can do it without a conflict; otherwise the merge
  is aborted and nothing changes. Nothing in the app rebases, resets or
  discards work.

## Error list and AI explanations

Errors raised while the app runs are kept in memory and counted by a pill at
the bottom of the screen, which opens `/errors`. The *Explain with AI* button
sends the error (and, for a file that doesn't parse, that file and a working
one from the same folder) to any OpenAI-compatible chat completions endpoint.
Configure it in `.env`; [`.env.example`](.env.example) has samples for
OpenAI, OpenRouter and a local Ollama:

```sh
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...        # leave out for endpoints that need none
AI_MODEL=gpt-4o-mini
```

Without `AI_BASE_URL` and `AI_MODEL` the button is disabled.

## Update Indicator

The home page shows a banner when a newer image than the one you are running
has been pushed to Docker Hub, with the list of commits that are in it. Nothing
updates automatically; run your [restart script](#restart-script) (or
`docker compose pull && docker compose up -d`) when you want to pick it up.

How it works: `build.sh` bakes the git commit into the image (`GIT_SHA` env
var and the `org.opencontainers.image.revision` label). Once an hour the server
reads that label off the published `snowcollege/canvas_management:4` manifest
using anonymous Docker Hub requests, and if the commit differs it asks the
GitHub compare API for the commits in between. Nothing is sent anywhere except
the two public APIs.

Environment variables:

- `DISABLE_UPDATE_CHECK=true` turns the check off (e.g. offline use).
- `UPDATE_CHECK_TAG` is the tag to compare against, defaults to the major
  version the image was built as (`4`). Set it if you pin something else in
  your compose file.
- `UPDATE_CHECK_IMAGE` defaults to `snowcollege/canvas_management`.

Local `pnpm dev` runs have no `GIT_SHA` and skip the check.

# ideas

multi-section support for due dates/times

maybe track a list of Canvas files no assignment references any more and offer to delete them


## Features
- websocket server to watch file system for changes, notify frontend it should invalidate cache
    - files can be edited in any text editor on the computer and changes are reflected in real time on the site
- holiday schedule
- lectures, 1 per day
- image upload on publish for assignments, quizzes and pages
- calendar weeks do not dupliacate, some of the first or last days of the calendar show up on the next month
- calendar and module list scroll position, and expanded modules, remembered per course
- days without class can be hidden on the calendar (narrowed to a strip)
- git from the course page: commit, pull and push, commit on publish, file history and restore
- files that don't parse are listed in their module and open as plain text to fix
- error list for the session, with an AI explanation per error
- matching questions have distractors
   - `-` in the question can be escaped with `\-`
