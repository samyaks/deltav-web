import { ingestFeeds } from "/integrations/ingest.mjs";
import { parseUploadCsv } from "/integrations/upload.mjs";

const DEMO_SEATS = [
  { tool: "Harvey", licensed: 10, monthlyCost: 2500 },
  { tool: "Legora", licensed: 6, monthlyCost: 1800 },
  { tool: "Everlaw", licensed: 4, monthlyCost: 1200 },
];

const DEMO_FILES = [
  "/integrations/examples/demo/harvey-usage.csv",
  "/integrations/examples/demo/legora-credits.csv",
  "/integrations/examples/demo/legora-audit.csv",
  "/integrations/examples/demo/everlaw-usage.csv",
  "/integrations/examples/demo/clio-time.csv",
  "/integrations/examples/demo/clio-matters.csv",
];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const state = {
  feeds: [],
};

const els = {
  drop: document.getElementById("drop-zone"),
  input: document.getElementById("file-input"),
  status: document.getElementById("intake-status"),
  feedList: document.getElementById("feed-list"),
  clear: document.getElementById("clear-files"),
  demo: document.getElementById("load-demo"),
  org: document.getElementById("org"),
  orgStats: document.getElementById("org-stats"),
  tools: document.getElementById("tools"),
  toolList: document.getElementById("tool-list"),
  users: document.getElementById("users"),
  userRows: document.getElementById("user-rows"),
  matters: document.getElementById("matters"),
  matterRows: document.getElementById("matter-rows"),
};

els.input.addEventListener("change", async () => {
  await addFiles([...els.input.files]);
  els.input.value = "";
});

["dragenter", "dragover"].forEach((type) => {
  els.drop.addEventListener(type, (event) => {
    event.preventDefault();
    els.drop.classList.add("is-over");
  });
});

["dragleave", "drop"].forEach((type) => {
  els.drop.addEventListener(type, (event) => {
    event.preventDefault();
    els.drop.classList.remove("is-over");
  });
});

els.drop.addEventListener("drop", async (event) => {
  await addFiles([...event.dataTransfer.files]);
});

els.clear.addEventListener("click", () => {
  state.feeds = [];
  render();
});

els.demo.addEventListener("click", () => {
  loadDemo().catch((error) => setStatus(error.message, true));
});

async function loadDemo() {
  setStatus("Loading sample month…");
  const feeds = [];
  for (const url of DEMO_FILES) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}`);
    const text = await response.text();
    const parsed = parseUploadCsv(text);
    feeds.push({ ...parsed, name: url.split("/").pop() });
  }
  state.feeds = feeds;
  render();
  setStatus(`Loaded ${feeds.length} sample feeds.`);
}

if (new URLSearchParams(location.search).has("demo")) {
  loadDemo().catch((error) => setStatus(error.message, true));
}

async function addFiles(files) {
  const csvFiles = files.filter((file) => /\.csv$/i.test(file.name) || file.type === "text/csv");
  if (csvFiles.length === 0) {
    setStatus("Choose CSV files.", true);
    return;
  }

  const next = [...state.feeds];
  const errors = [];
  for (const file of csvFiles) {
    try {
      const text = await file.text();
      const parsed = parseUploadCsv(text);
      const existing = next.findIndex((feed) => feed.kind === parsed.kind);
      const entry = { ...parsed, name: file.name };
      if (existing >= 0) next[existing] = entry;
      else next.push(entry);
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  state.feeds = next;
  render();
  if (errors.length) setStatus(errors.join(" "), true);
  else setStatus(`Mapped ${next.length} feed${next.length === 1 ? "" : "s"}.`);
}

function render() {
  const hasFeeds = state.feeds.length > 0;
  els.clear.hidden = !hasFeeds;
  els.feedList.hidden = !hasFeeds;
  els.feedList.innerHTML = state.feeds
    .map((feed) => `<li><span>${escapeHtml(feed.kind)}</span><span>${escapeHtml(feed.name)} · ${feed.rows.length} rows</span></li>`)
    .join("");

  [els.org, els.tools, els.users, els.matters].forEach((section) => {
    section.hidden = !hasFeeds;
  });

  if (!hasFeeds) {
    setStatus("No files yet. Load the sample month to see the rollup.");
    return;
  }

  const view = ingestFeeds(state.feeds, { seats: DEMO_SEATS });
  renderOrg(view.org);
  renderTools(view.tools, view.org.spend);
  renderUsers(view.users);
  renderMatters(view.matters);
}

function renderOrg(org) {
  const hoursNote = org.timeHours
    ? `${formatHours(org.timeHours)} from Clio · ${formatMoney(org.timeCost)} billed`
    : "Tied to a matter number";
  els.orgStats.innerHTML = [
    stat("AI spend", formatMoney(org.spend), `${formatMoney(org.usageSpend)} usage · ${formatMoney(org.seatSpend)} seats`),
    stat("People active", String(org.activeUsers), `${org.seatsInUse} seats in use of ${org.licensedSeats}`),
    stat("Matters with AI", String(org.mattersWithAi), hoursNote),
    stat("Recoverable", formatMoney(org.recoverable), `${org.idleSeats} idle seats this month`, true),
  ].join("");
}

function renderTools(tools, totalSpend) {
  const aiSpend = tools.filter((tool) => tool.isAi).reduce((sum, tool) => sum + tool.spend, 0) || totalSpend;
  els.toolList.innerHTML = tools.map((tool) => {
    const share = tool.isAi && aiSpend ? Math.round((tool.spend / aiSpend) * 100) : 0;
    const unitLabel = unitPhrase(tool.units, tool.unitKind);
    const seatLabel = tool.licensedSeats
      ? `${tool.activeUsers} of ${tool.licensedSeats} seats · ${tool.idleSeats} idle`
      : `${tool.activeUsers} people`;
    const shareLabel = tool.isAi ? `${share}% of AI spend` : "Time from Clio · not AI seat spend";
    return `
      <article class="tool">
        <div>
          <h3 class="tool-name">${escapeHtml(tool.tool)}</h3>
          <p class="tool-meta">${escapeHtml(seatLabel)}</p>
        </div>
        <div>
          <p class="tool-spend">${formatMoney(tool.spend)}</p>
          <p class="tool-meta">${escapeHtml(unitLabel)} · ${tool.matters} matters</p>
        </div>
        <div>
          <div class="share${tool.isAi ? "" : " share--ink"}" role="img" aria-label="${escapeHtml(shareLabel)}"><span style="width: ${tool.isAi ? share : 100}%"></span></div>
          <p class="share-label">${escapeHtml(shareLabel)}</p>
        </div>
      </article>
    `;
  }).join("");
}

function renderUsers(users) {
  els.userRows.innerHTML = users.map((user) => `
    <tr>
      <th scope="row">${escapeHtml(user.user)}</th>
      <td data-label="AI spend">${formatMoneyExact(user.spend)}</td>
      <td data-label="Hours">${formatHours(user.hours)}</td>
      <td data-label="Matters">${user.matters.length}</td>
      <td data-label="Tools">${escapeHtml(user.tools.join(", ") || "—")}</td>
    </tr>
  `).join("");
}

function renderMatters(matters) {
  els.matterRows.innerHTML = matters.map((matter) => `
    <tr>
      <th scope="row">${escapeHtml(matter.matterNumber)}</th>
      <td data-label="AI cost">${formatMoneyExact(matter.spend)}</td>
      <td data-label="Hours">${formatHours(matter.hours)}</td>
      <td data-label="People">${matter.users}</td>
      <td data-label="Tools">${escapeHtml(matter.tools.join(", ") || "—")}</td>
    </tr>
  `).join("");
}

function stat(label, value, note, statement = false) {
  return `
    <div class="stat">
      <p class="caps caps--12">${escapeHtml(label)}</p>
      <p class="stat-value${statement ? " text-statement" : ""}">${escapeHtml(value)}</p>
      <p class="stat-note">${escapeHtml(note)}</p>
    </div>
  `;
}

function unitPhrase(units, unitKind) {
  const n = Number(units) || 0;
  if (unitKind === "query") return `${n} quer${n === 1 ? "y" : "ies"}`;
  if (unitKind === "credit") return `${n} credit${n === 1 ? "" : "s"}`;
  if (unitKind === "doc") return `${n} doc${n === 1 ? "" : "s"}`;
  if (unitKind === "action") return `${n} action${n === 1 ? "" : "s"}`;
  if (unitKind === "hour") return `${formatHours(n)} hour${n === 1 ? "" : "s"}`;
  return `${n} units`;
}

function formatHours(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatMoney(value) {
  return money.format(value || 0);
}

function formatMoneyExact(value) {
  return value >= 100 ? money.format(value) : moneyExact.format(value || 0);
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
