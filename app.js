(() => {
  "use strict";

  const STORAGE_KEY = "mahami_app_v1";
  const sections = {
    daily: { title: "مهام يومية", placeholder: "ما المهمة التي تريد إنجازها اليوم؟", icon: "☀️" },
    notes: { title: "ملاحظات", placeholder: "عنوان الملاحظة (اختياري)", icon: "📝" },
    essentials: { title: "ضروريات", placeholder: "أضف شيئًا ضروريًا...", icon: "⭐" },
    projects: { title: "مشاريع", placeholder: "اسم المشروع أو الخطوة التالية...", icon: "📁" },
    mustBuy: { title: "مشتريات ضرورية", placeholder: "ما الذي تحتاج إلى شرائه؟", icon: "🛒" },
    regularBuy: { title: "مشتريات عادية", placeholder: "أضف إلى قائمة المشتريات...", icon: "🧺" }
  };

  const $ = id => document.getElementById(id);
  const form = $("itemForm");
  const titleInput = $("itemTitle");
  const detailsInput = $("itemDetails");
  const dueDateInput = $("itemDueDate");
  const itemsList = $("itemsList");
  const calendarPanel = $("calendarPanel");
  const calendarDays = $("calendarDays");
  const calendarTaskForm = $("calendarTaskForm");
  const calendarTaskInput = $("calendarTaskTitle");
  const calendarCategory = $("calendarCategory");
  const today = new Date();

  let activeSection = "daily";
  let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = toISODate(today);
  let data = loadData();
  let toastTimer;

  function emptyData() {
    return Object.fromEntries(Object.keys(sections).map(key => [key, []]));
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return emptyData();
      const parsed = JSON.parse(saved);
      const clean = emptyData();
      for (const key of Object.keys(clean)) {
        if (Array.isArray(parsed[key])) {
          clean[key] = parsed[key]
            .filter(item => item && typeof item.id === "string" && typeof item.text === "string")
            .map(item => ({
              id: item.id,
              text: item.text,
              completed: !!item.completed,
              createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
              dueDate: typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : ""
            }));
        }
      }
      return clean;
    } catch {
      return emptyData();
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      updateCounts();
    } catch {
      showToast("تعذّر الحفظ. مساحة التخزين قد تكون ممتلئة.");
    }
  }

  function num(value) {
    return new Intl.NumberFormat("ar").format(value);
  }

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function fromISODate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
    return new Intl.DateTimeFormat("ar", options).format(fromISODate(value));
  }

  function allItems() {
    return Object.entries(data).flatMap(([section, items]) =>
      items.map(item => ({ section, item }))
    );
  }

  function itemsForDate(date) {
    return allItems().filter(entry => entry.item.dueDate === date);
  }

  function updateCounts() {
    const all = allItems();
    $("totalCount").textContent = `${num(all.length)} عناصر`;
    const count = activeSection === "calendar"
      ? itemsForDate(selectedDate).length
      : (data[activeSection] || []).length;
    $("sectionCount").textContent = `${num(count)} عناصر`;
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createdTime() {
    return new Date().toLocaleString("ar", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function appendTaskCard(container, section, item, { showSection = false } = {}) {
    const card = document.createElement("article");
    card.className = `item${item.completed ? " completed" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = item.completed;
    check.setAttribute("aria-label", item.completed ? "إلغاء إكمال المهمة" : "تحديد المهمة كمكتملة");
    check.addEventListener("change", () => {
      item.completed = check.checked;
      saveData();
      refreshCurrentView();
    });

    const contentWrap = document.createElement("div");
    contentWrap.className = "item-content";
    const content = document.createElement("div");
    content.textContent = item.text;
    contentWrap.appendChild(content);

    if (showSection) {
      const sectionTag = document.createElement("div");
      sectionTag.className = "item-section-tag";
      sectionTag.textContent = sections[section].title;
      contentWrap.appendChild(sectionTag);
    }

    if (item.createdAt) {
      const created = document.createElement("div");
      created.className = "item-date";
      created.textContent = `أُضيف ${item.createdAt}`;
      contentWrap.appendChild(created);
    }

    const schedule = document.createElement("label");
    schedule.className = "item-schedule";
    const scheduleLabel = document.createElement("span");
    scheduleLabel.textContent = "الموعد";
    const scheduleInput = document.createElement("input");
    scheduleInput.type = "date";
    scheduleInput.value = item.dueDate || "";
    scheduleInput.setAttribute("aria-label", `موعد: ${item.text}`);
    scheduleInput.addEventListener("change", () => {
      item.dueDate = scheduleInput.value;
      saveData();
      refreshCurrentView();
      showToast(item.dueDate ? `أُضيف الموعد: ${formatDate(item.dueDate)}` : "أُزيل موعد المهمة");
    });
    schedule.append(scheduleLabel, scheduleInput);
    contentWrap.appendChild(schedule);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `حذف: ${item.text}`);
    del.addEventListener("click", () => {
      data[section] = data[section].filter(entry => entry.id !== item.id);
      saveData();
      refreshCurrentView();
      showToast("تم حذف العنصر");
    });

    card.append(check, contentWrap, del);
    container.appendChild(card);
  }

  function renderRegularItems() {
    const section = sections[activeSection];
    itemsList.replaceChildren();

    if (!data[activeSection].length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      const icon = document.createElement("div");
      icon.className = "empty-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = section.icon;
      const heading = document.createElement("strong");
      heading.textContent = "لا توجد عناصر بعد";
      const message = document.createElement("span");
      message.textContent = "أضف أول عنصر من الحقل أعلاه.";
      empty.append(icon, heading, message);
      itemsList.appendChild(empty);
    } else {
      data[activeSection].forEach(item => appendTaskCard(itemsList, activeSection, item));
    }
  }

  function renderCalendar() {
    $("calendarMonthTitle").textContent = new Intl.DateTimeFormat("ar", {
      month: "long", year: "numeric"
    }).format(calendarMonth);
    $("selectedDateTitle").textContent = formatDate(selectedDate, {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    calendarTaskInput.placeholder = `أضف مهمة ليوم ${formatDate(selectedDate, { day: "numeric", month: "short" })}`;

    const weekdayNames = [
      { short: "أحد", full: "الأحد" }, { short: "إثن", full: "الإثنين" },
      { short: "ثلا", full: "الثلاثاء" }, { short: "أرب", full: "الأربعاء" },
      { short: "خمي", full: "الخميس" }, { short: "جمع", full: "الجمعة" },
      { short: "سبت", full: "السبت" }
    ];
    const weekdays = $("calendarWeekdays");
    if (!weekdays.childElementCount) {
      weekdayNames.forEach(day => {
        const label = document.createElement("span");
        label.textContent = day.short;
        label.title = day.full;
        label.setAttribute("aria-label", day.full);
        weekdays.appendChild(label);
      });
    }

    calendarDays.replaceChildren();
    const firstOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    const todayKey = toISODate(new Date());
    const fragment = document.createDocumentFragment();

    for (let offset = 0; offset < 42; offset += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + offset);
      const dateKey = toISODate(date);
      const count = itemsForDate(dateKey).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      if (date.getMonth() !== calendarMonth.getMonth()) button.classList.add("outside-month");
      if (dateKey === selectedDate) button.classList.add("selected");
      if (dateKey === todayKey) button.classList.add("today");
      button.dataset.date = dateKey;
      button.tabIndex = dateKey === selectedDate ? 0 : -1;
      button.setAttribute("aria-pressed", String(dateKey === selectedDate));
      button.setAttribute("aria-label", `${formatDate(dateKey, {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      })}، ${num(count)} مهام`);

      const dayNumber = document.createElement("span");
      dayNumber.className = "calendar-day-number";
      dayNumber.textContent = num(date.getDate());
      const countLabel = document.createElement("span");
      countLabel.className = "calendar-day-count";
      countLabel.textContent = count ? num(count) : "";
      button.append(dayNumber, countLabel);
      fragment.appendChild(button);
    }
    calendarDays.appendChild(fragment);

    const entries = itemsForDate(selectedDate);
    $("selectedDateCount").textContent = `${num(entries.length)} عناصر`;
    const dayItems = $("calendarItems");
    dayItems.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty calendar-empty";
      empty.innerHTML = "<strong>لا توجد مهام لهذا اليوم</strong><span>أضف مهمة هنا أو حدّد موعدًا لها من أي قسم.</span>";
      dayItems.appendChild(empty);
    } else {
      entries.forEach(({ section, item }) => appendTaskCard(dayItems, section, item, { showSection: true }));
    }
    updateCounts();
  }

  function refreshCurrentView() {
    if (activeSection === "calendar") renderCalendar();
    else {
      renderRegularItems();
      updateCounts();
    }
  }

  function render() {
    const isCalendar = activeSection === "calendar";
    $("regularView").hidden = isCalendar;
    calendarPanel.hidden = !isCalendar;
    $("tabs").querySelectorAll(".tab").forEach(button => {
      const active = button.dataset.section === activeSection;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    if (isCalendar) {
      renderCalendar();
      return;
    }

    const section = sections[activeSection];
    $("sectionTitle").textContent = section.title;
    titleInput.placeholder = section.placeholder;
    form.classList.toggle("note-mode", activeSection === "notes");
    renderRegularItems();
    updateCounts();
  }

  function addCalendarTask(event) {
    event.preventDefault();
    const text = calendarTaskInput.value.trim();
    if (!text) {
      calendarTaskInput.focus();
      showToast("اكتب اسم المهمة أولًا");
      return;
    }
    const section = sections[calendarCategory.value] ? calendarCategory.value : "daily";
    data[section].unshift({
      id: makeId(),
      text,
      completed: false,
      createdAt: createdTime(),
      dueDate: selectedDate
    });
    saveData();
    calendarTaskInput.value = "";
    renderCalendar();
    calendarTaskInput.focus();
    showToast("تمت إضافة المهمة إلى التقويم");
  }

  function moveCalendarMonth(delta) {
    const selected = fromISODate(selectedDate);
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
    const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    calendarMonth = nextMonth;
    selectedDate = toISODate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(selected.getDate(), maxDay)));
    renderCalendar();
  }

  function moveCalendarSelection(delta) {
    const next = fromISODate(selectedDate);
    next.setDate(next.getDate() + delta);
    selectedDate = toISODate(next);
    calendarMonth = new Date(next.getFullYear(), next.getMonth(), 1);
    renderCalendar();
    calendarDays.querySelector(`[data-date="${selectedDate}"]`)?.focus();
  }

  Object.entries(sections).forEach(([key, section]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = section.title;
    calendarCategory.appendChild(option);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const details = detailsInput.value.trim();
    const text = activeSection === "notes" ? [title, details].filter(Boolean).join("\n") : title;
    if (!text) {
      (activeSection === "notes" && !title ? detailsInput : titleInput).focus();
      showToast("اكتب شيئًا أولًا");
      return;
    }

    data[activeSection].unshift({
      id: makeId(),
      text,
      completed: false,
      createdAt: createdTime(),
      dueDate: dueDateInput.value || ""
    });
    saveData();
    render();
    titleInput.value = "";
    detailsInput.value = "";
    dueDateInput.value = "";
    (activeSection === "notes" ? detailsInput : titleInput).focus();
    showToast("تمت الإضافة والحفظ");
  });

  $("clearInput").addEventListener("click", () => {
    titleInput.value = "";
    detailsInput.value = "";
    dueDateInput.value = "";
    (activeSection === "notes" ? detailsInput : titleInput).focus();
  });

  $("tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    activeSection = button.dataset.section;
    render();
    titleInput.value = "";
    detailsInput.value = "";
    dueDateInput.value = "";
  });

  $("previousMonth").addEventListener("click", () => moveCalendarMonth(-1));
  $("nextMonth").addEventListener("click", () => moveCalendarMonth(1));
  $("calendarToday").addEventListener("click", () => {
    const now = new Date();
    calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    selectedDate = toISODate(now);
    renderCalendar();
  });
  calendarDays.addEventListener("click", event => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    selectedDate = button.dataset.date;
    const date = fromISODate(selectedDate);
    calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
  });
  calendarDays.addEventListener("keydown", event => {
    const movements = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in movements) {
      event.preventDefault();
      moveCalendarSelection(movements[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const date = fromISODate(selectedDate);
      date.setDate(date.getDate() + (event.key === "Home" ? -date.getDay() : 6 - date.getDay()));
      const delta = Math.round((date - fromISODate(selectedDate)) / 86400000);
      moveCalendarSelection(delta);
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveCalendarMonth(event.key === "PageUp" ? -1 : 1);
      calendarDays.querySelector(`[data-date="${selectedDate}"]`)?.focus();
    }
  });
  calendarTaskForm.addEventListener("submit", addCalendarTask);

  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .catch(() => showToast("تعذّر تفعيل العمل دون إنترنت"));
    });
  }
})();
