(() => {
  "use strict";

  const COLUMN_KEYS = ["todo", "inprogress", "done"];
  const STORAGE_KEYS = {
    statusMap: "cliniqPlanner.statusMap.v1",
    preferences: "cliniqPlanner.preferences.v1"
  };

  const appState = {
    allTasks: [],
    filteredTasks: [],
    sprintCatalog: [],
    filters: {
      pi: "all",
      sprint: "all",
      feature: "all",
      assignee: "all",
      search: ""
    },
    sortBy: "default",
    activeView: "board",
    calendarMonth: "",
    wipLimits: { todo: null, inprogress: null, done: null },
    dragTaskId: null,
    hierarchy: {},
    charts: { burndown: null, velocity: null }
  };

  const els = {
    piFilter: document.getElementById("piFilter"),
    sprintFilter: document.getElementById("sprintFilter"),
    featureFilter: document.getElementById("featureFilter"),
    assigneeFilter: document.getElementById("assigneeFilter"),
    sortBy: document.getElementById("sortBy"),
    todoLimit: document.getElementById("todoLimit"),
    inprogressLimit: document.getElementById("inprogressLimit"),
    doneLimit: document.getElementById("doneLimit"),
    searchInput: document.getElementById("searchInput"),
    totalTasks: document.getElementById("totalTasks"),
    completedPercent: document.getElementById("completedPercent"),
    inProgressCount: document.getElementById("inProgressCount"),
    progressLabel: document.getElementById("progressLabel"),
    progressBar: document.getElementById("progressBar"),
    todoList: document.getElementById("todoList"),
    inprogressList: document.getElementById("inprogressList"),
    doneList: document.getElementById("doneList"),
    todoCount: document.getElementById("todoCount"),
    inprogressCount: document.getElementById("inprogressCount"),
    doneCount: document.getElementById("doneCount"),
    todoColumn: document.querySelector('.column[data-status="todo"]'),
    inprogressColumn: document.querySelector('.column[data-status="inprogress"]'),
    doneColumn: document.querySelector('.column[data-status="done"]'),
    logoutBtn: document.getElementById("logoutBtn"),
    modal: document.getElementById("taskModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    closeModal: document.getElementById("closeModal"),
    boardViewBtn: document.getElementById("boardViewBtn"),
    insightsViewBtn: document.getElementById("insightsViewBtn"),
    boardView: document.getElementById("boardView"),
    insightsView: document.getElementById("insightsView"),
    calendarMonth: document.getElementById("calendarMonth"),
    sprintLegend: document.getElementById("sprintLegend"),
    sprintCalendar: document.getElementById("sprintCalendar"),
    committedPoints: document.getElementById("committedPoints"),
    completedPoints: document.getElementById("completedPoints"),
    spilloverTasks: document.getElementById("spilloverTasks"),
    overdueOpen: document.getElementById("overdueOpen"),
    burndownSubtitle: document.getElementById("burndownSubtitle"),
    burndownChart: document.getElementById("burndownChart"),
    velocityChart: document.getElementById("velocityChart")
  };

  function init() {
    if (!ensureAuthenticated()) return;
    loadPreferences();
    bindEvents();
    loadData();
  }

  async function loadData() {
    try {
      const response = await fetch("data.json");
      if (!response.ok) throw new Error("Unable to load data.json");

      const raw = await response.json();
      appState.allTasks = normalizeRecords(raw);
      applyPersistedStatuses();
      appState.hierarchy = groupByHierarchy(appState.allTasks);
      appState.sprintCatalog = buildSprintCatalog(appState.allTasks);

      populateFilters(appState.allTasks);
      populateCalendarMonthOptions();
      applyPreferencesToControls();
      setActiveView(appState.activeView, false);
      applyFiltersAndRender();
    } catch (error) {
      console.error(error);
      showLoadError();
    }
  }

  function bindEvents() {
    els.piFilter.addEventListener("change", onFilterChange);
    els.sprintFilter.addEventListener("change", onFilterChange);
    els.featureFilter.addEventListener("change", onFilterChange);
    els.assigneeFilter.addEventListener("change", onFilterChange);
    els.searchInput.addEventListener("input", onSearchInput);
    els.sortBy.addEventListener("change", onSortChange);
    els.todoLimit.addEventListener("input", onWipLimitChange);
    els.inprogressLimit.addEventListener("input", onWipLimitChange);
    els.doneLimit.addEventListener("input", onWipLimitChange);
    els.logoutBtn.addEventListener("click", onLogoutClick);
    els.boardViewBtn.addEventListener("click", () => setActiveView("board"));
    els.insightsViewBtn.addEventListener("click", () => setActiveView("insights"));
    els.calendarMonth.addEventListener("change", onCalendarMonthChange);

    [els.todoList, els.inprogressList, els.doneList].forEach((list) => {
      list.addEventListener("dragover", onListDragOver);
      list.addEventListener("dragleave", onListDragLeave);
      list.addEventListener("drop", onListDrop);
    });

    els.closeModal.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function normalizeRecords(records) {
    return records.map((record, index) => {
      const cleaned = trimObjectKeys(record);
      const statusRaw = getString(cleaned.Status);
      const statusKey = normalizeStatus(statusRaw);
      const priorityRaw = getString(cleaned.Priority || cleaned.Severity || cleaned.Rank);

      const startDate = parseDate(cleaned["Start Date"]);
      const endDate = parseDate(cleaned["End Date"]);
      const sprintStartDate = parseDate(cleaned["Sprint Start Date"]);
      const sprintEndDate = parseDate(cleaned["Sprint End Date"]);
      const dueDate = endDate || sprintEndDate;

      const pi = getString(cleaned.PI) || getString(cleaned.PI_ID) || "Unspecified PI";
      const sprint = getString(cleaned.Sprint) || "Unspecified Sprint";
      const taskTitle = getString(cleaned.Task) || getString(cleaned["User Story"]) || `Task ${index + 1}`;

      return {
        id: `task-${index + 1}`,
        originalIndex: index,
        raw: cleaned,
        pi,
        sprint,
        sprintKey: `${pi}::${sprint}`,
        feature: getString(cleaned.Feature) || "Unspecified Feature",
        featureId: getString(cleaned.Feature_ID) || "-",
        story: getString(cleaned["User Story"]) || "-",
        storyId: getString(cleaned.Story_ID) || "-",
        task: taskTitle,
        assignee: getString(cleaned.Assignee) || "Unassigned",
        description: getString(cleaned.Description) || "No description",
        app: getString(cleaned.App) || "-",
        storyPoints: cleaned["Story Points"] ?? "-",
        sprintStartDate,
        sprintEndDate,
        statusRaw,
        statusKey,
        statusLabel: statusDisplay(statusKey),
        priority: normalizePriority(priorityRaw),
        priorityText: priorityRaw || "No Priority",
        startDate,
        dueDate,
        overdue: Boolean(dueDate && isPast(dueDate) && statusKey !== "done"),
        capacity: cleaned.Capacity ?? "-"
      };
    });
  }

  function trimObjectKeys(record) {
    const out = {};
    Object.keys(record).forEach((key) => {
      const safeKey = String(key).trim();
      const value = record[key];
      out[safeKey] = typeof value === "string" ? value.trim() : value;
    });
    return out;
  }

  function getString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeStatus(value) {
    const status = (value || "").toLowerCase().replace(/\s+/g, "");
    if (["done", "completed", "closed"].includes(status)) return "done";
    if (["inprogress", "active", "ongoing", "working"].includes(status)) return "inprogress";
    return "todo";
  }

  function statusDisplay(statusKey) {
    if (statusKey === "done") return "Done";
    if (statusKey === "inprogress") return "In Progress";
    return "To Do";
  }

  function normalizePriority(value) {
    const normalized = (value || "").toLowerCase();
    if (normalized.includes("high") || normalized === "p0" || normalized === "p1") return "high";
    if (normalized.includes("medium") || normalized === "p2") return "medium";
    if (normalized.includes("low") || normalized === "p3" || normalized === "p4") return "low";
    return "none";
  }

  function parseDate(value) {
    const text = getString(value);
    if (!text) return null;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isPast(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compare = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return compare < today;
  }

  function pointsOf(task) {
    const parsed = Number(task.storyPoints);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function groupByHierarchy(tasks) {
    return tasks.reduce((acc, task) => {
      if (!acc[task.pi]) acc[task.pi] = {};
      if (!acc[task.pi][task.feature]) acc[task.pi][task.feature] = {};
      if (!acc[task.pi][task.feature][task.story]) acc[task.pi][task.feature][task.story] = [];
      acc[task.pi][task.feature][task.story].push(task);
      return acc;
    }, {});
  }

  function buildSprintCatalog(tasks) {
    const map = new Map();
    tasks.forEach((task) => {
      if (!map.has(task.sprintKey)) {
        map.set(task.sprintKey, {
          key: task.sprintKey,
          sprint: task.sprint,
          pi: task.pi,
          startDate: task.sprintStartDate,
          endDate: task.sprintEndDate,
          tasks: []
        });
      }

      const sprint = map.get(task.sprintKey);
      sprint.tasks.push(task);
      if (!sprint.startDate && task.sprintStartDate) sprint.startDate = task.sprintStartDate;
      if (!sprint.endDate && task.sprintEndDate) sprint.endDate = task.sprintEndDate;
    });

    return [...map.values()].sort((a, b) => {
      const at = a.startDate ? a.startDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bt = b.startDate ? b.startDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return a.sprint.localeCompare(b.sprint);
    });
  }

  function populateFilters(tasks) {
    fillSelect(els.piFilter, collectUnique(tasks, "pi"), "All PI");
    fillSelect(els.sprintFilter, collectUnique(tasks, "sprint"), "All Sprints");
    fillSelect(els.featureFilter, collectUnique(tasks, "feature"), "All Features");
    fillSelect(els.assigneeFilter, collectUnique(tasks, "assignee"), "All Assignees");
  }

  function collectUnique(tasks, key) {
    return [...new Set(tasks.map((item) => item[key]))].sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(select, options, allLabel) {
    select.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = allLabel;
    select.appendChild(allOption);
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function populateCalendarMonthOptions() {
    const monthMap = new Map();
    appState.sprintCatalog.forEach((sprint) => {
      if (sprint.startDate) monthMap.set(monthKey(sprint.startDate), sprint.startDate);
      if (sprint.endDate) monthMap.set(monthKey(sprint.endDate), sprint.endDate);
    });
    if (monthMap.size === 0) {
      const now = new Date();
      monthMap.set(monthKey(now), now);
    }

    const sorted = [...monthMap.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
    els.calendarMonth.innerHTML = "";
    sorted.forEach(([key, date]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = date.toLocaleString(undefined, { month: "long", year: "numeric" });
      els.calendarMonth.appendChild(option);
    });

    appState.calendarMonth = appState.calendarMonth || sorted[sorted.length - 1][0];
  }

  function onFilterChange() {
    appState.filters.pi = els.piFilter.value;
    appState.filters.sprint = els.sprintFilter.value;
    appState.filters.feature = els.featureFilter.value;
    appState.filters.assignee = els.assigneeFilter.value;
    persistPreferences();
    applyFiltersAndRender();
  }

  function onSearchInput(event) {
    appState.filters.search = event.target.value.trim().toLowerCase();
    persistPreferences();
    applyFiltersAndRender();
  }

  function onSortChange(event) {
    appState.sortBy = event.target.value;
    persistPreferences();
    applyFiltersAndRender();
  }

  function onWipLimitChange() {
    appState.wipLimits.todo = parseLimitValue(els.todoLimit.value);
    appState.wipLimits.inprogress = parseLimitValue(els.inprogressLimit.value);
    appState.wipLimits.done = parseLimitValue(els.doneLimit.value);
    persistPreferences();
    applyFiltersAndRender();
  }

  function onCalendarMonthChange(event) {
    appState.calendarMonth = event.target.value;
    persistPreferences();
    renderSprintLegend();
    renderSprintCalendar();
  }

  function parseLimitValue(value) {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  }

  function applyFiltersAndRender() {
    appState.filteredTasks = appState.allTasks.filter((task) => {
      const matchesPi = appState.filters.pi === "all" || task.pi === appState.filters.pi;
      const matchesSprint = appState.filters.sprint === "all" || task.sprint === appState.filters.sprint;
      const matchesFeature = appState.filters.feature === "all" || task.feature === appState.filters.feature;
      const matchesAssignee = appState.filters.assignee === "all" || task.assignee === appState.filters.assignee;
      const matchesSearch = matchesTaskSearch(task, appState.filters.search);
      return matchesPi && matchesSprint && matchesFeature && matchesAssignee && matchesSearch;
    });

    renderBoard(appState.filteredTasks);
    updateStats(appState.filteredTasks);
    renderInsights();
  }

  function matchesTaskSearch(task, searchValue) {
    if (!searchValue) return true;
    const searchable = [
      task.task,
      task.story,
      task.storyId,
      task.feature,
      task.assignee,
      task.pi,
      task.sprint,
      task.statusLabel,
      task.description
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(searchValue);
  }

  function renderBoard(tasks) {
    clearBoardColumns();
    const buckets = { todo: [], inprogress: [], done: [] };
    tasks.forEach((task) => buckets[task.statusKey].push(task));

    buckets.todo = sortTasks(buckets.todo, appState.sortBy);
    buckets.inprogress = sortTasks(buckets.inprogress, appState.sortBy);
    buckets.done = sortTasks(buckets.done, appState.sortBy);

    renderColumn(els.todoList, buckets.todo, "No tasks in To Do");
    renderColumn(els.inprogressList, buckets.inprogress, "No tasks in progress");
    renderColumn(els.doneList, buckets.done, "No completed tasks");

    updateColumnHeader(els.todoColumn, els.todoCount, buckets.todo.length, appState.wipLimits.todo);
    updateColumnHeader(els.inprogressColumn, els.inprogressCount, buckets.inprogress.length, appState.wipLimits.inprogress);
    updateColumnHeader(els.doneColumn, els.doneCount, buckets.done.length, appState.wipLimits.done);
  }

  function sortTasks(tasks, sortBy) {
    const cloned = [...tasks];
    if (sortBy === "default") return cloned.sort((a, b) => a.originalIndex - b.originalIndex);
    if (sortBy === "dueDate") return cloned.sort((a, b) => compareDueDates(a, b) || a.originalIndex - b.originalIndex);
    if (sortBy === "priority") return cloned.sort((a, b) => comparePriority(a, b) || a.originalIndex - b.originalIndex);
    if (sortBy === "assignee") return cloned.sort((a, b) => a.assignee.localeCompare(b.assignee) || a.originalIndex - b.originalIndex);
    if (sortBy === "task") return cloned.sort((a, b) => a.task.localeCompare(b.task) || a.originalIndex - b.originalIndex);
    return cloned;
  }

  function compareDueDates(a, b) {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    return 0;
  }

  function comparePriority(a, b) {
    const rank = { high: 0, medium: 1, low: 2, none: 3 };
    return rank[a.priority] - rank[b.priority];
  }

  function updateColumnHeader(columnEl, countEl, count, limit) {
    const hasLimit = Number.isInteger(limit);
    const breached = hasLimit && count > limit;
    countEl.textContent = hasLimit ? `${count}/${limit}` : String(count);
    columnEl.classList.toggle("wip-breach", breached);
    columnEl.title = breached ? `WIP exceeded: ${count} tasks, limit ${limit}` : "";
  }

  function clearBoardColumns() {
    [els.todoList, els.inprogressList, els.doneList].forEach((list) => {
      list.innerHTML = "";
    });
  }

  function renderColumn(columnElement, tasks, emptyLabel) {
    if (tasks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-column";
      empty.textContent = emptyLabel;
      columnElement.appendChild(empty);
      return;
    }
    tasks.forEach((task) => columnElement.appendChild(createTaskCard(task)));
  }

  function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = `card ${task.overdue ? "overdue" : ""}`;
    card.draggable = true;
    card.dataset.taskId = task.id;

    const priorityClass = task.priority !== "none" ? task.priority : "";
    const priorityLabel = task.priority !== "none" ? task.priorityText : "No Priority";
    const overdueBadge = task.overdue ? '<span class="overdue-badge">Overdue</span>' : "";

    card.innerHTML = `
      <h4 class="card-title">${escapeHtml(task.task)}</h4>
      <p class="card-story">${escapeHtml(task.story)}</p>
      <div class="card-grid">
        <span><b>Feature:</b> ${escapeHtml(task.feature)}</span>
        <span><b>Story:</b> ${escapeHtml(task.storyId)}</span>
        <span><b>Assignee:</b> ${escapeHtml(task.assignee)}</span>
        <span><b>Sprint:</b> ${escapeHtml(task.sprint)}</span>
      </div>
      <div class="card-footer">
        <span class="status-badge ${task.statusKey}">${task.statusLabel}</span>
        <span class="priority-badge ${priorityClass}">${escapeHtml(priorityLabel)}</span>
        ${overdueBadge}
      </div>
    `;

    setCardAccent(card, task.priority, task.statusKey);
    card.addEventListener("dragstart", () => {
      appState.dragTaskId = task.id;
      card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => {
      appState.dragTaskId = null;
      card.style.opacity = "1";
    });
    card.addEventListener("click", () => openTaskModal(task));
    return card;
  }

  function setCardAccent(card, priority, statusKey) {
    const byPriority = { high: "#d65555", medium: "#df8f15", low: "#1f9b66" };
    const byStatus = { todo: "#b38606", inprogress: "#1671cf", done: "#0f8b58" };
    card.style.borderLeftColor = byPriority[priority] || byStatus[statusKey] || "#adb6c6";
  }

  function onListDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("is-drop-target");
  }

  function onListDragLeave(event) {
    event.currentTarget.classList.remove("is-drop-target");
  }

  function onListDrop(event) {
    event.preventDefault();
    const list = event.currentTarget;
    list.classList.remove("is-drop-target");
    const targetStatus = list.dataset.status;
    if (!appState.dragTaskId || !COLUMN_KEYS.includes(targetStatus)) return;

    updateTaskStatus(appState.dragTaskId, targetStatus);
    persistStatusMap();
    applyFiltersAndRender();
  }

  function updateTaskStatus(taskId, statusKey) {
    const task = appState.allTasks.find((item) => item.id === taskId);
    if (!task) return;
    task.statusKey = statusKey;
    task.statusLabel = statusDisplay(statusKey);
    task.statusRaw = task.statusLabel;
    task.raw.Status = task.statusLabel;
    if (statusKey === "done") task.overdue = false;
    else if (task.dueDate) task.overdue = isPast(task.dueDate);
  }

  function updateStats(tasks) {
    const total = tasks.length;
    const done = tasks.filter((task) => task.statusKey === "done").length;
    const inProgress = tasks.filter((task) => task.statusKey === "inprogress").length;
    const completion = total === 0 ? 0 : Math.round((done / total) * 100);
    els.totalTasks.textContent = String(total);
    els.completedPercent.textContent = `${completion}%`;
    els.inProgressCount.textContent = String(inProgress);
    els.progressLabel.textContent = `${completion}%`;
    els.progressBar.style.width = `${completion}%`;
  }

  function renderInsights() {
    renderSprintLegend();
    renderSprintCalendar();
    const activeSprint = getActiveSprintMeta();
    const sprintTasks = activeSprint ? activeSprint.tasks : [];
    updateAgileMetrics(sprintTasks);
    renderBurndown(activeSprint, sprintTasks);
    renderVelocity();
  }

  function getActiveSprintMeta() {
    let pool = [...appState.sprintCatalog];
    if (appState.filters.pi !== "all") pool = pool.filter((s) => s.pi === appState.filters.pi);
    if (appState.filters.sprint !== "all") pool = pool.filter((s) => s.sprint === appState.filters.sprint);
    if (pool.length === 0) return null;
    return pool[pool.length - 1];
  }

  function updateAgileMetrics(sprintTasks) {
    const committed = sprintTasks.reduce((sum, task) => sum + pointsOf(task), 0);
    const completed = sprintTasks.filter((task) => task.statusKey === "done").reduce((sum, task) => sum + pointsOf(task), 0);
    const now = new Date();
    const spillover = sprintTasks.filter((task) => task.sprintEndDate && task.sprintEndDate < now && task.statusKey !== "done").length;
    const overdue = sprintTasks.filter((task) => task.overdue && task.statusKey !== "done").length;

    els.committedPoints.textContent = String(committed);
    els.completedPoints.textContent = String(completed);
    els.spilloverTasks.textContent = String(spillover);
    els.overdueOpen.textContent = String(overdue);
  }

  function renderBurndown(sprintMeta, sprintTasks) {
    if (!els.burndownChart || typeof window.Chart === "undefined") return;
    if (appState.charts.burndown) appState.charts.burndown.destroy();

    if (!sprintMeta || !sprintMeta.startDate || !sprintMeta.endDate) {
      els.burndownSubtitle.textContent = "No sprint date range available";
      appState.charts.burndown = new window.Chart(els.burndownChart, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: { plugins: { legend: { display: false } } }
      });
      return;
    }

    const dates = getDateRange(sprintMeta.startDate, sprintMeta.endDate);
    const labels = dates.map((d) => `${d.getDate()}/${d.getMonth() + 1}`);
    const total = sprintTasks.reduce((sum, task) => sum + pointsOf(task), 0);
    const completed = sprintTasks.filter((task) => task.statusKey === "done").reduce((sum, task) => sum + pointsOf(task), 0);
    const ideal = labels.map((_, i) => (labels.length === 1 ? 0 : Number((total - (total * i) / (labels.length - 1)).toFixed(2))));
    const elapsed = getElapsedDaysInSprint(sprintMeta.startDate, sprintMeta.endDate);
    const remainingNow = Math.max(total - completed, 0);

    const actual = labels.map((_, i) => {
      if (elapsed <= 1) return i === 0 ? total : remainingNow;
      if (i < elapsed) {
        const burn = (total - remainingNow) * (i / (elapsed - 1));
        return Number((total - burn).toFixed(2));
      }
      return remainingNow;
    });

    els.burndownSubtitle.textContent = `${sprintMeta.sprint} (${formatDate(sprintMeta.startDate)} - ${formatDate(sprintMeta.endDate)})`;

    appState.charts.burndown = new window.Chart(els.burndownChart, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Ideal Remaining", data: ideal, borderColor: "#8aa2bf", borderDash: [6, 4], tension: 0.2 },
          { label: "Actual Remaining", data: actual, borderColor: "#0f5bd8", backgroundColor: "rgba(15, 91, 216, 0.14)", fill: true, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, title: { display: true, text: "Story Points" } } }
      }
    });
  }

  function getDateRange(start, end) {
    const result = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= last) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  function getElapsedDaysInSprint(start, end) {
    const today = new Date();
    const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (todayOnly <= startOnly) return 1;
    if (todayOnly >= endOnly) return getDateRange(startOnly, endOnly).length;
    return getDateRange(startOnly, todayOnly).length;
  }

  function renderVelocity() {
    if (!els.velocityChart || typeof window.Chart === "undefined") return;
    if (appState.charts.velocity) appState.charts.velocity.destroy();

    const sprints = appState.sprintCatalog.slice(-8);
    const labels = sprints.map((s) => s.sprint);
    const committed = sprints.map((s) => s.tasks.reduce((sum, t) => sum + pointsOf(t), 0));
    const completed = sprints.map((s) => s.tasks.filter((t) => t.statusKey === "done").reduce((sum, t) => sum + pointsOf(t), 0));

    appState.charts.velocity = new window.Chart(els.velocityChart, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Committed", data: committed, backgroundColor: "#b8d4fb" },
          { label: "Completed", data: completed, backgroundColor: "#2c78df" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, title: { display: true, text: "Story Points" } } }
      }
    });
  }

  function renderSprintLegend() {
    els.sprintLegend.innerHTML = "";
    const monthSprints = getSprintsForSelectedMonth();
    if (monthSprints.length === 0) {
      const chip = document.createElement("span");
      chip.className = "sprint-chip";
      chip.textContent = "No sprint in this month";
      chip.style.cursor = "default";
      els.sprintLegend.appendChild(chip);
      return;
    }

    monthSprints.forEach((sprint) => {
      const chip = document.createElement("button");
      chip.className = "sprint-chip";
      chip.type = "button";
      const done = sprint.tasks.filter((t) => t.statusKey === "done").length;
      chip.textContent = `${sprint.sprint} (${done}/${sprint.tasks.length})`;
      chip.addEventListener("click", () => {
        els.sprintFilter.value = sprint.sprint;
        appState.filters.sprint = sprint.sprint;
        persistPreferences();
        applyFiltersAndRender();
      });
      els.sprintLegend.appendChild(chip);
    });
  }

  function getSprintsForSelectedMonth() {
    const [yearText, monthText] = appState.calendarMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    const target = new Date(year, month, 1);

    return appState.sprintCatalog.filter((sprint) => {
      if (!sprint.startDate || !sprint.endDate) return false;
      const sprintStartMonth = new Date(sprint.startDate.getFullYear(), sprint.startDate.getMonth(), 1);
      const sprintEndMonth = new Date(sprint.endDate.getFullYear(), sprint.endDate.getMonth(), 1);
      return target >= sprintStartMonth && target <= sprintEndMonth;
    });
  }

  function renderSprintCalendar() {
    els.sprintCalendar.innerHTML = "";
    const [yearText, monthText] = appState.calendarMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label) => {
      const head = document.createElement("div");
      head.className = "cal-head";
      head.textContent = label;
      els.sprintCalendar.appendChild(head);
    });

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const leading = first.getDay();
    const totalCells = Math.ceil((leading + last.getDate()) / 7) * 7;

    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - leading + 1;
      const current = new Date(year, month, dayNumber);
      const inMonth = current.getMonth() === month;

      const day = document.createElement("div");
      day.className = `cal-day ${inMonth ? "" : "muted"}`;

      const num = document.createElement("div");
      num.className = "cal-day-num";
      num.textContent = String(current.getDate());
      day.appendChild(num);

      const sprints = sprintsOnDate(current);
      if (sprints.length > 0) {
        const stack = document.createElement("div");
        stack.className = "cal-sprints";

        sprints.slice(0, 2).forEach((sprint) => {
          const pill = document.createElement("span");
          pill.className = "cal-pill";
          pill.textContent = sprint.sprint;
          stack.appendChild(pill);
        });

        if (sprints.length > 2) {
          const extra = document.createElement("span");
          extra.className = "cal-pill";
          extra.textContent = `+${sprints.length - 2} more`;
          stack.appendChild(extra);
        }

        day.appendChild(stack);
      }

      els.sprintCalendar.appendChild(day);
    }
  }

  function sprintsOnDate(date) {
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return appState.sprintCatalog.filter((sprint) => {
      if (!sprint.startDate || !sprint.endDate) return false;
      const start = new Date(sprint.startDate.getFullYear(), sprint.startDate.getMonth(), sprint.startDate.getDate());
      const end = new Date(sprint.endDate.getFullYear(), sprint.endDate.getMonth(), sprint.endDate.getDate());
      return current >= start && current <= end;
    });
  }

  function setActiveView(view, persist = true) {
    appState.activeView = view === "insights" ? "insights" : "board";
    const board = appState.activeView === "board";
    els.boardView.classList.toggle("is-hidden", !board);
    els.insightsView.classList.toggle("is-hidden", board);
    els.boardViewBtn.classList.toggle("is-active", board);
    els.insightsViewBtn.classList.toggle("is-active", !board);
    if (persist) persistPreferences();
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function openTaskModal(task) {
    const formattedDueDate = task.dueDate ? task.dueDate.toLocaleDateString() : "-";
    const formattedStartDate = task.startDate ? task.startDate.toLocaleDateString() : "-";

    els.modalTitle.textContent = task.task;
    els.modalBody.innerHTML = `
      ${modalRow("PI", task.pi)}
      ${modalRow("Sprint", task.sprint)}
      ${modalRow("Feature", `${task.feature} (${task.featureId})`)}
      ${modalRow("Story", `${task.storyId} - ${task.story}`)}
      ${modalRow("Assignee", task.assignee)}
      ${modalRow("Status", task.statusLabel)}
      ${modalRow("Priority", task.priorityText)}
      ${modalRow("Story Points", String(task.storyPoints))}
      ${modalRow("Start Date", formattedStartDate)}
      ${modalRow("End Date", formattedDueDate)}
      ${modalRow("App", task.app)}
      ${modalRow("Description", task.description)}
    `;

    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
  }

  function modalRow(label, value) {
    return `<div class="modal-row"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</div>`;
  }

  function closeModal() {
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
  }

  function showLoadError() {
    clearBoardColumns();
    const errorMessage = document.createElement("div");
    errorMessage.className = "empty-column";
    errorMessage.textContent = "Could not load planning data. Please verify data.json is available.";
    els.todoList.appendChild(errorMessage);
  }

  function applyPersistedStatuses() {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.statusMap);
      if (!json) return;
      const statusMap = JSON.parse(json);
      appState.allTasks.forEach((task) => {
        const savedStatus = statusMap[task.id];
        if (COLUMN_KEYS.includes(savedStatus)) updateTaskStatus(task.id, savedStatus);
      });
    } catch (error) {
      console.warn("Could not restore task statuses", error);
    }
  }

  function persistStatusMap() {
    try {
      const statusMap = appState.allTasks.reduce((acc, task) => {
        acc[task.id] = task.statusKey;
        return acc;
      }, {});
      localStorage.setItem(STORAGE_KEYS.statusMap, JSON.stringify(statusMap));
    } catch (error) {
      console.warn("Could not persist task statuses", error);
    }
  }

  function loadPreferences() {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.preferences);
      if (!json) return;
      const prefs = JSON.parse(json);

      if (prefs.filters) {
        appState.filters.pi = prefs.filters.pi || "all";
        appState.filters.sprint = prefs.filters.sprint || "all";
        appState.filters.feature = prefs.filters.feature || "all";
        appState.filters.assignee = prefs.filters.assignee || "all";
        appState.filters.search = prefs.filters.search || "";
      }

      if (prefs.sortBy) appState.sortBy = prefs.sortBy;
      if (prefs.activeView) appState.activeView = prefs.activeView;
      if (prefs.calendarMonth) appState.calendarMonth = prefs.calendarMonth;

      if (prefs.wipLimits) {
        appState.wipLimits.todo = Number.isInteger(prefs.wipLimits.todo) ? prefs.wipLimits.todo : null;
        appState.wipLimits.inprogress = Number.isInteger(prefs.wipLimits.inprogress) ? prefs.wipLimits.inprogress : null;
        appState.wipLimits.done = Number.isInteger(prefs.wipLimits.done) ? prefs.wipLimits.done : null;
      }
    } catch (error) {
      console.warn("Could not load preferences", error);
    }
  }

  function persistPreferences() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.preferences,
        JSON.stringify({
          filters: appState.filters,
          sortBy: appState.sortBy,
          wipLimits: appState.wipLimits,
          activeView: appState.activeView,
          calendarMonth: appState.calendarMonth
        })
      );
    } catch (error) {
      console.warn("Could not persist preferences", error);
    }
  }

  function applyPreferencesToControls() {
    setSelectValue(els.piFilter, appState.filters.pi);
    setSelectValue(els.sprintFilter, appState.filters.sprint);
    setSelectValue(els.featureFilter, appState.filters.feature);
    setSelectValue(els.assigneeFilter, appState.filters.assignee);

    els.searchInput.value = appState.filters.search;
    els.sortBy.value = appState.sortBy;
    els.todoLimit.value = appState.wipLimits.todo ?? "";
    els.inprogressLimit.value = appState.wipLimits.inprogress ?? "";
    els.doneLimit.value = appState.wipLimits.done ?? "";

    const monthValues = Array.from(els.calendarMonth.options).map((opt) => opt.value);
    els.calendarMonth.value = monthValues.includes(appState.calendarMonth) ? appState.calendarMonth : monthValues[0];
    appState.calendarMonth = els.calendarMonth.value;
  }

  function setSelectValue(selectEl, value) {
    const values = Array.from(selectEl.options).map((opt) => opt.value);
    selectEl.value = values.includes(value) ? value : "all";

    if (selectEl === els.piFilter) appState.filters.pi = selectEl.value;
    if (selectEl === els.sprintFilter) appState.filters.sprint = selectEl.value;
    if (selectEl === els.featureFilter) appState.filters.feature = selectEl.value;
    if (selectEl === els.assigneeFilter) appState.filters.assignee = selectEl.value;
  }

  function ensureAuthenticated() {
    if (!window.AuthGate || !window.AuthGate.isAuthenticated()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  function onLogoutClick() {
    if (window.AuthGate) window.AuthGate.clearSession();
    window.location.href = "login.html";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
