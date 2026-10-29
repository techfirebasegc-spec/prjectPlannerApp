import {
  addDoc, collection, collectionGroup, deleteDoc, doc, getDocs, getDoc, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch
} from "firebase/firestore";
import { db } from "./firebase.js";
import { getAuthenticatedPlannerUser, signOutUser, updatePlannerProfile } from "./auth.js";

(() => {
  "use strict";

  const COLUMN_KEYS = ["todo", "inprogress", "done"];
  const STORAGE_KEYS = {
    statusMap: "cliniqPlanner.statusMap.v1",
    preferences: "cliniqPlanner.preferences.v1"
  };

  const appState = {
    allTasks: [],
    userStories: [],
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
    listSort: { key: "default", direction: "asc" },
    selectedTaskIds: new Set(),
    activeView: "board",
    calendarMonth: "",
    wipLimits: { todo: null, inprogress: null, done: null },
    dragTaskId: null,
    hierarchy: {},
    charts: { burndown: null, velocity: null },
    user: null,
    unsubscribeTasks: null,
    unsubscribeStories: null,
    editingStoryId: null,
    showArchivedStories: false,
    storyViewMode: "list",
    expandedStoryTaskIds: new Set(),
    unsubscribeProjects: null,
    unsubscribeOwnedProjects: null,
    unsubscribeUserProjectPointers: null,
    unsubscribeMembers: null,
    projects: [],
    ownedProjects: [],
    memberProjects: [],
    pointerProjects: [],
    activeProjectId: "default",
    editingTaskId: null,
    viewedTaskId: null,
    selectedMember: null,
    editingProjectId: null
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
    todoStat: document.getElementById("todoStat"),
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
    appShell: document.querySelector(".app-shell"),
    sidebarToggleBtn: document.getElementById("sidebarToggleBtn"),
    currentUserName: document.getElementById("currentUserName"),
    accountMenuBtn: document.getElementById("accountMenuBtn"),
    accountMenu: document.getElementById("accountMenu"),
    settingsBtn: document.getElementById("settingsBtn"),
    projectSelect: document.getElementById("projectSelect"),
    newProjectBtn: document.getElementById("newProjectBtn"),
    editProjectBtn: document.getElementById("editProjectBtn"),
    archiveProjectBtn: document.getElementById("archiveProjectBtn"),
    modal: document.getElementById("taskModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    closeModal: document.getElementById("closeModal"),
    editTaskBtn: document.getElementById("editTaskBtn"),
    copyTaskBtn: document.getElementById("copyTaskBtn"),
    deleteTaskBtn: document.getElementById("deleteTaskBtn"),
    taskStatusSelect: document.getElementById("taskStatusSelect"),
    saveStatusBtn: document.getElementById("saveStatusBtn"),
    newTaskBtn: document.getElementById("newTaskBtn"),
    taskEditorModal: document.getElementById("taskEditorModal"),
    taskEditorForm: document.getElementById("taskEditorForm"),
    closeTaskEditor: document.getElementById("closeTaskEditor"),
    cancelTaskEditor: document.getElementById("cancelTaskEditor"),
    saveTaskBtn: document.getElementById("saveTaskBtn"),
    taskEditorError: document.getElementById("taskEditorError"),
    newTaskName: document.getElementById("newTaskName"),
    projectEditorModal: document.getElementById("projectEditorModal"),
    projectEditorForm: document.getElementById("projectEditorForm"),
    closeProjectEditor: document.getElementById("closeProjectEditor"),
    cancelProjectEditor: document.getElementById("cancelProjectEditor"),
    saveProjectBtn: document.getElementById("saveProjectBtn"),
    projectEditorError: document.getElementById("projectEditorError"),
    newProjectName: document.getElementById("newProjectName"),
    membersBtn: document.getElementById("membersBtn"),
    membersModal: document.getElementById("membersModal"),
    closeMembers: document.getElementById("closeMembers"),
    memberForm: document.getElementById("memberForm"),
    memberSelect: document.getElementById("memberSelect"),
    saveMemberBtn: document.getElementById("saveMemberBtn"),
    memberError: document.getElementById("memberError"),
    memberList: document.getElementById("memberList"),
    boardViewBtn: document.getElementById("boardViewBtn"),
    listViewBtn: document.getElementById("listViewBtn"),
    insightsViewBtn: document.getElementById("insightsViewBtn"),
    knowledgeViewBtn: document.getElementById("knowledgeViewBtn"),
    knowledgeView: document.getElementById("knowledgeView"),
    storiesViewBtn: document.getElementById("storiesViewBtn"),
    sidebarStoriesBtn: document.getElementById("sidebarStoriesBtn"),
    newStoryBtn: document.getElementById("newStoryBtn"),
    storyEditorModal: document.getElementById("storyEditorModal"),
    storyEditorForm: document.getElementById("storyEditorForm"),
    storyEditorTitle: document.getElementById("storyEditorTitle"),
    storyTitleInput: document.getElementById("storyTitleInput"),
    storyDescriptionInput: document.getElementById("storyDescriptionInput"),
    storyCriteriaInput: document.getElementById("storyCriteriaInput"),
    storyPiInput: document.getElementById("storyPiInput"),
    storyFeatureInput: document.getElementById("storyFeatureInput"),
    storyStartDateInput: document.getElementById("storyStartDateInput"),
    storyEndDateInput: document.getElementById("storyEndDateInput"),
    storyEditorError: document.getElementById("storyEditorError"),
    saveStoryBtn: document.getElementById("saveStoryBtn"),
    cancelStoryEditor: document.getElementById("cancelStoryEditor"),
    closeStoryEditor: document.getElementById("closeStoryEditor"),
    storiesView: document.getElementById("storiesView"),
    storiesGrid: document.getElementById("storiesGrid"),
    toggleArchivedStoriesBtn: document.getElementById("toggleArchivedStoriesBtn"),
    storiesSummary: document.getElementById("storiesSummary"),
    userStoryOptions: document.getElementById("userStoryOptions"),
    taskUserStoryInput: document.getElementById("taskUserStoryInput"),
    profileViewBtn: document.getElementById("profileViewBtn"),
    boardView: document.getElementById("boardView"),
    listView: document.getElementById("listView"),
    taskTableBody: document.getElementById("taskTableBody"),
    listSummary: document.getElementById("listSummary"),
    selectAllTasks: document.getElementById("selectAllTasks"),
    archiveSelectedTasksBtn: document.getElementById("archiveSelectedTasksBtn"),
    bulkTaskStatus: document.getElementById("bulkTaskStatus"),
    applyBulkStatusBtn: document.getElementById("applyBulkStatusBtn"),
    insightsView: document.getElementById("insightsView"),
    profileView: document.getElementById("profileView"),
    profileFirstName: document.getElementById("profileFirstName"),
    profileLastName: document.getElementById("profileLastName"),
    profileEmail: document.getElementById("profileEmail"),
    profileUid: document.getElementById("profileUid"),
    profileProject: document.getElementById("profileProject"),
    profileRole: document.getElementById("profileRole"),
    profileForm: document.getElementById("profileForm"),
    profileFirstNameInput: document.getElementById("profileFirstNameInput"),
    profileLastNameInput: document.getElementById("profileLastNameInput"),
    saveProfileBtn: document.getElementById("saveProfileBtn"),
    profileError: document.getElementById("profileError"),
    profileAccessList: document.getElementById("profileAccessList"),
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

  async function init() {
    const session = await getAuthenticatedPlannerUser();
    if (!session.user) {
      window.location.replace("login.html");
      return;
    }
    if (session.reason) {
      window.location.replace("login.html");
      return;
    }

    appState.user = session.user;
    els.currentUserName.textContent = session.user.displayName || session.user.email || "Signed-in user";
    updateAccountAvatar(els.currentUserName.textContent);
    els.newTaskBtn.addEventListener("click", openTaskEditor);
    loadPreferences();
    bindEvents();
    if (window.matchMedia("(max-width: 1100px)").matches) setSidebarCollapsed(true);
    loadProjects();
  }

  function loadProjects() {
    if (appState.unsubscribeProjects) appState.unsubscribeProjects();
    if (appState.unsubscribeOwnedProjects) appState.unsubscribeOwnedProjects();
    if (appState.unsubscribeUserProjectPointers) appState.unsubscribeUserProjectPointers();
    const ownedProjects = query(collection(db, "plannerProjects"), where("ownerId", "==", appState.user.uid));
    appState.unsubscribeOwnedProjects = onSnapshot(ownedProjects, (snapshot) => {
      appState.ownedProjects = snapshot.docs.map((project) => ({
        id: project.id,
        ...project.data(),
        role: "owner"
      }));
      syncProjects();
    }, (error) => {
      console.error("Could not load owned projects", error);
      showProjectLoadError();
    });

    const memberships = query(collectionGroup(db, "members"), where("uid", "==", appState.user.uid));
    appState.unsubscribeProjects = onSnapshot(memberships, async (snapshot) => {
      const projects = await Promise.all(snapshot.docs.map(async (member) => {
        try {
          const projectId = member.ref.parent.parent.id;
          const project = await getDoc(doc(db, "plannerProjects", projectId));
          return project.exists() ? { id: project.id, ...project.data(), role: member.data().role } : null;
        } catch (error) {
          console.warn("Skipping an unavailable project membership", error);
          return null;
        }
      }));
      appState.memberProjects = projects.filter(Boolean);
      syncProjects();
    }, (error) => {
      console.error("Could not load projects", error);
      appState.memberProjects = [];
      syncProjects();
    });

    const pointers = collection(db, "plannerUserProjects", appState.user.uid, "projects");
    appState.unsubscribeUserProjectPointers = onSnapshot(pointers, async (snapshot) => {
      const projects = await Promise.all(snapshot.docs.map(async (pointer) => {
        try {
          const project = await getDoc(doc(db, "plannerProjects", pointer.id));
          return project.exists() ? { id: project.id, ...project.data(), role: pointer.data().role } : null;
        } catch (error) {
          console.warn("Skipping an unavailable project access record", error);
          return null;
        }
      }));
      appState.pointerProjects = projects.filter(Boolean);
      syncProjects();
    }, (error) => {
      console.error("Could not load project access", error);
      appState.pointerProjects = [];
      syncProjects();
    });
  }

  function syncProjects() {
    const byId = new Map();
    [...appState.memberProjects, ...appState.pointerProjects, ...appState.ownedProjects]
      .filter((project) => project.archived !== true)
      .forEach((project) => byId.set(project.id, project));
    appState.projects = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    populateProjectSelect();
    loadData();
  }

  function showProjectLoadError() {
    const error = document.createElement("option");
    error.value = "default";
    error.textContent = "Default Project";
    els.projectSelect.innerHTML = "";
    els.projectSelect.appendChild(error);
  }

  function populateProjectSelect() {
    const selected = appState.activeProjectId;
    els.projectSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "default";
    defaultOption.textContent = "Default Project";
    els.projectSelect.appendChild(defaultOption);
    appState.projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      els.projectSelect.appendChild(option);
    });
    els.projectSelect.value = appState.projects.some((project) => project.id === selected) || selected === "default" ? selected : "default";
    appState.activeProjectId = els.projectSelect.value;
    updateMembersControl();
  }

  function loadData() {
    if (appState.unsubscribeTasks) appState.unsubscribeTasks();
    if (appState.unsubscribeStories) appState.unsubscribeStories();
    appState.unsubscribeStories = onSnapshot(userStoryCollection(), (snapshot) => {
      appState.userStories = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      applyFiltersAndRender();
    }, (error) => {
      console.error("Could not load user stories", error);
      appState.userStories = [];
      applyFiltersAndRender();
    });
    appState.unsubscribeTasks = onSnapshot(taskCollection(), (snapshot) => {
      const raw = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      appState.allTasks = normalizeRecords(raw).filter((task) => task.archived !== true);
      appState.selectedTaskIds = new Set([...appState.selectedTaskIds].filter((taskId) => appState.allTasks.some((task) => task.id === taskId)));
      appState.hierarchy = groupByHierarchy(appState.allTasks);
      appState.sprintCatalog = buildSprintCatalog(appState.allTasks);

      populateFilters(appState.allTasks);
      populateCalendarMonthOptions();
      applyPreferencesToControls();
      setActiveView(appState.activeView, false);
      applyFiltersAndRender();
    }, (error) => {
      console.error(error);
      showLoadError();
    });
  }

  function bindEvents() {
    els.piFilter.addEventListener("change", onFilterChange);
    els.sprintFilter.addEventListener("change", onFilterChange);
    els.featureFilter.addEventListener("change", onFilterChange);
    els.assigneeFilter.addEventListener("change", onFilterChange);
    els.searchInput.addEventListener("input", onSearchInput);
    els.sortBy.addEventListener("change", onSortChange);
    els.selectAllTasks.addEventListener("change", toggleAllVisibleTasks);
    els.archiveSelectedTasksBtn.addEventListener("click", archiveSelectedTasks);
    els.applyBulkStatusBtn.addEventListener("click", updateSelectedTaskStatuses);
    document.querySelectorAll(".list-sort-button").forEach((button) => {
      button.addEventListener("click", () => onListSort(button.dataset.listSort));
    });
    els.todoLimit.addEventListener("input", onWipLimitChange);
    els.inprogressLimit.addEventListener("input", onWipLimitChange);
    els.doneLimit.addEventListener("input", onWipLimitChange);
    els.logoutBtn.addEventListener("click", onLogoutClick);
    els.sidebarToggleBtn.addEventListener("click", () => setSidebarCollapsed(!els.appShell.classList.contains("sidebar-collapsed")));
    document.querySelectorAll("[data-sidebar-expand]").forEach((button) => {
      button.addEventListener("click", () => setSidebarCollapsed(false));
    });
    els.accountMenuBtn.addEventListener("click", toggleAccountMenu);
    els.settingsBtn.addEventListener("click", () => {
      closeAccountMenu();
      setActiveView("profile");
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".account-menu-wrap")) closeAccountMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAccountMenu();
    });
    els.projectSelect.addEventListener("change", onProjectChange);
    els.newProjectBtn.addEventListener("click", openProjectEditor);
    els.editProjectBtn.addEventListener("click", () => {
      const project = appState.projects.find((item) => item.id === appState.activeProjectId);
      if (project) openProjectEditor(project);
    });
    els.archiveProjectBtn.addEventListener("click", archiveActiveProject);
    els.membersBtn.addEventListener("click", openMembers);
    els.boardViewBtn.addEventListener("click", () => setActiveView("board"));
    els.listViewBtn.addEventListener("click", () => setActiveView("list"));
    els.insightsViewBtn.addEventListener("click", () => setActiveView("insights"));
    els.knowledgeViewBtn?.addEventListener("click", () => setActiveView("knowledge"));
    els.storiesViewBtn.addEventListener("click", () => setActiveView("stories"));
    els.sidebarStoriesBtn?.addEventListener("click", () => { setActiveView("stories"); if (window.matchMedia("(max-width: 1100px)").matches) setSidebarCollapsed(true); });
    els.newStoryBtn.addEventListener("click", () => openStoryEditor());
    els.storiesGrid.classList.add("stories-grid-list");
    els.toggleArchivedStoriesBtn.addEventListener("click", () => {
      appState.showArchivedStories = !appState.showArchivedStories;
      els.toggleArchivedStoriesBtn.textContent = appState.showArchivedStories ? "Show active" : "Show archived";
      els.toggleArchivedStoriesBtn.setAttribute("aria-pressed", String(appState.showArchivedStories));
      renderUserStories(appState.filteredTasks);
    });
    els.storyEditorForm.addEventListener("submit", saveUserStory);
    els.cancelStoryEditor.addEventListener("click", closeStoryEditor);
    els.closeStoryEditor.addEventListener("click", closeStoryEditor);
    els.storyEditorModal.addEventListener("click", (event) => { if (event.target === els.storyEditorModal) closeStoryEditor(); });
    els.profileViewBtn.addEventListener("click", () => setActiveView("profile"));
    els.profileForm.addEventListener("submit", saveProfile);
    els.calendarMonth.addEventListener("change", onCalendarMonthChange);

    [els.todoList, els.inprogressList, els.doneList].forEach((list) => {
      list.addEventListener("dragover", onListDragOver);
      list.addEventListener("dragleave", onListDragLeave);
      list.addEventListener("drop", onListDrop);
    });

    els.closeModal.addEventListener("click", closeModal);
    els.editTaskBtn.addEventListener("click", () => {
      const task = appState.allTasks.find((item) => item.id === appState.viewedTaskId);
      if (task) openTaskEditor(task);
    });
    els.copyTaskBtn.addEventListener("click", copyViewedTask);
    els.saveStatusBtn.addEventListener("click", saveModalStatus);
    els.deleteTaskBtn.addEventListener("click", deleteViewedTask);
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
        closeTaskEditor();
      }
    });

    els.closeTaskEditor.addEventListener("click", closeTaskEditor);
    els.cancelTaskEditor.addEventListener("click", closeTaskEditor);
    els.taskEditorModal.addEventListener("click", (event) => {
      if (event.target === els.taskEditorModal) closeTaskEditor();
    });
    els.taskEditorForm.addEventListener("submit", createTask);

    els.closeProjectEditor.addEventListener("click", closeProjectEditor);
    els.cancelProjectEditor.addEventListener("click", closeProjectEditor);
    els.projectEditorModal.addEventListener("click", (event) => {
      if (event.target === els.projectEditorModal) closeProjectEditor();
    });
    els.projectEditorForm.addEventListener("submit", createProject);
    els.closeMembers.addEventListener("click", closeMembers);
    els.membersModal.addEventListener("click", (event) => {
      if (event.target === els.membersModal) closeMembers();
    });
    els.memberForm.addEventListener("submit", addMember);
    els.memberSelect.addEventListener("change", selectMember);
  }

  function taskCollection() {
    return appState.activeProjectId === "default"
      ? collection(db, "plannerTasks")
      : collection(db, "plannerProjects", appState.activeProjectId, "tasks");
  }

  function taskReference(taskId) {
    return doc(taskCollection(), taskId);
  }

  function userStoryCollection() {
    return appState.activeProjectId === "default"
      ? collection(db, "plannerUserStories")
      : collection(db, "plannerProjects", appState.activeProjectId, "userStories");
  }

  function userStoryReference(storyId) {
    return doc(userStoryCollection(), storyId);
  }

  function onProjectChange(event) {
    appState.activeProjectId = event.target.value;
    appState.selectedTaskIds.clear();
    persistPreferences();
    updateMembersControl();
    loadData();
  }

  function updateMembersControl() {
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    els.membersBtn.classList.toggle("is-hidden", !active || active.role !== "owner");
    els.editProjectBtn.classList.toggle("is-hidden", !active || active.role !== "owner");
    els.archiveProjectBtn.classList.toggle("is-hidden", !active || active.role !== "owner");
    renderProfile();
  }

  function normalizeRecords(records) {
    return records.map((record, index) => {
      const cleaned = trimObjectKeys(record);
      const statusRaw = getString(cleaned.status || cleaned.Status);
      const statusKey = normalizeStatus(statusRaw);
      const priorityRaw = getString(cleaned.Priority || cleaned.Severity || cleaned.Rank);

      const startDate = parseDate(cleaned.startDate || cleaned["Start Date"]);
      const endDate = parseDate(cleaned.endDate || cleaned["End Date"]);
      const sprintStartDate = parseDate(cleaned.sprintStartDate || cleaned["Sprint Start Date"]);
      const sprintEndDate = parseDate(cleaned.sprintEndDate || cleaned["Sprint End Date"]);
      const dueDate = endDate || sprintEndDate;

      const pi = getString(cleaned.pi || cleaned.PI) || getString(cleaned.piId || cleaned.PI_ID) || "Unspecified PI";
      const sprint = getString(cleaned.sprint || cleaned.Sprint) || "Unspecified Sprint";
      const taskTitle = getString(cleaned.task || cleaned.Task) || getString(cleaned.userStory || cleaned["User Story"]) || `Task ${index + 1}`;

      return {
        id: getString(cleaned.id) || `task-${index + 1}`,
        originalIndex: index,
        raw: cleaned,
        archived: cleaned.archived === true,
        pi,
        sprint,
        sprintKey: `${pi}::${sprint}`,
        feature: getString(cleaned.feature || cleaned.Feature) || "Unspecified Feature",
        featureId: getString(cleaned.featureId || cleaned.Feature_ID) || "-",
        story: getString(cleaned.userStory || cleaned["User Story"]) || "-",
        storyId: getString(cleaned.storyId || cleaned.Story_ID) || "-",
        task: taskTitle,
        assignee: getString(cleaned.assignee || cleaned.Assignee) || "Unassigned",
        description: getString(cleaned.description || cleaned.Description) || "No description",
        subtasks: Array.isArray(cleaned.subtasks) ? cleaned.subtasks : [],
        dependencies: Array.isArray(cleaned.dependencies) ? cleaned.dependencies : [],
        app: getString(cleaned.app || cleaned.App) || "-",
        storyPoints: cleaned.storyPoints ?? cleaned["Story Points"] ?? "-",
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
        capacity: cleaned.capacity ?? cleaned.Capacity ?? "-"
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

  function onListSort(key) {
    const nextDirection = appState.listSort.key === key && appState.listSort.direction === "asc" ? "desc" : "asc";
    appState.listSort = { key, direction: nextDirection };
    renderList(appState.filteredTasks);
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
    renderList(appState.filteredTasks);
    renderUserStories(appState.filteredTasks);
    populateUserStoryOptions(appState.allTasks);
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

  function populateUserStoryOptions(tasks) {
    const stories = [...new Set([...appState.userStories.map(story => String(story.title || "").trim()), ...tasks.map((task) => String(task.raw.userStory || task.story || "").trim())].filter((s) => s && s !== "-"))].sort((a,b) => a.localeCompare(b));
    els.userStoryOptions.innerHTML = stories.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
  }

  function renderUserStories(tasks) {
    const groups = new Map();
    appState.userStories.forEach((record) => {
      const title = String(record.title || "").trim();
      if (!title) return;
      groups.set(`id:${record.id}`, {
        id: record.id, title, description: String(record.description || ""),
        acceptanceCriteria: Array.isArray(record.acceptanceCriteria) ? record.acceptanceCriteria : [],
        lifecycle: record.lifecycle || "Draft", pi: record.pi || "", feature: record.feature || "",
        startDate: record.startDate || "", endDate: record.endDate || "", archived: record.archived === true, tasks: []
      });
    });
    tasks.forEach((task) => {
      const title = String(task.raw.userStory || task.story || "").trim();
      if (!title || title === "-") return;
      const stableId = String(task.raw.userStoryId || "").trim();
      const key = stableId ? `id:${stableId}` : `legacy:${title.toLocaleLowerCase()}`;
      if (!groups.has(key)) groups.set(key, {
        id: stableId, title, description: "", acceptanceCriteria: [],
        lifecycle: "Draft", pi: "", feature: "", startDate: "", endDate: "", archived: false, tasks: []
      });
      const group = groups.get(key);
      group.tasks.push(task);
      if (!group.description) group.description = String(task.raw.userStoryDescription || "").trim();
      if (!group.pi) group.pi = task.raw.pi || "";
      if (!group.feature) group.feature = task.raw.feature || "";
      if (group.lifecycle === "Draft" && task.raw.userStoryStatus) group.lifecycle = task.raw.userStoryStatus;
    });
    const allStories = [...groups.values()];
    const stories = allStories.filter(story => appState.showArchivedStories ? story.archived : !story.archived).sort((a,b) => a.title.localeCompare(b.title));
    els.storiesSummary.textContent = `${stories.length} ${appState.showArchivedStories ? "archived" : "active"} stor${stories.length === 1 ? "y" : "ies"} · ${stories.reduce((n,s) => n+s.tasks.length,0)} linked tasks`;
    if (!stories.length) {
      els.storiesGrid.innerHTML = '<div class="stories-empty"><strong>No user stories yet</strong><p>Create your first story. You can add tasks whenever you are ready.</p><button class="save-task-btn" type="button" data-create-story>+ Create User Story</button></div>';
      els.storiesGrid.querySelector("[data-create-story]")?.addEventListener("click", () => openStoryEditor());
      return;
    }
    els.storiesGrid.innerHTML = stories.map((story) => {
      const counts = { todo: 0, inprogress: 0, done: 0 };
      story.tasks.forEach((task) => counts[task.statusKey] = (counts[task.statusKey] || 0) + 1);
      const storyPoints = story.tasks.reduce((total, task) => total + (Number(task.storyPoints) || 0), 0);
      const criteria = story.acceptanceCriteria.length ? `<p class="story-criteria-count">${story.acceptanceCriteria.length} acceptance criteria</p>` : "";
      const doneCount = counts.done;
      const completion = story.tasks.length ? Math.round(doneCount / story.tasks.length * 100) : 0;
      const detailsOpen = appState.expandedStoryTaskIds.has(story.id);
      return `<article class="story-card story-row${story.archived ? " is-archived" : ""}${detailsOpen ? " is-expanded" : ""}">
        <div class="story-row-main">
          <div class="story-row-title"><span class="story-card-label">${story.archived ? "ARCHIVED" : "USER STORY"}</span><h3>${escapeHtml(story.title)}</h3><p class="story-description">${escapeHtml(story.description || "No description added yet.")}</p></div>
          <div class="story-row-status"><span class="story-lifecycle-pill">${escapeHtml(story.lifecycle)}</span><span class="story-task-count">${story.tasks.length} task${story.tasks.length===1?"":"s"}</span></div>
          <div class="story-row-progress"><div class="story-progress-copy"><span>Task progress</span><strong>${completion}%</strong></div><div class="story-progress-track"><span style="width:${completion}%"></span></div><small>${counts.done} of ${story.tasks.length} done</small></div>
          <div class="story-row-points"><small>Points</small><strong>${storyPoints}</strong></div>
          <button type="button" class="story-details-toggle${detailsOpen ? " is-active" : ""}" data-toggle-story-details="${escapeHtml(story.id)}" aria-expanded="${detailsOpen}">${detailsOpen ? "Hide details ↑" : "View details ↓"}</button>
        </div>
        <div class="story-row-actions"><button type="button" class="story-edit" data-edit-story-id="${escapeHtml(story.id)}">Edit</button>${story.archived ? "" : `<button type="button" class="story-add-task" data-story-title="${escapeHtml(story.title)}" data-story-id="${escapeHtml(story.id)}" data-story-description="${escapeHtml(story.description)}">+ Add task</button>`}<button type="button" class="story-archive-action" data-archive-story-id="${escapeHtml(story.id)}" data-archive-story-title="${escapeHtml(story.title)}">${story.archived ? "Restore" : "Archive"}</button></div>
        <div class="story-row-details" ${detailsOpen ? "" : "hidden"}>
          <div class="story-detail-heading"><div><span class="story-card-label">STORY DETAILS</span><h4>${escapeHtml(story.title)}</h4><p>Review the story definition and track delivery without leaving this list.</p></div><span class="story-detail-completion">${completion}% complete</span></div>
          <div class="story-detail-layout">
            <div class="story-detail-column">
              <section class="story-detail-panel"><div class="story-detail-panel-title"><span class="story-detail-icon">◎</span><div><h5>Overview</h5><p>Lifecycle and delivery summary</p></div></div>
                <div class="story-detail-stats"><div><small>Lifecycle</small><strong>${escapeHtml(story.lifecycle)}</strong></div><div><small>Total tasks</small><strong>${story.tasks.length}</strong></div><div><small>Completed</small><strong>${counts.done} / ${story.tasks.length}</strong></div><div><small>Story points</small><strong>${storyPoints}</strong></div></div>
                <div class="story-detail-status-line"><span class="story-status-dot todo"></span>To do <strong>${counts.todo}</strong><span class="story-status-dot progress"></span>In progress <strong>${counts.inprogress}</strong><span class="story-status-dot done"></span>Done <strong>${counts.done}</strong></div>
              </section>
              <section class="story-detail-panel"><div class="story-detail-panel-title"><span class="story-detail-icon">✓</span><div><h5>Acceptance criteria</h5><p>Conditions for considering this story complete</p></div><span class="story-detail-count">${story.acceptanceCriteria.length}</span></div>
                ${story.acceptanceCriteria.length ? `<ul class="story-criteria-list">${story.acceptanceCriteria.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<div class="story-detail-empty-box"><strong>No acceptance criteria yet</strong><p>Add clear, testable outcomes when editing this story.</p><button type="button" class="story-inline-edit" data-edit-story-id="${escapeHtml(story.id)}">Edit story</button></div>'}
              </section>
            </div>
            <section class="story-detail-panel story-linked-panel"><div class="story-detail-panel-title"><span class="story-detail-icon">☷</span><div><h5>Linked tasks</h5><p>Tasks contributing to this story's progress</p></div><span class="story-detail-count">${story.tasks.length}</span><button type="button" class="story-add-task story-detail-add" data-story-title="${escapeHtml(story.title)}" data-story-id="${escapeHtml(story.id)}" data-story-description="${escapeHtml(story.description)}" ${story.archived ? "disabled" : ""}>+ Add task</button></div>
              ${story.tasks.length ? `<div class="story-linked-task-list">${story.tasks.map((task,index) => `<button type="button" class="story-linked-task" data-story-task="${escapeHtml(task.id)}"><span class="story-task-index">${index+1}</span><span class="story-linked-task-name">${escapeHtml(task.task)}<small>${Number(task.storyPoints)||0} points</small></span><span class="story-linked-status status-${escapeHtml(String(task.statusKey||"todo").toLowerCase())}">${escapeHtml(task.statusLabel)}</span><span class="story-linked-assignee" title="Task owner"><span class="story-assignee-avatar">${escapeHtml((task.assignee && task.assignee !== "Unassigned" ? task.assignee : "U").split(/\\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase())}</span><span>${escapeHtml(task.assignee || "Unassigned")}</span></span><span class="story-linked-open" aria-hidden="true">›</span></button>`).join("")}</div>` : '<div class="story-detail-empty-box"><strong>No linked tasks</strong><p>Break this story into tasks to start tracking delivery.</p></div>'}
            </section>
          </div>
        </div></article>`;
    }).join("");
    els.storiesGrid.querySelectorAll("[data-toggle-story-details]").forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.toggleStoryDetails;
      if (appState.expandedStoryTaskIds.has(id)) appState.expandedStoryTaskIds.delete(id);
      else appState.expandedStoryTaskIds.add(id);
      renderUserStories(appState.filteredTasks);
    }));
    els.storiesGrid.querySelectorAll("[data-expand-story-tasks]").forEach(button => button.addEventListener("click", () => {
      const id = button.dataset.expandStoryTasks;
      if (appState.expandedStoryTaskIds.has(id)) appState.expandedStoryTaskIds.delete(id);
      else appState.expandedStoryTaskIds.add(id);
      renderUserStories(appState.filteredTasks);
    }));
    els.storiesGrid.querySelectorAll("[data-story-task]").forEach(button => button.addEventListener("click", () => {
      const task = appState.allTasks.find(item => item.id === button.dataset.storyTask); if (task) openTaskModal(task);
    }));
    els.storiesGrid.querySelectorAll("[data-story-title]").forEach(button => button.addEventListener("click", () => {
      openTaskEditor(); els.taskUserStoryInput.value = button.dataset.storyTitle || ""; els.taskUserStoryInput.dataset.storyId = button.dataset.storyId || "";
      els.taskEditorForm.elements.namedItem("userStoryDescription").value = button.dataset.storyDescription || ""; els.newTaskName.focus();
    }));
    els.storiesGrid.querySelectorAll("[data-archive-story-id]").forEach(button => button.addEventListener("click", () => archiveUserStory(button.dataset.archiveStoryId, button.dataset.archiveStoryTitle)));
    els.storiesGrid.querySelectorAll("[data-edit-story-id]").forEach(button => button.addEventListener("click", () => {
      const story = appState.userStories.find(item => item.id === button.dataset.editStoryId);
      if (story) openStoryEditor(story);
      else {
        const legacy = stories.find(item => item.id === button.dataset.editStoryId);
        if (legacy) openStoryEditor({ id: legacy.id, title: legacy.title, description: legacy.description, lifecycle: legacy.lifecycle, pi: legacy.pi, feature: legacy.feature, startDate: legacy.startDate, endDate: legacy.endDate, acceptanceCriteria: legacy.acceptanceCriteria, legacy: true });
      }
    }));
  }

  async function archiveUserStory(storyId, storyTitle) {
    if (!storyId) {
      window.alert("This legacy story has no stable ID yet. Edit and save it first, then archive it.");
      return;
    }
    const story = appState.userStories.find(item => item.id === storyId);
    const isArchived = story?.archived === true;
    const action = isArchived ? "restore" : "archive";
    if (!window.confirm(`Are you sure you want to ${action} "${storyTitle}"? Its tasks will remain unchanged.`)) return;
    try {
      const now = serverTimestamp();
      if (story) {
        await updateDoc(userStoryReference(storyId), { archived: !isArchived, updatedAt: now });
      } else {
        const legacyTasks = appState.allTasks.filter(task => String(task.raw.userStoryId || "").trim() === storyId);
        const first = legacyTasks[0];
        await setDoc(userStoryReference(storyId), {
          title: storyTitle,
          description: String(first?.raw.userStoryDescription || ""),
          acceptanceCriteria: Array.isArray(first?.raw.acceptanceCriteria) ? first.raw.acceptanceCriteria : [],
          pi: String(first?.raw.pi || ""), feature: String(first?.raw.feature || ""),
          startDate: String(first?.raw.startDate || ""), endDate: String(first?.raw.endDate || ""),
          lifecycle: String(first?.raw.userStoryStatus || "Draft"),
          createdBy: appState.user.uid, createdAt: now, updatedAt: now, archived: !isArchived
        });
      }
    } catch (error) {
      console.error("Could not archive User Story", error);
      window.alert("Could not update this User Story. Check your project permissions and try again.");
    }
  }

  function openStoryEditor(story = null) {
    appState.editingStoryId = story?.id || null;
    els.storyEditorForm.reset();
    els.storyEditorTitle.textContent = story ? "Edit User Story" : "Create User Story";
    els.saveStoryBtn.textContent = story ? "Save Changes" : "Create User Story";
    els.storyTitleInput.value = story?.title || "";
    els.storyDescriptionInput.value = story?.description || "";
    els.storyCriteriaInput.value = Array.isArray(story?.acceptanceCriteria) ? story.acceptanceCriteria.join("\n") : "";
    els.storyPiInput.value = story?.pi || "";
    els.storyFeatureInput.value = story?.feature || "";
    els.storyStartDateInput.value = story?.startDate || "";
    els.storyEndDateInput.value = story?.endDate || "";
    els.storyEditorError.textContent = "";
    els.storyEditorModal.classList.add("is-open");
    els.storyEditorModal.setAttribute("aria-hidden", "false");
    els.storyTitleInput.focus();
  }

  function closeStoryEditor() {
    els.storyEditorModal.classList.remove("is-open");
    els.storyEditorModal.setAttribute("aria-hidden", "true");
    appState.editingStoryId = null;
  }

  async function saveUserStory(event) {
    event.preventDefault();
    const title = els.storyTitleInput.value.trim();
    const description = els.storyDescriptionInput.value.trim();
    const criteria = els.storyCriteriaInput.value.split("\n").map(value => value.trim()).filter(Boolean);
    if (!title) { els.storyEditorError.textContent = "Enter a User Story title."; els.storyTitleInput.focus(); return; }
    if (title.length > 160) { els.storyEditorError.textContent = "Title must be 160 characters or fewer."; return; }
    if (description.length > 1500) { els.storyEditorError.textContent = "Description must be 1,500 characters or fewer."; return; }
    if (criteria.length > 50 || criteria.some(value => value.length > 500)) { els.storyEditorError.textContent = "Add up to 50 acceptance criteria, each no longer than 500 characters."; return; }
    const startDate = els.storyStartDateInput.value;
    const endDate = els.storyEndDateInput.value;
    if (startDate && endDate && endDate < startDate) { els.storyEditorError.textContent = "Target date cannot be before the start date."; return; }
    els.saveStoryBtn.disabled = true;
    els.saveStoryBtn.textContent = "Saving...";
    els.storyEditorError.textContent = "";
    const existingStory = appState.userStories.find(item => item.id === appState.editingStoryId);
    const previousTitle = existingStory?.title || "";
    const data = {
      title, description, acceptanceCriteria: criteria,
      pi: els.storyPiInput.value.trim(), feature: els.storyFeatureInput.value.trim(),
      startDate, endDate, lifecycle: appState.userStories.find(item => item.id === appState.editingStoryId)?.lifecycle || "Draft",
      createdBy: existingStory?.createdBy || appState.user.uid, archived: existingStory?.archived === true, updatedAt: serverTimestamp()
    };
    try {
      if (appState.editingStoryId) {
        const existing = existingStory;
        if (existing) {
          await updateDoc(userStoryReference(appState.editingStoryId), data);
          const linked = appState.allTasks.filter(task => String(task.raw.userStoryId || "").trim() === appState.editingStoryId);
          for (let start = 0; start < linked.length; start += 450) {
            const batch = writeBatch(db);
            linked.slice(start, start + 450).forEach(task => batch.update(taskReference(task.id), { userStory: title, userStoryDescription: description, updatedAt: serverTimestamp() }));
            await batch.commit();
          }
        }
        else {
          // Legacy stories are upgraded into independent records; linked task IDs are preserved.
          const legacyId = appState.editingStoryId;
          await setDoc(userStoryReference(legacyId), { ...data, createdAt: serverTimestamp() });
          const linked = appState.allTasks.filter(task => String(task.raw.userStoryId || "") === legacyId || (!task.raw.userStoryId && String(task.raw.userStory || task.story || "").trim() === previousTitle));
          for (let start = 0; start < linked.length; start += 450) {
            const batch = writeBatch(db);
            linked.slice(start, start + 450).forEach(task => batch.update(taskReference(task.id), { userStoryId: legacyId, userStory: title, userStoryDescription: description, updatedAt: serverTimestamp() }));
            await batch.commit();
          }
        }
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(userStoryCollection(), data);
      }
      closeStoryEditor();
    } catch (error) {
      console.error("Could not save User Story", error);
      els.storyEditorError.textContent = "Could not save the User Story. Check project permissions and try again.";
    } finally {
      els.saveStoryBtn.disabled = false;
      els.saveStoryBtn.textContent = appState.editingStoryId ? "Save Changes" : "Create User Story";
    }
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

  function renderList(tasks) {
    const sorted = appState.listSort.key === "default"
      ? sortTasks(tasks, appState.sortBy)
      : sortListTasks(tasks, appState.listSort.key, appState.listSort.direction);
    updateListSortHeaders();
    els.taskTableBody.innerHTML = "";
    els.listSummary.textContent = `${sorted.length} task${sorted.length === 1 ? "" : "s"}`;
    if (sorted.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 9;
      cell.textContent = "No tasks match the current filters.";
      row.appendChild(cell);
      els.taskTableBody.appendChild(row);
      updateBulkArchiveControls(sorted);
      return;
    }
    sorted.forEach((task) => {
      const row = document.createElement("tr");
      row.tabIndex = 0;
      row.addEventListener("click", () => openTaskModal(task));
      row.addEventListener("keydown", (event) => { if (event.key === "Enter") openTaskModal(task); });
      const selectCell = document.createElement("td");
      selectCell.className = "list-select-cell";
      const selectTask = document.createElement("input");
      selectTask.type = "checkbox";
      selectTask.checked = appState.selectedTaskIds.has(task.id);
      selectTask.disabled = !canArchiveTask(task);
      selectTask.setAttribute("aria-label", `Select ${task.task} for archive`);
      if (!canArchiveTask(task)) selectTask.title = "Your access does not allow archiving this task.";
      selectTask.addEventListener("click", (event) => event.stopPropagation());
      selectTask.addEventListener("keydown", (event) => event.stopPropagation());
      selectTask.addEventListener("change", () => {
        if (selectTask.checked) appState.selectedTaskIds.add(task.id);
        else appState.selectedTaskIds.delete(task.id);
        updateBulkArchiveControls(sorted);
      });
      selectCell.appendChild(selectTask);
      row.appendChild(selectCell);
      const taskCell = document.createElement("td");
      taskCell.className = "list-task-cell";
      const taskIcon = document.createElement("span");
      taskIcon.className = "list-task-icon";
      taskIcon.setAttribute("aria-hidden", "true");
      taskIcon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2.2"></rect><path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h7"></path></svg>';
      const taskText = document.createElement("div");
      const taskName = document.createElement("strong");
      taskName.textContent = task.task;
      taskText.appendChild(taskName);
      if (task.story && task.story !== "-") {
        const story = document.createElement("span");
        story.textContent = task.story;
        taskText.appendChild(story);
      }
      taskCell.append(taskIcon, taskText);
      row.appendChild(taskCell);

      [task.feature, task.pi, task.sprint, task.assignee].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 1 || index === 2) cell.className = "list-compact-value";
        row.appendChild(cell);
      });

      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = `list-status ${task.statusKey}`;
      status.textContent = task.statusLabel;
      statusCell.appendChild(status);
      row.appendChild(statusCell);

      const priorityCell = document.createElement("td");
      const priority = document.createElement("span");
      priority.className = `list-priority ${String(task.priorityText).toLowerCase().replace(/\s+/g, "-")}`;
      priority.textContent = task.priorityText;
      priorityCell.appendChild(priority);
      row.appendChild(priorityCell);

      const dueCell = document.createElement("td");
      dueCell.className = "list-due-date";
      dueCell.textContent = task.dueDate ? formatDate(task.dueDate) : "—";
      row.appendChild(dueCell);
      els.taskTableBody.appendChild(row);
    });
    updateBulkArchiveControls(sorted);
  }

  function canArchiveTask(task) {
    if (appState.activeProjectId === "default") return task.raw.createdBy === appState.user.uid;
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    return Boolean(active && ["owner", "editor"].includes(active.role));
  }

  function updateBulkArchiveControls(visibleTasks = appState.filteredTasks) {
    const archivable = visibleTasks.filter(canArchiveTask);
    const selected = archivable.filter((task) => appState.selectedTaskIds.has(task.id));
    els.archiveSelectedTasksBtn.disabled = selected.length === 0;
    els.archiveSelectedTasksBtn.textContent = selected.length ? `Archive selected (${selected.length})` : "Archive selected";
    els.applyBulkStatusBtn.disabled = selected.length === 0;
    els.applyBulkStatusBtn.textContent = selected.length ? `Update status (${selected.length})` : "Update status";
    els.selectAllTasks.checked = archivable.length > 0 && selected.length === archivable.length;
    els.selectAllTasks.indeterminate = selected.length > 0 && selected.length < archivable.length;
    els.selectAllTasks.disabled = archivable.length === 0;
  }

  function toggleAllVisibleTasks(event) {
    const archivable = appState.filteredTasks.filter(canArchiveTask);
    archivable.forEach((task) => {
      if (event.target.checked) appState.selectedTaskIds.add(task.id);
      else appState.selectedTaskIds.delete(task.id);
    });
    renderList(appState.filteredTasks);
  }

  async function updateSelectedTaskStatuses() {
    const selected = appState.allTasks.filter((task) => appState.selectedTaskIds.has(task.id) && canArchiveTask(task));
    if (!selected.length) return;

    const statusByKey = { todo: "To Do", inprogress: "In Progress", done: "Done" };
    const nextStatus = statusByKey[els.bulkTaskStatus.value];
    if (!nextStatus) return;

    const unchanged = selected.filter((task) => task.status !== nextStatus);
    if (!unchanged.length) {
      window.alert("The selected tasks already have that status.");
      return;
    }
    if (!window.confirm(`Move ${unchanged.length} selected task${unchanged.length === 1 ? "" : "s"} to "${nextStatus}"?`)) return;

    els.applyBulkStatusBtn.disabled = true;
    els.applyBulkStatusBtn.textContent = "Updating...";
    try {
      for (let start = 0; start < unchanged.length; start += 450) {
        const batch = writeBatch(db);
        unchanged.slice(start, start + 450).forEach((task) => {
          batch.update(taskReference(task.id), { status: nextStatus, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      appState.selectedTaskIds.clear();
    } catch (error) {
      console.error("Could not update selected task statuses", error);
      window.alert("Some selected tasks could not be updated. Please review the board and try again.");
    } finally {
      updateBulkArchiveControls();
    }
  }

  async function archiveSelectedTasks() {
    const selected = appState.allTasks.filter((task) => appState.selectedTaskIds.has(task.id) && canArchiveTask(task));
    if (!selected.length) return;
    if (!window.confirm(`Archive ${selected.length} selected task${selected.length === 1 ? "" : "s"}? You can retain the records in Firestore, but they will be hidden from active views.`)) return;
    els.archiveSelectedTasksBtn.disabled = true;
    els.archiveSelectedTasksBtn.textContent = "Archiving...";
    try {
      for (let start = 0; start < selected.length; start += 500) {
        const batch = writeBatch(db);
        selected.slice(start, start + 500).forEach((task) => {
          batch.update(taskReference(task.id), { archived: true, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      appState.selectedTaskIds.clear();
    } catch (error) {
      console.error("Could not archive selected tasks", error);
      window.alert("Some selected tasks could not be archived. Please try again.");
      updateBulkArchiveControls();
    }
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

  function sortListTasks(tasks, key, direction) {
    const multiplier = direction === "desc" ? -1 : 1;
    const textCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const statusRank = { todo: 0, inprogress: 1, done: 2 };
    const priorityRank = { high: 0, medium: 1, low: 2, none: 3 };
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      if (key === "dueDate") comparison = compareDueDates(a, b);
      else if (key === "status") comparison = (statusRank[a.statusKey] ?? 99) - (statusRank[b.statusKey] ?? 99);
      else if (key === "priority") comparison = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
      else comparison = textCompare.compare(String(a[key] || ""), String(b[key] || ""));
      return comparison ? comparison * multiplier : a.originalIndex - b.originalIndex;
    });
  }

  function updateListSortHeaders() {
    document.querySelectorAll(".list-sort-button").forEach((button) => {
      const active = button.dataset.listSort === appState.listSort.key;
      const direction = appState.listSort.direction;
      const header = button.closest("th");
      header?.setAttribute("aria-sort", active ? (direction === "asc" ? "ascending" : "descending") : "none");
      button.classList.toggle("is-active", active);
      const indicator = button.querySelector("span");
      if (indicator) indicator.textContent = active ? (direction === "asc" ? "↑" : "↓") : "↕";
    });
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

  async function onListDrop(event) {
    event.preventDefault();
    const list = event.currentTarget;
    list.classList.remove("is-drop-target");
    const targetStatus = list.dataset.status;
    if (!appState.dragTaskId || !COLUMN_KEYS.includes(targetStatus)) return;

    await updateTaskStatus(appState.dragTaskId, targetStatus);
  }

  async function updateTaskStatus(taskId, statusKey) {
    const task = appState.allTasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      await updateDoc(taskReference(taskId), {
        status: statusDisplay(statusKey),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Could not update task status", error);
      window.alert("Your access does not allow this task update.");
      return false;
    }
  }

  async function saveModalStatus() {
    if (!appState.viewedTaskId) return;
    const statusKey = els.taskStatusSelect.value;
    els.saveStatusBtn.disabled = true;
    els.saveStatusBtn.textContent = "Saving...";
    try {
      const saved = await updateTaskStatus(appState.viewedTaskId, statusKey);
      if (saved) closeModal();
    } finally {
      els.saveStatusBtn.disabled = false;
      els.saveStatusBtn.textContent = "Save Status";
    }
  }

  function updateStats(tasks) {
    const total = tasks.length;
    const done = tasks.filter((task) => task.statusKey === "done").length;
    const inProgress = tasks.filter((task) => task.statusKey === "inprogress").length;
    const todo = tasks.filter((task) => task.statusKey === "todo").length;
    const completion = total === 0 ? 0 : Math.round((done / total) * 100);
    els.totalTasks.textContent = String(total);
    els.completedPercent.textContent = `${completion}%`;
    els.inProgressCount.textContent = String(inProgress);
    els.todoStat.textContent = String(todo);
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

    // Historical daily snapshots are not stored, so do not fabricate an "actual" burn curve.
    // Display the current remaining-work snapshot as a flat reference across the sprint.
    const remainingSnapshot = labels.map(() => remainingNow);

    els.burndownSubtitle.textContent = `${sprintMeta.sprint} (${formatDate(sprintMeta.startDate)} - ${formatDate(sprintMeta.endDate)})`;

    appState.charts.burndown = new window.Chart(els.burndownChart, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Ideal Remaining", data: ideal, borderColor: "#8aa2bf", borderDash: [6, 4], tension: 0.2 },
          { label: "Current Remaining (snapshot)", data: remainingSnapshot, borderColor: "#0f5bd8", backgroundColor: "rgba(15, 91, 216, 0.08)", fill: false, tension: 0 }
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

    let eligibleSprints = [...appState.sprintCatalog];
    if (appState.filters.pi !== "all") eligibleSprints = eligibleSprints.filter((s) => s.pi === appState.filters.pi);
    const sprints = eligibleSprints.slice(-8);
    const labels = sprints.map((s) => `${s.pi} · ${s.sprint}`);
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
    appState.activeView = ["board", "list", "stories", "insights", "knowledge", "profile"].includes(view) ? view : "board";
    const board = appState.activeView === "board", list = appState.activeView === "list", stories = appState.activeView === "stories";
    const insights = appState.activeView === "insights", knowledge = appState.activeView === "knowledge", profile = appState.activeView === "profile";
    els.boardView.classList.toggle("is-hidden", !board);
    els.listView.classList.toggle("is-hidden", !list);
    els.storiesView.classList.toggle("is-hidden", !stories);
    els.insightsView.classList.toggle("is-hidden", !insights);
    els.knowledgeView?.classList.toggle("is-hidden", !knowledge);
    els.knowledgeViewBtn?.classList.toggle("is-active", knowledge);
    els.profileView.classList.toggle("is-hidden", !profile);
    els.boardViewBtn.classList.toggle("is-active", board);
    els.listViewBtn.classList.toggle("is-active", list);
    els.storiesViewBtn.classList.toggle("is-active", stories);
    els.insightsViewBtn.classList.toggle("is-active", insights);
    els.profileViewBtn.classList.toggle("is-active", profile);
    if (persist) persistPreferences();
  }

  function renderProfile() {
    if (!appState.user) return;
    const project = appState.projects.find((item) => item.id === appState.activeProjectId);
    const parts = (appState.user.displayName || "").trim().split(/\s+/).filter(Boolean);
    els.profileFirstName.textContent = parts[0] || "Not set";
    els.profileLastName.textContent = parts.slice(1).join(" ") || "Not set";
    els.profileEmail.textContent = appState.user.email || "No email available";
    els.profileUid.textContent = appState.user.uid;
    els.profileProject.textContent = project?.name || "Default Project";
    els.profileRole.textContent = project?.role ? project.role[0].toUpperCase() + project.role.slice(1) : "Shared member";
    els.profileFirstNameInput.value = parts[0] || "";
    els.profileLastNameInput.value = parts.slice(1).join(" ");
    renderProfileAccess();
  }

  function renderProfileAccess() {
    els.profileAccessList.innerHTML = "";
    const projects = [
      { id: "default", name: "Default Project", role: "shared member" },
      ...appState.projects
    ];
    projects.forEach((project) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "profile-access-row";
      row.textContent = `${project.name} — ${project.role}`;
      row.addEventListener("click", () => {
        els.projectSelect.value = project.id;
        onProjectChange({ target: els.projectSelect });
        setActiveView("board");
      });
      els.profileAccessList.appendChild(row);
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    const firstName = els.profileFirstNameInput.value.trim();
    const lastName = els.profileLastNameInput.value.trim();
    if (!firstName) {
      els.profileError.textContent = "Enter your first name.";
      return;
    }
    els.saveProfileBtn.disabled = true;
    els.saveProfileBtn.textContent = "Saving...";
    els.profileError.textContent = "";
    try {
      const profile = await updatePlannerProfile(firstName, lastName);
      appState.user.displayName = profile.displayName;
      els.currentUserName.textContent = profile.displayName;
      updateAccountAvatar(profile.displayName);
      renderProfile();
      els.profileError.textContent = "Profile saved.";
    } catch (error) {
      console.error("Could not save profile", error);
      els.profileError.textContent = "Could not save your profile. Please try again.";
    } finally {
      els.saveProfileBtn.disabled = false;
      els.saveProfileBtn.textContent = "Save Profile";
    }
  }

  function formatDate(date) {
    return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function updateAccountAvatar(name) {
    const initials = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    els.accountMenuBtn.textContent = initials || "U";
  }

  function setSidebarCollapsed(collapsed) {
    els.appShell.classList.toggle("sidebar-collapsed", collapsed);
    els.sidebarToggleBtn.setAttribute("aria-expanded", String(!collapsed));
    els.sidebarToggleBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    els.sidebarToggleBtn.textContent = collapsed ? "☰" : "×";
  }

  function toggleAccountMenu() {
    const opening = els.accountMenu.classList.contains("is-hidden");
    els.accountMenu.classList.toggle("is-hidden", !opening);
    els.accountMenuBtn.setAttribute("aria-expanded", String(opening));
  }

  function closeAccountMenu() {
    els.accountMenu.classList.add("is-hidden");
    els.accountMenuBtn.setAttribute("aria-expanded", "false");
  }

  function openTaskModal(task) {
    appState.viewedTaskId = task.id;
    const formattedDueDate = task.dueDate ? task.dueDate.toLocaleDateString() : "-";
    const formattedStartDate = task.startDate ? task.startDate.toLocaleDateString() : "-";

    els.modalTitle.textContent = task.task;
    els.modalBody.innerHTML = `
      <section class="task-detail-grid" aria-label="Task information">
        ${modalRow("PI", task.pi)}
        ${modalRow("Sprint", task.sprint)}
        ${modalRow("Feature", `${task.feature} (${task.featureId})`)}
        ${modalRow("Story", `${task.storyId} - ${task.story}`)}
        ${modalRow("Assignee", task.assignee)}
        ${modalRow("Priority", task.priorityText)}
        ${modalRow("Story points", String(task.storyPoints))}
        ${modalRow("Start date", formattedStartDate)}
        ${modalRow("End date", formattedDueDate)}
        ${modalRow("App", task.app)}
      </section>
      <section class="task-detail-description"><h3>User story description</h3><p>${escapeHtml(task.raw.userStoryDescription || "No user story description added.")}</p></section>
      <section class="task-detail-description"><h3>Task description</h3><p>${escapeHtml(task.description || "No description added.")}</p></section>
      ${renderTaskBreakdown(task)}
      ${renderAcceptanceCriteria(task)}
      ${renderStoryLifecycle(task)}
    `;

    bindTaskBreakdownActions(task);
    bindAcceptanceCriteriaActions(task);
    bindStoryLifecycleActions(task);
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    els.taskStatusSelect.value = task.statusKey;
    const isDefault = appState.activeProjectId === "default";
    const isCreator = task.raw.createdBy === appState.user.uid;
    els.editTaskBtn.classList.toggle("is-hidden", isDefault && !isCreator);
    els.deleteTaskBtn.classList.toggle("is-hidden", isDefault && !isCreator);
  }

  function renderTaskBreakdown(task) {
    const subtasks = Array.isArray(task.raw.subtasks) ? task.raw.subtasks : [];
    const dependencies = Array.isArray(task.raw.dependencies) ? task.raw.dependencies : [];
    const candidates = appState.allTasks.filter((item) => item.id !== task.id && !item.archived);
    const completed = subtasks.filter((item) => item && item.done).length;
    return `
      <section class="task-breakdown">
        <div class="breakdown-heading"><div><h3>Subtasks & checklist</h3><p>${completed} of ${subtasks.length} complete</p></div></div>
        <div class="subtask-list">${subtasks.length ? subtasks.map((item, index) => `
          <label class="subtask-item"><input type="checkbox" data-subtask-index="${index}" ${item.done ? "checked" : ""}><span class="${item.done ? "is-complete" : ""}">${escapeHtml(item.title || "Untitled subtask")}</span><button type="button" data-remove-subtask="${index}" aria-label="Remove subtask">×</button></label>`).join("") : '<p class="breakdown-empty">No subtasks yet. Add a checklist item below.</p>'}</div>
        <form id="addSubtaskForm" class="breakdown-add-form"><input name="subtaskTitle" maxlength="160" required placeholder="Add a checklist item"><button type="submit">Add</button></form>
      </section>
      <section class="task-breakdown">
        <div class="breakdown-heading"><div><h3>Dependencies</h3><p>Work that must be completed first</p></div></div>
        <div class="dependency-list">${dependencies.map((id) => {
          const dependency = appState.allTasks.find((item) => item.id === id);
          return dependency ? `<div class="dependency-item"><span class="dependency-status ${dependency.statusKey}"></span><span><b>${escapeHtml(dependency.task)}</b><small>${escapeHtml(dependency.statusLabel)}</small></span><button type="button" data-remove-dependency="${escapeHtml(id)}">Remove</button></div>` : "";
        }).join("") || '<p class="breakdown-empty">No dependencies linked.</p>'}</div>
        <form id="addDependencyForm" class="breakdown-add-form"><select name="dependencyId" required><option value="">Select a prerequisite task</option>${candidates.filter((item) => !dependencies.includes(item.id)).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.task)} — ${escapeHtml(item.statusLabel)}</option>`).join("")}</select><button type="submit">Link task</button></form>
      </section>`;
  }

  function bindTaskBreakdownActions(task) {
    const subtaskForm = document.getElementById("addSubtaskForm");
    subtaskForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = String(new FormData(subtaskForm).get("subtaskTitle") || "").trim();
      if (!title) return;
      const items = [...(task.raw.subtasks || []), { title, done: false }];
      await saveTaskBreakdown(task, { subtasks: items });
    });
    els.modalBody.querySelectorAll("[data-subtask-index]").forEach((input) => input.addEventListener("change", async () => {
      const items = [...(task.raw.subtasks || [])];
      const index = Number(input.dataset.subtaskIndex);
      if (!items[index]) return;
      items[index] = { ...items[index], done: input.checked };
      await saveTaskBreakdown(task, { subtasks: items });
    }));
    els.modalBody.querySelectorAll("[data-remove-subtask]").forEach((button) => button.addEventListener("click", async () => {
      const items = [...(task.raw.subtasks || [])];
      items.splice(Number(button.dataset.removeSubtask), 1);
      await saveTaskBreakdown(task, { subtasks: items });
    }));
    const dependencyForm = document.getElementById("addDependencyForm");
    dependencyForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const dependencyId = String(new FormData(dependencyForm).get("dependencyId") || "");
      const dependencies = [...(task.raw.dependencies || [])];
      if (!dependencyId || dependencies.includes(dependencyId)) return;
      if (wouldCreateDependencyCycle(task.id, dependencyId)) {
        window.alert("This link would create a dependency cycle. Choose a different prerequisite.");
        return;
      }
      await saveTaskBreakdown(task, { dependencies: [...dependencies, dependencyId] });
    });
    els.modalBody.querySelectorAll("[data-remove-dependency]").forEach((button) => button.addEventListener("click", async () => {
      const dependencies = (task.raw.dependencies || []).filter((id) => id !== button.dataset.removeDependency);
      await saveTaskBreakdown(task, { dependencies });
    }));
  }

  function wouldCreateDependencyCycle(taskId, prerequisiteId) {
    const visited = new Set();
    const visit = (id) => {
      if (id === taskId) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const task = appState.allTasks.find((item) => item.id === id);
      return (task?.raw.dependencies || []).some(visit);
    };
    return visit(prerequisiteId);
  }

  async function saveTaskBreakdown(task, patch) {
    try {
      await updateDoc(taskReference(task.id), { ...patch, updatedAt: serverTimestamp() });
      task.raw = { ...task.raw, ...patch };
      openTaskModal(appState.allTasks.find((item) => item.id === task.id) || task);
    } catch (error) {
      console.error("Could not update task breakdown", error);
      window.alert("Could not save this change. Check your project permissions and try again.");
    }
  }

  function renderAcceptanceCriteria(task) {
    const criteria = Array.isArray(task.raw.acceptanceCriteria) ? task.raw.acceptanceCriteria : [];
    const completed = criteria.filter((item) => item && item.done).length;
    return `
      <section class="task-breakdown acceptance-criteria">
        <div class="breakdown-heading"><div><h3>Acceptance criteria</h3><p>${completed} of ${criteria.length} satisfied</p></div></div>
        <div class="subtask-list">${criteria.length ? criteria.map((item, index) => `
          <label class="subtask-item"><input type="checkbox" data-criteria-index="${index}" ${item.done ? "checked" : ""}><span class="${item.done ? "is-complete" : ""}">${escapeHtml(item.title || "Acceptance criterion")}</span><button type="button" data-remove-criteria="${index}" aria-label="Remove acceptance criterion">×</button></label>`).join("") : '<p class="breakdown-empty">Add clear conditions that must be met for this work to be accepted.</p>'}</div>
        <form id="addCriteriaForm" class="breakdown-add-form"><input name="criteriaTitle" maxlength="240" required placeholder="e.g. User can save the form successfully"><button type="submit">Add criterion</button></form>
      </section>`;
  }

  function bindAcceptanceCriteriaActions(task) {
    const form = document.getElementById("addCriteriaForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = String(new FormData(form).get("criteriaTitle") || "").trim();
      if (!title) return;
      await saveTaskBreakdown(task, { acceptanceCriteria: [...(task.raw.acceptanceCriteria || []), { title, done: false }] });
    });
    els.modalBody.querySelectorAll("[data-criteria-index]").forEach((input) => input.addEventListener("change", async () => {
      const items = [...(task.raw.acceptanceCriteria || [])];
      const index = Number(input.dataset.criteriaIndex);
      if (!items[index]) return;
      items[index] = { ...items[index], done: input.checked };
      await saveTaskBreakdown(task, { acceptanceCriteria: items });
    }));
    els.modalBody.querySelectorAll("[data-remove-criteria]").forEach((button) => button.addEventListener("click", async () => {
      const items = [...(task.raw.acceptanceCriteria || [])];
      items.splice(Number(button.dataset.removeCriteria), 1);
      await saveTaskBreakdown(task, { acceptanceCriteria: items });
    }));
  }

  const STORY_LIFECYCLE_STATES = ["Draft", "Ready", "In Progress", "In Review", "Accepted"];

  function renderStoryLifecycle(task) {
    const state = STORY_LIFECYCLE_STATES.includes(task.raw.userStoryStatus) ? task.raw.userStoryStatus : "Draft";
    return `
      <section class="task-breakdown story-lifecycle">
        <div class="breakdown-heading"><div><h3>User Story lifecycle</h3><p>Track the delivery state of the story linked to this task.</p></div></div>
        <label class="story-lifecycle-control" for="userStoryStatusSelect"><span>Story status</span>
          <select id="userStoryStatusSelect">${STORY_LIFECYCLE_STATES.map((value) => `<option value="${value}" ${value === state ? "selected" : ""}>${value}</option>`).join("")}</select>
        </label>
        <p class="story-lifecycle-note">Changing this status updates tasks linked by stable User Story ID; legacy tasks without an ID are matched by title.</p>
      </section>`;
  }

  function bindStoryLifecycleActions(task) {
    const select = document.getElementById("userStoryStatusSelect");
    select?.addEventListener("change", async () => {
      const nextState = select.value;
      if (!STORY_LIFECYCLE_STATES.includes(nextState)) return;
      select.disabled = true;
      const storyTitle = String(task.raw.userStory || task.story || "").trim();
      const storyId = String(task.raw.userStoryId || "");
      const linkedTasks = storyId
        ? appState.allTasks.filter((item) => String(item.raw.userStoryId || "") === storyId)
        : (storyTitle && storyTitle !== "-"
          ? appState.allTasks.filter((item) => String(item.raw.userStory || item.story || "").trim() === storyTitle)
          : [task]);
      if (linkedTasks.length > 500) {
        window.alert("This story is linked to more than 500 tasks. Status was not changed; split the update into smaller groups.");
        select.disabled = false;
        return;
      }
      try {
        const batch = writeBatch(db);
        linkedTasks.forEach((item) => {
          batch.update(taskReference(item.id), {
            userStoryStatus: nextState,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        linkedTasks.forEach((item) => {
          item.raw = { ...item.raw, userStoryStatus: nextState };
        });
        openTaskModal(appState.allTasks.find((item) => item.id === task.id) || task);
      } catch (error) {
        console.error("Could not update linked User Story statuses", error);
        window.alert("Could not save the User Story status for every linked task. Check project permissions and try again.");
        select.disabled = false;
      }
    });
  }

  function modalRow(label, value) {
    return `<div class="modal-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(value || "—")}</span></div>`;
  }

  function copyViewedTask() {
    const task = appState.allTasks.find((item) => item.id === appState.viewedTaskId);
    if (!task) return;
    openTaskEditor({ ...task, id: null, raw: { ...task.raw, task: `Copy of ${task.task}` } });
    document.getElementById("taskEditorTitle").textContent = "Copy Task";
    els.saveTaskBtn.textContent = "Create Copy";
  }

  function closeModal() {
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
    appState.viewedTaskId = null;
  }

  function openTaskEditor(task = null) {
    appState.editingTaskId = task?.id || null;
    els.taskEditorForm.reset();
    delete els.taskUserStoryInput.dataset.storyId;
    if (task) {
      els.taskUserStoryInput.dataset.storyId = String(task.raw.userStoryId || "");
      const fields = {
        task: task.raw.task || task.task,
        userStory: task.raw.userStory || "",
        userStoryDescription: task.raw.userStoryDescription || "",
        pi: task.raw.pi || "",
        sprint: task.raw.sprint || "",
        feature: task.raw.feature || "",
        assigneeUid: task.raw.assigneeUid || "",
        storyPoints: task.raw.storyPoints ?? 0,
        priority: task.raw.priority || "",
        startDate: task.raw.startDate || "",
        endDate: task.raw.endDate || "",
        description: task.raw.description || ""
      };
      Object.entries(fields).forEach(([name, value]) => {
        const control = els.taskEditorForm.elements.namedItem(name);
        if (control) control.value = value;
      });
      document.getElementById("taskEditorTitle").textContent = "Edit Task";
      els.saveTaskBtn.textContent = "Save Changes";
      closeModal();
    } else {
      document.getElementById("taskEditorTitle").textContent = "New Task";
      els.saveTaskBtn.textContent = "Create Task";
    }
    els.taskEditorError.textContent = "";
    populateTaskAssignees(task).catch((error) => {
      console.error("Could not load task assignees", error);
      els.taskEditorError.textContent = "Could not load assignees. Check project membership permissions.";
    });
    els.taskEditorModal.classList.add("is-open");
    els.taskEditorModal.setAttribute("aria-hidden", "false");
    els.newTaskName.focus();
  }

  async function populateTaskAssignees(task = null) {
    const select = els.taskEditorForm.elements.namedItem("assigneeUid");
    if (!select) return;
    const previousUid = task?.raw?.assigneeUid || "";
    const legacyName = task?.raw?.assignee || "";
    select.innerHTML = '<option value="">Unassigned</option>';
    let members = [];
    if (appState.activeProjectId === "default") {
      // The shared Default Project has no project-members collection, so use the
      // signed-in-user directory and retain compatibility with existing assignments.
      const snapshot = await getDocs(query(collection(db, "plannerDirectory"), orderBy("displayName")));
      members = snapshot.docs.map((item) => item.data()).filter((user) => user.uid && user.displayName);
    } else {
      const snapshot = await getDocs(collection(db, "plannerProjects", appState.activeProjectId, "members"));
      members = snapshot.docs.map((item) => item.data()).filter((member) => member.uid && member.displayName);
    }
    const uniqueMembers = [...new Map(members.map((member) => [member.uid, member])).values()]
      .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
    uniqueMembers.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.uid;
      option.textContent = member.uid === appState.user.uid ? `${member.displayName} (you)` : member.displayName;
      option.dataset.displayName = member.displayName;
      select.appendChild(option);
    });
    // Older tasks stored only a display name. Keep that assignment visible until
    // a real directory identity is selected, rather than silently unassigning it.
    if (legacyName && !previousUid) {
      const matchingMember = uniqueMembers.find((member) => member.displayName === legacyName);
      if (matchingMember) {
        select.value = matchingMember.uid;
      } else {
        const legacy = document.createElement("option");
        legacy.value = `__legacy__:${legacyName}`;
        legacy.textContent = `${legacyName} (legacy assignment — reselect a member to link)`;
        select.appendChild(legacy);
        select.value = legacy.value;
      }
    }
    select.value = previousUid;
    if (previousUid && !uniqueMembers.some((member) => member.uid === previousUid)) {
      const missing = document.createElement("option");
      missing.value = previousUid;
      missing.textContent = `${legacyName || "Former member"} (no longer in this project)`;
      missing.dataset.displayName = legacyName;
      select.appendChild(missing);
      select.value = previousUid;
    }
  }

  function closeTaskEditor() {
    els.taskEditorModal.classList.remove("is-open");
    els.taskEditorModal.setAttribute("aria-hidden", "true");
  }

  async function createTask(event) {
    event.preventDefault();
    const form = new FormData(els.taskEditorForm);
    const task = String(form.get("task") || "").trim();
    if (!task) {
      els.taskEditorError.textContent = "Enter a task name.";
      return;
    }

    const storyPoints = Number(form.get("storyPoints") || 0);
    if (!Number.isFinite(storyPoints) || storyPoints < 0) {
      els.taskEditorError.textContent = "Story points must be zero or greater.";
      return;
    }

    els.saveTaskBtn.disabled = true;
    els.saveTaskBtn.textContent = appState.editingTaskId ? "Saving..." : "Creating...";
    els.taskEditorError.textContent = "";
    try {
      const storyTitle = String(form.get("userStory") || "").trim();
      const editingTask = appState.editingTaskId
        ? appState.allTasks.find((item) => item.id === appState.editingTaskId)
        : null;
      const selectedStoryId = String(els.taskUserStoryInput.dataset.storyId || "").trim();
      const matchingStoryTasks = storyTitle && storyTitle !== "-"
        ? appState.allTasks.filter((item) => {
            const itemTitle = String(item.raw.userStory || item.story || "").trim();
            const itemStoryId = String(item.raw.userStoryId || "").trim();
            if (selectedStoryId) return itemStoryId === selectedStoryId;
            return itemTitle === storyTitle && !itemStoryId;
          })
        : [];
      const storyId = storyTitle && storyTitle !== "-"
        ? (selectedStoryId || editingTask?.raw.userStoryId || matchingStoryTasks.find((item) => item.raw.userStoryId)?.raw.userStoryId || doc(taskCollection()).id)
        : "";
      const assigneeSelect = els.taskEditorForm.elements.namedItem("assigneeUid");
      const selectedAssigneeOption = assigneeSelect?.options[assigneeSelect.selectedIndex];
      const selectedAssigneeValue = String(form.get("assigneeUid") || "").trim();
      const assigneeUid = selectedAssigneeValue.startsWith("__legacy__:") ? "" : selectedAssigneeValue;
      const assigneeName = selectedAssigneeValue.startsWith("__legacy__:")
        ? String(editingTask?.raw.assignee || "").trim()
        : (assigneeUid ? String(selectedAssigneeOption?.dataset.displayName || selectedAssigneeOption?.textContent || "").replace(/ \(you\)$/, "").trim() : "");
      const taskData = {
        task,
        userStory: storyTitle,
        userStoryId: storyId,
        userStoryDescription: String(form.get("userStoryDescription") || "").trim(),
        pi: String(form.get("pi") || "").trim(),
        sprint: String(form.get("sprint") || "").trim(),
        feature: String(form.get("feature") || "").trim(),
        assignee: assigneeName,
        assigneeUid,
        storyPoints,
        priority: String(form.get("priority") || "").trim(),
        startDate: String(form.get("startDate") || ""),
        endDate: String(form.get("endDate") || ""),
        description: String(form.get("description") || "").trim(),
        subtasks: appState.editingTaskId ? (appState.allTasks.find((item) => item.id === appState.editingTaskId)?.raw.subtasks || []) : [],
        dependencies: appState.editingTaskId ? (appState.allTasks.find((item) => item.id === appState.editingTaskId)?.raw.dependencies || []) : [],
        updatedAt: serverTimestamp()
      };
      if (appState.editingTaskId) {
        if (storyId && matchingStoryTasks.some((item) => !item.raw.userStoryId)) {
          const batch = writeBatch(db);
          matchingStoryTasks.filter((item) => !item.raw.userStoryId && item.id !== appState.editingTaskId).forEach((item) => {
            batch.update(taskReference(item.id), { userStoryId: storyId, updatedAt: serverTimestamp() });
          });
          batch.update(taskReference(appState.editingTaskId), taskData);
          await batch.commit();
        } else {
          await updateDoc(taskReference(appState.editingTaskId), taskData);
        }
      } else {
        const newTaskData = {
          ...taskData,
          status: "To Do",
          archived: false,
          createdBy: appState.user.uid,
          createdAt: serverTimestamp()
        };
        if (storyId && matchingStoryTasks.some((item) => !item.raw.userStoryId)) {
          const batch = writeBatch(db);
          matchingStoryTasks.filter((item) => !item.raw.userStoryId).forEach((item) => {
            batch.update(taskReference(item.id), { userStoryId: storyId, updatedAt: serverTimestamp() });
          });
          batch.set(doc(taskCollection()), newTaskData);
          await batch.commit();
        } else {
          await addDoc(taskCollection(), newTaskData);
        }
      }
      closeTaskEditor();
    } catch (error) {
      console.error("Could not create task", error);
      els.taskEditorError.textContent = "Could not create the task. Please try again.";
    } finally {
      els.saveTaskBtn.disabled = false;
      els.saveTaskBtn.textContent = appState.editingTaskId ? "Save Changes" : "Create Task";
    }
  }

  async function deleteViewedTask() {
    const task = appState.allTasks.find((item) => item.id === appState.viewedTaskId);
    if (!task || !window.confirm(`Delete “${task.task}”? This cannot be undone.`)) return;
    try {
      await deleteDoc(taskReference(task.id));
      closeModal();
    } catch (error) {
      console.error("Could not delete task", error);
      window.alert("Your access does not allow this task deletion.");
    }
  }

  function openProjectEditor(project = null) {
    appState.editingProjectId = project?.id || null;
    els.projectEditorForm.reset();
    if (project) {
      els.newProjectName.value = project.name || "";
      els.projectEditorForm.elements.namedItem("description").value = project.description || "";
      document.getElementById("projectEditorTitle").textContent = "Project Details";
      els.saveProjectBtn.textContent = "Save Project";
    } else {
      document.getElementById("projectEditorTitle").textContent = "New Project";
      els.saveProjectBtn.textContent = "Create Project";
    }
    els.projectEditorError.textContent = "";
    els.projectEditorModal.classList.add("is-open");
    els.projectEditorModal.setAttribute("aria-hidden", "false");
    els.newProjectName.focus();
  }

  function closeProjectEditor() {
    els.projectEditorModal.classList.remove("is-open");
    els.projectEditorModal.setAttribute("aria-hidden", "true");
  }

  async function createProject(event) {
    event.preventDefault();
    const form = new FormData(els.projectEditorForm);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      els.projectEditorError.textContent = "Enter a project name.";
      return;
    }
    els.saveProjectBtn.disabled = true;
    els.saveProjectBtn.textContent = "Creating...";
    try {
      if (appState.editingProjectId) {
        await updateDoc(doc(db, "plannerProjects", appState.editingProjectId), {
          name,
          description: String(form.get("description") || "").trim(),
          archived: false,
          updatedAt: serverTimestamp()
        });
        closeProjectEditor();
        return;
      }
      const projectRef = doc(collection(db, "plannerProjects"));
      const batch = writeBatch(db);
      batch.set(projectRef, {
        name,
        description: String(form.get("description") || "").trim(),
        ownerId: appState.user.uid,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(doc(projectRef, "members", appState.user.uid), {
        uid: appState.user.uid,
        displayName: appState.user.displayName || appState.user.email || "Unnamed user",
        role: "owner",
        addedAt: serverTimestamp()
      });
      batch.set(doc(db, "plannerUserProjects", appState.user.uid, "projects", projectRef.id), {
        role: "owner",
        addedAt: serverTimestamp()
      });
      await batch.commit();
      appState.activeProjectId = projectRef.id;
      closeProjectEditor();
    } catch (error) {
      console.error("Could not create project", error);
      els.projectEditorError.textContent = "Could not create the project. Please try again.";
    } finally {
      els.saveProjectBtn.disabled = false;
      els.saveProjectBtn.textContent = appState.editingProjectId ? "Save Project" : "Create Project";
    }
  }

  async function archiveActiveProject() {
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    if (!active || active.role !== "owner") return;
    if (!window.confirm(`Archive “${active.name}”? Members will no longer be able to open it.`)) return;
    try {
      await updateDoc(doc(db, "plannerProjects", active.id), {
        archived: true,
        updatedAt: serverTimestamp()
      });
      appState.activeProjectId = "default";
    } catch (error) {
      console.error("Could not archive project", error);
      window.alert("Could not archive this project. Please try again.");
    }
  }

  function openMembers() {
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    if (!active || active.role !== "owner") return;
    els.memberForm.reset();
    appState.selectedMember = null;
    loadDirectoryUsers();
    els.memberError.textContent = "";
    els.membersModal.classList.add("is-open");
    els.membersModal.setAttribute("aria-hidden", "false");
    els.memberSelect.focus();
    if (appState.unsubscribeMembers) appState.unsubscribeMembers();
    appState.unsubscribeMembers = onSnapshot(
      collection(db, "plannerProjects", active.id, "members"),
      (snapshot) => renderMembers(snapshot.docs.map((item) => item.data())),
      (error) => {
        console.error("Could not load members", error);
        els.memberError.textContent = "Could not load project members.";
      }
    );
  }

  function closeMembers() {
    els.membersModal.classList.remove("is-open");
    els.membersModal.setAttribute("aria-hidden", "true");
    if (appState.unsubscribeMembers) {
      appState.unsubscribeMembers();
      appState.unsubscribeMembers = null;
    }
  }

  function renderMembers(members) {
    els.memberList.innerHTML = "";
    members.sort((a, b) => a.role.localeCompare(b.role)).forEach((member) => {
      const row = document.createElement("div");
      row.className = "member-row";
      const name = member.displayName || (member.uid === appState.user.uid ? appState.user.displayName || appState.user.email : "Unnamed user");
      const label = document.createElement("span");
      label.textContent = `${name} — ${member.role}`;
      row.appendChild(label);
      if (member.role !== "owner") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger-action member-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => removeMember(member.uid, name));
        row.appendChild(remove);
      }
      els.memberList.appendChild(row);
    });
  }

  async function removeMember(uid, displayName) {
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    if (!active || active.role !== "owner" || !window.confirm(`Remove ${displayName} from this project?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "plannerProjects", active.id, "members", uid));
      batch.delete(doc(db, "plannerUserProjects", uid, "projects", active.id));
      await batch.commit();
    } catch (error) {
      console.error("Could not remove member", error);
      els.memberError.textContent = "Could not remove that member. Please try again.";
    }
  }

  async function addMember(event) {
    event.preventDefault();
    const active = appState.projects.find((project) => project.id === appState.activeProjectId);
    const selected = appState.selectedMember;
    const form = new FormData(els.memberForm);
    const uid = selected?.uid;
    const role = String(form.get("role") || "viewer");
    if (!active || active.role !== "owner" || !uid) {
      els.memberError.textContent = "Choose a user from the dropdown.";
      return;
    }
    els.saveMemberBtn.disabled = true;
    els.memberError.textContent = "";
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "plannerProjects", active.id, "members", uid), {
        uid,
        displayName: selected.displayName,
        role,
        addedAt: serverTimestamp()
      });
      batch.set(doc(db, "plannerUserProjects", uid, "projects", active.id), {
        role,
        addedAt: serverTimestamp()
      });
      await batch.commit();
      els.memberForm.reset();
      appState.selectedMember = null;
    } catch (error) {
      console.error("Could not add member", error);
      els.memberError.textContent = "Could not add that member. Please try again.";
    } finally {
      els.saveMemberBtn.disabled = false;
    }
  }

  async function loadDirectoryUsers() {
    els.memberSelect.innerHTML = '<option value="">Loading users...</option>';
    try {
      const results = await getDocs(query(
        collection(db, "plannerDirectory"),
        orderBy("displayName")
      ));
      els.memberSelect.innerHTML = '<option value="">Choose a user</option>';
      results.docs.forEach((item) => {
        const user = item.data();
        const option = document.createElement("option");
        option.value = user.uid;
        option.textContent = user.displayName;
        option.dataset.displayName = user.displayName;
        els.memberSelect.appendChild(option);
      });
      if (results.empty) els.memberSelect.innerHTML = '<option value="">No signed-in users available</option>';
    } catch (error) {
      console.error("Could not load users", error);
      els.memberSelect.innerHTML = '<option value="">Could not load users</option>';
      els.memberError.textContent = "Could not load users. Please try again.";
    }
  }

  function selectMember() {
    const option = els.memberSelect.options[els.memberSelect.selectedIndex];
    appState.selectedMember = option?.value ? {
      uid: option.value,
      displayName: option.dataset.displayName
    } : null;
    els.memberError.textContent = "";
  }

  function showLoadError() {
    clearBoardColumns();
    const errorMessage = document.createElement("div");
    errorMessage.className = "empty-column";
    errorMessage.textContent = "Could not load planning data. Check your Firebase access and try again.";
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
      if (typeof prefs.activeProjectId === "string") appState.activeProjectId = prefs.activeProjectId;
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
          activeProjectId: appState.activeProjectId,
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

  async function onLogoutClick() {
    if (appState.unsubscribeTasks) appState.unsubscribeTasks();
    await signOutUser();
    window.location.replace("login.html");
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
