#!/usr/bin/env node
/**
 * Build _data/recent_commits.json for the homepage "Recent Activity" section.
 *
 * Env vars:
 * - GITHUB_TOKEN (required): token for GitHub API
 * - GITHUB_OWNER (required): username or org
 * - RECENT_COMMITS_SINCE_DAYS (optional, default 90): only include commits since N days
 * - MAX_REPOS_TO_SCAN (optional, default 0): max repos to fetch commits from; 0 means no limit
 * - PER_REPO (optional, default 10): commits per repo to fetch
 * - MAX_ITEMS (optional, default 5): max items in output
 * - REPO_FETCH_CONCURRENCY (optional, default 6): concurrent repo commit requests
 */

import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER;

if (!TOKEN) {
  console.error("Missing env var: GITHUB_TOKEN");
  process.exit(1);
}
if (!OWNER) {
  console.error("Missing env var: GITHUB_OWNER");
  process.exit(1);
}

const SINCE_DAYS = Number(process.env.RECENT_COMMITS_SINCE_DAYS ?? 90);
const MAX_REPOS_TO_SCAN = Number(process.env.MAX_REPOS_TO_SCAN ?? 0);
const PER_REPO = Number(process.env.PER_REPO ?? 10);
const MAX_ITEMS = Number(process.env.MAX_ITEMS ?? 7);
const REPO_FETCH_CONCURRENCY = Number(process.env.REPO_FETCH_CONCURRENCY ?? 6);
const GH_FETCH_MAX_RETRIES = Number(process.env.GH_FETCH_MAX_RETRIES ?? 5);
const GH_FETCH_BASE_BACKOFF_MS = Number(process.env.GH_FETCH_BASE_BACKOFF_MS ?? 1000);

const sinceISO = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

const OUT_PATH = path.join(process.cwd(), "_data", "recent_commits.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ghFetch(url, { method = "GET" } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
        "User-Agent": "recent-commits-script",
      },
    });

    if (res.ok) return res.json();

    const retryAfter = res.headers.get("retry-after");
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");

    let waitMs = 0;
    if (retryAfter) {
      waitMs = Number(retryAfter) * 1000;
    } else if (remaining === "0" && reset) {
      const resetMs = Number(reset) * 1000;
      waitMs = Math.max(0, resetMs - Date.now()) + 1000;
    } else if (res.status === 403 || res.status === 429 || res.status >= 500) {
      // Backoff for transient failures even when explicit timing headers are absent.
      waitMs = GH_FETCH_BASE_BACKOFF_MS * 2 ** attempt;
    }

    if (waitMs > 0 && attempt < GH_FETCH_MAX_RETRIES) {
      const jitterMs = Math.floor(Math.random() * 250);
      const delay = waitMs + jitterMs;
      console.warn(
        `GitHub API ${res.status} for ${url}. Retrying in ${Math.ceil(delay / 1000)}s ` +
          `(attempt ${attempt + 1}/${GH_FETCH_MAX_RETRIES})...`
      );
      await sleep(delay);
      continue;
    }

    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status} for ${url}\n${txt}`);
  }
}

function clampPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

async function listRepos(owner) {
  const filtered = [];
  let page = 1;
  while (true) {
    const base = `https://api.github.com/users/${encodeURIComponent(owner)}/repos`;
    const url = `${base}?per_page=100&page=${page}&sort=updated&direction=desc&type=owner`;
    const batch = await ghFetch(url);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const repo of batch) {
      if (!repo || repo.archived || repo.disabled || repo.fork || repo.private) continue;
      filtered.push(repo);
      if (MAX_REPOS_TO_SCAN > 0 && filtered.length >= MAX_REPOS_TO_SCAN) {
        return filtered.slice(0, MAX_REPOS_TO_SCAN);
      }
    }

    if (batch.length < 100) break;
    page += 1;
  }

  if (MAX_REPOS_TO_SCAN > 0) return filtered.slice(0, MAX_REPOS_TO_SCAN);
  return filtered;
}

async function listCommits(owner, repoName) {
  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}` +
    `/commits?per_page=${PER_REPO}&since=${encodeURIComponent(sinceISO)}`;

  return ghFetch(url);
}

function normalizeCommit(item, repoName) {
  const c = item?.commit;
  const date = c?.author?.date ?? c?.committer?.date ?? null;
  const message = (c?.message ?? "").split("\n")[0].trim();
  const timestamp = date ? Date.parse(date) : 0;

  return {
    repo: repoName,
    url: item?.html_url ?? null,
    date,
    message,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

// Simple concurrency limiter
async function mapLimit(items, limit, mapper) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await mapper(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return results;
}

function sortByDateDesc(a, b) {
  return (b?.timestamp ?? 0) - (a?.timestamp ?? 0);
}

function readExistingJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function ensureDirExists(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function commitItemEqual(a, b) {
  return (
    a?.repo === b?.repo &&
    a?.url === b?.url &&
    a?.date === b?.date &&
    a?.message === b?.message
  );
}

function outputComparableEqual(existing, out) {
  if (!existing) return false;
  if (existing.owner !== out.owner || existing.since_days !== out.since_days) return false;

  const existingItems = Array.isArray(existing.items) ? existing.items : [];
  const outItems = Array.isArray(out.items) ? out.items : [];
  if (existingItems.length !== outItems.length) return false;

  for (let i = 0; i < outItems.length; i += 1) {
    if (!commitItemEqual(existingItems[i], outItems[i])) return false;
  }
  return true;
}

function shouldScanRepo(repo, cutoff) {
  if (!repo || repo.archived || repo.disabled || repo.fork || repo.private) return false;
  if (!repo.pushed_at) return true;

  const pushed = Date.parse(repo.pushed_at);
  return !Number.isFinite(pushed) || pushed >= cutoff;
}

function trimCommitForOutput(commit) {
  return {
    repo: commit.repo,
    url: commit.url,
    date: commit.date,
    message: commit.message,
  };
}

function insertTopCommit(topCommits, commit, limit) {
  if (!commit?.date || !commit.message) return;

  topCommits.push(commit);
  topCommits.sort(sortByDateDesc);
  if (topCommits.length > limit) topCommits.length = limit;
}

async function main() {
  const cutoff = Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000;
  const allRepos = await listRepos(OWNER);
  const repos = allRepos.filter((repo) => shouldScanRepo(repo, cutoff));
  const concurrency = clampPositiveInteger(REPO_FETCH_CONCURRENCY, 6);

  const commits = [];
  await mapLimit(repos, concurrency, async (repo) => {
    const repoName = repo.name;

    try {
      const list = await listCommits(OWNER, repoName);
      for (const item of list) insertTopCommit(commits, normalizeCommit(item, repoName), MAX_ITEMS);
    } catch (e) {
      console.warn(`Failed commits for ${repoName}: ${String(e.message ?? e)}`);
    }
  });

  // Make generated_at stable: use newest commit date, not "now"
  const generated_at = commits[0]?.date ?? null;

  const out = {
    owner: OWNER,
    since_days: SINCE_DAYS,
    generated_at,
    items: commits.map(trimCommitForOutput),
  };

  // Only write if meaningful content changed
  const existing = readExistingJson(OUT_PATH);
  if (outputComparableEqual(existing, out)) {
    console.log("recent_commits.json unchanged; not rewriting.");
    return;
  }

  ensureDirExists(OUT_PATH);
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_PATH} (${out.items.length} items).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
