(function () {
  "use strict";

  var STORAGE_KEYS = {
    categories: "gastos_categories",
    incomeCategories: "gastos_income_categories",
    expenses: "gastos_expenses",
    budget: "gastos_budget",
    theme: "gastos_theme",
    paymentMethods: "gastos_payment_methods"
  };
  var NEW_CATEGORY_VALUE = "__new__";
  var NEW_PAYMENT_METHOD_VALUE = "__new_payment_method__";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ALL_TIME_START = "0000-01-01";
  var ALL_TIME_END = "9999-12-31";

  // ---------- storage ----------
  function categoryStorageKey(kind) {
    return kind === "income" ? STORAGE_KEYS.incomeCategories : STORAGE_KEYS.categories;
  }
  function loadCategories(kind) {
    try { return JSON.parse(localStorage.getItem(categoryStorageKey(kind))) || []; }
    catch (e) { return []; }
  }
  function saveCategories(kind, cats) {
    localStorage.setItem(categoryStorageKey(kind), JSON.stringify(cats));
  }
  function addCategory(kind, name) {
    var cats = loadCategories(kind);
    var exists = cats.some(function (c) { return c.toLowerCase() === name.toLowerCase(); });
    if (!exists) {
      cats.push(name);
      saveCategories(kind, cats);
    }
    return name;
  }

  var LEGACY_PT_METHOD_NAMES = {
    "Cartão de Crédito": "Credit Card",
    "Cartão de Débito": "Debit Card",
    "Dinheiro": "Cash"
  };

  function loadPaymentMethods() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.paymentMethods);
      if (raw === null) {
        var defaults = ["Pix", "Credit Card", "Debit Card", "Cash"];
        savePaymentMethods(defaults);
        return defaults;
      }
      var methods = JSON.parse(raw) || [];
      var translated = methods.map(function (m) { return LEGACY_PT_METHOD_NAMES[m] || m; });
      if (JSON.stringify(translated) !== JSON.stringify(methods)) savePaymentMethods(translated);
      return translated;
    } catch (e) { return []; }
  }
  function savePaymentMethods(methods) {
    localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(methods));
  }
  function addPaymentMethod(name) {
    var methods = loadPaymentMethods();
    var exists = methods.some(function (m) { return m.toLowerCase() === name.toLowerCase(); });
    if (!exists) {
      methods.push(name);
      savePaymentMethods(methods);
    }
    return name;
  }

  function loadTransactions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses)) || []; }
    catch (e) { return []; }
  }
  function saveTransactions(txs) {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(txs));
  }
  function loadBudgetMap() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.budget));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return {};
    } catch (e) { return {}; }
  }
  function saveBudgetMap(map) {
    localStorage.setItem(STORAGE_KEYS.budget, JSON.stringify(map));
  }
  function getBudgetForMonth(monthKey) {
    var map = loadBudgetMap();
    var val = map[monthKey];
    return (typeof val === "number" && !isNaN(val)) ? val : null;
  }
  function setBudgetForMonth(monthKey, value) {
    var map = loadBudgetMap();
    map[monthKey] = value;
    saveBudgetMap(map);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- theme ----------
  function loadTheme() {
    try { return localStorage.getItem(STORAGE_KEYS.theme) || null; }
    catch (e) { return null; }
  }
  function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }
  function systemTheme() {
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function effectiveTheme() {
    return loadTheme() || systemTheme();
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function typeOf(tx) { return tx.type === "income" ? "income" : "expense"; }

  // ---------- formatting ----------
  var currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function formatCurrency(v) { return currencyFmt.format(v || 0); }

  function formatDateShort(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
  }

  function getMonday(date) {
    var d = new Date(date);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function weekKeyFor(dateStr) {
    var monday = getMonday(new Date(dateStr + "T00:00:00"));
    return monday.toISOString().slice(0, 10);
  }

  function weekLabelFor(mondayKey) {
    var monday = new Date(mondayKey + "T00:00:00");
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    var fmt = function (d) {
      return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
    };
    return fmt(monday) + " – " + fmt(sunday);
  }

  function todayStr() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function monthKeyFor(dateStr) { return dateStr.slice(0, 7); } // YYYY-MM

  function monthEndDateStr(monthKey) {
    var parts = monthKey.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var lastDay = new Date(year, month, 0).getDate();
    return monthKey + "-" + String(lastDay).padStart(2, "0");
  }

  function addMonthsToDateStr(dateStr, n) {
    var parts = dateStr.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    var totalMonths = month + n;
    var targetYear = year + Math.floor(totalMonths / 12);
    var targetMonth = ((totalMonths % 12) + 12) % 12;
    var daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    var targetDay = Math.min(day, daysInTargetMonth);
    var mm = String(targetMonth + 1).padStart(2, "0");
    var dd = String(targetDay).padStart(2, "0");
    return targetYear + "-" + mm + "-" + dd;
  }

  function monthKeyWithOffset(offset) {
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    return y + "-" + m;
  }

  function monthLabelFor(monthKey) {
    var parts = monthKey.split("-");
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  }

  function last12MonthKeys() {
    var keys = [];
    for (var i = 11; i >= 0; i--) keys.push(monthKeyWithOffset(-i));
    return keys;
  }

  function yearWithOffset(offset) {
    return new Date().getFullYear() + offset;
  }

  function monthKeysOfYear(year) {
    var keys = [];
    for (var m = 1; m <= 12; m++) keys.push(year + "-" + String(m).padStart(2, "0"));
    return keys;
  }

  // ---------- elements ----------
  var pageTitle = document.getElementById("pageTitle");
  var tabs = document.querySelectorAll(".tab");
  var views = document.querySelectorAll(".view");

  var expenseForm = document.getElementById("expenseForm");
  var typeToggle = document.getElementById("typeToggle");
  var descInput = document.getElementById("descInput");
  var amountInput = document.getElementById("amountInput");
  var categorySelect = document.getElementById("categorySelect");
  var newCategoryBox = document.getElementById("newCategoryBox");
  var newCategoryInput = document.getElementById("newCategoryInput");
  var confirmNewCategoryBtn = document.getElementById("confirmNewCategoryBtn");

  var paymentMethodField = document.getElementById("paymentMethodField");
  var paymentMethodSelect = document.getElementById("paymentMethodSelect");
  var newPaymentMethodBox = document.getElementById("newPaymentMethodBox");
  var newPaymentMethodInput = document.getElementById("newPaymentMethodInput");
  var confirmNewPaymentMethodBtn = document.getElementById("confirmNewPaymentMethodBtn");

  var dateInput = document.getElementById("dateInput");
  var toast = document.getElementById("toast");

  var installmentToggle = document.getElementById("installmentToggle");
  var installmentBox = document.getElementById("installmentBox");
  var installmentCount = document.getElementById("installmentCount");
  var installmentToggleField = document.getElementById("installmentToggleField");

  var summaryBar = document.getElementById("summaryBar");
  var historyList = document.getElementById("historyList");

  var statMoneyIn = document.getElementById("statMoneyIn");
  var statMoneyOut = document.getElementById("statMoneyOut");
  var statDifference = document.getElementById("statDifference");
  var statBudget = document.getElementById("statBudget");
  var budgetBox = document.getElementById("budgetBox");
  var moneyInBox = document.getElementById("moneyInBox");
  var moneyOutBox = document.getElementById("moneyOutBox");
  var manageCategoriesLink = document.getElementById("manageCategoriesLink");
  var backToHomeBtn = document.getElementById("backToHomeBtn");

  var incomeDetailBackBtn = document.getElementById("incomeDetailBackBtn");
  var incomeDonutSvg = document.getElementById("incomeDonutSvg");
  var incomeLegendList = document.getElementById("incomeLegendList");
  var incomeDonutTotal = document.getElementById("incomeDonutTotal");
  var incomeDonutWrap = document.getElementById("incomeDonutWrap");
  var incomeDetailList = document.getElementById("incomeDetailList");

  var expenseDetailBackBtn = document.getElementById("expenseDetailBackBtn");
  var expenseMethodDonutSvg = document.getElementById("expenseMethodDonutSvg");
  var expenseMethodLegendList = document.getElementById("expenseMethodLegendList");
  var expenseMethodDonutTotal = document.getElementById("expenseMethodDonutTotal");
  var expenseMethodDonutWrap = document.getElementById("expenseMethodDonutWrap");
  var expenseDetailList = document.getElementById("expenseDetailList");

  var periodToggle = document.getElementById("periodToggle");
  var periodMonthlySection = document.getElementById("periodMonthlySection");
  var periodAnnualSection = document.getElementById("periodAnnualSection");

  var monthPrevBtn = document.getElementById("monthPrevBtn");
  var monthNextBtn = document.getElementById("monthNextBtn");
  var monthNavLabel = document.getElementById("monthNavLabel");
  var monthSummaryBar = document.getElementById("monthSummaryBar");
  var monthList = document.getElementById("monthList");

  var yearPrevBtn = document.getElementById("yearPrevBtn");
  var yearNextBtn = document.getElementById("yearNextBtn");
  var yearNavLabel = document.getElementById("yearNavLabel");
  var annualMoneyIn = document.getElementById("annualMoneyIn");
  var annualMoneyOut = document.getElementById("annualMoneyOut");
  var annualDifference = document.getElementById("annualDifference");
  var annualBudgetAvg = document.getElementById("annualBudgetAvg");
  var annualTypeToggle = document.getElementById("annualTypeToggle");
  var annualDonutSvg = document.getElementById("annualDonutSvg");
  var annualLegendList = document.getElementById("annualLegendList");
  var annualDonutTotal = document.getElementById("annualDonutTotal");
  var annualDonutTotalLabel = document.getElementById("annualDonutTotalLabel");
  var annualDonutWrap = document.getElementById("annualDonutWrap");

  var categoryKindToggle = document.getElementById("categoryKindToggle");
  var categoryForm = document.getElementById("categoryForm");
  var categoryNameInput = document.getElementById("categoryNameInput");
  var categoryList = document.getElementById("categoryList");

  var historyBtn = document.getElementById("historyBtn");
  var settingsBtn = document.getElementById("settingsBtn");
  var settingsOverlay = document.getElementById("settingsOverlay");
  var themeToggle = document.getElementById("themeToggle");

  var modalOverlay = document.getElementById("modalOverlay");
  var modalMessage = document.getElementById("modalMessage");
  var modalCancel = document.getElementById("modalCancel");
  var modalConfirm = document.getElementById("modalConfirm");

  var budgetModalOverlay = document.getElementById("budgetModalOverlay");
  var budgetModalTitle = document.getElementById("budgetModalTitle");
  var budgetInput = document.getElementById("budgetInput");
  var budgetModalCancel = document.getElementById("budgetModalCancel");
  var budgetModalSave = document.getElementById("budgetModalSave");

  var TITLES = {
    add: "Add Transaction",
    home: "Welcome, Mr. Kaefer",
    history: "History",
    categories: "Categories",
    periods: "Periods",
    "income-detail": "Money In",
    "expense-detail": "Money Out"
  };

  var currentType = "expense";
  var monthOffset = 0;
  var yearOffset = 0;
  var annualKind = "expense";
  var categoryManagerKind = "expense";
  var periodMode = "monthly";

  // ---------- view switching ----------
  function switchView(name) {
    views.forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); });
    tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.view === name); });
    pageTitle.textContent = TITLES[name];
    historyBtn.classList.toggle("hidden", name !== "home");
    settingsBtn.classList.toggle("hidden", name !== "home");
    if (name === "history") renderHistory();
    if (name === "categories") renderCategoryManager();
    if (name === "add") { renderCategorySelect(); renderPaymentMethodSelect(); }
    if (name === "home") renderHome();
    if (name === "income-detail") renderIncomeDetail();
    if (name === "expense-detail") renderExpenseDetail();
    if (name === "periods") { monthOffset = 0; yearOffset = 0; renderPeriods(); }
  }

  function renderPeriods() {
    if (periodMode === "monthly") renderMonthly();
    else renderAnnual();
  }

  periodToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    periodMode = btn.dataset.period;
    periodToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    periodMonthlySection.classList.toggle("hidden", periodMode !== "monthly");
    periodAnnualSection.classList.toggle("hidden", periodMode !== "annual");
    renderPeriods();
  });

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.dataset.view); });
  });

  historyBtn.addEventListener("click", function () { switchView("history"); });
  manageCategoriesLink.addEventListener("click", function () { switchView("categories"); });
  backToHomeBtn.addEventListener("click", function () { switchView("home"); });
  moneyInBox.addEventListener("click", function () { switchView("income-detail"); });
  moneyOutBox.addEventListener("click", function () { switchView("expense-detail"); });
  incomeDetailBackBtn.addEventListener("click", function () { switchView("home"); });
  expenseDetailBackBtn.addEventListener("click", function () { switchView("home"); });

  monthPrevBtn.addEventListener("click", function () { monthOffset -= 1; renderMonthly(); });
  monthNextBtn.addEventListener("click", function () { monthOffset += 1; renderMonthly(); });

  yearPrevBtn.addEventListener("click", function () { yearOffset -= 1; renderAnnual(); });
  yearNextBtn.addEventListener("click", function () { yearOffset += 1; renderAnnual(); });

  annualTypeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    annualKind = btn.dataset.type;
    annualTypeToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    renderAnnual();
  });

  // ---------- type toggle (Add tab) ----------
  typeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    currentType = btn.dataset.type;
    typeToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });

    installmentToggleField.classList.toggle("hidden", currentType !== "expense");
    if (currentType !== "expense") {
      installmentToggle.checked = false;
      installmentBox.classList.add("hidden");
    }
    paymentMethodField.classList.toggle("hidden", currentType !== "expense");
    newPaymentMethodBox.classList.add("hidden");
    renderCategorySelect();
  });

  installmentToggle.addEventListener("change", function () {
    installmentBox.classList.toggle("hidden", !installmentToggle.checked);
  });

  // ---------- modal (confirm) ----------
  var pendingConfirmAction = null;
  function showConfirm(message, onConfirm) {
    modalMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    modalOverlay.classList.remove("hidden");
  }
  function hideConfirm() {
    modalOverlay.classList.add("hidden");
    pendingConfirmAction = null;
  }
  modalCancel.addEventListener("click", hideConfirm);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) hideConfirm();
  });
  modalConfirm.addEventListener("click", function () {
    var action = pendingConfirmAction;
    hideConfirm();
    if (action) action();
  });

  // ---------- budget modal ----------
  function openBudgetModal() {
    var thisMonth = monthKeyFor(todayStr());
    var current = getBudgetForMonth(thisMonth);
    budgetModalTitle.textContent = "Set your budget for " + monthLabelFor(thisMonth);
    budgetInput.value = current !== null ? current : "";
    budgetModalOverlay.classList.remove("hidden");
    budgetInput.focus();
  }
  function hideBudgetModal() { budgetModalOverlay.classList.add("hidden"); }

  budgetBox.addEventListener("click", openBudgetModal);
  budgetModalCancel.addEventListener("click", hideBudgetModal);
  budgetModalOverlay.addEventListener("click", function (e) {
    if (e.target === budgetModalOverlay) hideBudgetModal();
  });
  budgetModalSave.addEventListener("click", function () {
    var val = parseFloat(budgetInput.value);
    if (isNaN(val) || val < 0) return;
    setBudgetForMonth(monthKeyFor(todayStr()), val);
    hideBudgetModal();
    renderHome();
  });

  // ---------- settings sheet ----------
  function openSettings() {
    var current = effectiveTheme();
    themeToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.theme === current);
    });
    settingsOverlay.classList.add("open");
  }
  function closeSettings() {
    settingsOverlay.classList.remove("open");
  }
  settingsBtn.addEventListener("click", openSettings);
  settingsOverlay.addEventListener("click", function (e) {
    if (e.target === settingsOverlay) closeSettings();
  });
  themeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    var theme = btn.dataset.theme;
    saveTheme(theme);
    applyTheme(theme);
    themeToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
  });

  // ---------- toast ----------
  var toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    requestAnimationFrame(function () { toast.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.classList.add("hidden"); }, 200);
    }, 1800);
  }

  // ---------- category select (Add tab) ----------
  function renderCategorySelect(selectValue) {
    var cats = loadCategories(currentType);
    categorySelect.innerHTML = "";

    if (cats.length === 0) {
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "No categories yet";
      placeholder.disabled = true;
      placeholder.selected = true;
      categorySelect.appendChild(placeholder);
    }

    cats.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categorySelect.appendChild(opt);
    });

    var newOpt = document.createElement("option");
    newOpt.value = NEW_CATEGORY_VALUE;
    newOpt.textContent = "+ New category";
    categorySelect.appendChild(newOpt);

    if (selectValue && cats.indexOf(selectValue) !== -1) {
      categorySelect.value = selectValue;
      newCategoryBox.classList.add("hidden");
    } else if (cats.length === 0) {
      categorySelect.value = NEW_CATEGORY_VALUE;
      newCategoryBox.classList.remove("hidden");
    } else {
      newCategoryBox.classList.add("hidden");
    }
  }

  categorySelect.addEventListener("change", function () {
    if (categorySelect.value === NEW_CATEGORY_VALUE) {
      newCategoryBox.classList.remove("hidden");
      newCategoryInput.focus();
    } else {
      newCategoryBox.classList.add("hidden");
    }
  });

  confirmNewCategoryBtn.addEventListener("click", function () {
    var name = newCategoryInput.value.trim();
    if (!name) return;
    addCategory(currentType, name);
    newCategoryInput.value = "";
    newCategoryBox.classList.add("hidden");
    renderCategorySelect(name);
  });

  // ---------- payment method select (Add tab) ----------
  function renderPaymentMethodSelect(selectValue) {
    var methods = loadPaymentMethods();
    paymentMethodSelect.innerHTML = "";

    methods.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      paymentMethodSelect.appendChild(opt);
    });

    var newOpt = document.createElement("option");
    newOpt.value = NEW_PAYMENT_METHOD_VALUE;
    newOpt.textContent = "+ New method";
    paymentMethodSelect.appendChild(newOpt);

    if (selectValue && methods.indexOf(selectValue) !== -1) {
      paymentMethodSelect.value = selectValue;
    }
    newPaymentMethodBox.classList.add("hidden");
  }

  paymentMethodSelect.addEventListener("change", function () {
    if (paymentMethodSelect.value === NEW_PAYMENT_METHOD_VALUE) {
      newPaymentMethodBox.classList.remove("hidden");
      newPaymentMethodInput.focus();
    } else {
      newPaymentMethodBox.classList.add("hidden");
    }
  });

  confirmNewPaymentMethodBtn.addEventListener("click", function () {
    var name = newPaymentMethodInput.value.trim();
    if (!name) return;
    addPaymentMethod(name);
    newPaymentMethodInput.value = "";
    newPaymentMethodBox.classList.add("hidden");
    renderPaymentMethodSelect(name);
  });

  // ---------- expense form ----------
  expenseForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var desc = descInput.value.trim();
    var amount = parseFloat(amountInput.value);
    var category = categorySelect.value;
    var date = dateInput.value;

    if (!desc || isNaN(amount) || amount <= 0 || !date) return;

    if (category === NEW_CATEGORY_VALUE || !category) {
      var pending = newCategoryInput.value.trim();
      if (!pending) {
        newCategoryInput.focus();
        return;
      }
      category = addCategory(currentType, pending);
    }

    var paymentMethod = null;
    if (currentType === "expense") {
      paymentMethod = paymentMethodSelect.value;
      if (paymentMethod === NEW_PAYMENT_METHOD_VALUE || !paymentMethod) {
        var pendingMethod = newPaymentMethodInput.value.trim();
        if (!pendingMethod) {
          newPaymentMethodInput.focus();
          return;
        }
        paymentMethod = addPaymentMethod(pendingMethod);
      }
    }

    var installments = 1;
    if (currentType === "expense" && installmentToggle.checked) {
      installments = parseInt(installmentCount.value, 10);
      if (!installments || installments < 2) {
        installmentCount.focus();
        return;
      }
    }

    var txs = loadTransactions();
    var createdAt = Date.now();

    if (installments > 1) {
      var groupId = uid();
      var perInstallment = Math.round((amount / installments) * 100) / 100;
      var lastInstallment = Math.round((amount - perInstallment * (installments - 1)) * 100) / 100;
      for (var i = 0; i < installments; i++) {
        txs.push({
          id: uid(),
          desc: desc + " (" + (i + 1) + "/" + installments + ")",
          amount: i === installments - 1 ? lastInstallment : perInstallment,
          category: category,
          date: addMonthsToDateStr(date, i),
          type: "expense",
          paymentMethod: paymentMethod,
          installmentGroup: groupId,
          installmentIndex: i + 1,
          installmentTotal: installments,
          createdAt: createdAt
        });
      }
    } else {
      txs.push({
        id: uid(),
        desc: desc,
        amount: amount,
        category: category,
        date: date,
        type: currentType,
        paymentMethod: currentType === "expense" ? paymentMethod : undefined,
        createdAt: createdAt
      });
    }
    saveTransactions(txs);

    descInput.value = "";
    amountInput.value = "";
    newCategoryInput.value = "";
    newCategoryBox.classList.add("hidden");
    newPaymentMethodInput.value = "";
    newPaymentMethodBox.classList.add("hidden");
    installmentToggle.checked = false;
    installmentBox.classList.add("hidden");
    installmentCount.value = "";
    renderCategorySelect(category);
    if (currentType === "expense") renderPaymentMethodSelect(paymentMethod);
    descInput.focus();
    showToast(installments > 1 ? "Saved across " + installments + " months!" : "Saved!");
  });

  // ---------- home dashboard ----------
  function renderHome() {
    var txs = loadTransactions();
    var thisMonth = monthKeyFor(todayStr());

    var moneyIn = 0, moneyOut = 0;
    txs.forEach(function (t) {
      if (monthKeyFor(t.date) !== thisMonth) return;
      if (typeOf(t) === "income") moneyIn += t.amount;
      else moneyOut += t.amount;
    });
    var diff = moneyIn - moneyOut;

    statMoneyIn.textContent = formatCurrency(moneyIn);
    statMoneyOut.textContent = formatCurrency(moneyOut);
    statDifference.textContent = formatCurrency(diff);
    statDifference.classList.remove("positive", "negative");
    statDifference.classList.add(diff >= 0 ? "positive" : "negative");

    var budget = getBudgetForMonth(thisMonth);
    statBudget.classList.remove("positive", "negative");
    if (budget === null) {
      statBudget.textContent = "Set budget";
    } else {
      var remaining = budget - moneyOut;
      statBudget.textContent = formatCurrency(remaining);
      statBudget.classList.add(remaining >= 0 ? "positive" : "negative");
    }

    var categoryEntries = buildCategoryEntries(txs, thisMonth + "-01", monthEndDateStr(thisMonth), "expense");
    renderDonut(
      { svg: document.getElementById("donutSvg"), legendList: document.getElementById("legendList"), donutTotal: document.getElementById("donutTotal"), donutWrap: document.getElementById("donutWrap") },
      categoryEntries,
      moneyOut,
      "spent",
      "No expenses this month."
    );
  }

  // ---------- money in / money out detail ----------
  function sortTxsRecent(txs) {
    return txs.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
  }

  function renderIncomeDetail() {
    var txs = loadTransactions().filter(function (t) { return typeOf(t) === "income"; });
    var total = txs.reduce(function (s, t) { return s + t.amount; }, 0);
    var entries = buildCategoryEntries(txs, ALL_TIME_START, ALL_TIME_END, "income");
    renderDonut(
      { svg: incomeDonutSvg, legendList: incomeLegendList, donutTotal: incomeDonutTotal, donutWrap: incomeDonutWrap },
      entries,
      total,
      "received",
      "No income yet."
    );
    renderTransactionItems(incomeDetailList, sortTxsRecent(txs), renderIncomeDetail);
  }

  function renderExpenseDetail() {
    var txs = loadTransactions().filter(function (t) { return typeOf(t) === "expense"; });
    var total = txs.reduce(function (s, t) { return s + t.amount; }, 0);
    var entries = buildPaymentMethodEntries(txs, ALL_TIME_START, ALL_TIME_END);
    renderDonut(
      { svg: expenseMethodDonutSvg, legendList: expenseMethodLegendList, donutTotal: expenseMethodDonutTotal, donutWrap: expenseMethodDonutWrap },
      entries,
      total,
      "spent",
      "No expenses yet."
    );
    renderTransactionItems(expenseDetailList, sortTxsRecent(txs), renderExpenseDetail);
  }

  // ---------- annual tab ----------
  function renderAnnual() {
    var year = yearWithOffset(yearOffset);
    yearNavLabel.textContent = String(year);
    var startDate = year + "-01-01";
    var endDate = year + "-12-31";

    var txs = loadTransactions();

    var moneyIn = 0, moneyOut = 0;
    txs.forEach(function (t) {
      if (t.date < startDate || t.date > endDate) return;
      if (typeOf(t) === "income") moneyIn += t.amount;
      else moneyOut += t.amount;
    });
    var diff = moneyIn - moneyOut;

    annualMoneyIn.textContent = formatCurrency(moneyIn);
    annualMoneyOut.textContent = formatCurrency(moneyOut);
    annualDifference.textContent = formatCurrency(diff);
    annualDifference.classList.remove("positive", "negative");
    annualDifference.classList.add(diff >= 0 ? "positive" : "negative");

    var budgetMap = loadBudgetMap();
    var monthsOfYear = monthKeysOfYear(year);
    var set = monthsOfYear.filter(function (k) { return typeof budgetMap[k] === "number" && !isNaN(budgetMap[k]); });
    if (set.length === 0) {
      annualBudgetAvg.textContent = "No data";
    } else {
      var avg = set.reduce(function (s, k) { return s + budgetMap[k]; }, 0) / set.length;
      annualBudgetAvg.textContent = formatCurrency(avg);
    }

    var entries = buildCategoryEntries(txs, startDate, endDate, annualKind);
    var total = entries.reduce(function (s, e) { return s + e.amount; }, 0);
    var label = annualKind === "income" ? "received" : "spent";
    annualDonutTotalLabel.textContent = label;
    var emptyMsg = (annualKind === "income" ? "No income in " : "No expenses in ") + year + ".";

    renderDonut(
      { svg: annualDonutSvg, legendList: annualLegendList, donutTotal: annualDonutTotal, donutWrap: annualDonutWrap },
      entries,
      total,
      label,
      emptyMsg
    );
  }

  // ---------- monthly tab ----------
  function renderMonthly() {
    var monthKey = monthKeyWithOffset(monthOffset);
    monthNavLabel.textContent = monthLabelFor(monthKey);

    var txs = loadTransactions()
      .filter(function (t) { return monthKeyFor(t.date) === monthKey; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt - a.createdAt;
      });

    var moneyIn = 0, moneyOut = 0;
    txs.forEach(function (t) {
      if (typeOf(t) === "income") moneyIn += t.amount;
      else moneyOut += t.amount;
    });

    monthSummaryBar.innerHTML = "";
    var line1 = document.createElement("div");
    line1.textContent = "In " + formatCurrency(moneyIn) + "  ·  Out " + formatCurrency(moneyOut) + "  ·  Net " + formatCurrency(moneyIn - moneyOut);
    monthSummaryBar.appendChild(line1);

    if (txs.length === 0) {
      monthList.innerHTML = '<div class="empty-state">No transactions in this month.</div>';
      return;
    }

    var html = "";
    txs.forEach(function (t) {
      var isIncome = typeOf(t) === "income";
      var sign = isIncome ? "+" : "-";
      var amountClass = isIncome ? "positive" : "negative";
      html += '<div class="expense-item" data-id="' + t.id + '">' +
        '<div class="expense-info">' +
          '<div class="expense-desc">' + escapeHtml(t.desc) + '</div>' +
          '<div class="expense-meta"><span class="badge">' + escapeHtml(t.category) + '</span>' +
            (t.paymentMethod ? '<span class="badge">' + escapeHtml(t.paymentMethod) + '</span>' : '') +
            '<span>' + formatDateShort(t.date) + '</span></div>' +
        '</div>' +
        '<div class="expense-right">' +
          '<span class="expense-amount ' + amountClass + '">' + sign + formatCurrency(t.amount) + '</span>' +
          '<button class="icon-btn delete-month-expense" data-id="' + t.id + '">✕</button>' +
        '</div>' +
      '</div>';
    });
    monthList.innerHTML = html;

    monthList.querySelectorAll(".delete-month-expense").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Delete this transaction?", function () {
          var remaining = loadTransactions().filter(function (t) { return t.id !== id; });
          saveTransactions(remaining);
          renderMonthly();
        });
      });
    });
  }

  // ---------- donut chart (generic, by category) ----------
  function categoryColorVar(index) {
    return "var(--series-" + ((index % 8) + 1) + ")";
  }

  function buildCategoryEntries(txs, startDate, endDate, type) {
    return buildGroupedEntries(txs, startDate, endDate, type, function (t) { return t.category; });
  }

  function buildPaymentMethodEntries(txs, startDate, endDate) {
    return buildGroupedEntries(txs, startDate, endDate, "expense", function (t) { return t.paymentMethod || "Other"; });
  }

  function buildGroupedEntries(txs, startDate, endDate, type, keyFn) {
    var totals = {};
    txs.forEach(function (t) {
      if (typeOf(t) !== type) return;
      if (t.date < startDate || t.date > endDate) return;
      var key = keyFn(t);
      totals[key] = (totals[key] || 0) + t.amount;
    });

    var entries = Object.keys(totals).map(function (name) {
      return { name: name, amount: totals[name], isOther: false };
    });
    entries.sort(function (a, b) { return b.amount - a.amount; });

    var MAX_SLICES = 7;
    if (entries.length > MAX_SLICES) {
      var top = entries.slice(0, MAX_SLICES);
      var restTotal = entries.slice(MAX_SLICES).reduce(function (s, e) { return s + e.amount; }, 0);
      if (restTotal > 0) top.push({ name: "Other", amount: restTotal, isOther: true });
      entries = top;
    }

    var realNames = entries.filter(function (e) { return !e.isOther; }).map(function (e) { return e.name; });
    var colorOrder = realNames.slice().sort();
    var colorMap = {};
    colorOrder.forEach(function (name, i) { colorMap[name] = categoryColorVar(i); });

    entries.forEach(function (e) { e.color = e.isOther ? "var(--muted)" : colorMap[e.name]; });

    return entries;
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    var startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
    var endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
    var startInner = polarToCartesian(cx, cy, rInner, endAngle);
    var endInner = polarToCartesian(cx, cy, rInner, startAngle);
    var largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return [
      "M", startOuter.x, startOuter.y,
      "A", rOuter, rOuter, 0, largeArc, 0, endOuter.x, endOuter.y,
      "L", endInner.x, endInner.y,
      "A", rInner, rInner, 0, largeArc, 1, startInner.x, startInner.y,
      "Z"
    ].join(" ");
  }

  function renderDonut(els, entries, totalAmount, totalLabel, emptyMessage) {
    var svg = els.svg;
    var legendList = els.legendList;
    var donutTotal = els.donutTotal;
    var donutWrap = els.donutWrap;

    svg.innerHTML = "";
    legendList.innerHTML = "";
    donutTotal.textContent = formatCurrency(totalAmount);

    if (entries.length === 0) {
      donutWrap.classList.add("hidden");
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = emptyMessage;
      legendList.appendChild(empty);
      return;
    }
    donutWrap.classList.remove("hidden");

    var GAP_DEG = 2.2;
    var cumulative = 0;
    var slices = [];
    var rows = [];

    entries.forEach(function (entry, i) {
      var fraction = totalAmount > 0 ? entry.amount / totalAmount : 0;
      var angle = fraction * 360;
      var start = cumulative;
      var end = cumulative + angle;
      cumulative = end;

      var drawStart = start, drawEnd = end;
      if (angle > GAP_DEG && entries.length > 1) {
        drawStart = start + GAP_DEG / 2;
        drawEnd = end - GAP_DEG / 2;
      }

      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", describeArcPath(50, 50, 44, 27, drawStart, drawEnd));
      path.setAttribute("fill", entry.color);
      path.setAttribute("class", "donut-slice");
      path.dataset.index = String(i);
      svg.appendChild(path);
      slices.push(path);

      var li = document.createElement("li");
      li.className = "legend-row";
      li.dataset.index = String(i);

      var dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = entry.color;

      var name = document.createElement("span");
      name.className = "legend-name";
      name.textContent = entry.name;

      var amount = document.createElement("span");
      amount.className = "legend-amount";
      amount.textContent = formatCurrency(entry.amount);

      var pct = document.createElement("span");
      pct.className = "legend-pct";
      pct.textContent = Math.round(fraction * 100) + "%";

      li.appendChild(dot);
      li.appendChild(name);
      li.appendChild(amount);
      li.appendChild(pct);
      legendList.appendChild(li);
      rows.push(li);
    });

    var selectedIndex = null;
    function applySelection() {
      slices.forEach(function (s, i) {
        s.classList.toggle("dimmed", selectedIndex !== null && i !== selectedIndex);
        s.classList.toggle("lifted", selectedIndex === i);
      });
      rows.forEach(function (r, i) {
        r.classList.toggle("dimmed", selectedIndex !== null && i !== selectedIndex);
        r.classList.toggle("selected", selectedIndex === i);
      });
    }

    function toggleSelect(i) {
      selectedIndex = selectedIndex === i ? null : i;
      applySelection();
    }

    slices.forEach(function (s, i) { s.addEventListener("click", function () { toggleSelect(i); }); });
    rows.forEach(function (r, i) { r.addEventListener("click", function () { toggleSelect(i); }); });
  }

  // ---------- history ----------
  function collapseInstallments(txs) {
    var groups = {};
    var order = [];
    var singles = [];
    txs.forEach(function (t) {
      if (t.installmentGroup) {
        if (!groups[t.installmentGroup]) { groups[t.installmentGroup] = []; order.push(t.installmentGroup); }
        groups[t.installmentGroup].push(t);
      } else {
        singles.push(t);
      }
    });

    var collapsed = order.map(function (groupId) {
      var items = groups[groupId].slice().sort(function (a, b) { return (a.installmentIndex || 0) - (b.installmentIndex || 0); });
      var first = items[0];
      var total = items.reduce(function (s, t) { return s + t.amount; }, 0);
      var baseDesc = first.desc.replace(/\s*\(\d+\/\d+\)$/, "");
      return {
        id: groupId,
        desc: baseDesc + " (" + first.installmentTotal + "x)",
        amount: total,
        category: first.category,
        date: first.date,
        type: first.type,
        paymentMethod: first.paymentMethod,
        createdAt: first.createdAt,
        installmentGroup: groupId
      };
    });

    return singles.concat(collapsed);
  }

  function renderHistory() {
    var allTxs = loadTransactions();

    var total = allTxs.reduce(function (sum, t) {
      return sum + (typeOf(t) === "income" ? t.amount : -t.amount);
    }, 0);

    var txs = collapseInstallments(allTxs).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    summaryBar.innerHTML =
      "Net total: " + formatCurrency(total) +
      '<div class="muted">' + txs.length + " transaction(s)</div>";

    if (txs.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No transactions yet.</div>';
      return;
    }

    var groups = {};
    var order = [];
    txs.forEach(function (t) {
      var key = weekKeyFor(t.date);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(t);
    });
    order.sort().reverse();

    var html = "";
    order.forEach(function (key) {
      var items = groups[key];
      var weekTotal = items.reduce(function (s, t) {
        return s + (typeOf(t) === "income" ? t.amount : -t.amount);
      }, 0);
      html += '<div class="week-group">';
      html += '<div class="week-header"><span>Week of ' + weekLabelFor(key) + '</span>' +
              '<span class="week-total">' + formatCurrency(weekTotal) + '</span></div>';
      items.forEach(function (t) {
        var isIncome = typeOf(t) === "income";
        var sign = isIncome ? "+" : "-";
        var amountClass = isIncome ? "positive" : "negative";
        html += '<div class="expense-item" data-id="' + t.id + '">' +
          '<div class="expense-info">' +
            '<div class="expense-desc">' + escapeHtml(t.desc) + '</div>' +
            '<div class="expense-meta"><span class="badge">' + escapeHtml(t.category) + '</span>' +
            (t.paymentMethod ? '<span class="badge">' + escapeHtml(t.paymentMethod) + '</span>' : '') +
            '<span>' + formatDateShort(t.date) + '</span></div>' +
          '</div>' +
          '<div class="expense-right">' +
            '<span class="expense-amount ' + amountClass + '">' + sign + formatCurrency(t.amount) + '</span>' +
            '<button class="icon-btn delete-expense" data-id="' + t.id + '"' + (t.installmentGroup ? ' data-group="1"' : '') + '>✕</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    });
    historyList.innerHTML = html;

    historyList.querySelectorAll(".delete-expense").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        var isGroup = btn.dataset.group === "1";
        showConfirm(
          isGroup ? "Delete this purchase and all its installments?" : "Delete this transaction?",
          function () {
            var remaining = loadTransactions().filter(function (t) {
              return isGroup ? t.installmentGroup !== id : t.id !== id;
            });
            saveTransactions(remaining);
            renderHistory();
          }
        );
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTransactionItems(container, txs, onDeleted) {
    if (txs.length === 0) {
      container.innerHTML = '<div class="empty-state">No transactions yet.</div>';
      return;
    }
    var html = "";
    txs.forEach(function (t) {
      var isIncome = typeOf(t) === "income";
      var sign = isIncome ? "+" : "-";
      var amountClass = isIncome ? "positive" : "negative";
      html += '<div class="expense-item" data-id="' + t.id + '">' +
        '<div class="expense-info">' +
          '<div class="expense-desc">' + escapeHtml(t.desc) + '</div>' +
          '<div class="expense-meta"><span class="badge">' + escapeHtml(t.category) + '</span>' +
            (t.paymentMethod ? '<span class="badge">' + escapeHtml(t.paymentMethod) + '</span>' : '') +
            '<span>' + formatDateShort(t.date) + '</span></div>' +
        '</div>' +
        '<div class="expense-right">' +
          '<span class="expense-amount ' + amountClass + '">' + sign + formatCurrency(t.amount) + '</span>' +
          '<button class="icon-btn delete-tx" data-id="' + t.id + '">✕</button>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll(".delete-tx").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Delete this transaction?", function () {
          var remaining = loadTransactions().filter(function (t) { return t.id !== id; });
          saveTransactions(remaining);
          onDeleted();
        });
      });
    });
  }

  // ---------- category manager ----------
  categoryKindToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    categoryManagerKind = btn.dataset.kind;
    categoryKindToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    renderCategoryManager();
  });

  function renderCategoryManager() {
    var cats = loadCategories(categoryManagerKind);
    if (cats.length === 0) {
      categoryList.innerHTML = '<div class="empty-state">No categories yet.</div>';
      return;
    }
    var html = "";
    cats.forEach(function (c) {
      html += '<li class="category-item"><span>' + escapeHtml(c) + '</span>' +
        '<button class="icon-btn delete-category" data-name="' + escapeHtml(c) + '">✕</button></li>';
    });
    categoryList.innerHTML = html;

    categoryList.querySelectorAll(".delete-category").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.dataset.name;
        showConfirm(
          'Delete category "' + name + '"? Past transactions keep it, it just disappears from the list for new ones.',
          function () {
            var cats = loadCategories(categoryManagerKind).filter(function (c) { return c !== name; });
            saveCategories(categoryManagerKind, cats);
            renderCategoryManager();
          }
        );
      });
    });
  }

  categoryForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = categoryNameInput.value.trim();
    if (!name) return;
    addCategory(categoryManagerKind, name);
    categoryNameInput.value = "";
    renderCategoryManager();
  });

  // ---------- init ----------
  var savedTheme = loadTheme();
  if (savedTheme) applyTheme(savedTheme);

  (function migrateLegacyPaymentMethodNames() {
    var txs = loadTransactions();
    var changed = false;
    txs.forEach(function (t) {
      if (t.paymentMethod && LEGACY_PT_METHOD_NAMES[t.paymentMethod]) {
        t.paymentMethod = LEGACY_PT_METHOD_NAMES[t.paymentMethod];
        changed = true;
      }
    });
    if (changed) saveTransactions(txs);
  })();

  dateInput.value = todayStr();
  renderCategorySelect();
  renderPaymentMethodSelect();
  switchView("home");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
