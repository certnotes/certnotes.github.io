# AIs Through the Looking Glass

[![Deploy Jekyll with GitHub Pages](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcertnotes.github.io%2F&up_message=online&down_message=offline&label=site)](https://certnotes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/certnotes/certnotes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.3-cc342d?logo=ruby)
![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-222222?logo=githubpages)

Personal GitHub Pages site built with Jekyll and the remote `minima` theme.

Live site: <https://certnotes.github.io/>

## Overview

This repository powers a lightweight homepage that combines:

- pinned GitHub repositories from `site.github.public_repositories`
- recent GitHub commit activity from generated `_data/recent_commits.json`
- recent Substack posts from `_data/substack_posts.json`

Most site customization lives in [`_includes/`](./_includes), [`index.html`](./index.html), and [`_sass/minima/custom-styles.scss`](./_sass/minima/custom-styles.scss).

## Features

- Jekyll site deployed to GitHub Pages
- Remote `jekyll/minima` theme with local include and style overrides
- Pinned repository cards driven by `_config.yml`
- Generated JSON data for recent GitHub activity and Substack posts
- Scheduled GitHub Actions workflow to refresh recent activity and redeploy when data changes

## Repository Structure

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

## Local Development

### Prerequisites

- Ruby 3.3
- Bundler

Optional tools for regenerating data locally:

- Python 3 for Substack data
- Node.js 20 for GitHub activity data

### Install

```bash
bundle install
```

### Run the site

```bash
bundle exec jekyll serve
```

Open <http://127.0.0.1:4000>.

## Content and Data Sources

### Pinned repositories

Pinned repositories are defined in [`_config.yml`](./_config.yml) under `pinned_repos`. The homepage renders those repositories using GitHub metadata provided by `jekyll-github-metadata`.

### Substack posts

Refresh the Substack feed data with:

```bash
python3 scripts/fetch_substack_posts.py
```

Useful flags:

```bash
python3 scripts/fetch_substack_posts.py --limit 5
python3 scripts/fetch_substack_posts.py --feed-url https://example.substack.com/feed
```

This writes [`_data/substack_posts.json`](./_data/substack_posts.json).

### Recent GitHub commits

Generate recent commit data with:

```bash
GITHUB_TOKEN=... GITHUB_OWNER=certnotes node .github/scripts/build_recent_commits.mjs
```

Useful environment variables:

- `RECENT_COMMITS_SINCE_DAYS` default: `90`
- `MAX_REPOS_TO_SCAN` default: `0` (no limit)
- `PER_REPO` default: `10`
- `MAX_ITEMS` default: `7`

This writes `_data/recent_commits.json` only when the comparable output changes.

## GitHub Actions

### Deployment workflow

Primary workflow: [`.github/workflows/jekyll-gh-pages.yml`](./.github/workflows/jekyll-gh-pages.yml)

Triggers:

- pushes to `main`
- manual dispatch
- weekly schedule on Sunday at `00:00 UTC`

Behavior:

1. Checks out the repository.
2. Generates `_data/recent_commits.json`.
3. Always deploys on push and manual runs.
4. On scheduled runs, deploys only if `_data/recent_commits.json` changed.
5. Builds the site with Jekyll.
6. Publishes the built site to GitHub Pages.

Notes:

- `README.md` changes do not trigger the deployment workflow because the file is ignored in `paths-ignore`.
- `README.md` is also excluded from the Jekyll build via [`_config.yml`](./_config.yml).

### Maintenance workflow

[`.github/workflows/delete-workflow-runs.yml`](./.github/workflows/delete-workflow-runs.yml) deletes old workflow runs weekly and also supports manual dispatch.

## Tech Stack

- Jekyll
- `jekyll/minima` via `jekyll-remote-theme`
- `jekyll-github-metadata`
- GitHub Pages
- Python for Substack feed ingestion
- Node.js for recent GitHub activity generation

## License

No `LICENSE` file is currently included in this repository.
