# certnotes.github.io

[![Deploy Jekyll with GitHub Pages](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcertnotes.github.io%2F&up_message=online&down_message=offline&label=site)](https://certnotes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/certnotes/certnotes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.3-cc342d?logo=ruby)

Personal GitHub Pages site built with Jekyll and the remote `jekyll/minima` theme.

Live site: <https://certnotes.github.io/>

## Overview

This repository powers a personal homepage for notes, projects, and essays. The home page combines:

- pinned GitHub repositories rendered with `jekyll-github-metadata`
- recent GitHub commit activity fetched client-side from the GitHub API and cached in the browser
- recent Substack posts generated into `_data/substack_posts.json`

Most custom behavior lives in [`index.html`](./index.html), [`_includes/repo_list.html`](./_includes/repo_list.html), [`_includes/substack_posts.html`](./_includes/substack_posts.html), [`assets/js/recent-commits.js`](./assets/js/recent-commits.js), and [`_sass/minima/custom-styles.scss`](./_sass/minima/custom-styles.scss).

## Features

- GitHub Pages deployment through GitHub Actions
- Remote `jekyll/minima` theme with local include and style overrides
- Config-driven pinned repositories from [`_config.yml`](./_config.yml)
- Generated Substack post data for static rendering
- Client-side recent commit feed with cache-aware fallback behavior

## Repository Layout

```text
.
├── .github/workflows/
├── _config.yml
├── _data/substack_posts.json
├── _includes/
├── _sass/minima/custom-styles.scss
├── assets/js/recent-commits.js
├── Gemfile
├── index.html
└── scripts/fetch_substack_posts.py
```

## Getting Started

### Prerequisites

- Ruby 3.3
- Bundler
- Python 3 for regenerating Substack data

### Install dependencies

```bash
bundle install
```

### Run the site locally

```bash
bundle exec jekyll serve
```

Open <http://127.0.0.1:4000>.

## Content Workflow

### Pinned repositories

Pinned repositories are defined in [`_config.yml`](./_config.yml) under `pinned_repos`. The homepage renders up to four matching public repositories.

### Substack posts

Generate [`_data/substack_posts.json`](./_data/substack_posts.json) from the Substack RSS feed:

```bash
python3 scripts/fetch_substack_posts.py
```

Examples:

```bash
python3 scripts/fetch_substack_posts.py --limit 5
python3 scripts/fetch_substack_posts.py --feed-url https://example.substack.com/feed
```

### Recent GitHub commits

[`assets/js/recent-commits.js`](./assets/js/recent-commits.js) resolves the GitHub owner from page metadata when available, falls back to the `username.github.io` hostname pattern when needed, scans recent repositories through the GitHub API, and renders the latest commit entries client-side. Results are cached in `localStorage` for 24 hours, with stale cache used as a fallback if refresh fails.

## Deployment

Primary workflow: [`.github/workflows/jekyll-gh-pages.yml`](./.github/workflows/jekyll-gh-pages.yml)

It runs on:

- pushes to `main`
- manual dispatch

The workflow:

1. Checks out the repository.
2. Sets up Pages and Ruby.
3. Restores the Jekyll cache.
4. Builds the site with `bundle exec jekyll build -d ./_site`.
5. Uploads the build artifact and deploys it to GitHub Pages.

`README.md` is excluded from the Jekyll build via [`_config.yml`](./_config.yml), but README-only pushes still trigger the deployment workflow because the workflow does not define a `paths-ignore` filter.

Maintenance workflow: [`.github/workflows/delete-workflow-runs.yml`](./.github/workflows/delete-workflow-runs.yml)

This workflow deletes old GitHub Actions runs weekly and also supports manual dispatch.

## Tech Stack

- Jekyll
- `jekyll/minima` via `jekyll-remote-theme`
- `jekyll-github-metadata`
- GitHub Pages
- GitHub Actions
- Python for Substack feed ingestion

## License

No `LICENSE` file is currently included in this repository.
