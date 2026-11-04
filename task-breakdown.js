export const MAX_TASK_BREAKDOWN_ITEMS = 50;

function hasValidChecklistItems(items, maxTitleLength) {
  return Array.isArray(items)
    && items.length <= MAX_TASK_BREAKDOWN_ITEMS
    && items.every((item) => item
      && typeof item === "object"
      && typeof item.title === "string"
      && item.title.trim().length > 0
      && item.title.trim().length <= maxTitleLength
      && typeof item.done === "boolean");
}

function dependencyIds(task) {
  return Array.isArray(task?.raw?.dependencies)
    ? task.raw.dependencies.filter((id) => typeof id === "string" && id.trim())
    : [];
}

export function wouldCreateDependencyCycle(taskId, prerequisiteId, tasks, nextDependencies = null) {
  const taskById = new Map((Array.isArray(tasks) ? tasks : []).map((task) => [task.id, task]));
  const visited = new Set();
  const visit = (id) => {
    if (id === taskId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const dependencies = id === taskId && Array.isArray(nextDependencies)
      ? nextDependencies
      : dependencyIds(taskById.get(id));
    return dependencies.some(visit);
  };
  return visit(prerequisiteId);
}

export function validateTaskBreakdownPatch(task, patch, tasks) {
  if (!task || typeof task.id !== "string" || !patch || typeof patch !== "object") {
    return "This task is no longer available. Refresh and try again.";
  }
  if (Object.hasOwn(patch, "subtasks") && !hasValidChecklistItems(patch.subtasks, 160)) {
    return "Subtasks must contain at most 50 items with a title of up to 160 characters.";
  }
  if (Object.hasOwn(patch, "acceptanceCriteria") && !hasValidChecklistItems(patch.acceptanceCriteria, 240)) {
    return "Acceptance criteria must contain at most 50 items with a title of up to 240 characters.";
  }
  if (!Object.hasOwn(patch, "dependencies")) return "";

  const dependencies = patch.dependencies;
  if (!Array.isArray(dependencies) || dependencies.length > MAX_TASK_BREAKDOWN_ITEMS) {
    return "A task can have at most 50 dependencies.";
  }
  if (dependencies.some((id) => typeof id !== "string" || !id.trim())) {
    return "Each dependency must be a valid task.";
  }
  if (new Set(dependencies).size !== dependencies.length) {
    return "A task cannot list the same dependency more than once.";
  }
  const availableTasks = new Map((Array.isArray(tasks) ? tasks : [])
    .filter((candidate) => candidate && typeof candidate.id === "string" && !candidate.archived)
    .map((candidate) => [candidate.id, candidate]));
  if (dependencies.some((id) => id === task.id || !availableTasks.has(id))) {
    return "Dependencies must refer to another active task in this project.";
  }
  if (dependencies.some((id) => wouldCreateDependencyCycle(task.id, id, tasks, dependencies))) {
    return "This dependency would create a cycle. Choose a different prerequisite.";
  }
  return "";
}
