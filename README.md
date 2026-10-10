# Canvas Management
> Who wants to click around in Canvas when they can just edit markdown files? ;-)

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

All class data files are stored in markdown files in a folder. I recommend making this folder a git repo. Here's an example docker compose:

```yml
services:
  canvas_manager:
    image: snowcollege/canvas_management:4
    user: "${DOCKER_UID:-1000}:${DOCKER_GID:-1000}"
    container_name: canvas-manager
    ports:
      - 3000:3000
    env_file:
      - .env
    environment:
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


## Enable Image Support


You must set the `NEXT_PUBLIC_ENABLE_FILE_SYNC` environment variable to true. Images need to be available in the `/app/public/` directory in the container so that they are served as static files. Images can also be set to public URL's on the web.

When you add or update an assignment, quiz or page in Canvas, canvas manager uploads each local image it references to the Canvas course and keeps a lookup table (`assets` in the course's `settings.yml`) from the image's path to its Canvas URL and a hash of the file, so an image is uploaded once and again only when the file changes. A local image that can't be found stops the publish with an error naming it. Images on the web, including Mermaid diagrams, are left as links and never copied into Canvas files.

For Snow College professors, images should be stored in a separate git repo from the `facultyFiles` git repo. Otherwise the `faculty` repository will become cluttered with duplicated large binary images. Set up your volume like this:

```yml
    volumes:
      - ~/projects/facultyFiles:/app/public/images/facultyFiles
```

You can now embed an image in an assignment by adding something like this line.

```md
![formulas](/images/facultyFiles/1405/lab-04-simple-math-formulas.png)
```

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
  the token needs write access to the repo.
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
updates automatically; run your reset script (`docker compose pull && docker
compose up -d`) when you want to pick it up.

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
