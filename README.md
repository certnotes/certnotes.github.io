# AIs Through the Looking Glass

[![Deploy Jekyll with GitHub Pages](https://github.com/pro-cert-notes/pro-cert-notes.github.io/actions/workflows/jekyll-gh-pages.yml/badge.svg)](https://github.com/pro-cert-notes/pro-cert-notes.github.io/actions/workflows/jekyll-gh-pages.yml)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpro-cert-notes.github.io%2F&up_message=online&down_message=offline&label=site)](https://pro-cert-notes.github.io/)
![Last Commit](https://img.shields.io/github/last-commit/pro-cert-notes/pro-cert-notes.github.io)
![Jekyll](https://img.shields.io/badge/Jekyll-4.x-cc0000?logo=jekyll)
![Ruby](https://img.shields.io/badge/Ruby-3.x-cc342d?logo=ruby)
![Node](https://img.shields.io/badge/Node-20.x-339933?logo=node.js&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-222222?logo=githubpages)
[![RSS](https://img.shields.io/badge/RSS-Feed-orange?logo=rss)](https://pro-cert-notes.github.io/feed.xml)

Jekyll-powered personal notes/blog site on AI, social sciences, humanities, and adjacent technical topics.

Live site: <https://pro-cert-notes.github.io/>

## Features

- Posts from `_posts/` with pagination (`5` posts per page)
- Homepage sections for pinned repositories and recent GitHub commit activity
- Tag index page (`/tags/`) plus auto-generated topic cloud on `/about/`
- SEO, RSS feed, and sitemap support via Jekyll plugins
- GitHub Pages deployment via GitHub Actions
- Daily refresh of recent-commit data (deploy runs only when generated data changes)

## Tech Stack

- Jekyll (Ruby + Bundler)
- Minima via remote theme (`jekyll/minima`)
- GitHub Pages + GitHub Actions
- Node.js 20 (used by CI script that generates recent commit data)

## Project Structure

```text
.
├── .github/scripts/build_recent_commits.mjs  # Generates _data/recent_commits.json
├── .github/workflows/jekyll-gh-pages.yml     # Build/deploy + daily refresh workflow
├── .github/workflows/delete-workflow-runs.yml
├── _config.yml                                # Theme, plugins, pagination, permalinks
├── _includes/                                 # Reusable Liquid components
├── _posts/                                    # Blog posts: YYYY-MM-DD-title.md
├── _sass/minima/custom-styles.scss            # Minima overrides
├── img/                                       # Images used by posts/pages
├── index.html                                 # Home layout and sections
├── posts.md                                   # /posts/
├── tags.md                                    # /tags/
├── about.md                                   # /about/
├── Gemfile                                    # Ruby dependencies
└── package.json                               # Node metadata for CI script
```

## Quick Start

### Prerequisites

- Ruby + Bundler
- Node.js 20+ and npm (only needed if you want to run commit-data generation locally)

### Install

```bash
bundle install
```

### Run Locally

```bash
bundle exec jekyll serve
```

Local URL: `http://127.0.0.1:4000`

## Content Workflow

1. Create `_posts/YYYY-MM-DD-title.md`.
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

3. Add images under `img/` and reference them with `{{ '/img/your-image.webp' | relative_url }}`.
4. Push to `main` to trigger deployment.

## Deployment

Primary workflow: `.github/workflows/jekyll-gh-pages.yml`

Triggers:

- Push to `main`
- Manual run (`workflow_dispatch`)
- Scheduled run at `00:00 UTC` daily

Build/deploy flow:

- Set up Node 20 and run `node .github/scripts/build_recent_commits.mjs`
- For scheduled runs, skip deploy when `_data/recent_commits.json` is unchanged
- Build site with `bundle exec jekyll build -d ./_site`
- Upload artifact with `actions/upload-pages-artifact@v3`
- Deploy with `actions/deploy-pages@v4`

Maintenance workflow: `.github/workflows/delete-workflow-runs.yml` (manual cleanup tool).

## Configuration Notes

- `future: false` in `_config.yml` prevents future-dated posts from publishing early.
- `permalink: /posts/:title/` controls post URLs.
- Recent activity uses generated `_data/recent_commits.json`.

## Contributing

Issues and pull requests are welcome for content corrections and site improvements.

## License

No `LICENSE` file is present, so reuse permissions are not explicitly granted.
