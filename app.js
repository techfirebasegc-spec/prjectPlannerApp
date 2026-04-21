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
    filters: {
      pi: "all",
      sprint: "all",
      feature: "all",
      assignee: "all",
      search: ""
    },
    sortBy: "default",
    wipLimits: {
      todo: null,
      inprogress: null,
      done: null
    },
    dragTaskId: null,
    hierarchy: {}
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
    closeModal: document.getElementById("closeModal")
  };

  function init() {
    if (!ensureAuthenticated()) {
      return;
    }

    loadPreferences();
    bindEvents();
    loadData();
  }

  async function loadData() {
    try {
      const response = await fetch("data.json");
      if (!response.ok) {
        throw new Error("Unable to load data.json");
      }

      const raw = await response.json();
      appState.allTasks = normalizeRecords(raw);
      applyPersistedStatuses();
      appState.hierarchy = groupByHierarchy(appState.allTasks);

      populateFilters(appState.allTasks);
      applyPreferencesToControls();
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

    [els.todoList, els.inprogressList, els.doneList].forEach((list) => {
      list.addEventListener("dragover", onListDragOver);
      list.addEventListener("dragleave", onListDragLeave);
      list.addEventListener("drop", onListDrop);
    });

    els.closeModal.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  function normalizeRecords(records) {
    return records.map((record, index) => {
      const cleaned = trimObjectKeys(record);
      const statusRaw = getString(cleaned.Status);
      const statusKey = normalizeStatus(statusRaw);
      const statusLabel = statusDisplay(statusKey);
      const priorityRaw = getString(cleaned.Priority || cleaned.Severity || cleaned.Rank);
      const priority = normalizePriority(priorityRaw);

      const startDate = parseDate(cleaned["Start Date"]);
      const endDate = parseDate(cleaned["End Date"]);
      const sprintEndDate = parseDate(cleaned["Sprint End Date"]);
      const dueDate = endDate || sprintEndDate;
      const overdue = Boolean(dueDate && isPast(dueDate) && statusKey !== "done");

      const taskTitle = getString(cleaned.Task) || getString(cleaned["User Story"]) || `Task ${index + 1}`;

      return {
        id: `task-${index + 1}`,
        originalIndex: index,
        raw: cleaned,
        pi: getString(cleaned.PI) || getString(cleaned.PI_ID) || "Unspecified PI",
        sprint: getString(cleaned.Sprint) || "Unspecified Sprint",
        feature: getString(cleaned.Feature) || "Unspecified Feature",
        featureId: getString(cleaned.Feature_ID) || "-",
        story: getString(cleaned["User Story"]) || "-",
        storyId: getString(cleaned.Story_ID) || "-",
        task: taskTitle,
        assignee: getString(cleaned.Assignee) || "Unassigned",
        description: getString(cleaned.Description) || "No description",
        app: getString(cleaned.App) || "-",
        storyPoints: cleaned["Story Points"] ?? "-",
        statusRaw,
        statusKey,
        statusLabel,
        priority,
        priorityText: priorityRaw || "No Priority",
        startDate,
        dueDate,
        overdue,
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

    if (["done", "completed", "closed"].includes(status)) {
      return "done";
    }

    if (["inprogress", "active", "ongoing", "working"].includes(status)) {
      return "inprogress";
    }

    return "todo";
  }

  function statusDisplay(statusKey) {
    if (statusKey === "done") {
      return "Done";
    }

    if (statusKey === "inprogress") {
      return "In Progress";
    }

    return "To Do";
  }

  function normalizePriority(value) {
    const normalized = (value || "").toLowerCase();
    if (normalized.includes("high") || normalized === "p0" || normalized === "p1") {
      return "high";
    }

    if (normalized.includes("medium") || normalized === "p2") {
      return "medium";
    }

    if (normalized.includes("low") || normalized === "p3" || normalized === "p4") {
      return "low";
    }

    return "none";
  }

  function parseDate(value) {
    const text = getString(value);
    if (!text) {
      return null;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isPast(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compare = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return compare < today;
  }

  function groupByHierarchy(tasks) {
    return tasks.reduce((acc, task) => {
      if (!acc[task.pi]) {
        acc[task.pi] = {};
      }

      if (!acc[task.pi][task.feature]) {
        acc[task.pi][task.feature] = {};
      }

      if (!acc[task.pi][task.feature][task.story]) {
        acc[task.pi][task.feature][task.story] = [];
      }

      acc[task.pi][task.feature][task.story].push(task);
      return acc;
    }, {});
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

  function parseLimitValue(value) {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return Math.floor(parsed);
  }

  function applyFiltersAndRender() {
    appState.filteredTasks = appState.allTasks.filter((task) => {
      const matchesPi = appState.filters.pi === "all" || task.pi === appState.filters.pi;
      const matchesSprint = appState.filters.sprint === "all" || task.sprint === appState.filters.sprint;
      const matchesFeature = appState.filters.feature === "all" || task.feature === appState.filters.feature;
      const matchesAssignee =
        appState.filters.assignee === "all" || task.assignee === appState.filters.assignee;
      const matchesSearch = matchesTaskSearch(task, appState.filters.search);
      return matchesPi && matchesSprint && matchesFeature && matchesAssignee && matchesSearch;
    });

    renderBoard(appState.filteredTasks);
    updateStats(appState.filteredTasks);
  }

  function matchesTaskSearch(task, searchValue) {
    if (!searchValue) {
      return true;
    }

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

    const buckets = {
      todo: [],
      inprogress: [],
      done: []
    };

    tasks.forEach((task) => {
      buckets[task.statusKey].push(task);
    });

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

    if (sortBy === "default") {
      return cloned.sort((a, b) => a.originalIndex - b.originalIndex);
    }

    if (sortBy === "dueDate") {
      return cloned.sort((a, b) => compareDueDates(a, b) || a.originalIndex - b.originalIndex);
    }

    if (sortBy === "priority") {
      return cloned.sort((a, b) => comparePriority(a, b) || a.originalIndex - b.originalIndex);
    }

    if (sortBy === "assignee") {
      return cloned.sort((a, b) => a.assignee.localeCompare(b.assignee) || a.originalIndex - b.originalIndex);
    }

    if (sortBy === "task") {
      return cloned.sort((a, b) => a.task.localeCompare(b.task) || a.originalIndex - b.originalIndex);
    }

    return cloned;
  }

  function compareDueDates(a, b) {
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }

    if (!a.dueDate && b.dueDate) {
      return 1;
    }

    if (a.dueDate && !b.dueDate) {
      return -1;
    }

    return 0;
  }

  function comparePriority(a, b) {
    const rank = {
      high: 0,
      medium: 1,
      low: 2,
      none: 3
    };
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

    tasks.forEach((task) => {
      columnElement.appendChild(createTaskCard(task));
    });
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
    const byPriority = {
      high: "#d65555",
      medium: "#df8f15",
      low: "#1f9b66"
    };

    const byStatus = {
      todo: "#b38606",
      inprogress: "#1671cf",
      done: "#0f8b58"
    };

    const accent = byPriority[priority] || byStatus[statusKey] || "#adb6c6";
    card.style.borderLeftColor = accent;
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
    if (!appState.dragTaskId || !COLUMN_KEYS.includes(targetStatus)) {
      return;
    }

    updateTaskStatus(appState.dragTaskId, targetStatus);
    persistStatusMap();
    applyFiltersAndRender();
  }

  function updateTaskStatus(taskId, statusKey) {
    const task = appState.allTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    task.statusKey = statusKey;
    task.statusLabel = statusDisplay(statusKey);
    task.statusRaw = task.statusLabel;
    task.raw.Status = task.statusLabel;

    if (statusKey === "done") {
      task.overdue = false;
    } else if (task.dueDate) {
      task.overdue = isPast(task.dueDate);
    }
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
      if (!json) {
        return;
      }

      const statusMap = JSON.parse(json);
      appState.allTasks.forEach((task) => {
        const savedStatus = statusMap[task.id];
        if (COLUMN_KEYS.includes(savedStatus)) {
          updateTaskStatus(task.id, savedStatus);
        }
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
      if (!json) {
        return;
      }

      const prefs = JSON.parse(json);
      if (prefs.filters) {
        appState.filters.pi = prefs.filters.pi || "all";
        appState.filters.sprint = prefs.filters.sprint || "all";
        appState.filters.feature = prefs.filters.feature || "all";
        appState.filters.assignee = prefs.filters.assignee || "all";
        appState.filters.search = prefs.filters.search || "";
      }

      if (prefs.sortBy) {
        appState.sortBy = prefs.sortBy;
      }

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
          wipLimits: appState.wipLimits
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
  }

  function setSelectValue(selectEl, value) {
    const values = Array.from(selectEl.options).map((opt) => opt.value);
    selectEl.value = values.includes(value) ? value : "all";

    if (selectEl === els.piFilter) {
      appState.filters.pi = selectEl.value;
    }

    if (selectEl === els.sprintFilter) {
      appState.filters.sprint = selectEl.value;
    }

    if (selectEl === els.featureFilter) {
      appState.filters.feature = selectEl.value;
    }

    if (selectEl === els.assigneeFilter) {
      appState.filters.assignee = selectEl.value;
    }
  }

  function ensureAuthenticated() {
    if (!window.AuthGate || !window.AuthGate.isAuthenticated()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  function onLogoutClick() {
    if (window.AuthGate) {
      window.AuthGate.clearSession();
    }
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
