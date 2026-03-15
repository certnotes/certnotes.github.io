(() => {
  const root = document.getElementById("recent-commits-root");
  if (!root) return;

  const config = createConfig(root);
  if (!config) return;

  function createConfig(rootElement) {
    const maxItems = 7;
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
      cacheKey: rootElement.dataset.cacheKey || `recent-commits:v7:${owner}`,
      cacheTtlMs: 24 * 60 * 60 * 1000,
      staleCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
      reposPerPage: 30,
      maxRepoPages: resolveMaxRepoPages(rootElement),
      commitsPerRepo: 1,
      commitBatchSize: resolveCommitBatchSize(rootElement),
      maxItems,
      dateFormatter: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
    };
  }

  function parsePositiveInt(value, fallbackValue) {
    const parsed = Number.parseInt(value || "", 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
  }

  function resolveNetworkProfile() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = typeof connection?.effectiveType === "string" ? connection.effectiveType : "";
    const saveData = connection?.saveData === true;

    if (saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
      return "conservative";
    }

    if (effectiveType === "3g") {
      return "balanced";
    }

    return "aggressive";
  }

  function resolveCommitBatchSize(rootElement) {
    const configuredValue = parsePositiveInt(rootElement.dataset.commitBatchSize, 0);
    if (configuredValue) return configuredValue;

    switch (resolveNetworkProfile()) {
      case "conservative":
        return 2;
      case "balanced":
        return 3;
      default:
        return 5;
    }
  }

  function resolveMaxRepoPages(rootElement) {
    const configuredValue = parsePositiveInt(rootElement.dataset.maxRepoPages, 0);
    if (configuredValue) return configuredValue;

    return resolveNetworkProfile() === "conservative" ? 1 : 2;
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

      const pushedAt = typeof repo.pushed_at === "string" ? repo.pushed_at : null;
      const pushedAtTime = Date.parse(pushedAt);
      const isArchived = repo.archived === true;
      const isDisabled = repo.disabled === true;
      const isEmpty = repo.size === 0;
      if (!pushedAt || !Number.isFinite(pushedAtTime) || isArchived || isDisabled || isEmpty) return null;

      return {
        name: repo.name,
        defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : null,
        pushedAt,
        pushedAtTime,
        fetchedCommitPages: 0,
        commitsApiUrl: apiUrl(
          `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(repo.name)}/commits`
        ),
      };
    }

    function normalizeCommit(repo, commit) {
      const sha = typeof commit?.sha === "string" ? commit.sha : "";
      const message =
        typeof commit?.commit?.message === "string" ? commit.commit.message.split("\n")[0].trim() : "";
      const committedAt =
        typeof commit?.commit?.committer?.date === "string"
          ? commit.commit.committer.date
          : typeof commit?.commit?.author?.date === "string"
            ? commit.commit.author.date
            : null;
      const timestamp = Date.parse(committedAt);
      const url = typeof commit?.html_url === "string" ? commit.html_url : null;

      if (!sha || !message || !committedAt || !url || !Number.isFinite(timestamp)) return null;

      return {
        repo: repo.name,
        url,
        date: committedAt,
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
      url.searchParams.set("page", String(repo.fetchedCommitPages + 1));
      if (repo.defaultBranch) {
        url.searchParams.set("sha", repo.defaultBranch);
      }

      const commits = await fetchJson(url);
      if (!Array.isArray(commits)) return [];
      repo.fetchedCommitPages += 1;

      return commits
        .map((commit) => normalizeCommit(repo, commit))
        .filter(Boolean)
        .sort((left, right) => right.timestamp - left.timestamp);
    }

    return {
      fetchRepoPage,
      fetchRepoCommits,
    };
  }

  function createRecentCommitAccumulator() {
    const items = [];
    const seenUrls = new Set();
    const repoStates = new Map();
    let cutoffTime = null;

    function createRepoState(repo) {
      return {
        repo,
        commits: [],
        exhausted: false,
      };
    }

    function compareCommitDates(left, right) {
      return right.timestamp - left.timestamp;
    }

    function updateCutoffTime() {
      cutoffTime = items.length >= config.maxItems ? items[items.length - 1]?.timestamp ?? null : null;
    }

    function insertItem(item) {
      if (!item?.url || seenUrls.has(item.url)) return false;

      let insertIndex = items.findIndex((current) => item.timestamp > current.timestamp);
      if (insertIndex === -1) insertIndex = items.length;

      items.splice(insertIndex, 0, item);
      seenUrls.add(item.url);

      if (items.length > config.maxItems) {
        const removed = items.pop();
        if (removed?.url) {
          seenUrls.delete(removed.url);
        }
      }

      updateCutoffTime();
      return true;
    }

    function ensureRepoState(repo) {
      if (!repo?.name) return null;

      const existingState = repoStates.get(repo.name);
      if (existingState) return existingState;

      const state = createRepoState(repo);
      repoStates.set(repo.name, state);
      return state;
    }

    function mergeRepoCommits(repoState, commits) {
      if (!commits.length) {
        repoState.exhausted = true;
        return;
      }

      repoState.commits.push(...commits);
      repoState.commits.sort(compareCommitDates);

      for (const item of commits) {
        insertItem(item);
      }

      if (commits.length < config.commitsPerRepo) {
        repoState.exhausted = true;
      }
    }

    function addMany(repos, commitGroups) {
      for (let index = 0; index < commitGroups.length; index += 1) {
        const repoState = ensureRepoState(repos[index]);
        if (!repoState) continue;

        const commits = Array.isArray(commitGroups[index]) ? commitGroups[index] : [];
        mergeRepoCommits(repoState, commits);
      }
    }

    function hasEnoughItems() {
      return items.length >= config.maxItems;
    }

    function getCutoffTime() {
      return cutoffTime;
    }

    function canStopForRepoPage(repos, nextRepoIndex = repos.length) {
      if (!hasEnoughItems() || !Array.isArray(repos) || !repos.length) return false;

      const oldestSelectedTime = getCutoffTime();
      const nextRepo = repos[nextRepoIndex];
      const comparisonRepo = nextRepo || repos[repos.length - 1];
      const comparisonTime = comparisonRepo?.pushedAtTime;

      if (!Number.isFinite(oldestSelectedTime) || !Number.isFinite(comparisonTime)) return false;

      return oldestSelectedTime >= comparisonTime;
    }

    function getReposNeedingMoreCommits() {
      return Array.from(repoStates.values()).filter((state) => {
        if (state.exhausted) return false;
        if (!hasEnoughItems()) return true;
        if (state.exhausted || !state.commits.length) return false;

        const oldestKnownCommit = state.commits[state.commits.length - 1];
        return Number.isFinite(oldestKnownCommit?.timestamp) && oldestKnownCommit.timestamp > cutoffTime;
      });
    }

    function toData() {
      return items.length ? { owner: config.owner, items: items.slice() } : null;
    }

    return {
      addMany,
      canStopForRepoPage,
      getCutoffTime,
      getReposNeedingMoreCommits,
      hasEnoughItems,
      toData,
    };
  }

  function canRepoBeatCutoff(repo, cutoffTime) {
    if (!repo || !Number.isFinite(repo.pushedAtTime)) return false;
    if (!Number.isFinite(cutoffTime)) return true;
    return repo.pushedAtTime > cutoffTime;
  }

  function selectCandidateRepos(repos, startIndex, cutoffTime) {
    return repos
      .slice(startIndex, startIndex + config.commitBatchSize)
      .filter((repo) => canRepoBeatCutoff(repo, cutoffTime));
  }

  function shouldStopRepoBatchScan(accumulator, repos, startIndex, cutoffTime) {
    return (
      accumulator.hasEnoughItems() &&
      repos[startIndex] &&
      !canRepoBeatCutoff(repos[startIndex], cutoffTime)
    );
  }

  function shouldStopRepoPageScan(accumulator, repos) {
    return accumulator.canStopForRepoPage(repos) || repos.length < config.reposPerPage;
  }

  async function fetchCommitGroups(github, repos) {
    return Promise.all(repos.map((repo) => github.fetchRepoCommits(repo)));
  }

  async function scanRepoPage(github, accumulator, repos) {
    for (let index = 0; index < repos.length; index += config.commitBatchSize) {
      const cutoffTime = accumulator.getCutoffTime();
      const repoBatch = selectCandidateRepos(repos, index, cutoffTime);

      if (!repoBatch.length && accumulator.hasEnoughItems()) break;
      if (shouldStopRepoBatchScan(accumulator, repos, index, cutoffTime)) break;

      const commitGroups = await fetchCommitGroups(github, repoBatch);
      accumulator.addMany(repoBatch, commitGroups);

      if (accumulator.canStopForRepoPage(repos, index + config.commitBatchSize)) break;
    }
  }

  async function loadAdditionalCommits(github, accumulator) {
    while (true) {
      const reposNeedingMoreCommits = accumulator.getReposNeedingMoreCommits();
      if (!reposNeedingMoreCommits.length) break;

      const repos = reposNeedingMoreCommits.map((state) => state.repo);
      const commitGroups = await fetchCommitGroups(github, repos);
      accumulator.addMany(repos, commitGroups);

      if (commitGroups.every((group) => !group.length)) break;
    }
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

  function createSyncIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "octicon");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M1.705 8.005a.75.75 0 0 1 .834-.656l1.5.2a.75.75 0 0 1-.178 1.49l-.243-.033a4.5 4.5 0 0 0 7.208 2.127.75.75 0 0 1 1.124.992A6 6 0 0 1 2.5 9.521l.01.074a.75.75 0 1 1-1.49.178l-.2-1.5a.75.75 0 0 1 .656-.834Zm12.59-.01a.75.75 0 0 1-.834.656l-1.5-.2a.75.75 0 1 1 .178-1.49l.244.032a4.5 4.5 0 0 0-7.21-2.126.75.75 0 0 1-1.123-.992A6 6 0 0 1 13.5 6.48l-.01-.074a.75.75 0 1 1 1.49-.178l.2 1.5a.75.75 0 0 1-.656.834Z"
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

  function renderRecentCommitsLoading() {
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

    const loadingMessage = document.createElement("p");
    loadingMessage.className = "recent-commits-loading";

    const loadingIcon = document.createElement("span");
    loadingIcon.className = "recent-commits-loading-icon";
    loadingIcon.setAttribute("aria-hidden", "true");
    loadingIcon.append(createSyncIcon());
    loadingMessage.append(loadingIcon);
    loadingMessage.append("Loading recent commits...");
    section.append(loadingMessage);

    fragment.append(section);
    config.root.replaceChildren(fragment);
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

      await scanRepoPage(github, accumulator, repos);

      if (shouldStopRepoPageScan(accumulator, repos)) break;
    }

    await loadAdditionalCommits(github, accumulator);

    return accumulator.toData();
  }

  async function init() {
    renderRecentCommitsLoading();

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
