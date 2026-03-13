# AIs Through the Looking Glass

[![Deploy Jekyll with GitHub Pages](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/certnotes/certnotes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fcertnotes.github.io%2F&up_message=online&down_message=offline&label=site)](https://certnotes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/certnotes/certnotes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.x-cc342d?logo=ruby)
![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-222222?logo=githubpages)
[![RSS](https://img.shields.io/badge/RSS-Feed-orange?logo=rss)](https://certnotes.github.io/feed.xml)

Personal Jekyll site for essays, notes, and project links across AI, social science, and adjacent technical topics.

Live site: <https://certnotes.github.io/>

## What This Repo Contains

This repository powers a GitHub Pages site built with Jekyll and the `jekyll/minima` remote theme.

The homepage currently combines:

- pinned GitHub repositories from `site.github.public_repositories`
- recent GitHub commit activity from `_data/recent_commits.json`
- recent Substack posts from `_data/substack_posts.json`

## Features

- GitHub Pages site with Jekyll and Minima theme overrides
- homepage repo cards for pinned repositories defined in `_config.yml`
- optional recent GitHub activity section rendered from generated JSON
- recent Substack posts rendered from generated JSON
- SEO, RSS feed, and sitemap support via Jekyll plugins
- automated GitHub Pages deployment with scheduled refreshes

## Quick Start

### Prerequisites

Required for local site development:

- Ruby 3.x
- Bundler

Optional for regenerating dynamic data locally:

- Node.js 20+ for recent GitHub commits data
- Python 3.11+ for Substack feed data

### Install

```bash
bundle install
```

### Run Locally

```bash
bundle exec jekyll serve
```

Then open <http://127.0.0.1:4000>.

## Refresh Generated Data

Refresh Substack posts:

```bash
python3 scripts/fetch_substack_posts.py
```

This writes `_data/substack_posts.json`.

Refresh recent GitHub commits:

```bash
GITHUB_TOKEN=... GITHUB_OWNER=certnotes node .github/scripts/build_recent_commits.mjs
```

This writes `_data/recent_commits.json` when recent activity is found.

## Deployment

Primary workflow: `.github/workflows/jekyll-gh-pages.yml`

It runs on:

- pushes to `main`, except README-only changes
- manual dispatch
- a daily schedule at `00:00 UTC`

The deployment job:

1. generates recent GitHub commit data
2. skips scheduled deploys when the generated commit data has not changed
3. builds the site with Jekyll
4. publishes the result to GitHub Pages

Maintenance workflow: `.github/workflows/delete-workflow-runs.yml`

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
├── _sass/minima/custom-styles.scss
├── Gemfile
├── index.html
└── scripts/
    └── fetch_substack_posts.py
```

## Configuration

Key site settings live in `_config.yml`, including:

- permalink structure
- timezone
- remote theme and Jekyll plugins
- pinned repositories shown on the homepage

## Contributing

Issues and pull requests are welcome for content fixes and site improvements.

## License

No `LICENSE` file is present, so reuse permissions are not explicitly granted.
