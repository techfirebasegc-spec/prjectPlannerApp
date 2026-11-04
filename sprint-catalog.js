function parseSprintDate(value) {
  if (value && typeof value.toDate === "function") return parseSprintDate(value.toDate());
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeSprintDate(value) {
  const date = parseSprintDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskSprintName(task) {
  return String(task?.raw?.sprint ?? task?.raw?.Sprint ?? task?.sprint ?? "").trim();
}

function taskSprintId(task) {
  return String(task?.raw?.sprintId || "").trim();
}

export function taskBelongsToSprint(task, sprint) {
  if (!task || !sprint) return false;
  const sprintId = taskSprintId(task);
  return sprintId ? sprintId === String(sprint.id || "") : taskSprintName(task) === String(sprint.name || sprint.sprint || "").trim();
}

export function buildSprintCatalog(tasks, sprintRecords) {
  const records = Array.isArray(sprintRecords) ? sprintRecords.filter((sprint) => sprint && sprint.archived !== true) : [];
  const byId = new Map(records.map((sprint) => [String(sprint.id || "").trim(), sprint]).filter(([id]) => id));
  const byName = new Map();
  records.forEach((sprint) => {
    const name = String(sprint.name || "").trim();
    if (!name) return;
    const matches = byName.get(name) || [];
    matches.push(sprint);
    byName.set(name, matches);
  });
  const catalog = new Map();
  const addSprint = (key, name, pi, startDate, endDate, id = "") => {
    if (!catalog.has(key)) catalog.set(key, { key, id, sprint: name, pi: pi || "Unspecified PI", startDate, endDate, tasks: [] });
    return catalog.get(key);
  };

  records.forEach((sprint) => {
    const id = String(sprint.id || "").trim(), name = String(sprint.name || "").trim();
    if (id && name) addSprint(`id:${id}`, name, "", parseSprintDate(sprint.startDate), parseSprintDate(sprint.endDate), id);
  });

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const id = taskSprintId(task), name = taskSprintName(task);
    const byIdMatch = id ? byId.get(id) : null;
    const nameMatches = !byIdMatch && name ? byName.get(name) || [] : [];
    const metadata = byIdMatch || (nameMatches.length === 1 ? nameMatches[0] : null);
    if (!metadata && !name) return;
    const sprint = metadata
      ? addSprint(`id:${metadata.id}`, String(metadata.name || name).trim(), task.pi, parseSprintDate(metadata.startDate), parseSprintDate(metadata.endDate), metadata.id)
      : addSprint(task.sprintKey || `legacy:${name}`, name, task.pi, task.sprintStartDate || null, task.sprintEndDate || null);
    sprint.tasks.push(task);
    if (sprint.pi === "Unspecified PI" && task.pi) sprint.pi = task.pi;
    if (!sprint.startDate && task.sprintStartDate) sprint.startDate = task.sprintStartDate;
    if (!sprint.endDate && task.sprintEndDate) sprint.endDate = task.sprintEndDate;
    if (sprint.startDate && sprint.endDate && sprint.startDate > sprint.endDate) [sprint.startDate, sprint.endDate] = [sprint.endDate, sprint.startDate];
  });

  return [...catalog.values()].sort((a, b) => {
    const aTime = a.startDate ? a.startDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startDate ? b.startDate.getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.sprint.localeCompare(b.sprint);
  });
}
