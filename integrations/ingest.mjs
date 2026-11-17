// Turn parsed Harvey / Legora / Everlaw / Clio rows into one set of usage
// events, then roll those up to the firm, each person, and each matter number.
// AI cost comes from tool rates (+ optional seat bills). Clio time is hours and
// billed time value, kept separate from AI spend.

export const DEFAULT_RATES = {
  Harvey: { perQuery: 5.36 },
  Legora: { perCredit: 11.45 },
  Everlaw: { perDoc: 0.42 },
};

const AI_TOOLS = new Set(["Harvey", "Legora", "Everlaw"]);

/**
 * @param {Array<{ kind: string, rows: object[] }>} feeds
 * @param {{ rates?: typeof DEFAULT_RATES, seats?: { tool: string, licensed: number, monthlyCost: number }[] }} [options]
 */
export function ingestFeeds(feeds, options = {}) {
  const rates = { ...DEFAULT_RATES, ...(options.rates ?? {}) };
  const events = [];
  const summaries = [];

  for (const feed of feeds) {
    if (!feed || !Array.isArray(feed.rows)) {
      throw new Error("Each feed needs a kind and a rows list.");
    }
    switch (feed.kind) {
      case "harvey-usage":
        for (const row of feed.rows) events.push(fromHarveyUsage(row, rates));
        break;
      case "harvey-matters":
        for (const row of feed.rows) summaries.push(fromHarveyMatter(row));
        break;
      case "legora-credits":
        for (const row of feed.rows) events.push(fromLegoraCredits(row, rates));
        break;
      case "legora-audit":
        for (const row of feed.rows) events.push(fromLegoraAudit(row));
        break;
      case "everlaw-usage":
        for (const row of feed.rows) events.push(fromEverlawUsage(row, rates));
        break;
      case "everlaw-projects":
        for (const row of feed.rows) summaries.push(fromEverlawProject(row));
        break;
      case "clio-time":
        for (const row of feed.rows) events.push(fromClioTime(row));
        break;
      case "clio-matters":
        for (const row of feed.rows) summaries.push(fromClioMatter(row));
        break;
      default:
        throw new Error(`Unknown feed kind "${feed.kind}".`);
    }
  }

  return rollup(events, summaries, options.seats ?? []);
}

function fromHarveyUsage(row, rates) {
  return event({
    tool: "Harvey",
    user: row.user,
    at: row.at,
    matterNumber: row.matterNumber,
    product: row.product,
    action: row.action,
    id: row.id,
    units: 1,
    unitKind: "query",
    cost: rates.Harvey?.perQuery ?? 0,
  });
}

function fromHarveyMatter(row) {
  return {
    tool: "Harvey",
    matterNumber: row.matterNumber ?? "",
    users: row.users ?? 0,
    units: row.queries ?? 0,
    unitKind: "query",
  };
}

function fromLegoraCredits(row, rates) {
  const credits = Number(row.credits) || 0;
  return event({
    tool: "Legora",
    user: row.user,
    at: row.at,
    matterNumber: row.project ?? "",
    product: row.feature ?? "",
    action: "",
    id: "",
    units: credits,
    unitKind: "credit",
    cost: credits * (rates.Legora?.perCredit ?? 0),
  });
}

function fromLegoraAudit(row) {
  return event({
    tool: "Legora",
    user: row.user,
    at: row.at,
    matterNumber: "",
    product: "",
    action: row.action,
    id: "",
    units: 1,
    unitKind: "action",
    cost: 0,
  });
}

function fromEverlawUsage(row, rates) {
  const docs = Number(row.docs) || 0;
  return event({
    tool: "Everlaw",
    user: row.user,
    at: row.at,
    matterNumber: row.matterNumber,
    product: "",
    action: row.action,
    id: row.id,
    units: docs,
    unitKind: "doc",
    cost: docs * (rates.Everlaw?.perDoc ?? 0),
  });
}

function fromEverlawProject(row) {
  return {
    tool: "Everlaw",
    matterNumber: row.matterNumber ?? "",
    users: row.users ?? 0,
    units: row.docs ?? 0,
    unitKind: "doc",
  };
}

function fromClioTime(row) {
  const hours = Number(row.hours) || 0;
  const rate = Number(row.rate) || 0;
  return event({
    tool: "Clio",
    user: row.user,
    at: row.at,
    matterNumber: row.matterNumber,
    product: "",
    action: "",
    id: row.id,
    units: hours,
    unitKind: "hour",
    cost: hours * rate,
  });
}

function fromClioMatter(row) {
  return {
    tool: "Clio",
    matterNumber: row.matterNumber ?? "",
    users: 0,
    units: 0,
    unitKind: "matter",
    status: row.status ?? "",
  };
}

function event(fields) {
  return {
    tool: fields.tool,
    user: fields.user ?? "",
    at: fields.at ?? "",
    matterNumber: fields.matterNumber ?? "",
    product: fields.product ?? "",
    action: fields.action ?? "",
    id: fields.id ?? "",
    units: fields.units ?? 0,
    unitKind: fields.unitKind,
    cost: roundMoney(fields.cost ?? 0),
  };
}

function rollup(events, summaries, seats) {
  const byTool = new Map();
  const byUser = new Map();
  const byMatter = new Map();

  for (const seat of seats) {
    const tool = toolBucket(byTool, seat.tool);
    tool.licensedSeats += seat.licensed ?? 0;
    tool.seatSpend += seat.monthlyCost ?? 0;
  }

  for (const row of events) {
    if (row.unitKind === "action" && row.cost === 0 && !row.matterNumber) {
      const tool = toolBucket(byTool, row.tool);
      if (row.user) tool.users.add(row.user);
      const user = userBucket(byUser, row.user);
      user.tools.add(row.tool);
      user.actions += 1;
      continue;
    }

    addEvent(byTool, byUser, byMatter, row);
  }

  for (const summary of summaries) {
    if (!summary.matterNumber) continue;
    const matter = matterBucket(byMatter, summary.matterNumber);
    matter.tools.add(summary.tool);
    if (summary.status) matter.status = summary.status;
    if (summary.users > matter.summaryUsers) matter.summaryUsers = summary.users;
    if (summary.unitKind !== "matter") matter.summaryUnits += summary.units;
  }

  const tools = [...byTool.values()]
    .map((tool) => {
      const usageSpend = roundMoney(tool.usageSpend);
      const seatSpend = roundMoney(tool.seatSpend);
      const timeCost = roundMoney(tool.timeCost);
      const isTime = tool.unitKind === "hour";
      const spend = roundMoney(isTime ? timeCost : usageSpend + seatSpend);
      const activeUsers = tool.users.size;
      const idleSeats = Math.max(0, tool.licensedSeats - activeUsers);
      return {
        tool: tool.tool,
        spend,
        usageSpend,
        seatSpend,
        timeCost,
        hours: roundHours(tool.hours),
        units: isTime ? roundHours(tool.hours) : tool.units,
        unitKind: tool.unitKind,
        activeUsers,
        licensedSeats: tool.licensedSeats,
        idleSeats,
        matters: tool.matters.size,
        isAi: AI_TOOLS.has(tool.tool),
      };
    })
    .sort((a, b) => b.spend - a.spend || a.tool.localeCompare(b.tool));

  const users = [...byUser.values()]
    .map((user) => ({
      user: user.user,
      spend: roundMoney(user.spend),
      hours: roundHours(user.hours),
      timeCost: roundMoney(user.timeCost),
      units: user.units,
      actions: user.actions,
      matters: [...user.matters].filter(Boolean).sort(),
      tools: [...user.tools].sort(),
    }))
    .sort((a, b) => b.spend - a.spend || b.hours - a.hours || a.user.localeCompare(b.user));

  const matters = [...byMatter.values()]
    .map((matter) => {
      const tools = [...matter.tools].sort();
      return {
        matterNumber: matter.matterNumber,
        status: matter.status || "",
        spend: roundMoney(matter.spend),
        hours: roundHours(matter.hours),
        timeCost: roundMoney(matter.timeCost),
        units: matter.units || matter.summaryUnits,
        users: Math.max(matter.users.size, matter.summaryUsers),
        tools,
        hasAi: tools.some((name) => AI_TOOLS.has(name)),
      };
    })
    .sort((a, b) => b.spend - a.spend || b.hours - a.hours || a.matterNumber.localeCompare(b.matterNumber));

  const aiTools = tools.filter((tool) => tool.isAi);
  const usageSpend = roundMoney(aiTools.reduce((sum, tool) => sum + tool.usageSpend, 0));
  const seatSpend = roundMoney(aiTools.reduce((sum, tool) => sum + tool.seatSpend, 0));
  const spend = roundMoney(usageSpend + seatSpend);
  const timeHours = roundHours(tools.reduce((sum, tool) => sum + tool.hours, 0));
  const timeCost = roundMoney(tools.reduce((sum, tool) => sum + tool.timeCost, 0));
  const licensedSeats = aiTools.reduce((sum, tool) => sum + tool.licensedSeats, 0);
  const seatsInUse = aiTools.reduce((sum, tool) => sum + tool.activeUsers, 0);
  const idleSeats = aiTools.reduce((sum, tool) => sum + tool.idleSeats, 0);
  const recoverable = roundMoney(
    aiTools.reduce((sum, tool) => {
      if (!tool.licensedSeats || !tool.seatSpend) return sum;
      return sum + (tool.seatSpend * tool.idleSeats) / tool.licensedSeats;
    }, 0),
  );

  return {
    org: {
      spend,
      usageSpend,
      seatSpend,
      timeHours,
      timeCost,
      seatsInUse,
      licensedSeats,
      idleSeats,
      recoverable,
      mattersWithAi: matters.filter((matter) => matter.hasAi).length,
      activeUsers: users.length,
      tools: tools.map((tool) => tool.tool),
    },
    tools,
    users,
    matters,
    events,
  };
}

function addEvent(byTool, byUser, byMatter, row) {
  const isTime = row.unitKind === "hour";
  const tool = toolBucket(byTool, row.tool);
  if (isTime) {
    tool.hours += row.units;
    tool.timeCost += row.cost;
    tool.unitKind = "hour";
  } else {
    tool.usageSpend += row.cost;
    tool.units += row.units;
    tool.unitKind = tool.unitKind || row.unitKind;
  }
  if (row.user) tool.users.add(row.user);
  if (row.matterNumber) tool.matters.add(row.matterNumber);

  if (row.user) {
    const user = userBucket(byUser, row.user);
    if (isTime) {
      user.hours += row.units;
      user.timeCost += row.cost;
    } else {
      user.spend += row.cost;
      user.units += row.units;
    }
    user.tools.add(row.tool);
    if (row.matterNumber) user.matters.add(row.matterNumber);
  }

  if (row.matterNumber) {
    const matter = matterBucket(byMatter, row.matterNumber);
    if (isTime) {
      matter.hours += row.units;
      matter.timeCost += row.cost;
    } else {
      matter.spend += row.cost;
      matter.units += row.units;
    }
    matter.tools.add(row.tool);
    if (row.user) matter.users.add(row.user);
  }
}

function toolBucket(map, name) {
  if (!map.has(name)) {
    map.set(name, {
      tool: name,
      usageSpend: 0,
      seatSpend: 0,
      timeCost: 0,
      hours: 0,
      units: 0,
      unitKind: "",
      users: new Set(),
      matters: new Set(),
      licensedSeats: 0,
      idleSeats: 0,
    });
  }
  return map.get(name);
}

function userBucket(map, name) {
  if (!map.has(name)) {
    map.set(name, {
      user: name,
      spend: 0,
      hours: 0,
      timeCost: 0,
      units: 0,
      actions: 0,
      matters: new Set(),
      tools: new Set(),
    });
  }
  return map.get(name);
}

function matterBucket(map, name) {
  if (!map.has(name)) {
    map.set(name, {
      matterNumber: name,
      status: "",
      spend: 0,
      hours: 0,
      timeCost: 0,
      units: 0,
      summaryUnits: 0,
      summaryUsers: 0,
      users: new Set(),
      tools: new Set(),
    });
  }
  return map.get(name);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundHours(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
