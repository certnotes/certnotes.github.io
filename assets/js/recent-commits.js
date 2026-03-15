(() => {
  const root = document.getElementById("recent-commits-root");
  if (!root) return;

  const config = createConfig(root);
  if (!config) return;

  function createConfig(rootElement) {
    const githubApiBaseUrl = rootElement.dataset.sourceUrl || "https://api.github.com";
    let apiBaseUrl;

    try {
      apiBaseUrl = new URL(githubApiBaseUrl);
    } catch {
      console.warn("recent-commits: invalid source URL", githubApiBaseUrl);
      return null;
    }

    const owner = resolveOwner(rootElement);
    if (!owner) {
      console.warn("recent-commits: could not resolve repo owner");
      return null;
    }

      return {
        root: rootElement,
        owner,
        apiBaseUrl,
        cacheKey: rootElement.dataset.cacheKey || `recent-commits:v4:${owner}`,
        cacheTtlMs: 24 * 60 * 60 * 1000,
        staleCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
        reposPerPage: 30,
        maxRepoPages: 2,
        commitsPerRepo: 1,
        commitBatchSize: 3,
        maxItems: 7,
        dateFormatter: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
    };
  }

  function resolveOwner(rootElement) {
    const configuredOwner = rootElement.dataset.owner?.trim();
    if (configuredOwner) return configuredOwner;

    return inferOwnerFromHostname();
  }

  function inferOwnerFromHostname() {
    const hostname = window.location.hostname.trim().toLowerCase();
    const githubPagesMatch = hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    return githubPagesMatch?.[1] || "";
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return config.dateFormatter.format(date).replace(/\//g, "-");
  }

    function readCache() {
      try {
        const raw = window.localStorage.getItem(config.cacheKey);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        const fetchedAt = Number(cached?.fetchedAt);
        if (!Number.isFinite(fetchedAt)) return null;
        if (!cached?.data || !Array.isArray(cached.data.items)) return null;

        const ageMs = Date.now() - fetchedAt;
        if (ageMs > config.staleCacheTtlMs) return null;

        return {
          data: cached.data,
          isFresh: ageMs <= config.cacheTtlMs,
        };
      } catch {
        return null;
      }
    }

  function writeCache(data) {
    if (!data || !Array.isArray(data.items)) return;

    try {
      window.localStorage.setItem(
        config.cacheKey,
        JSON.stringify({
          fetchedAt: Date.now(),
          data,
        })
      );
    } catch {
      console.warn("recent-commits: failed to write cache");
    }
  }

  function createGitHubClient() {
    function apiUrl(pathname) {
      return new URL(pathname, config.apiBaseUrl);
    }

    async function fetchJson(url) {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load recent commits: ${response.status}`);
      }

      return response.json();
    }

    function isOwnedRepo(repo) {
      return (
        repo &&
        typeof repo.name === "string" &&
        repo.owner &&
        typeof repo.owner.login === "string" &&
        repo.owner.login.toLowerCase() === config.owner.toLowerCase()
      );
    }

    function normalizeRepo(repo) {
      if (!isOwnedRepo(repo)) return null;

      return {
        name: repo.name,
        defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : null,
        pushedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
        pushedAtTime: Date.parse(repo.pushed_at),
        commitsApiUrl: apiUrl(
          `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(repo.name)}/commits`
        ),
      };
    }

    function normalizeCommit(repo, commit) {
      const sha = typeof commit?.sha === "string" ? commit.sha : "";
      const message =
        typeof commit?.commit?.message === "string" ? commit.commit.message.split("\n")[0].trim() : "";
      const authoredAt =
        typeof commit?.commit?.author?.date === "string"
          ? commit.commit.author.date
          : typeof commit?.commit?.committer?.date === "string"
            ? commit.commit.committer.date
            : null;
      const timestamp = Date.parse(authoredAt);
      const url = typeof commit?.html_url === "string" ? commit.html_url : null;

      if (!sha || !message || !authoredAt || !url || !Number.isFinite(timestamp)) return null;

      return {
        repo: repo.name,
        url,
        date: authoredAt,
        timestamp,
        message,
      };
    }

    async function fetchRepoPage(page) {
      const url = apiUrl(`/users/${encodeURIComponent(config.owner)}/repos`);
      url.searchParams.set("sort", "pushed");
      url.searchParams.set("direction", "desc");
      url.searchParams.set("per_page", String(config.reposPerPage));
      url.searchParams.set("page", String(page));

      const repos = await fetchJson(url);
      if (!Array.isArray(repos) || !repos.length) return [];

      return repos.map(normalizeRepo).filter(Boolean);
    }

    async function fetchRepoCommits(repo) {
      if (!repo?.commitsApiUrl) return [];

      const url = new URL(repo.commitsApiUrl);
      url.searchParams.set("per_page", String(config.commitsPerRepo));
      if (repo.defaultBranch) {
        url.searchParams.set("sha", repo.defaultBranch);
      }

      const commits = await fetchJson(url);
      if (!Array.isArray(commits)) return [];

      return commits.map((commit) => normalizeCommit(repo, commit)).filter(Boolean);
    }

    return {
      fetchRepoPage,
      fetchRepoCommits,
    };
  }

  function createRecentCommitAccumulator() {
    const items = [];
    const seenUrls = new Set();

    function compareCommitDates(left, right) {
      return right.timestamp - left.timestamp;
    }

    function add(item) {
      if (!item?.url || seenUrls.has(item.url)) return;

      seenUrls.add(item.url);
      items.push(item);
      items.sort(compareCommitDates);

      if (items.length > config.maxItems) {
        const removed = items.pop();
        if (removed?.url) {
          seenUrls.delete(removed.url);
        }
      }
    }

    function addMany(commitGroups) {
      for (const group of commitGroups) {
        for (const item of group) {
          add(item);
        }
      }
    }

    function hasEnoughItems() {
      return items.length >= config.maxItems;
    }

    function canStopForRepoPage(repos, nextRepoIndex = repos.length) {
      if (!hasEnoughItems() || !Array.isArray(repos) || !repos.length) return false;

      const oldestSelectedTime = items[items.length - 1]?.timestamp;
      const nextRepo = repos[nextRepoIndex];
      const comparisonRepo = nextRepo || repos[repos.length - 1];
      const comparisonTime = comparisonRepo?.pushedAtTime;

      if (!Number.isFinite(oldestSelectedTime) || !Number.isFinite(comparisonTime)) return false;

      return oldestSelectedTime >= comparisonTime;
    }

    function toData() {
      return items.length ? { owner: config.owner, items: items.slice() } : null;
    }

    return {
      addMany,
      canStopForRepoPage,
      toData,
    };
  }

  function createCommitIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "octicon");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"
    );
    svg.append(path);
    return svg;
  }

  function createSeparator() {
    const separator = document.createElement("span");
    separator.className = "recent-commit-sep";
    separator.textContent = "·";
    return separator;
  }

  function createRepoUrl(repoName) {
    return `https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(repoName)}`;
  }

  function renderCommitItem(item) {
    const listItem = document.createElement("li");

    const icon = document.createElement("span");
    icon.className = "recent-commit-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.append(createCommitIcon());
    listItem.append(icon);

    const text = document.createElement("span");
    text.className = "recent-commit-text";

    const repoLink = document.createElement("a");
    repoLink.href = createRepoUrl(item.repo);
    repoLink.textContent = item.repo;
    text.append(repoLink);

    text.append(createSeparator());

    const messageLink = document.createElement("a");
    messageLink.className = "recent-commit-message";
    messageLink.href = item.url;
    messageLink.textContent = item.message;
    text.append(messageLink);

    text.append(createSeparator());

    const date = document.createElement("span");
    date.className = "recent-commit-date";
    date.textContent = formatDate(item.date);
    text.append(date);

    listItem.append(text);
    return listItem;
  }

  function renderRecentCommits(data) {
    const items = Array.isArray(data?.items) ? data.items.slice(0, config.maxItems) : [];
    const owner = typeof data?.owner === "string" ? data.owner : "";

    if (!items.length || !owner) return;

    const validItems = items.filter((item) => item?.repo && item?.url && item?.message && item?.date);
    if (!validItems.length) return;

    const fragment = document.createDocumentFragment();

    const divider = document.createElement("hr");
    divider.className = "section-divider";
    fragment.append(divider);

    const section = document.createElement("section");
    section.id = "recent-commits-block";

    const heading = document.createElement("h2");
    heading.append("Recent Activity ");
    const headingMeta = document.createElement("span");
    headingMeta.className = "section-heading-meta";
    headingMeta.textContent = "(GitHub commits)";
    heading.append(headingMeta);
    section.append(heading);

    const list = document.createElement("ul");
    list.className = "recent-commits";

    for (const item of validItems) {
      list.append(renderCommitItem(item));
    }

    section.append(list);
    fragment.append(section);

    config.root.replaceChildren(fragment);
  }

  async function loadRecentCommits() {
    const github = createGitHubClient();
    const accumulator = createRecentCommitAccumulator();

    for (let page = 1; page <= config.maxRepoPages; page += 1) {
      const repos = await github.fetchRepoPage(page);
      if (!repos.length) break;

      for (let index = 0; index < repos.length; index += config.commitBatchSize) {
        const repoBatch = repos.slice(index, index + config.commitBatchSize);
        const commitGroups = await Promise.all(repoBatch.map((repo) => github.fetchRepoCommits(repo)));
        accumulator.addMany(commitGroups);
        if (accumulator.canStopForRepoPage(repos, index + config.commitBatchSize)) break;
      }

      if (accumulator.canStopForRepoPage(repos)) break;
      if (repos.length < config.reposPerPage) break;
    }

    return accumulator.toData();
  }

  async function init() {
    const cached = readCache();
    if (cached?.data) {
      renderRecentCommits(cached.data);
      if (cached.isFresh) return;
    }

    try {
      const data = await loadRecentCommits();
      if (!data) return;

      writeCache(data);
      renderRecentCommits(data);
    } catch (error) {
      console.warn("recent-commits: failed to load recent commits", error);
    }
  }

  init();
})();
