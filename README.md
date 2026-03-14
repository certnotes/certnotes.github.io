# AIs Through the Looking Glass

[![Deploy Jekyll with GitHub Pages](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcertnotes.github.io%2F&up_message=online&down_message=offline&label=site)](https://certnotes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/certnotes/certnotes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.3-cc342d?logo=ruby)
![Node](https://img.shields.io/badge/Node.js-24%2B-339933)

Personal GitHub Pages site built with Jekyll and the remote `minima` theme.

Live site: <https://certnotes.github.io/>

## What This Repo Contains

This repository powers a small personal homepage that combines:

- pinned GitHub repositories sourced through `jekyll-github-metadata`
- recent GitHub commit activity from generated `_data/recent_commits.json`
- recent Substack posts from generated `_data/substack_posts.json`

Most site customization lives in [`index.html`](./index.html), [`_includes/`](./_includes), and [`_sass/minima/custom-styles.scss`](./_sass/minima/custom-styles.scss).

## Features

- GitHub Pages deployment with Jekyll
- Remote `jekyll/minima` theme plus local include/style overrides
- Config-driven pinned repository cards from [`_config.yml`](./_config.yml)
- Generated data files for GitHub activity and Substack posts
- Scheduled GitHub Actions automation for refresh and deployment

## Repository Layout

```text
.
├── .github/
│   ├── scripts/
│   │   └── build_recent_commits.mjs
│   └── workflows/
│       ├── delete-workflow-runs.yml
│       └── jekyll-gh-pages.yml
├── _config.yml
├── _data/
│   └── substack_posts.json
├── _includes/
│   ├── recent_commits.html
│   ├── repo_list.html
│   └── substack_posts.html
├── _sass/
│   └── minima/
│       └── custom-styles.scss
├── Gemfile
├── README.md
├── index.html
└── scripts/
    └── fetch_substack_posts.py
```

## Quick Start

### Prerequisites

- Ruby 3.3
- Bundler
- Python 3 if you want to regenerate Substack data locally
- Node.js 20 if you want to regenerate GitHub activity data locally

### Install dependencies

```bash
bundle install
```

### Run locally

```bash
bundle exec jekyll serve
```

Open <http://127.0.0.1:4000>.

## Content and Data

### Pinned repositories

Pinned repositories are defined in [`_config.yml`](./_config.yml) under `pinned_repos`. The homepage renders those repositories with metadata exposed by `jekyll-github-metadata`.

### Substack posts

Fetch recent Substack posts into [`_data/substack_posts.json`](./_data/substack_posts.json):

```bash
python3 scripts/fetch_substack_posts.py
```

Useful examples:

```bash
python3 scripts/fetch_substack_posts.py --limit 5
python3 scripts/fetch_substack_posts.py --feed-url https://example.substack.com/feed
```

### Recent GitHub commits

Generate recent commit data into `_data/recent_commits.json`:

```bash
GITHUB_TOKEN=... GITHUB_OWNER=certnotes node .github/scripts/build_recent_commits.mjs
```

Supported environment variables:

- `RECENT_COMMITS_SINCE_DAYS` default: `90`
- `MAX_REPOS_TO_SCAN` default: `0` (no limit)
- `PER_REPO` default: `10`
- `MAX_ITEMS` default: `7`
- `REPO_FETCH_CONCURRENCY` default: `6`
- `GH_FETCH_MAX_RETRIES` default: `5`
- `GH_FETCH_BASE_BACKOFF_MS` default: `1000`

The generator skips stale repositories before requesting commits, keeps only the most recent items in memory, retries transient GitHub API failures with backoff, and rewrites the output file only when the comparable payload changes.

Generated commit items contain:

- `repo`
- `url`
- `date`
- `message`

## Automation

### Deployment workflow

Primary workflow: [`.github/workflows/jekyll-gh-pages.yml`](./.github/workflows/jekyll-gh-pages.yml)

Triggers:

- push to `main`
- manual dispatch
- weekly schedule on Sunday at `00:00 UTC`

Workflow behavior:

1. Checks out the repository.
2. Generates `_data/recent_commits.json`.
3. Deploys on push and manual runs.
4. On scheduled runs, deploys only if `_data/recent_commits.json` changed.
5. Builds the site with Jekyll.
6. Publishes the built site to GitHub Pages.

Notes:

- `README.md` changes do not trigger the deployment workflow because the workflow ignores that path on push.
- `README.md` is excluded from the Jekyll build via [`_config.yml`](./_config.yml).

### Maintenance workflow

[`.github/workflows/delete-workflow-runs.yml`](./.github/workflows/delete-workflow-runs.yml) removes old workflow runs weekly and also supports manual dispatch.

## Tech Stack

- Jekyll
- `jekyll/minima` via `jekyll-remote-theme`
- `jekyll-github-metadata`
- GitHub Pages
- Python for Substack feed ingestion
- Node.js for recent GitHub activity generation

## License

No `LICENSE` file is currently included in this repository.
