(() => {
  const root = document.getElementById("recent-commits-root");
  const owner = root?.dataset.owner || "certnotes";
  const cacheKey = root?.dataset.cacheKey || `recent-commits:${owner}`;
  const cacheTtlMs = 24 * 60 * 60 * 1000;
  const eventsUrl =
    root?.dataset.sourceUrl ||
    `https://api.github.com/users/${encodeURIComponent(owner)}/events/public`;
  const eventsPerPage = 100;
  const maxEventPages = 3;
  const maxItems = 7;

  if (!root) return;

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  let eventsBaseUrl;
  try {
    eventsBaseUrl = new URL(eventsUrl);
  } catch {
    console.warn("recent-commits: invalid source URL", eventsUrl);
    return;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return dateFormatter.format(date).replace(/\//g, "-");
  }

  function readCachedRecentCommits() {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return null;

      const cached = JSON.parse(raw);
      const fetchedAt = Number(cached?.fetchedAt);
      if (!Number.isFinite(fetchedAt)) return null;
      if (Date.now() - fetchedAt > cacheTtlMs) return null;
      if (!cached?.data || !Array.isArray(cached.data.items)) return null;

      return cached.data;
    } catch {
      return null;
    }
  }

  function writeCachedRecentCommits(data) {
    if (!data || !Array.isArray(data.items)) return;

    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          fetchedAt: Date.now(),
          data,
        })
      );
    } catch {
      console.warn("recent-commits: failed to write cache");
    }
  }

  function collectRecentCommits(events, items, seenUrls) {
    for (const event of events) {
      if (event?.type !== "PushEvent") continue;

      const repoFullName = typeof event?.repo?.name === "string" ? event.repo.name : "";
      if (!repoFullName.startsWith(`${owner}/`)) continue;

      const repoName = repoFullName.split("/")[1] ?? repoFullName;
      const eventDate = event?.created_at ?? null;
      const commits = Array.isArray(event?.payload?.commits) ? event.payload.commits : [];

      for (const commit of commits) {
        const sha = typeof commit?.sha === "string" ? commit.sha : "";
        const message = typeof commit?.message === "string" ? commit.message.split("\n")[0].trim() : "";
        const url = sha ? `https://github.com/${repoFullName}/commit/${encodeURIComponent(sha)}` : null;

        if (!url || !eventDate || !message || seenUrls.has(url)) continue;

        seenUrls.add(url);
        items.push({
          repo: repoName,
          url,
          date: eventDate,
          message,
        });

        if (items.length >= maxItems) {
          return true;
        }
      }
    }

    return false;
  }

  function normalizeRecentCommits(eventPages) {
    if (!Array.isArray(eventPages)) return null;

    const items = [];
    const seenUrls = new Set();

    for (const events of eventPages) {
      if (!Array.isArray(events)) continue;
      if (collectRecentCommits(events, items, seenUrls)) break;
    }

    return items.length
      ? {
          owner,
          items,
        }
      : null;
  }

  function fetchEventPage(page) {
    const url = new URL(eventsBaseUrl);
    url.searchParams.set("per_page", String(eventsPerPage));
    url.searchParams.set("page", String(page));

    return fetch(url.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load recent commits: ${response.status}`);
      }

      return response.json();
    });
  }

  function createCommitIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "octicon");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M6.5 1.75a1.75 1.75 0 1 1 3.362.694l3.122 1.56a1.75 1.75 0 1 1-.67 1.341L9.19 6.905a1.75 1.75 0 1 1 0 2.19l3.123 1.56a1.75 1.75 0 1 1-.531 1.006L8.49 10.015a1.75 1.75 0 1 1-1.98-2.48V5.75a1.75 1.75 0 0 1 0-3.5Zm1.5 1a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm5-5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
    );
    svg.append(path);
    return svg;
  }

  function renderRecentCommits(data) {
    const items = Array.isArray(data?.items) ? data.items.slice(0, maxItems) : [];
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
      const repoUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(item.repo)}`;

      const listItem = document.createElement("li");

      const icon = document.createElement("span");
      icon.className = "recent-commit-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.append(createCommitIcon());
      listItem.append(icon);

      const text = document.createElement("span");
      text.className = "recent-commit-text";

      const repoLink = document.createElement("a");
      repoLink.href = repoUrl;
      repoLink.textContent = item.repo;
      text.append(repoLink);

      const repoSep = document.createElement("span");
      repoSep.className = "recent-commit-sep";
      repoSep.textContent = "·";
      text.append(repoSep);

      const messageLink = document.createElement("a");
      messageLink.className = "recent-commit-message";
      messageLink.href = item.url;
      messageLink.textContent = item.message;
      text.append(messageLink);

      const dateSep = document.createElement("span");
      dateSep.className = "recent-commit-sep";
      dateSep.textContent = "·";
      text.append(dateSep);

      const date = document.createElement("span");
      date.className = "recent-commit-date";
      date.textContent = formatDate(item.date);
      text.append(date);

      listItem.append(text);
      list.append(listItem);
    }

    section.append(list);
    fragment.append(section);

    root.replaceChildren(fragment);
  }

  async function loadRecentCommits() {
    const eventPages = [];

    for (let page = 1; page <= maxEventPages; page += 1) {
      const events = await fetchEventPage(page);
      eventPages.push(events);

      const data = normalizeRecentCommits(eventPages);
      if (data?.items?.length >= maxItems) {
        return data;
      }
    }

    return normalizeRecentCommits(eventPages);
  }

  const cachedData = readCachedRecentCommits();
  if (cachedData) {
    renderRecentCommits(cachedData);
    return;
  }

  loadRecentCommits()
    .then((data) => {
      if (!data) return;
      writeCachedRecentCommits(data);
      renderRecentCommits(data);
    })
    .catch((error) => {
      console.warn("recent-commits: failed to load recent commits", error);
    });
})();
