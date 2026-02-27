# AIs Through the Looking Glass

[![Deploy Jekyll with GitHub Pages](https://github.com/pro-cert-notes/pro-cert-notes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/pro-cert-notes/pro-cert-notes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpro-cert-notes.github.io%2F&up_message=online&down_message=offline&label=site)](https://pro-cert-notes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/pro-cert-notes/pro-cert-notes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.x-cc342d?logo=ruby)
![Node](https://img.shields.io/badge/Node-20.x-339933?logo=node.js&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-222222?logo=githubpages)
[![RSS](https://img.shields.io/badge/RSS-Feed-orange?logo=rss)](https://pro-cert-notes.github.io/feed.xml)

Jekyll-powered notes/blog site on AI, social sciences, humanities, and adjacent technical topics.

Live site: <https://pro-cert-notes.github.io/>

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Publishing Content](#publishing-content)
- [Deployment](#deployment)
- [Configuration Notes](#configuration-notes)
- [Contributing](#contributing)
- [License](#license)

## Features

- Jekyll posts from `_posts/` with pagination (`5` posts per page)
- Homepage sections for pinned repositories and recent GitHub commit activity
- Tag index page (`/tags/`) and auto-generated topic cloud on `/about/`
- SEO metadata, RSS feed, and sitemap generation
- GitHub Pages deployment with GitHub Actions
- Scheduled refresh of recent-commit data

## Tech Stack

- Jekyll + Bundler
- Minima via remote theme (`jekyll/minima`)
- GitHub Pages + GitHub Actions
- Node.js 20 for `.github/scripts/build_recent_commits.mjs`

## Repository Layout

```text
.
├── .github/scripts/build_recent_commits.mjs  # Generates _data/recent_commits.json
├── .github/workflows/jekyll-gh-pages.yml     # Build/deploy workflow
├── .github/workflows/delete-workflow-runs.yml
├── _config.yml
├── _includes/
├── _posts/                                   # YYYY-MM-DD-title.md
├── _sass/minima/custom-styles.scss
├── img/
├── index.html
├── posts.md
├── tags.md
├── about.md
├── Gemfile
└── package.json
```

## Getting Started

### Prerequisites

- Ruby and Bundler
- Node.js 20+ and npm (optional; only needed to generate recent-commit data locally)

### Install Dependencies

```bash
bundle install
```

### Run Locally

```bash
bundle exec jekyll serve
```

Open `http://127.0.0.1:4000`.

### Optional: Generate Recent Commit Data Locally

```bash
npm ci --no-fund --no-audit
GITHUB_TOKEN=... GITHUB_OWNER=pro-cert-notes node .github/scripts/build_recent_commits.mjs
```

The script writes `_data/recent_commits.json` (created if missing).

## Publishing Content

1. Create a post file: `_posts/YYYY-MM-DD-title.md`
2. Add front matter:

```yaml
---
layout: post
title: "Post Title"
date: 2026-02-22
published: true
excerpt: "Short summary for feed/cards."
tags:
  - ai
  - data-engineering
---
```

3. Add images under `img/` and reference via `{{ '/img/your-image.webp' | relative_url }}`
4. Deploy by either:
   - pushing to `main` with a commit message ending in `-rebuild`, or
   - running the workflow manually from GitHub Actions

## Deployment

Primary workflow: `.github/workflows/jekyll-gh-pages.yml`

Triggers:

- `push` to `main` (workflow starts), but build/deploy runs only when commit message ends with `-rebuild`
- `workflow_dispatch` (manual run)
- `schedule` daily at `00:00 UTC`

Deploy behavior:

- Recent commit data is generated first using Node 20
- Manual runs deploy
- Scheduled runs deploy only if `_data/recent_commits.json` changed or a post exists with today's UTC date (`YYYY-MM-DD-*`)
- Artifacts are deployed with `actions/deploy-pages@v4`

Maintenance workflow: `.github/workflows/delete-workflow-runs.yml` (manual cleanup of workflow history).

## Configuration Notes

- `future: false` in `_config.yml` prevents publishing future-dated posts early
- `permalink: /posts/:title/` controls post URLs
- `timezone: Asia/Seoul`
- `README.md` is excluded from Jekyll build output

## Contributing

Issues and pull requests are welcome for content corrections and site improvements.

## License

No `LICENSE` file is currently present, so reuse permissions are not explicitly granted.
