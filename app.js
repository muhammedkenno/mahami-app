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
  const WEEKDAYS = [
    { value: 0, short: "أحد", full: "الأحد" }, { value: 1, short: "إثن", full: "الإثنين" },
    { value: 2, short: "ثلا", full: "الثلاثاء" }, { value: 3, short: "أرب", full: "الأربعاء" },
    { value: 4, short: "خمي", full: "الخميس" }, { value: 5, short: "جمع", full: "الجمعة" },
    { value: 6, short: "سبت", full: "السبت" }
  ];

  const $ = id => document.getElementById(id);
  const form = $("itemForm");
  const titleInput = $("itemTitle");
  const detailsInput = $("itemDetails");
  const itemsList = $("itemsList");
  const calendarPanel = $("calendarPanel");
  const financePanel = $("financePanel");
  const gymPanel = $("gymPanel");
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

  function isDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return emptyData();
      const parsed = JSON.parse(saved);
      const clean = emptyData();
      for (const key of Object.keys(clean)) {
        if (!Array.isArray(parsed[key])) continue;
        clean[key] = parsed[key]
          .filter(item => item && typeof item.id === "string" && typeof item.text === "string")
          .map(item => {
            const legacyDate = isDate(item.dueDate) ? item.dueDate : "";
            const startDate = isDate(item.startDate) ? item.startDate : legacyDate || (isDate(item.endDate) ? item.endDate : "");
            const endDate = isDate(item.endDate) ? item.endDate : legacyDate;
            const repeatDays = Array.isArray(item.repeatDays)
              ? [...new Set(item.repeatDays.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
              : [];
            return {
              id: item.id,
              text: item.text,
              completed: !!item.completed,
              createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
              startDate,
              endDate,
              repeatDays,
              completedDates: Array.isArray(item.completedDates) ? item.completedDates.filter(isDate) : []
            };
          });
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
    return isDate(value) ? new Intl.DateTimeFormat("ar", options).format(fromISODate(value)) : "";
  }

  function repeatDaysFor(item) {
    return Array.isArray(item.repeatDays) ? item.repeatDays : [];
  }

  function scheduledOn(item, date) {
    const start = item.startDate || "";
    const end = item.endDate || "";
    const repeatDays = repeatDaysFor(item);
    if (repeatDays.length) {
      if (start && date < start) return false;
      if (end && date > end) return false;
      return repeatDays.includes(fromISODate(date).getDay());
    }
    if (!start) return false;
    return date >= start && date <= (end || start);
  }

  function allItems() {
    return Object.entries(data).flatMap(([section, items]) => items.map(item => ({ section, item })));
  }

  function itemsForDate(date) {
    return allItems().filter(({ item }) => scheduledOn(item, date));
  }

  function updateCounts() {
    const all = allItems();
    const financeCount = window.MahamiFinance?.count() || 0;
    $("totalCount").textContent = `${num(all.length + financeCount)} سجلات`;
    const gymCount = window.MahamiGym?.count() || 0;
    const count = activeSection === "calendar"
      ? itemsForDate(selectedDate).length
      : activeSection === "expenses" ? financeCount : activeSection === "gym" ? gymCount : (data[activeSection] || []).length;
    const target = activeSection === "expenses" ? $("financeCount") : activeSection === "gym" ? $("gymCount") : $("sectionCount");
    const label = activeSection === "expenses" ? "حركات" : activeSection === "gym" ? "أيام تدريب" : "عناصر";
    target.textContent = `${num(count)} ${label}`;
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createdTime() {
    return new Date().toLocaleString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function scheduleDescription(item) {
    const days = repeatDaysFor(item);
    if (days.length) {
      const names = days.map(day => WEEKDAYS.find(entry => entry.value === day)?.full).filter(Boolean).join("، ");
      let text = `أسبوعيًا: ${names}`;
      if (item.startDate) text += ` · من ${formatDate(item.startDate)}`;
      if (item.endDate) text += ` إلى ${formatDate(item.endDate)}`;
      return text;
    }
    if (!item.startDate) return "بدون موعد";
    if (item.endDate && item.endDate !== item.startDate) {
      return `من ${formatDate(item.startDate)} إلى ${formatDate(item.endDate)}`;
    }
    return formatDate(item.startDate);
  }

  function fillDayPicker(container, prefix, checkedDays = []) {
    container.replaceChildren();
    WEEKDAYS.forEach(day => {
      const label = document.createElement("label");
      label.className = "weekday-chip";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = prefix;
      checkbox.value = String(day.value);
      checkbox.checked = checkedDays.includes(day.value);
      checkbox.setAttribute("aria-label", day.full);
      const text = document.createElement("span");
      text.textContent = day.short;
      label.append(checkbox, text);
      container.appendChild(label);
    });
  }

  function selectedDays(container) {
    return [...container.querySelectorAll('input[type="checkbox"]:checked')]
      .map(input => Number(input.value))
      .sort((a, b) => a - b);
  }

  function setDayPickerVisible(checkbox, container) {
    container.hidden = !checkbox.checked;
  }

  function clearScheduleError(formElement) {
    formElement.querySelectorAll(".schedule-error").forEach(error => error.remove());
    formElement.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute("aria-invalid"));
    formElement.querySelectorAll("[aria-describedby]").forEach(field => {
      const ids = field.getAttribute("aria-describedby").split(/\s+/).filter(id => !id.startsWith("schedule-error-"));
      if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
      else field.removeAttribute("aria-describedby");
    });
  }

  function showScheduleError(formElement, target, message) {
    clearScheduleError(formElement);
    const error = document.createElement("p");
    error.className = "schedule-error";
    error.id = `schedule-error-${makeId()}`;
    error.setAttribute("role", "alert");
    error.textContent = message;
    const anchor = target.closest(".weekday-picker, .date-range-fields") || formElement;
    anchor.insertAdjacentElement("afterend", error);
    target.setAttribute("aria-invalid", "true");
    target.setAttribute("aria-describedby", error.id);
    target.focus();
  }

  function setupScheduleErrors(formElement) {
    ["input", "change"].forEach(type => formElement.addEventListener(type, event => {
      const field = event.target;
      if (field.matches('input[type="date"], input[type="checkbox"]')) clearScheduleError(formElement);
    }));
  }

  function setupRepeatToggle(toggle, dayPicker, startInput) {
    toggle.addEventListener("change", () => {
      setDayPickerVisible(toggle, dayPicker);
      if (toggle.checked && !startInput.value) startInput.value = toISODate(new Date());
    });
  }

  function readSchedule(startInput, endInput, repeatToggle, dayPicker, fallbackStart = "") {
    let startDate = startInput.value;
    let endDate = endInput.value;
    const repeatDays = repeatToggle.checked ? selectedDays(dayPicker) : [];
    if (!startDate && endDate) startDate = endDate;
    if (!startDate && repeatToggle.checked) startDate = fallbackStart || toISODate(new Date());
    if (endDate && !startDate) startDate = endDate;
    if (startDate && endDate && endDate < startDate) {
      showScheduleError(endInput.closest("form"), endInput, "تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له.");
      return null;
    }
    if (repeatToggle.checked && repeatDays.length === 0) {
      const dayInput = dayPicker.querySelector("input");
      if (dayInput) showScheduleError(dayInput.closest("form"), dayInput, "اختر يومًا واحدًا على الأقل للتكرار الأسبوعي.");
      return null;
    }
    return { startDate, endDate, repeatDays, completedDates: [] };
  }

  function setSchedule(item, schedule) {
    item.startDate = schedule.startDate;
    item.endDate = schedule.endDate;
    item.repeatDays = schedule.repeatDays;
    if (!Array.isArray(item.completedDates)) item.completedDates = [];
  }

  function updateTask(section, item, occurrenceDate, completed) {
    if (repeatDaysFor(item).length && occurrenceDate) {
      const dates = new Set(Array.isArray(item.completedDates) ? item.completedDates : []);
      if (completed) dates.add(occurrenceDate);
      else dates.delete(occurrenceDate);
      item.completedDates = [...dates].sort();
    } else {
      item.completed = completed;
    }
    saveData();
    refreshCurrentView();
  }

  function moveTask(section, item, direction) {
    const list = data[section];
    const index = list.findIndex(entry => entry.id === item.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    saveData();
    renderRegularItems();
    updateCounts();
  }

  function buildScheduleEditor(section, item) {
    const details = document.createElement("details");
    details.className = "item-schedule-editor";
    const summary = document.createElement("summary");
    summary.textContent = `المواعيد: ${scheduleDescription(item)}`;

    const editor = document.createElement("form");
    editor.className = "schedule-editor";
    const range = document.createElement("div");
    range.className = "schedule-range-fields";
    const startLabel = document.createElement("label");
    startLabel.textContent = "من تاريخ";
    const startInput = document.createElement("input");
    startInput.type = "date";
    startInput.value = item.startDate || "";
    startLabel.appendChild(startInput);
    const endLabel = document.createElement("label");
    endLabel.textContent = "إلى تاريخ (اختياري)";
    const endInput = document.createElement("input");
    endInput.type = "date";
    endInput.value = item.endDate || "";
    endLabel.appendChild(endInput);
    range.append(startLabel, endLabel);

    const repeatLabel = document.createElement("label");
    repeatLabel.className = "repeat-toggle";
    const repeatToggle = document.createElement("input");
    repeatToggle.type = "checkbox";
    repeatToggle.checked = repeatDaysFor(item).length > 0;
    const repeatText = document.createElement("span");
    repeatText.textContent = "كرر أسبوعيًا";
    repeatLabel.append(repeatToggle, repeatText);

    const dayPicker = document.createElement("div");
    dayPicker.className = "weekday-picker";
    fillDayPicker(dayPicker, `edit-${item.id}`, repeatDaysFor(item));
    dayPicker.hidden = !repeatToggle.checked;
    setupRepeatToggle(repeatToggle, dayPicker, startInput);

    const save = document.createElement("button");
    save.type = "submit";
    save.className = "schedule-save";
    save.textContent = "حفظ الموعد";
    editor.append(range, repeatLabel, dayPicker, save);
    editor.addEventListener("submit", event => {
      event.preventDefault();
      const schedule = readSchedule(startInput, endInput, repeatToggle, dayPicker);
      if (!schedule) return;
      setSchedule(item, schedule);
      saveData();
      refreshCurrentView();
      showToast("تم تحديث موعد المهمة");
    });
    setupScheduleErrors(editor);
    details.append(summary, editor);
    return details;
  }

  function appendTaskCard(container, section, item, { showSection = false, occurrenceDate = "", allowReorder = false } = {}) {
    const recurring = repeatDaysFor(item).length > 0;
    const todayKey = toISODate(new Date());
    const completionDate = occurrenceDate || (recurring && scheduledOn(item, todayKey) ? todayKey : "");
    const isCompleted = recurring
      ? !!completionDate && (item.completedDates || []).includes(completionDate)
      : !!item.completed;
    const card = document.createElement("article");
    card.className = `item${isCompleted ? " completed" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = isCompleted;
    check.disabled = recurring && !completionDate;
    const occurrenceLabel = completionDate ? formatDate(completionDate, { weekday: "long", day: "numeric", month: "long" }) : "";
    const checkLabel = recurring
      ? `${isCompleted ? "إلغاء إكمال" : "إكمال"} تكرار ${occurrenceLabel}: ${item.text}`
      : (isCompleted ? `إلغاء إكمال: ${item.text}` : `تحديد كمكتمل: ${item.text}`);
    check.setAttribute("aria-label", checkLabel);
    if (check.disabled) check.title = "لا يوجد تكرار مجدول لهذا اليوم";
    check.addEventListener("change", () => updateTask(section, item, completionDate, check.checked));

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

    if (recurring && !completionDate) {
      const repeatNote = document.createElement("div");
      repeatNote.className = "item-date";
      repeatNote.textContent = "يُتاح إكمال كل تكرار في يومه المحدد";
      contentWrap.appendChild(repeatNote);
    }

    if (item.createdAt) {
      const created = document.createElement("div");
      created.className = "item-date";
      created.textContent = `أُضيف ${item.createdAt}`;
      contentWrap.appendChild(created);
    }
    contentWrap.appendChild(buildScheduleEditor(section, item));

    const actions = document.createElement("div");
    actions.className = "item-actions";
    if (allowReorder) {
      const index = data[section].findIndex(entry => entry.id === item.id);
      const up = document.createElement("button");
      up.type = "button";
      up.className = "order-btn";
      up.textContent = "↑";
      up.disabled = index === 0;
      up.setAttribute("aria-label", `نقل ${item.text} للأعلى`);
      up.addEventListener("click", () => moveTask(section, item, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.className = "order-btn";
      down.textContent = "↓";
      down.disabled = index === data[section].length - 1;
      down.setAttribute("aria-label", `نقل ${item.text} للأسفل`);
      down.addEventListener("click", () => moveTask(section, item, 1));
      actions.append(up, down);
    }

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
    actions.appendChild(del);
    card.append(check, contentWrap, actions);
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
      data[activeSection].forEach(item => appendTaskCard(itemsList, activeSection, item, { allowReorder: true }));
    }
  }

  function renderCalendar() {
    $("calendarMonthTitle").textContent = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(calendarMonth);
    $("selectedDateTitle").textContent = formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("calendarTaskStartDate").value = selectedDate;
    calendarTaskInput.placeholder = `أضف مهمة ليوم ${formatDate(selectedDate, { day: "numeric", month: "short" })}`;

    const weekdays = $("calendarWeekdays");
    if (!weekdays.childElementCount) {
      WEEKDAYS.forEach(day => {
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
      button.setAttribute("aria-label", `${formatDate(dateKey, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}، ${num(count)} مهام`);
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
      entries.forEach(({ section, item }) => appendTaskCard(dayItems, section, item, { showSection: true, occurrenceDate: selectedDate }));
    }
    updateCounts();
  }

  function refreshCurrentView() {
    if (activeSection === "calendar") renderCalendar();
    else if (activeSection === "expenses") {
      window.MahamiFinance?.render();
      updateCounts();
    }
    else if (activeSection === "gym") {
      window.MahamiGym?.render();
      updateCounts();
    }
    else {
      renderRegularItems();
      updateCounts();
    }
  }

  function render() {
    const isCalendar = activeSection === "calendar";
    const isExpenses = activeSection === "expenses";
    const isGym = activeSection === "gym";
    $("regularView").hidden = isCalendar || isExpenses || isGym;
    calendarPanel.hidden = !isCalendar;
    financePanel.hidden = !isExpenses;
    gymPanel.hidden = !isGym;
    $("tabs").querySelectorAll(".tab").forEach(button => {
      const active = button.dataset.section === activeSection;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (isCalendar) {
      renderCalendar();
      return;
    }
    if (isExpenses) {
      window.MahamiFinance?.render();
      updateCounts();
      return;
    }
    if (isGym) {
      window.MahamiGym?.render();
      updateCounts();
      return;
    }
    const section = sections[activeSection];
    $("sectionTitle").textContent = section.title;
    titleInput.placeholder = section.placeholder;
    form.classList.toggle("note-mode", activeSection === "notes");
    renderRegularItems();
    updateCounts();
  }

  function makeTask(text, schedule) {
    return { id: makeId(), text, completed: false, createdAt: createdTime(), ...schedule };
  }

  function resetScheduleForm({ start, end, repeat, days, startValue = "" }) {
    start.value = startValue;
    end.value = "";
    repeat.checked = false;
    days.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
    days.hidden = true;
  }

  function addCalendarTask(event) {
    event.preventDefault();
    const text = calendarTaskInput.value.trim();
    if (!text) {
      calendarTaskInput.focus();
      showToast("اكتب اسم المهمة أولًا");
      return;
    }
    const schedule = readSchedule(
      $("calendarTaskStartDate"), $("calendarTaskEndDate"), $("calendarTaskRepeatWeekly"), $("calendarTaskRepeatDays"), selectedDate
    );
    if (!schedule) return;
    const section = sections[calendarCategory.value] ? calendarCategory.value : "daily";
    data[section].unshift(makeTask(text, schedule));
    saveData();
    calendarTaskInput.value = "";
    resetScheduleForm({
      start: $("calendarTaskStartDate"), end: $("calendarTaskEndDate"), repeat: $("calendarTaskRepeatWeekly"),
      days: $("calendarTaskRepeatDays"), startValue: selectedDate
    });
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

  function setupComposerSchedule(prefix) {
    const repeat = $(`${prefix}RepeatWeekly`);
    const days = $(`${prefix}RepeatDays`);
    const start = $(`${prefix}StartDate`);
    setupRepeatToggle(repeat, days, start);
    fillDayPicker(days, `${prefix}-day`);
  }

  Object.entries(sections).forEach(([key, section]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = section.title;
    calendarCategory.appendChild(option);
  });
  setupComposerSchedule("item");
  setupComposerSchedule("calendarTask");
  setupScheduleErrors(form);
  setupScheduleErrors(calendarTaskForm);

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
    const schedule = readSchedule($("itemStartDate"), $("itemEndDate"), $("itemRepeatWeekly"), $("itemRepeatDays"));
    if (!schedule) return;
    data[activeSection].unshift(makeTask(text, schedule));
    saveData();
    render();
    titleInput.value = "";
    detailsInput.value = "";
    resetScheduleForm({
      start: $("itemStartDate"), end: $("itemEndDate"), repeat: $("itemRepeatWeekly"), days: $("itemRepeatDays")
    });
    (activeSection === "notes" ? detailsInput : titleInput).focus();
    showToast("تمت الإضافة والحفظ");
  });

  $("clearInput").addEventListener("click", () => {
    titleInput.value = "";
    detailsInput.value = "";
    resetScheduleForm({ start: $("itemStartDate"), end: $("itemEndDate"), repeat: $("itemRepeatWeekly"), days: $("itemRepeatDays") });
    (activeSection === "notes" ? detailsInput : titleInput).focus();
  });

  $("tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    activeSection = button.dataset.section;
    render();
    titleInput.value = "";
    detailsInput.value = "";
  });
  window.addEventListener("mahami-finance-change", updateCounts);
  window.addEventListener("mahami-gym-change", updateCounts);
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
      navigator.serviceWorker.register("./sw.js").catch(() => showToast("تعذّر تفعيل العمل دون إنترنت"));
    });
  }
})();
