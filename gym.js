(() => {
  "use strict";

  const STORAGE_KEY = "mahami_gym_program_v1";
  const DEFAULT_PROGRAM = {
    days: [
      {
        id: "saturday", name: "السبت", muscles: "صدر + أكتاف + تراي", focus: "تضخيم الصدر", rest: false,
        subtitle: "يوم الصدر الأساسي",
        exercises: [
          ["Chest Press Machine", "3", "8–12"],
          ["Incline Chest Press", "3", "8–12"],
          ["Pec Deck", "2", "12–15"],
          ["Shoulder Press Machine", "2", "10–12"],
          ["Lateral Raise Machine", "3", "12–15"],
          ["Triceps Pushdown", "3", "10–15"]
        ]
      },
      {
        id: "sunday", name: "الأحد", muscles: "ظهر + باي + ساعد", focus: "عرض الظهر والباي", rest: false,
        subtitle: "",
        exercises: [
          ["Lat Pulldown", "3", "8–12"],
          ["Seated Cable Row", "3", "10–12"],
          ["Chest Supported Row", "2", "10–12"],
          ["Preacher Curl Machine", "3", "8–12"],
          ["Cable Biceps Curl", "2", "10–15"],
          ["Hammer Curl", "2", "10–12"],
          ["Reverse Wrist Curl", "2", "12–15"]
        ]
      },
      {
        id: "monday", name: "الاثنين", muscles: "راحة", focus: "استشفاء", rest: true,
        subtitle: "", exercises: []
      },
      {
        id: "tuesday", name: "الثلاثاء", muscles: "أرجل + بطن", focus: "المحافظة على الأرجل", rest: false,
        subtitle: "حجم تمرين متوسط للمحافظة على عضلات الأرجل دون إعطائها الأولوية.",
        exercises: [
          ["Leg Press", "3", "10–12"],
          ["Seated Leg Curl", "3", "12–15"],
          ["Leg Extension", "2", "12–15"],
          ["Calf Raise", "2", "15–20"],
          ["Abdominal Crunch Machine", "3", "12–15"],
          ["Plank", "2", "30–45 ثانية"]
        ]
      },
      {
        id: "wednesday", name: "الأربعاء", muscles: "أكتاف + صدر + ذراعان", focus: "تضخيم الجزء العلوي", rest: false,
        subtitle: "يوم التركيز على الشكل والتفاصيل",
        exercises: [
          ["Incline Chest Press", "3", "8–12"],
          ["Cable Chest Fly", "2", "12–15"],
          ["Lateral Raise Machine", "3", "12–20"],
          ["Rear Delt Machine", "2", "12–15"],
          ["Biceps Curl Machine", "2", "10–12"],
          ["Rope Triceps Pushdown", "3", "10–15"],
          ["Wrist Curl", "2", "15–20"]
        ]
      },
      {
        id: "thursday", name: "الخميس", muscles: "راحة", focus: "استشفاء", rest: true,
        subtitle: "", exercises: []
      },
      {
        id: "friday", name: "الجمعة", muscles: "راحة", focus: "استشفاء", rest: true,
        subtitle: "", exercises: []
      }
    ],
    duration: "50–60 دقيقة تقريبًا",
    compoundRest: "90–120 ثانية",
    isolationRest: "60–90 ثانية"
  };

  const $ = id => document.getElementById(id);
  const weekDisplay = $("gymWeekDisplay");
  const weekEditor = $("gymWeekEditor");
  const workoutCards = $("gymWorkoutCards");
  const rulesDisplay = $("gymRulesDisplay");
  const rulesEditor = $("gymRulesEditor");
  const statusBox = $("gymStatus");
  const editWeekButton = $("gymEditWeekButton");
  const editRulesButton = $("gymEditRulesButton");
  if (!weekDisplay || !weekEditor || !workoutCards || !rulesDisplay || !rulesEditor || !statusBox) return;

  let program = loadProgram();
  let editingWeek = false;
  let editingRules = false;
  let editingWorkoutId = "";
  const openWorkoutIds = new Set();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultProgram() {
    const fresh = clone(DEFAULT_PROGRAM);
    fresh.days = fresh.days.map(day => ({
      ...day,
      exercises: day.exercises.map(([name, sets, reps], index) => ({
        id: `${day.id}-${index + 1}`,
        name,
        sets,
        reps
      }))
    }));
    return fresh;
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `gym-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function textValue(value, fallback = "") {
    return typeof value === "string" ? value.slice(0, 180) : fallback;
  }

  function normalizeProgram(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.days)) return defaultProgram();
    const days = DEFAULT_PROGRAM.days.map(defaultDay => {
      const saved = value.days.find(day => day && day.id === defaultDay.id) || {};
      const rawExercises = Array.isArray(saved.exercises) ? saved.exercises : defaultDay.exercises.map((exercise, index) => ({
        id: `${defaultDay.id}-${index + 1}`, name: exercise[0], sets: exercise[1], reps: exercise[2]
      }));
      const exercises = rawExercises.filter(exercise => exercise && typeof exercise === "object").map((exercise, index) => ({
        id: typeof exercise.id === "string" && exercise.id ? exercise.id.slice(0, 90) : `${defaultDay.id}-${index + 1}-${makeId()}`,
        name: textValue(exercise.name),
        sets: textValue(String(exercise.sets ?? ""), "3").slice(0, 3),
        reps: textValue(exercise.reps, "").slice(0, 40)
      }));
      return {
        id: defaultDay.id,
        name: defaultDay.name,
        muscles: textValue(saved.muscles, defaultDay.muscles),
        focus: textValue(saved.focus, defaultDay.focus),
        rest: typeof saved.rest === "boolean" ? saved.rest : defaultDay.rest,
        subtitle: textValue(saved.subtitle, defaultDay.subtitle),
        exercises
      };
    });
    return {
      days,
      duration: textValue(value.duration, DEFAULT_PROGRAM.duration),
      compoundRest: textValue(value.compoundRest, DEFAULT_PROGRAM.compoundRest),
      isolationRest: textValue(value.isolationRest, DEFAULT_PROGRAM.isolationRest)
    };
  }

  function loadProgram() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeProgram(JSON.parse(saved)) : defaultProgram();
    } catch {
      return defaultProgram();
    }
  }

  function el(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function button(text, className, label = text) {
    const element = el("button", className, text);
    element.type = "button";
    element.setAttribute("aria-label", label);
    return element;
  }

  function labelWithInput(labelText, input, className = "") {
    const label = el("label", className);
    label.append(el("span", "gym-field-label", labelText), input);
    return label;
  }

  function textInput(value, name, maxLength = 180) {
    const input = el("input", "gym-input");
    input.type = "text";
    input.name = name;
    input.maxLength = maxLength;
    input.value = value;
    input.autocomplete = "off";
    return input;
  }

  function textArea(value, name, rows = 2) {
    const input = el("textarea", "gym-input gym-textarea");
    input.name = name;
    input.maxLength = 180;
    input.rows = rows;
    input.value = value;
    return input;
  }

  function setStatus(message, isError = false) {
    statusBox.textContent = message;
    statusBox.classList.toggle("error", isError);
  }

  function showFormError(form, target, message) {
    const error = form.querySelector(".gym-form-error");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    if (target) {
      target.setAttribute("aria-invalid", "true");
      target.focus();
    }
  }

  function clearFormError(form) {
    const error = form.querySelector(".gym-form-error");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
    form.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute("aria-invalid"));
  }

  function commit(candidate, message) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    } catch {
      setStatus("تعذّر حفظ التغييرات. مساحة التخزين قد تكون ممتلئة.", true);
      return false;
    }
    program = candidate;
    editingWeek = false;
    editingRules = false;
    editingWorkoutId = "";
    setStatus(message);
    render();
    window.dispatchEvent(new Event("mahami-gym-change"));
    return true;
  }

  function renderWeekTable() {
    const table = el("table", "gym-table gym-week-table");
    const caption = el("caption", "visually-hidden", "جدول النادي الأسبوعي: اليوم والعضلات المستهدفة والتركيز");
    table.appendChild(caption);
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["اليوم", "العضلات المستهدفة", "التركيز"].forEach(text => {
      const cell = el("th", "", text);
      cell.scope = "col";
      headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement("tbody");
    program.days.forEach(day => {
      const row = document.createElement("tr");
      if (day.rest) row.className = "gym-rest-row";
      const dayCell = el("th", "gym-day-name");
      dayCell.scope = "row";
      dayCell.append(el("span", "", day.name));
      if (day.rest) dayCell.appendChild(el("span", "gym-rest-pill", "راحة"));
      const muscles = el("td", "gym-muscles-cell", day.muscles);
      const focus = el("td", "gym-focus-cell", day.focus);
      row.append(dayCell, muscles, focus);
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    return table;
  }

  function renderWeekEditor() {
    const form = el("form", "gym-editor-form gym-week-form");
    form.noValidate = true;
    const intro = el("p", "gym-form-intro", "عدّل العضلات المستهدفة والتركيز أو غيّر حالة اليوم إلى راحة.");
    form.appendChild(intro);
    program.days.forEach(day => {
      const group = el("fieldset", "gym-week-editor-day");
      const legend = el("legend", "", day.name);
      const restLabel = el("label", "gym-rest-toggle");
      const rest = document.createElement("input");
      rest.type = "checkbox";
      rest.name = `rest-${day.id}`;
      rest.checked = day.rest;
      rest.setAttribute("aria-label", `${day.name}: يوم راحة`);
      restLabel.append(rest, el("span", "", "يوم راحة"));
      const muscles = textInput(day.muscles, `muscles-${day.id}`, 120);
      muscles.required = true;
      const focus = textInput(day.focus, `focus-${day.id}`, 120);
      focus.required = true;
      group.append(
        legend,
        restLabel,
        labelWithInput("العضلات المستهدفة", muscles),
        labelWithInput("التركيز", focus)
      );
      form.appendChild(group);
    });
    const error = el("p", "gym-form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const actions = el("div", "gym-form-actions");
    const save = el("button", "gym-action gym-primary-action", "حفظ الجدول");
    save.type = "submit";
    const cancel = button("إلغاء", "gym-secondary-action", "إلغاء تعديل الجدول الأسبوعي");
    actions.append(save, cancel);
    form.append(error, actions);
    form.addEventListener("input", () => clearFormError(form));
    form.addEventListener("change", () => clearFormError(form));
    cancel.addEventListener("click", () => {
      editingWeek = false;
      renderWeek();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      clearFormError(form);
      const candidate = clone(program);
      for (const day of candidate.days) {
        const muscles = form.elements.namedItem(`muscles-${day.id}`);
        const focus = form.elements.namedItem(`focus-${day.id}`);
        if (!muscles.value.trim() || !focus.value.trim()) {
          showFormError(form, !muscles.value.trim() ? muscles : focus, "أكمل العضلات المستهدفة والتركيز لكل يوم.");
          return;
        }
        day.muscles = muscles.value.trim();
        day.focus = focus.value.trim();
        day.rest = form.elements.namedItem(`rest-${day.id}`).checked;
      }
      commit(candidate, "تم حفظ جدول الأسبوع.");
    });
    return form;
  }

  function renderWeek() {
    weekDisplay.hidden = editingWeek;
    weekEditor.hidden = !editingWeek;
    if (editWeekButton) editWeekButton.hidden = editingWeek;
    weekDisplay.replaceChildren();
    weekEditor.replaceChildren();
    if (editingWeek) weekEditor.appendChild(renderWeekEditor());
    else weekDisplay.appendChild(renderWeekTable());
  }

  function renderExerciseTable(day) {
    if (!day.exercises.length) {
      return el("p", "gym-no-exercises", "لا توجد تمارين مضافة لهذا اليوم بعد.");
    }
    const table = el("table", "gym-table gym-exercise-table");
    const caption = el("caption", "visually-hidden", `تمارين يوم ${day.name}`);
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["التمرين", "المجموعات", "التكرارات"].forEach(text => {
      const cell = el("th", "", text);
      cell.scope = "col";
      headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement("tbody");
    day.exercises.forEach(exercise => {
      const row = document.createElement("tr");
      const name = el("th", "gym-exercise-name", exercise.name);
      name.scope = "row";
      name.dir = "auto";
      const sets = el("td", "gym-number-cell", exercise.sets);
      sets.dir = "auto";
      const reps = el("td", "gym-reps-cell", exercise.reps);
      reps.dir = "auto";
      row.append(name, sets, reps);
      tbody.appendChild(row);
    });
    table.append(caption, thead, tbody);
    return table;
  }

  function makeExerciseEditorRow(exercise) {
    const row = el("div", "gym-exercise-edit-row");
    row.dataset.exerciseId = exercise.id;
    const name = textInput(exercise.name, "exerciseName", 120);
    name.required = true;
    name.dir = "auto";
    const sets = el("input", "gym-input gym-sets-input");
    sets.type = "number";
    sets.name = "exerciseSets";
    sets.min = "1";
    sets.max = "30";
    sets.step = "1";
    sets.inputMode = "numeric";
    sets.value = exercise.sets;
    sets.required = true;
    const reps = textInput(exercise.reps, "exerciseReps", 40);
    reps.required = true;
    reps.dir = "auto";
    row.append(
      labelWithInput("التمرين", name, "gym-edit-exercise-name"),
      labelWithInput("المجموعات", sets),
      labelWithInput("التكرارات / المدة", reps, "gym-edit-exercise-reps"),
      button("حذف", "gym-remove-exercise", `حذف التمرين ${exercise.name || "غير المسمى"}`)
    );
    return row;
  }

  function renderWorkoutEditor(day) {
    const form = el("form", "gym-editor-form gym-workout-form");
    form.noValidate = true;
    const subtitle = textArea(day.subtitle, "subtitle", 2);
    form.appendChild(labelWithInput("وصف اليوم (اختياري)", subtitle));
    const listLabel = el("h4", "gym-edit-list-title", "قائمة التمارين");
    const rows = el("div", "gym-exercise-edit-list");
    day.exercises.forEach(exercise => rows.appendChild(makeExerciseEditorRow(exercise)));
    const add = button("＋ إضافة تمرين", "gym-add-exercise", "إضافة تمرين إلى هذا اليوم");
    const error = el("p", "gym-form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const actions = el("div", "gym-form-actions");
    const save = el("button", "gym-action gym-primary-action", "حفظ التمارين");
    save.type = "submit";
    const cancel = button("إلغاء", "gym-secondary-action", `إلغاء تعديل تمارين يوم ${day.name}`);
    actions.append(save, cancel);
    form.append(listLabel, rows, add, error, actions);
    form.addEventListener("input", () => clearFormError(form));
    form.addEventListener("click", event => {
      const remove = event.target.closest(".gym-remove-exercise");
      if (remove) {
        remove.closest(".gym-exercise-edit-row")?.remove();
        setStatus("تم حذف التمرين من مسودة التعديل؛ احفظ التغييرات لتأكيد الحذف.");
        return;
      }
      if (event.target.closest(".gym-add-exercise")) {
        event.preventDefault();
        const newRow = makeExerciseEditorRow({ id: makeId(), name: "", sets: "3", reps: "8–12" });
        rows.appendChild(newRow);
        newRow.querySelector('[name="exerciseName"]').focus();
      }
    });
    cancel.addEventListener("click", () => {
      editingWorkoutId = "";
      renderWorkouts();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      clearFormError(form);
      const exerciseRows = [...rows.querySelectorAll(".gym-exercise-edit-row")];
      const exercises = [];
      for (const row of exerciseRows) {
        const name = row.querySelector('[name="exerciseName"]');
        const sets = row.querySelector('[name="exerciseSets"]');
        const reps = row.querySelector('[name="exerciseReps"]');
        if (!name.value.trim()) {
          showFormError(form, name, "اكتب اسم كل تمرين أو احذف صفه.");
          return;
        }
        if (!sets.value || Number(sets.value) < 1 || Number(sets.value) > 30 || !Number.isInteger(Number(sets.value))) {
          showFormError(form, sets, "أدخل عدد مجموعات صحيحًا بين ١ و٣٠.");
          return;
        }
        if (!reps.value.trim()) {
          showFormError(form, reps, "أدخل التكرارات أو مدة التمرين.");
          return;
        }
        exercises.push({ id: row.dataset.exerciseId || makeId(), name: name.value.trim(), sets: sets.value, reps: reps.value.trim() });
      }
      const candidate = clone(program);
      const target = candidate.days.find(item => item.id === day.id);
      target.subtitle = subtitle.value.trim();
      target.exercises = exercises;
      commit(candidate, `تم حفظ تمارين يوم ${day.name}.`);
    });
    return form;
  }

  function renderWorkouts() {
    workoutCards.replaceChildren();
    const activeDays = program.days.filter(day => !day.rest);
    if (!activeDays.length) {
      workoutCards.appendChild(el("div", "gym-empty", "كل الأيام محددة كراحة. عدّل جدول الأسبوع لإضافة أيام تدريب."));
      return;
    }
    activeDays.forEach(day => {
      const details = el("details", "gym-day-card");
      if (openWorkoutIds.has(day.id) || editingWorkoutId === day.id) details.open = true;
      const summary = el("summary", "gym-day-summary");
      const summaryMain = el("span", "gym-day-summary-main");
      summaryMain.append(el("strong", "", day.name), el("span", "", day.muscles));
      summary.append(summaryMain, el("span", "gym-disclosure-mark", "＋"));
      const body = el("div", "gym-day-body");
      if (day.subtitle) body.appendChild(el("p", "gym-day-subtitle", day.subtitle));
      if (editingWorkoutId === day.id) {
        body.appendChild(renderWorkoutEditor(day));
      } else {
        const actions = el("div", "gym-day-actions");
        const edit = button("تعديل التمارين", "gym-action", `تعديل تمارين يوم ${day.name}`);
        edit.addEventListener("click", () => {
          editingWorkoutId = day.id;
          openWorkoutIds.add(day.id);
          setStatus("");
          renderWorkouts();
        });
        actions.appendChild(edit);
        body.append(actions, renderExerciseTable(day));
      }
      details.append(summary, body);
      details.addEventListener("toggle", () => {
        if (details.open) openWorkoutIds.add(day.id);
        else openWorkoutIds.delete(day.id);
      });
      workoutCards.appendChild(details);
    });
  }

  function renderRules() {
    rulesDisplay.hidden = editingRules;
    rulesEditor.hidden = !editingRules;
    if (editRulesButton) editRulesButton.hidden = editingRules;
    rulesDisplay.replaceChildren();
    rulesEditor.replaceChildren();
    if (editingRules) {
      rulesEditor.appendChild(renderRulesEditor());
      return;
    }
    const list = el("div", "gym-rules-list");
    [
      ["مدة التمرين", program.duration],
      ["الراحة للتمارين الأساسية", program.compoundRest],
      ["الراحة لتمارين العزل", program.isolationRest]
    ].forEach(([label, value]) => {
      const card = el("article", "gym-rule-card");
      card.append(el("span", "", label), el("strong", "", value));
      list.appendChild(card);
    });
    rulesDisplay.appendChild(list);
  }

  function renderRulesEditor() {
    const form = el("form", "gym-editor-form gym-rules-form");
    form.noValidate = true;
    const duration = textInput(program.duration, "duration", 80);
    const compound = textInput(program.compoundRest, "compoundRest", 80);
    const isolation = textInput(program.isolationRest, "isolationRest", 80);
    [duration, compound, isolation].forEach(input => { input.required = true; });
    const error = el("p", "gym-form-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const actions = el("div", "gym-form-actions");
    const save = el("button", "gym-action gym-primary-action", "حفظ الإرشادات");
    save.type = "submit";
    const cancel = button("إلغاء", "gym-secondary-action", "إلغاء تعديل مدة التمرين والراحة");
    actions.append(save, cancel);
    form.append(
      labelWithInput("مدة التمرين", duration),
      labelWithInput("الراحة للتمارين الأساسية", compound),
      labelWithInput("الراحة لتمارين العزل", isolation),
      error,
      actions
    );
    form.addEventListener("input", () => clearFormError(form));
    cancel.addEventListener("click", () => {
      editingRules = false;
      renderRules();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      clearFormError(form);
      if (!duration.value.trim() || !compound.value.trim() || !isolation.value.trim()) {
        const target = !duration.value.trim() ? duration : !compound.value.trim() ? compound : isolation;
        showFormError(form, target, "أكمل مدة التمرين وفترات الراحة.");
        return;
      }
      const candidate = clone(program);
      candidate.duration = duration.value.trim();
      candidate.compoundRest = compound.value.trim();
      candidate.isolationRest = isolation.value.trim();
      commit(candidate, "تم حفظ مدة التمرين وفترات الراحة.");
    });
    return form;
  }

  function render() {
    renderWeek();
    renderWorkouts();
    renderRules();
  }

  if (editWeekButton) {
    editWeekButton.addEventListener("click", () => {
      editingWeek = true;
      setStatus("");
      renderWeek();
    });
  }
  if (editRulesButton) {
    editRulesButton.addEventListener("click", () => {
      editingRules = true;
      setStatus("");
      renderRules();
    });
  }

  window.MahamiGym = {
    count: () => program.days.filter(day => !day.rest).length,
    render
  };
  render();
})();
