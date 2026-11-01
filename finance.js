(() => {
  "use strict";

  const STORAGE_KEY = "mahami_finance_v1";
  const form = document.getElementById("financeForm");
  const amountInput = document.getElementById("financeAmount");
  const dateInput = document.getElementById("financeDate");
  const descriptionInput = document.getElementById("financeDescription");
  const errorBox = document.getElementById("financeError");
  const statusBox = document.getElementById("financeStatus");
  const calculatorKeys = document.getElementById("calculatorKeys");
  const calculatorExpression = document.getElementById("calculatorExpression");
  const calculatorFeedback = document.getElementById("calculatorFeedback");
  const transactionsList = document.getElementById("transactionsList");
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

  let transactions = loadTransactions();
  let expression = "";
  let lastResult = null;

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const candidate = new Date(year, month - 1, day);
    return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
  }

  function createId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadTransactions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap(item => {
        if (!item || typeof item.id !== "string" || !["income", "expense"].includes(item.type) || !isDate(item.date)) return [];
        const legacyAmount = Number(item.amount);
        const amountCents = Number.isSafeInteger(item.amountCents)
          ? item.amountCents
          : Number.isFinite(legacyAmount) && legacyAmount > 0 && legacyAmount <= 1e12
            ? Math.round((legacyAmount + Number.EPSILON) * 100)
            : 0;
        if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return [];
        return [{
          id: item.id,
          type: item.type,
          amountCents,
          date: item.date,
          description: typeof item.description === "string" ? item.description.slice(0, 120) : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : ""
        }];
      });
    } catch {
      return [];
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch {
      return false;
    }
  }

  function formatCents(cents) {
    const amount = typeof cents === "bigint" ? cents : BigInt(cents);
    const negative = amount < 0n;
    const absolute = negative ? -amount : amount;
    const whole = absolute / 100n;
    const fraction = Number(absolute % 100n);
    const wholeText = new Intl.NumberFormat("ar").format(whole);
    const fractionText = new Intl.NumberFormat("ar", { minimumIntegerDigits: 2, useGrouping: false }).format(fraction);
    return `${negative ? "−" : ""}${wholeText}٫${fractionText}`;
  }

  function formatAmount(amount) {
    return formatCents(BigInt(Math.round((amount + Number.EPSILON) * 100)));
  }

  function formatDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "short", year: "numeric" })
      .format(new Date(year, month - 1, day));
  }

  function setFormError(target, message) {
    clearFormError();
    errorBox.textContent = message;
    errorBox.hidden = false;
    if (target) {
      target.setAttribute("aria-invalid", "true");
      target.setAttribute("aria-describedby", "financeError");
      target.focus();
    }
  }

  function clearFormError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
    [amountInput, dateInput].forEach(field => {
      field.removeAttribute("aria-invalid");
      if (field.getAttribute("aria-describedby") === "financeError") field.removeAttribute("aria-describedby");
    });
  }

  function clearCalculatorMessage() {
    calculatorFeedback.textContent = "";
    calculatorFeedback.classList.remove("error");
  }

  function renderCalculator() {
    const visible = expression
      ? expression.replace(/[0-9]/g, digit => arabicDigits[Number(digit)]).replace(/\./g, "٫").replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−")
      : "٠";
    calculatorExpression.textContent = visible;
  }

  function tokenize(source) {
    const compact = source.replace(/\s+/g, "");
    if (!compact || !/^[0-9.+\-*/()]+$/.test(compact)) throw new Error("أدخل أرقامًا وعوامل حسابية صحيحة.");
    const tokens = compact.match(/(?:\d+(?:\.\d*)?|\.\d+|[()+\-*/])/g) || [];
    if (tokens.join("") !== compact) throw new Error("تحقق من الأرقام والفواصل في العملية.");
    return tokens;
  }

  function calculate(source) {
    const tokens = tokenize(source);
    let position = 0;

    function parseExpression() {
      let value = parseTerm();
      while (tokens[position] === "+" || tokens[position] === "-") {
        const operator = tokens[position++];
        const next = parseTerm();
        value = operator === "+" ? value + next : value - next;
      }
      return value;
    }

    function parseTerm() {
      let value = parseFactor();
      while (tokens[position] === "*" || tokens[position] === "/") {
        const operator = tokens[position++];
        const next = parseFactor();
        if (operator === "/" && next === 0) throw new Error("لا يمكن القسمة على صفر.");
        value = operator === "*" ? value * next : value / next;
      }
      return value;
    }

    function parseFactor() {
      let sign = 1;
      while (tokens[position] === "+" || tokens[position] === "-") {
        if (tokens[position++] === "-") sign *= -1;
      }
      if (tokens[position] === "(") {
        position += 1;
        const value = parseExpression();
        if (tokens[position] !== ")") throw new Error("أغلق القوس لإكمال العملية.");
        position += 1;
        return sign * value;
      }
      const token = tokens[position++];
      if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error("أكمل العملية الحسابية أولًا.");
      return sign * Number(token);
    }

    const result = parseExpression();
    if (position !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e12) {
      throw new Error("العملية غير مكتملة أو أن الناتج خارج النطاق.");
    }
    return Math.round((result + Number.EPSILON) * 100) / 100;
  }

  function enterCalculatorKey(key) {
    if (key === "clear") {
      expression = "";
      lastResult = null;
      clearCalculatorMessage();
      renderCalculator();
      return;
    }
    if (key === "back") {
      expression = expression.slice(0, -1);
      lastResult = null;
      clearCalculatorMessage();
      renderCalculator();
      return;
    }
    if (key === "=") {
      try {
        const result = calculate(expression);
        lastResult = result;
        amountInput.value = result.toFixed(2);
        clearCalculatorMessage();
        calculatorFeedback.textContent = `الناتج ${formatAmount(result)}؛ أُضيف إلى المبلغ.`;
      } catch (error) {
        calculatorFeedback.textContent = error.message;
        calculatorFeedback.classList.add("error");
      }
      amountInput.focus();
      return;
    }

    const isDigit = /^\d$/.test(key);
    const isOperator = /^[+\-*/]$/.test(key);
    if (lastResult !== null) {
      expression = isOperator ? String(lastResult) : "";
      lastResult = null;
    }
    if (expression.length >= 48) return;

    if (key === ".") {
      const currentNumber = expression.split(/[()+\-*/]/).pop();
      if (currentNumber.includes(".")) return;
      expression += currentNumber ? "." : "0.";
    } else if (isOperator) {
      const previous = expression.at(-1) || "";
      if (!expression && key !== "-" && key !== "+") return;
      if (/^[+\-*/]$/.test(previous)) {
        if (key === "-" && previous !== "-") expression += key;
        else expression = expression.slice(0, -1) + key;
      } else {
        expression += key;
      }
    } else if (isDigit || key === "(" || key === ")") {
      expression += key;
    }
    clearCalculatorMessage();
    renderCalculator();
  }

  function render() {
    let incomeCents = 0n;
    let expenseCents = 0n;
    transactions.forEach(item => {
      const cents = BigInt(item.amountCents);
      if (item.type === "income") incomeCents += cents;
      else expenseCents += cents;
    });
    document.getElementById("financeIncomeTotal").textContent = formatCents(incomeCents);
    document.getElementById("financeExpenseTotal").textContent = formatCents(expenseCents);
    document.getElementById("financeBalanceTotal").textContent = formatCents(incomeCents - expenseCents);
    document.getElementById("financeCount").textContent = `${new Intl.NumberFormat("ar").format(transactions.length)} حركات`;

    transactionsList.replaceChildren();
    const ordered = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    if (!ordered.length) {
      const empty = document.createElement("div");
      empty.className = "empty finance-empty";
      const heading = document.createElement("strong");
      heading.textContent = "لا توجد حركات بعد";
      const message = document.createElement("span");
      message.textContent = "أضف دخلك أو مصروفك لتظهر هنا.";
      empty.append(heading, message);
      transactionsList.appendChild(empty);
      return;
    }

    ordered.forEach(item => {
      const card = document.createElement("article");
      card.className = "transaction-card";
      const main = document.createElement("div");
      main.className = "transaction-main";
      const heading = document.createElement("div");
      heading.className = "transaction-heading";
      const kind = document.createElement("span");
      kind.className = `transaction-kind ${item.type}`;
      kind.textContent = item.type === "income" ? "دخل" : "مصروف";
      const description = document.createElement("span");
      description.className = "transaction-description";
      description.textContent = item.description || (item.type === "income" ? "دخل" : "مصروف");
      heading.append(kind, description);
      const date = document.createElement("span");
      date.className = "transaction-date";
      date.textContent = formatDate(item.date);
      main.append(heading, date);

      const amount = document.createElement("strong");
      amount.className = `transaction-amount ${item.type}`;
      amount.textContent = `${item.type === "income" ? "+" : "−"}${formatCents(BigInt(item.amountCents))}`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "transaction-delete";
      remove.dataset.transactionId = item.id;
      remove.textContent = "×";
      remove.setAttribute("aria-label", `حذف حركة ${item.type === "income" ? "دخل" : "مصروف"}: ${item.description || formatCents(BigInt(item.amountCents))}`);
      card.append(main, amount, remove);
      transactionsList.appendChild(card);
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    clearFormError();
    statusBox.textContent = "";
    const type = form.querySelector('input[name="transactionType"]:checked')?.value;
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
      setFormError(amountInput, "أدخل مبلغًا أكبر من صفر وبقيمة صالحة.");
      return;
    }
    const amountCents = Math.round((amount + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
      setFormError(amountInput, "المبلغ بعد التقريب يجب ألا يقل عن ٠٫٠١.");
      return;
    }
    if (!isDate(dateInput.value)) {
      setFormError(dateInput, "اختر تاريخًا صالحًا للحركة.");
      return;
    }

    const record = {
      id: createId(),
      type: type === "income" ? "income" : "expense",
      amountCents,
      date: dateInput.value,
      description: descriptionInput.value.trim().slice(0, 120),
      createdAt: new Date().toISOString()
    };
    transactions.unshift(record);
    if (!saveTransactions()) {
      transactions.shift();
      setFormError(amountInput, "تعذّر حفظ الحركة. مساحة التخزين قد تكون ممتلئة.");
      return;
    }
    form.reset();
    dateInput.value = localDateString();
    clearFormError();
    statusBox.textContent = record.type === "income" ? "تم تسجيل الدخل." : "تم تسجيل المصروف.";
    expression = "";
    lastResult = null;
    clearCalculatorMessage();
    renderCalculator();
    render();
    window.dispatchEvent(new Event("mahami-finance-change"));
    amountInput.focus();
  });

  [amountInput, dateInput].forEach(field => {
    field.addEventListener("input", clearFormError);
    field.addEventListener("change", clearFormError);
  });

  calculatorKeys.addEventListener("click", event => {
    const button = event.target.closest("[data-calc]");
    if (button) enterCalculatorKey(button.dataset.calc);
  });

  transactionsList.addEventListener("click", event => {
    const button = event.target.closest("[data-transaction-id]");
    if (!button) return;
    const previous = transactions;
    transactions = transactions.filter(item => item.id !== button.dataset.transactionId);
    if (!saveTransactions()) {
      transactions = previous;
      statusBox.textContent = "تعذّر تحديث سجل الحركات.";
      return;
    }
    statusBox.textContent = "تم حذف الحركة.";
    render();
    window.dispatchEvent(new Event("mahami-finance-change"));
  });

  dateInput.value = localDateString();
  renderCalculator();
  render();
  window.MahamiFinance = Object.freeze({ count: () => transactions.length, render });
})();
