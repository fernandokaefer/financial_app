(function () {
  "use strict";

  var STORAGE_KEYS = {
    categories: "gastos_categories",
    incomeCategories: "gastos_income_categories",
    expenses: "gastos_expenses",
    budget: "gastos_budget",
    theme: "gastos_theme",
    paymentMethods: "gastos_payment_methods",
    hideBalance: "gastos_hide_balance",
    cards: "gastos_cards",
    subscriptions: "gastos_subscriptions",
    commitments: "gastos_commitments"
  };
  var NEW_CATEGORY_VALUE = "__new__";
  var NEW_PAYMENT_METHOD_VALUE = "__new_payment_method__";
  var NONE_CARD_VALUE = "__none__";
  var CREDIT_CARD_METHOD = "Cartão de Crédito";
  var SVG_NS = "http://www.w3.org/2000/svg";

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
    scheduleCloudSave();
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

  var LEGACY_EN_METHOD_NAMES = {
    "Credit Card": "Cartão de Crédito",
    "Debit Card": "Cartão de Débito",
    "Cash": "Dinheiro"
  };

  function loadPaymentMethods() {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS.paymentMethods);
      if (raw === null) {
        var defaults = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Dinheiro"];
        savePaymentMethods(defaults);
        return defaults;
      }
      var methods = JSON.parse(raw) || [];
      var translated = methods.map(function (m) { return LEGACY_EN_METHOD_NAMES[m] || m; });
      if (JSON.stringify(translated) !== JSON.stringify(methods)) savePaymentMethods(translated);
      return translated;
    } catch (e) { return []; }
  }
  function savePaymentMethods(methods) {
    localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(methods));
    scheduleCloudSave();
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

  function removePaymentMethod(name) {
    var methods = loadPaymentMethods().filter(function (m) { return m !== name; });
    savePaymentMethods(methods);
  }

  // ---------- cards ----------
  function loadCards() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.cards)) || []; }
    catch (e) { return []; }
  }
  function saveCards(cards) {
    localStorage.setItem(STORAGE_KEYS.cards, JSON.stringify(cards));
    scheduleCloudSave();
  }
  function addCard(card) {
    var cards = loadCards();
    cards.push(card);
    saveCards(cards);
    addPaymentMethod(card.name);
  }
  function deleteCard(id) {
    var cards = loadCards();
    var card = cards.find(function (c) { return c.id === id; });
    cards = cards.filter(function (c) { return c.id !== id; });
    saveCards(cards);
    if (card) removePaymentMethod(card.name);
  }

  // ---------- subscriptions ----------
  function loadSubscriptions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions)) || []; }
    catch (e) { return []; }
  }
  function saveSubscriptions(subs) {
    localStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(subs));
    scheduleCloudSave();
  }
  function addSubscription(sub) {
    var subs = loadSubscriptions();
    subs.push(sub);
    saveSubscriptions(subs);
  }
  function deleteSubscription(id) {
    var subs = loadSubscriptions().filter(function (s) { return s.id !== id; });
    saveSubscriptions(subs);
  }

  // ---------- commitments (Próximos Meses) ----------
  function loadCommitments() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.commitments)) || []; }
    catch (e) { return []; }
  }
  function saveCommitments(items) {
    localStorage.setItem(STORAGE_KEYS.commitments, JSON.stringify(items));
    scheduleCloudSave();
  }
  function addCommitment(item) {
    var items = loadCommitments();
    items.push(item);
    saveCommitments(items);
  }
  function deleteCommitment(id) {
    var items = loadCommitments().filter(function (c) { return c.id !== id; });
    saveCommitments(items);
  }

  function loadTransactions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses)) || []; }
    catch (e) { return []; }
  }
  function saveTransactions(txs) {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(txs));
    scheduleCloudSave();
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
    scheduleCloudSave();
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

  function parseAmount(str) {
    str = String(str).trim();
    if (!str) return NaN;
    str = str.replace(/[^0-9.,-]/g, "");
    var lastComma = str.lastIndexOf(",");
    var lastDot = str.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) str = str.replace(/\./g, "").replace(",", ".");
      else str = str.replace(/,/g, "");
    } else if (lastComma !== -1) {
      str = str.replace(",", ".");
    }
    return parseFloat(str);
  }

  // ---------- theme ----------
  function loadTheme() {
    try { return localStorage.getItem(STORAGE_KEYS.theme) || null; }
    catch (e) { return null; }
  }
  function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    scheduleCloudSave();
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

  var PT_MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  var PT_MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function formatShortDatePtBR(d) {
    return String(d.getDate()).padStart(2, "0") + " " + PT_MONTH_ABBR[d.getMonth()];
  }

  function weekLabelFor(mondayKey) {
    var monday = new Date(mondayKey + "T00:00:00");
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return formatShortDatePtBR(monday) + " – " + formatShortDatePtBR(sunday);
  }

  function todayStr() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // Billing cycle: closes on the 10th, so a cycle named "2026-07" runs
  // from Jul 11 through Aug 10 (paid mid-August) — not the calendar month.
  var CYCLE_CLOSE_DAY = 10;

  function isoDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Generalized version of the billing-cycle math below, parameterized by
  // closing day so per-card invoice cycles can reuse it (closeDay 0 = calendar month).
  function financialMonthKeyForClose(dateStr, closeDay) {
    var parts = dateStr.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (day <= closeDay) {
      month -= 1;
      if (month < 0) { month = 11; year -= 1; }
    }
    return year + "-" + String(month + 1).padStart(2, "0");
  }

  function cycleBoundsForClose(closeDay, monthKey) {
    var parts = monthKey.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    return {
      start: isoDateStr(new Date(year, month, closeDay + 1)),
      end: isoDateStr(new Date(year, month + 1, closeDay))
    };
  }

  function financialMonthKeyFor(dateStr) {
    return financialMonthKeyForClose(dateStr, CYCLE_CLOSE_DAY);
  }

  function cycleBounds(monthKey) {
    return cycleBoundsForClose(CYCLE_CLOSE_DAY, monthKey);
  }

  function formatShortDate(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    return formatShortDatePtBR(d);
  }

  function cycleRangeLabel(monthKey) {
    var bounds = cycleBounds(monthKey);
    return formatShortDate(bounds.start) + " – " + formatShortDate(bounds.end);
  }

  function financialYearBounds(year) {
    return {
      start: cycleBounds(year + "-01").start,
      end: cycleBounds(year + "-12").end
    };
  }

  function financialYearRangeLabel(year) {
    var bounds = financialYearBounds(year);
    var d = new Date(bounds.start + "T00:00:00");
    var e = new Date(bounds.end + "T00:00:00");
    var fmt = function (x) { return formatShortDatePtBR(x) + " " + x.getFullYear(); };
    return fmt(d) + " – " + fmt(e);
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
    var base = financialMonthKeyFor(todayStr());
    var parts = base.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1 + offset;
    var targetYear = year + Math.floor(month / 12);
    var targetMonth = ((month % 12) + 12) % 12;
    return targetYear + "-" + String(targetMonth + 1).padStart(2, "0");
  }

  function monthLabelFor(monthKey) {
    var parts = monthKey.split("-");
    var month = parseInt(parts[1], 10) - 1;
    return (PT_MONTH_NAMES[month] + " " + parts[0]).toUpperCase();
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
  var cardSelectField = document.getElementById("cardSelectField");
  var cardSelect = document.getElementById("cardSelect");
  var applyAllInstallmentsField = document.getElementById("applyAllInstallmentsField");
  var applyAllInstallmentsToggle = document.getElementById("applyAllInstallmentsToggle");
  var saveTxBtn = document.getElementById("saveTxBtn");

  var dateInput = document.getElementById("dateInput");
  var toast = document.getElementById("toast");

  var installmentToggle = document.getElementById("installmentToggle");
  var installmentBox = document.getElementById("installmentBox");
  var installmentCount = document.getElementById("installmentCount");
  var installmentToggleField = document.getElementById("installmentToggleField");

  var summaryBar = document.getElementById("summaryBar");
  var historyList = document.getElementById("historyList");

  var backToHomeBtn = document.getElementById("backToHomeBtn");

  var periodToggle = document.getElementById("periodToggle");
  var periodMonthlySection = document.getElementById("periodMonthlySection");
  var periodAnnualSection = document.getElementById("periodAnnualSection");

  var monthPrevBtn = document.getElementById("monthPrevBtn");
  var monthNextBtn = document.getElementById("monthNextBtn");
  var monthNavLabel = document.getElementById("monthNavLabel");
  var monthNavSubLabel = document.getElementById("monthNavSubLabel");
  var monthStatReceitas = document.getElementById("monthStatReceitas");
  var monthStatDespesas = document.getElementById("monthStatDespesas");
  var monthStatBalanco = document.getElementById("monthStatBalanco");
  var monthList = document.getElementById("monthList");

  var yearPrevBtn = document.getElementById("yearPrevBtn");
  var yearNextBtn = document.getElementById("yearNextBtn");
  var yearNavLabel = document.getElementById("yearNavLabel");
  var yearNavSubLabel = document.getElementById("yearNavSubLabel");
  var annualMoneyIn = document.getElementById("annualMoneyIn");
  var annualMoneyOut = document.getElementById("annualMoneyOut");
  var annualDifference = document.getElementById("annualDifference");
  var annualBudgetAvg = document.getElementById("annualBudgetAvg");
  var annualTypeToggle = document.getElementById("annualTypeToggle");
  var annualDonutSvg = document.getElementById("annualDonutSvg");
  var annualLegendList = document.getElementById("annualLegendList");
  var annualDonutTotal = document.getElementById("annualDonutTotal");
  var annualDonutWrap = document.getElementById("annualDonutWrap");

  var categoryKindToggle = document.getElementById("categoryKindToggle");
  var categoryForm = document.getElementById("categoryForm");
  var categoryNameInput = document.getElementById("categoryNameInput");
  var categoryList = document.getElementById("categoryList");

  var menuBtn = document.getElementById("menuBtn");
  var hideBalanceBtn = document.getElementById("hideBalanceBtn");
  var menuOverlay = document.getElementById("menuOverlay");
  var menuHistoryBtn = document.getElementById("menuHistoryBtn");
  var menuCategoriesBtn = document.getElementById("menuCategoriesBtn");
  var menuBudgetBtn = document.getElementById("menuBudgetBtn");
  var menuSyncInstallmentsBtn = document.getElementById("menuSyncInstallmentsBtn");
  var menuSettingsBtn = document.getElementById("menuSettingsBtn");

  var qaIncomeBtn = document.getElementById("qaIncomeBtn");
  var qaExpenseBtn = document.getElementById("qaExpenseBtn");
  var qaReportBtn = document.getElementById("qaReportBtn");

  var homeBalanceValue = document.getElementById("homeBalanceValue");
  var homeMonthPrevBtn = document.getElementById("homeMonthPrevBtn");
  var homeMonthNextBtn = document.getElementById("homeMonthNextBtn");
  var homeMonthLabel = document.getElementById("homeMonthLabel");
  var homeStatReceitas = document.getElementById("homeStatReceitas");
  var homeStatDespesas = document.getElementById("homeStatDespesas");
  var homeStatBalanco = document.getElementById("homeStatBalanco");
  var homeTxCount = document.getElementById("homeTxCount");
  var homeTxFilter = document.getElementById("homeTxFilter");
  var homeTxList = document.getElementById("homeTxList");

  var addCardBtn = document.getElementById("addCardBtn");
  var cartoesEmpty = document.getElementById("cartoesEmpty");
  var cartoesEmptyAddBtn = document.getElementById("cartoesEmptyAddBtn");
  var cartoesListWrap = document.getElementById("cartoesListWrap");
  var cartoesTotalValue = document.getElementById("cartoesTotalValue");
  var cardsList = document.getElementById("cardsList");
  var cardFormOverlay = document.getElementById("cardFormOverlay");
  var cardNameInput = document.getElementById("cardNameInput");
  var cardLimitInput = document.getElementById("cardLimitInput");
  var cardClosingDayInput = document.getElementById("cardClosingDayInput");
  var cardFormSaveBtn = document.getElementById("cardFormSaveBtn");

  var addSubscriptionBtn = document.getElementById("addSubscriptionBtn");
  var assinaturasEmpty = document.getElementById("assinaturasEmpty");
  var assinaturasEmptyAddBtn = document.getElementById("assinaturasEmptyAddBtn");
  var assinaturasListWrap = document.getElementById("assinaturasListWrap");
  var assinaturasTotalValue = document.getElementById("assinaturasTotalValue");
  var subsCountValue = document.getElementById("subsCountValue");
  var subsAnnualValue = document.getElementById("subsAnnualValue");
  var subsMonthlyValue = document.getElementById("subsMonthlyValue");
  var subscriptionsList = document.getElementById("subscriptionsList");
  var subscriptionFormOverlay = document.getElementById("subscriptionFormOverlay");
  var subNameInput = document.getElementById("subNameInput");
  var subAmountInput = document.getElementById("subAmountInput");
  var subBillingDayInput = document.getElementById("subBillingDayInput");
  var subFormSaveBtn = document.getElementById("subFormSaveBtn");

  var proximosHeroValue = document.getElementById("proximosHeroValue");
  var proximosHeroLabel = document.getElementById("proximosHeroLabel");
  var pmPagarBtn = document.getElementById("pmPagarBtn");
  var pmReceberBtn = document.getElementById("pmReceberBtn");
  var pmCardBtn = document.getElementById("pmCardBtn");
  var proximosEmpty = document.getElementById("proximosEmpty");
  var proximosListWrap = document.getElementById("proximosListWrap");
  var commitmentsList = document.getElementById("commitmentsList");
  var commitmentFormOverlay = document.getElementById("commitmentFormOverlay");
  var commitmentFormTitle = document.getElementById("commitmentFormTitle");
  var commitmentDescInput = document.getElementById("commitmentDescInput");
  var commitmentAmountInput = document.getElementById("commitmentAmountInput");
  var commitmentDateInput = document.getElementById("commitmentDateInput");
  var commitmentFormSaveBtn = document.getElementById("commitmentFormSaveBtn");

  var settingsOverlay = document.getElementById("settingsOverlay");
  var themeToggle = document.getElementById("themeToggle");
  var exportBackupBtn = document.getElementById("exportBackupBtn");
  var importBackupBtn = document.getElementById("importBackupBtn");
  var importBackupInput = document.getElementById("importBackupInput");

  var cloudAuthForm = document.getElementById("cloudAuthForm");
  var cloudSignedInBox = document.getElementById("cloudSignedInBox");
  var cloudStatusText = document.getElementById("cloudStatusText");
  var cloudEmailInput = document.getElementById("cloudEmailInput");
  var cloudPasswordInput = document.getElementById("cloudPasswordInput");
  var cloudSignInBtn = document.getElementById("cloudSignInBtn");
  var cloudSignUpBtn = document.getElementById("cloudSignUpBtn");
  var cloudSignOutBtn = document.getElementById("cloudSignOutBtn");
  var cloudRestoreBtn = document.getElementById("cloudRestoreBtn");

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
    add: "Adicionar Transação",
    home: "Finanças",
    history: "Histórico",
    categories: "Categorias",
    periods: "Períodos",
    cartoes: "Cartões",
    assinaturas: "Assinaturas",
    "proximos-meses": "Próximos Meses"
  };

  var currentType = "expense";
  var monthOffset = 0;
  var yearOffset = 0;
  var annualKind = "expense";
  var categoryManagerKind = "expense";
  var periodMode = "monthly";
  var editingTxId = null;

  // ---------- view switching ----------
  var currentViewName = "home";
  function switchView(name) {
    currentViewName = name;
    if (name !== "add" && editingTxId) {
      editingTxId = null;
      saveTxBtn.textContent = "Salvar";
    }
    views.forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); });
    pageTitle.textContent = TITLES[name];
    menuBtn.classList.toggle("hidden", name !== "home");
    hideBalanceBtn.classList.toggle("hidden", name !== "home" && name !== "proximos-meses");
    addCardBtn.classList.toggle("hidden", name !== "cartoes");
    addSubscriptionBtn.classList.toggle("hidden", name !== "assinaturas");
    if (name === "history") renderHistory();
    if (name === "categories") renderCategoryManager();
    if (name === "add" && !editingTxId) { renderCategorySelect(); renderPaymentMethodSelect(); updateCardSelectVisibility(); }
    if (name === "home") renderHomeDashboard();
    if (name === "periods") { monthOffset = 0; yearOffset = 0; renderPeriods(); }
    if (name === "cartoes") renderCartoes();
    if (name === "assinaturas") renderAssinaturas();
    if (name === "proximos-meses") renderProximosMeses();
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

  backToHomeBtn.addEventListener("click", function () { switchView("home"); });

  // ---------- installment sync (fix stragglers left over from per-installment edits) ----------
  function computeInstallmentSyncPlan() {
    var txs = loadTransactions();
    var groups = {};
    txs.forEach(function (t) {
      if (!t.installmentGroup) return;
      if (!groups[t.installmentGroup]) groups[t.installmentGroup] = [];
      groups[t.installmentGroup].push(t);
    });

    var changedGroups = 0;
    var changedItems = 0;

    Object.keys(groups).forEach(function (groupId) {
      var items = groups[groupId];
      if (items.length < 2) return;

      var classifiedItems = items.filter(function (t) { return !!t.cardName; });
      if (classifiedItems.length === 0) return;

      var counts = {};
      classifiedItems.forEach(function (t) {
        var key = t.cardName;
        if (!counts[key]) {
          counts[key] = {
            cardName: t.cardName,
            paymentMethod: t.paymentMethod,
            category: t.category,
            count: 0,
            minIndex: t.installmentIndex || 999
          };
        }
        counts[key].count++;
        if ((t.installmentIndex || 999) < counts[key].minIndex) counts[key].minIndex = t.installmentIndex || 999;
      });

      var best = null;
      Object.keys(counts).forEach(function (k) {
        var c = counts[k];
        if (!best || c.count > best.count || (c.count === best.count && c.minIndex < best.minIndex)) best = c;
      });

      var groupChanged = false;
      items.forEach(function (t) {
        var needsChange = t.cardName !== best.cardName || t.paymentMethod !== best.paymentMethod || t.category !== best.category;
        if (needsChange) {
          t.cardName = best.cardName;
          t.paymentMethod = best.paymentMethod;
          t.category = best.category;
          changedItems++;
          groupChanged = true;
        }
      });
      if (groupChanged) changedGroups++;
    });

    return { txs: txs, changedGroups: changedGroups, changedItems: changedItems };
  }

  // ---------- side menu drawer ----------
  menuBtn.addEventListener("click", function () { menuOverlay.classList.add("open"); });
  menuOverlay.addEventListener("click", function (e) {
    if (e.target === menuOverlay) menuOverlay.classList.remove("open");
  });
  menuHistoryBtn.addEventListener("click", function () { menuOverlay.classList.remove("open"); switchView("history"); });
  menuCategoriesBtn.addEventListener("click", function () { menuOverlay.classList.remove("open"); switchView("categories"); });
  menuBudgetBtn.addEventListener("click", function () { menuOverlay.classList.remove("open"); openBudgetModal(); });
  menuSyncInstallmentsBtn.addEventListener("click", function () {
    menuOverlay.classList.remove("open");
    var plan = computeInstallmentSyncPlan();
    if (plan.changedItems === 0) {
      showToast("Tudo certo! Nenhuma parcela precisa de ajuste.");
      return;
    }
    showConfirm(
      "Isso vai igualar cartão, forma de pagamento e categoria em " + plan.changedItems + " parcela(s) de " + plan.changedGroups + " compra(s), usando a classificação mais comum de cada uma. Continuar?",
      function () {
        saveTransactions(plan.txs);
        renderHomeDashboard();
        showToast(plan.changedItems + " parcela(s) sincronizada(s)!");
      }
    );
  });
  menuSettingsBtn.addEventListener("click", function () { menuOverlay.classList.remove("open"); openSettings(); });

  // ---------- balance visibility ----------
  function loadHideBalance() { return localStorage.getItem(STORAGE_KEYS.hideBalance) === "1"; }
  function saveHideBalance(v) { localStorage.setItem(STORAGE_KEYS.hideBalance, v ? "1" : "0"); }
  var balanceHidden = loadHideBalance();
  function displayCurrency(v) { return balanceHidden ? "R$ ••••" : formatCurrency(v); }
  var EYE_SVG_ATTRS = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var EYE_OPEN_SVG = '<svg ' + EYE_SVG_ATTRS + '><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_SVG = '<svg ' + EYE_SVG_ATTRS + '><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>';
  function updateHideBalanceIcon() { hideBalanceBtn.innerHTML = balanceHidden ? EYE_OFF_SVG : EYE_OPEN_SVG; }
  hideBalanceBtn.addEventListener("click", function () {
    balanceHidden = !balanceHidden;
    saveHideBalance(balanceHidden);
    updateHideBalanceIcon();
    if (currentViewName === "proximos-meses") renderProximosMeses();
    else renderHomeDashboard();
  });

  // ---------- home quick actions ----------
  qaIncomeBtn.addEventListener("click", function () { setTransactionType("income"); switchView("add"); });
  qaExpenseBtn.addEventListener("click", function () { setTransactionType("expense"); switchView("add"); });
  qaReportBtn.addEventListener("click", function () { switchView("periods"); });

  // ---------- home nav cards ----------
  document.querySelectorAll(".nav-card").forEach(function (card) {
    card.addEventListener("click", function () { switchView(card.dataset.view); });
  });

  // ---------- generic back links ----------
  document.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.dataset.back); });
  });

  // ---------- home month nav + recent transactions filter ----------
  var homeMonthOffset = 0;
  var homeTxFilterType = "all";

  homeMonthPrevBtn.addEventListener("click", function () { homeMonthOffset -= 1; renderHomeDashboard(); });
  homeMonthNextBtn.addEventListener("click", function () { homeMonthOffset += 1; renderHomeDashboard(); });

  homeTxFilter.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    homeTxFilterType = btn.dataset.filter;
    homeTxFilter.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    renderHomeDashboard();
  });

  function monthLabelPtBR(monthKey) {
    var parts = monthKey.split("-");
    var month = parseInt(parts[1], 10) - 1;
    return PT_MONTH_NAMES[month] + " " + parts[0];
  }

  function renderHomeDashboard() {
    checkAndGenerateSubscriptionCharges();

    var monthKey = monthKeyWithOffset(homeMonthOffset);
    homeMonthLabel.textContent = monthLabelPtBR(monthKey);

    var allTxs = loadTransactions();

    var monthTxs = allTxs.filter(function (t) { return financialMonthKeyFor(t.date) === monthKey; });
    var moneyIn = 0, moneyOut = 0;
    monthTxs.forEach(function (t) {
      if (typeOf(t) === "income") moneyIn += t.amount;
      else moneyOut += t.amount;
    });
    var balance = moneyIn - moneyOut;
    homeBalanceValue.textContent = displayCurrency(balance);
    homeStatReceitas.textContent = displayCurrency(moneyIn);
    homeStatDespesas.textContent = displayCurrency(moneyOut);
    homeStatBalanco.textContent = displayCurrency(balance);
    homeStatBalanco.classList.remove("positive", "negative");
    homeStatBalanco.classList.add(balance >= 0 ? "positive" : "negative");

    var filtered = monthTxs.filter(function (t) {
      if (homeTxFilterType === "all") return true;
      return typeOf(t) === homeTxFilterType;
    });
    var sorted = collapseInstallments(filtered).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });
    homeTxCount.textContent = String(sorted.length);
    renderTransactionItems(homeTxList, sorted, renderHomeDashboard);
  }

  // ---------- cartões module ----------
  function currentCardInvoice(card, txs) {
    var closeDay = card.closingDay || 0;
    var thisCardMonth = financialMonthKeyForClose(todayStr(), closeDay);
    var total = 0;
    txs.forEach(function (t) {
      if (typeOf(t) !== "expense") return;
      var matchesCard = t.cardName === card.name || (!t.cardName && t.paymentMethod === card.name);
      if (!matchesCard) return;
      if (financialMonthKeyForClose(t.date, closeDay) !== thisCardMonth) return;
      total += t.amount;
    });
    return total;
  }

  function renderCartoes() {
    var cards = loadCards();
    var txs = loadTransactions();

    cartoesEmpty.classList.toggle("hidden", cards.length > 0);
    cartoesListWrap.classList.toggle("hidden", cards.length === 0);
    if (cards.length === 0) return;

    var totalInvoices = 0;
    var html = "";
    cards.forEach(function (card) {
      var invoice = currentCardInvoice(card, txs);
      totalInvoices += invoice;

      var barHtml = "";
      if (card.limit) {
        var pct = Math.min(100, Math.round((invoice / card.limit) * 100));
        barHtml = '<div class="card-limit-bar"><div class="card-limit-fill' + (invoice > card.limit ? ' over' : '') + '" style="width:' + pct + '%"></div></div>';
      }

      var metaParts = [];
      if (card.limit) metaParts.push("Limite " + formatCurrency(card.limit));
      if (card.closingDay) metaParts.push("Fecha dia " + card.closingDay);

      html += '<div class="card-row" data-id="' + card.id + '">' +
        '<div class="card-row-top">' +
          '<span class="card-row-name">' + escapeHtml(card.name) + '</span>' +
          '<button class="icon-btn delete-card" data-id="' + card.id + '" aria-label="Excluir cartão">✕</button>' +
        '</div>' +
        '<div class="card-row-invoice">' + formatCurrency(invoice) + '<span class="card-row-invoice-sub">fatura atual</span></div>' +
        barHtml +
        (metaParts.length ? '<div class="card-row-meta">' + metaParts.join(" · ") + '</div>' : '') +
      '</div>';
    });

    cardsList.innerHTML = html;
    cartoesTotalValue.textContent = formatCurrency(totalInvoices);

    cardsList.querySelectorAll(".delete-card").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir este cartão? As transações antigas continuam no histórico.", function () {
          deleteCard(id);
          renderCartoes();
        });
      });
    });
  }

  function openCardForm() {
    cardNameInput.value = "";
    cardLimitInput.value = "";
    cardClosingDayInput.value = "";
    cardFormOverlay.classList.add("open");
    cardNameInput.focus();
  }
  function closeCardForm() { cardFormOverlay.classList.remove("open"); }

  addCardBtn.addEventListener("click", openCardForm);
  cartoesEmptyAddBtn.addEventListener("click", openCardForm);
  cardFormOverlay.addEventListener("click", function (e) {
    if (e.target === cardFormOverlay) closeCardForm();
  });
  cardFormSaveBtn.addEventListener("click", function () {
    var name = cardNameInput.value.trim();
    if (!name) {
      showToast("Digite o nome do cartão.");
      cardNameInput.focus();
      return;
    }
    var limitVal = cardLimitInput.value.trim() ? parseAmount(cardLimitInput.value) : null;
    if (limitVal !== null && (isNaN(limitVal) || limitVal < 0)) {
      showToast("Limite inválido.");
      cardLimitInput.focus();
      return;
    }
    var closingDayVal = cardClosingDayInput.value.trim() ? parseInt(cardClosingDayInput.value, 10) : 0;
    if (isNaN(closingDayVal) || closingDayVal < 0 || closingDayVal > 28) closingDayVal = 0;

    addCard({
      id: uid(),
      name: name,
      limit: limitVal,
      closingDay: closingDayVal,
      createdAt: Date.now()
    });
    closeCardForm();
    renderCartoes();
    showToast("Cartão adicionado!");
  });

  // ---------- assinaturas module ----------
  var SUBSCRIPTION_CATEGORY = "Assinaturas";

  function checkAndGenerateSubscriptionCharges() {
    var subs = loadSubscriptions();
    if (subs.length === 0) return;
    var today = todayStr();
    var todayParts = today.split("-");
    var year = parseInt(todayParts[0], 10);
    var month = parseInt(todayParts[1], 10) - 1;
    var currentCalMonth = year + "-" + String(month + 1).padStart(2, "0");
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var changed = false;
    subs.forEach(function (sub) {
      if (sub.lastGeneratedMonth === currentCalMonth) return;
      var billingDay = Math.min(sub.billingDay || 1, daysInMonth);
      var chargeDate = currentCalMonth + "-" + String(billingDay).padStart(2, "0");
      if (today < chargeDate) return;

      var txs = loadTransactions();
      txs.push({
        id: uid(),
        desc: sub.name,
        amount: sub.amount,
        category: addCategory("expense", SUBSCRIPTION_CATEGORY),
        date: chargeDate,
        type: "expense",
        paymentMethod: "Assinatura",
        subscriptionId: sub.id,
        createdAt: Date.now()
      });
      saveTransactions(txs);
      sub.lastGeneratedMonth = currentCalMonth;
      changed = true;
    });
    if (changed) saveSubscriptions(subs);
  }

  function renderAssinaturas() {
    checkAndGenerateSubscriptionCharges();
    var subs = loadSubscriptions();

    assinaturasEmpty.classList.toggle("hidden", subs.length > 0);
    assinaturasListWrap.classList.toggle("hidden", subs.length === 0);
    if (subs.length === 0) return;

    var monthlyTotal = subs.reduce(function (s, sub) { return s + sub.amount; }, 0);
    assinaturasTotalValue.textContent = formatCurrency(monthlyTotal);
    subsCountValue.textContent = String(subs.length);
    subsMonthlyValue.textContent = formatCurrency(monthlyTotal);
    subsAnnualValue.textContent = formatCurrency(monthlyTotal * 12);

    var sorted = subs.slice().sort(function (a, b) { return (a.billingDay || 1) - (b.billingDay || 1); });
    var html = "";
    sorted.forEach(function (sub) {
      html += '<div class="expense-item" data-id="' + sub.id + '">' +
        '<div class="expense-info">' +
          '<div class="expense-desc">' + escapeHtml(sub.name) + '</div>' +
          '<div class="expense-meta"><span class="badge">Dia ' + (sub.billingDay || 1) + '</span></div>' +
        '</div>' +
        '<div class="expense-right">' +
          '<span class="expense-amount negative">' + formatCurrency(sub.amount) + '</span>' +
          '<button class="icon-btn delete-subscription" data-id="' + sub.id + '" aria-label="Excluir assinatura">✕</button>' +
        '</div>' +
      '</div>';
    });
    subscriptionsList.innerHTML = html;

    subscriptionsList.querySelectorAll(".delete-subscription").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir esta assinatura? As despesas já lançadas continuam no histórico.", function () {
          deleteSubscription(id);
          renderAssinaturas();
        });
      });
    });
  }

  function openSubscriptionForm() {
    subNameInput.value = "";
    subAmountInput.value = "";
    subBillingDayInput.value = "";
    subscriptionFormOverlay.classList.add("open");
    subNameInput.focus();
  }
  function closeSubscriptionForm() { subscriptionFormOverlay.classList.remove("open"); }

  addSubscriptionBtn.addEventListener("click", openSubscriptionForm);
  assinaturasEmptyAddBtn.addEventListener("click", openSubscriptionForm);
  subscriptionFormOverlay.addEventListener("click", function (e) {
    if (e.target === subscriptionFormOverlay) closeSubscriptionForm();
  });
  subFormSaveBtn.addEventListener("click", function () {
    var name = subNameInput.value.trim();
    if (!name) { showToast("Digite o nome da assinatura."); subNameInput.focus(); return; }
    var amount = parseAmount(subAmountInput.value);
    if (isNaN(amount) || amount <= 0) { showToast("Valor inválido."); subAmountInput.focus(); return; }
    var billingDay = parseInt(subBillingDayInput.value, 10);
    if (isNaN(billingDay) || billingDay < 1 || billingDay > 28) billingDay = 1;

    addSubscription({
      id: uid(),
      name: name,
      amount: amount,
      billingDay: billingDay,
      lastGeneratedMonth: null,
      createdAt: Date.now()
    });
    closeSubscriptionForm();
    renderAssinaturas();
    showToast("Assinatura adicionada!");
  });

  // ---------- próximos meses module ----------
  var pendingCommitmentKind = "pagar";

  function nextCalendarMonthKey() {
    var today = todayStr();
    var parts = today.split("-");
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var targetYear = year + Math.floor(month / 12);
    var targetMonth = month % 12;
    return targetYear + "-" + String(targetMonth + 1).padStart(2, "0");
  }

  function renderProximosMeses() {
    var items = loadCommitments();

    var nextMonth = nextCalendarMonthKey();
    var pagarNextMonth = items
      .filter(function (c) { return c.kind === "pagar" && c.dueDate.slice(0, 7) === nextMonth; })
      .reduce(function (s, c) { return s + c.amount; }, 0);
    proximosHeroValue.textContent = displayCurrency(pagarNextMonth);
    proximosHeroLabel.textContent = "A pagar em " + monthLabelPtBR(nextMonth).split(" ")[0];

    proximosEmpty.classList.toggle("hidden", items.length > 0);
    proximosListWrap.classList.toggle("hidden", items.length === 0);
    if (items.length === 0) return;

    var sorted = items.slice().sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
    var html = "";
    sorted.forEach(function (c) {
      var isPagar = c.kind === "pagar";
      html += '<div class="expense-item" data-id="' + c.id + '">' +
        '<div class="expense-info">' +
          '<div class="expense-desc">' + escapeHtml(c.desc) + '</div>' +
          '<div class="expense-meta"><span class="badge">' + formatDateShort(c.dueDate) + '</span></div>' +
        '</div>' +
        '<div class="expense-right">' +
          '<span class="expense-amount ' + (isPagar ? "negative" : "positive") + '">' + (isPagar ? "-" : "+") + formatCurrency(c.amount) + '</span>' +
          '<button class="icon-btn delete-commitment" data-id="' + c.id + '" aria-label="Excluir compromisso">✕</button>' +
        '</div>' +
      '</div>';
    });
    commitmentsList.innerHTML = html;

    commitmentsList.querySelectorAll(".delete-commitment").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir este compromisso?", function () {
          deleteCommitment(id);
          renderProximosMeses();
        });
      });
    });
  }

  function openCommitmentForm(kind) {
    pendingCommitmentKind = kind;
    commitmentFormTitle.textContent = kind === "pagar" ? "Nova Conta a Pagar" : "Novo Recebimento";
    commitmentDescInput.value = "";
    commitmentAmountInput.value = "";
    commitmentDateInput.value = todayStr();
    commitmentFormOverlay.classList.add("open");
    commitmentDescInput.focus();
  }
  function closeCommitmentForm() { commitmentFormOverlay.classList.remove("open"); }

  pmPagarBtn.addEventListener("click", function () { openCommitmentForm("pagar"); });
  pmReceberBtn.addEventListener("click", function () { openCommitmentForm("receber"); });
  pmCardBtn.addEventListener("click", function () { switchView("cartoes"); });

  commitmentFormOverlay.addEventListener("click", function (e) {
    if (e.target === commitmentFormOverlay) closeCommitmentForm();
  });
  commitmentFormSaveBtn.addEventListener("click", function () {
    var desc = commitmentDescInput.value.trim();
    if (!desc) { showToast("Digite uma descrição."); commitmentDescInput.focus(); return; }
    var amount = parseAmount(commitmentAmountInput.value);
    if (isNaN(amount) || amount <= 0) { showToast("Valor inválido."); commitmentAmountInput.focus(); return; }
    var dueDate = commitmentDateInput.value;
    if (!dueDate) { showToast("Escolha uma data."); return; }

    addCommitment({
      id: uid(),
      desc: desc,
      amount: amount,
      dueDate: dueDate,
      kind: pendingCommitmentKind,
      createdAt: Date.now()
    });
    closeCommitmentForm();
    renderProximosMeses();
    showToast("Compromisso adicionado!");
  });

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
  function setTransactionType(type) {
    currentType = type;
    typeToggle.querySelectorAll(".segmented-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.type === type);
    });

    installmentToggleField.classList.toggle("hidden", currentType !== "expense");
    if (currentType !== "expense") {
      installmentToggle.checked = false;
      installmentBox.classList.add("hidden");
    }
    paymentMethodField.classList.toggle("hidden", currentType !== "expense");
    newPaymentMethodBox.classList.add("hidden");
    renderCategorySelect();
    updateCardSelectVisibility();
  }

  function renderCardSelect(selectValue) {
    var cards = loadCards();
    cardSelect.innerHTML = "";

    var noneOpt = document.createElement("option");
    noneOpt.value = NONE_CARD_VALUE;
    noneOpt.textContent = "Nenhum (genérico)";
    cardSelect.appendChild(noneOpt);

    cards.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      cardSelect.appendChild(opt);
    });

    cardSelect.value = (selectValue && cards.some(function (c) { return c.name === selectValue; }))
      ? selectValue
      : NONE_CARD_VALUE;
  }

  function updateCardSelectVisibility() {
    var show = currentType === "expense" &&
      paymentMethodSelect.value === CREDIT_CARD_METHOD &&
      loadCards().length > 0;
    cardSelectField.classList.toggle("hidden", !show);
    if (show) renderCardSelect();
  }

  typeToggle.addEventListener("click", function (e) {
    var btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    setTransactionType(btn.dataset.type);
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
    var thisMonth = financialMonthKeyFor(todayStr());
    var current = getBudgetForMonth(thisMonth);
    budgetModalTitle.textContent = "Definir orçamento de " + monthLabelFor(thisMonth) + " (" + cycleRangeLabel(thisMonth) + ")";
    budgetInput.value = current !== null ? String(current).replace(".", ",") : "";
    budgetModalOverlay.classList.remove("hidden");
    budgetInput.focus();
  }
  function hideBudgetModal() { budgetModalOverlay.classList.add("hidden"); }

  budgetModalCancel.addEventListener("click", hideBudgetModal);
  budgetModalOverlay.addEventListener("click", function (e) {
    if (e.target === budgetModalOverlay) hideBudgetModal();
  });
  budgetModalSave.addEventListener("click", function () {
    var val = parseAmount(budgetInput.value);
    if (isNaN(val) || val < 0) {
      showToast("Digite um valor válido.");
      budgetInput.focus();
      return;
    }
    setBudgetForMonth(financialMonthKeyFor(todayStr()), val);
    hideBudgetModal();
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

  // ---------- backup / restore ----------
  function buildBackupPayload() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      expenses: loadTransactions(),
      categories: loadCategories("expense"),
      incomeCategories: loadCategories("income"),
      paymentMethods: loadPaymentMethods(),
      budget: loadBudgetMap(),
      theme: loadTheme(),
      cards: loadCards(),
      subscriptions: loadSubscriptions(),
      commitments: loadCommitments()
    };
  }

  function exportBackup() {
    var data = buildBackupPayload();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "money-tracker-backup-" + data.exportedAt.slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Backup exportado!");
  }

  function restoreBackup(data) {
    if (Array.isArray(data.expenses)) saveTransactions(data.expenses);
    if (Array.isArray(data.categories)) saveCategories("expense", data.categories);
    if (Array.isArray(data.incomeCategories)) saveCategories("income", data.incomeCategories);
    if (Array.isArray(data.paymentMethods)) savePaymentMethods(data.paymentMethods);
    if (data.budget && typeof data.budget === "object" && !Array.isArray(data.budget)) saveBudgetMap(data.budget);
    if (typeof data.theme === "string") { saveTheme(data.theme); applyTheme(data.theme); }
    if (Array.isArray(data.cards)) saveCards(data.cards);
    if (Array.isArray(data.subscriptions)) saveSubscriptions(data.subscriptions);
    if (Array.isArray(data.commitments)) saveCommitments(data.commitments);
    closeSettings();
    showToast("Backup restaurado!");
    switchView("home");
  }

  function importBackupFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (e) { showToast("Arquivo de backup inválido."); return; }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        showToast("Arquivo de backup inválido.");
        return;
      }
      showConfirm("Restaurar este backup? Isso vai substituir todos os dados atuais deste dispositivo.", function () {
        restoreBackup(data);
      });
    };
    reader.readAsText(file);
  }

  exportBackupBtn.addEventListener("click", exportBackup);
  importBackupBtn.addEventListener("click", function () { importBackupInput.click(); });
  importBackupInput.addEventListener("change", function () {
    var file = importBackupInput.files[0];
    if (file) importBackupFile(file);
    importBackupInput.value = "";
  });

  // ---------- cloud backup (Firebase) ----------
  function scheduleCloudSave() {
    if (!window.CloudSync || !window.CloudSync.isSignedIn()) return;
    window.CloudSync.queueSave(buildBackupPayload);
  }

  function isLocalDataEmpty() {
    return loadTransactions().length === 0 &&
      loadCategories("expense").length === 0 &&
      loadCategories("income").length === 0;
  }

  var lastCloudSyncAt = null;

  function refreshCloudStatusText() {
    if (!window.CloudSync || !window.CloudSync.isSignedIn()) return;
    var lastText = lastCloudSyncAt
      ? new Date(lastCloudSyncAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "agora mesmo";
    cloudStatusText.innerHTML = 'Conectado como <span class="ok">' + escapeHtml(window.CloudSync.currentEmail()) + '</span><br>Última sincronização: ' + lastText;
  }

  function updateCloudStatusUI(user) {
    cloudAuthForm.classList.toggle("hidden", !!user);
    cloudSignedInBox.classList.toggle("hidden", !user);
    if (user) refreshCloudStatusText();
  }

  function whenCloudSyncReady(cb) {
    if (window.CloudSync) { cb(); return; }
    window.addEventListener("cloudsync:ready", cb, { once: true });
  }

  cloudSignUpBtn.addEventListener("click", function () {
    var email = cloudEmailInput.value.trim();
    var password = cloudPasswordInput.value;
    if (!email || !password) { showToast("Digite e-mail e senha."); return; }
    window.CloudSync.signUp(email, password).then(function () {
      cloudPasswordInput.value = "";
      showToast("Conta criada — fazendo backup agora.");
    }).catch(function (err) { showToast(err.message); });
  });

  cloudSignInBtn.addEventListener("click", function () {
    var email = cloudEmailInput.value.trim();
    var password = cloudPasswordInput.value;
    if (!email || !password) { showToast("Digite e-mail e senha."); return; }
    window.CloudSync.signIn(email, password).then(function () {
      cloudPasswordInput.value = "";
    }).catch(function (err) { showToast(err.message); });
  });

  cloudSignOutBtn.addEventListener("click", function () {
    window.CloudSync.signOut();
  });

  cloudRestoreBtn.addEventListener("click", function () {
    window.CloudSync.fetchCloudBackup().then(function (data) {
      if (!data) { showToast("Nenhum backup na nuvem encontrado ainda."); return; }
      showConfirm("Restaurar do seu backup na nuvem? Isso vai substituir todos os dados atuais deste dispositivo.", function () {
        restoreBackup(data);
      });
    }).catch(function (err) { showToast(err.message); });
  });

  window.addEventListener("cloudsync:saved", function (e) {
    lastCloudSyncAt = e.detail.at;
    refreshCloudStatusText();
  });

  window.addEventListener("cloudsync:error", function (e) {
    showToast("Erro na sincronização: " + e.detail.message);
  });

  whenCloudSyncReady(function () {
    window.CloudSync.onAuthChange(function (user) {
      updateCloudStatusUI(user);
      if (!user) return;
      if (isLocalDataEmpty()) {
        window.CloudSync.fetchCloudBackup().then(function (data) {
          if (data) restoreBackup(data);
        });
      } else {
        scheduleCloudSave();
      }
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
      placeholder.textContent = "Nenhuma categoria ainda";
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
    newOpt.textContent = "+ Nova categoria";
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
    var cardNames = loadCards().map(function (c) { return c.name; });
    var methods = loadPaymentMethods().filter(function (m) { return cardNames.indexOf(m) === -1; });
    paymentMethodSelect.innerHTML = "";

    methods.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      paymentMethodSelect.appendChild(opt);
    });

    var newOpt = document.createElement("option");
    newOpt.value = NEW_PAYMENT_METHOD_VALUE;
    newOpt.textContent = "+ Nova forma de pagamento";
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
    updateCardSelectVisibility();
  });

  confirmNewPaymentMethodBtn.addEventListener("click", function () {
    var name = newPaymentMethodInput.value.trim();
    if (!name) return;
    addPaymentMethod(name);
    newPaymentMethodInput.value = "";
    newPaymentMethodBox.classList.add("hidden");
    renderPaymentMethodSelect(name);
    updateCardSelectVisibility();
  });

  // ---------- expense form ----------
  function resetAddFormAfterSave() {
    descInput.value = "";
    amountInput.value = "";
    newCategoryInput.value = "";
    newCategoryBox.classList.add("hidden");
    newPaymentMethodInput.value = "";
    newPaymentMethodBox.classList.add("hidden");
    installmentToggle.checked = false;
    installmentBox.classList.add("hidden");
    installmentCount.value = "";
    installmentToggleField.classList.toggle("hidden", currentType !== "expense");
    applyAllInstallmentsField.classList.add("hidden");
    saveTxBtn.textContent = "Salvar";
    renderCategorySelect();
    renderPaymentMethodSelect();
    updateCardSelectVisibility();
  }

  function openEditTransaction(id) {
    var tx = loadTransactions().find(function (t) { return t.id === id; });
    if (!tx) return;

    editingTxId = id;
    setTransactionType(typeOf(tx));
    descInput.value = tx.desc;
    amountInput.value = String(tx.amount).replace(".", ",");
    dateInput.value = tx.date;
    renderCategorySelect(tx.category);
    newCategoryBox.classList.add("hidden");

    if (currentType === "expense") {
      var cardNamesNow = loadCards().map(function (c) { return c.name; });
      var pmValue = tx.paymentMethod;
      var cardNameValue = tx.cardName || null;
      if (!cardNameValue && pmValue && cardNamesNow.indexOf(pmValue) !== -1) {
        // legacy record: the payment method itself used to be the card's own name
        cardNameValue = pmValue;
        pmValue = CREDIT_CARD_METHOD;
      }
      renderPaymentMethodSelect(pmValue);
      updateCardSelectVisibility();
      if (cardNameValue) cardSelect.value = cardNameValue;
    }

    installmentToggleField.classList.add("hidden");
    installmentToggle.checked = false;
    installmentBox.classList.add("hidden");
    applyAllInstallmentsField.classList.toggle("hidden", !tx.installmentGroup);
    applyAllInstallmentsToggle.checked = true;
    saveTxBtn.textContent = "Salvar Alterações";
    switchView("add");
  }

  expenseForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var desc = descInput.value.trim();
    var amount = parseAmount(amountInput.value);
    var category = categorySelect.value;
    var date = dateInput.value;

    if (!desc || !date) return;

    if (isNaN(amount) || amount <= 0) {
      showToast("Digite um valor válido.");
      amountInput.focus();
      return;
    }

    if (category === NEW_CATEGORY_VALUE || !category) {
      var pending = newCategoryInput.value.trim();
      if (!pending) {
        showToast("Digite o nome da categoria.");
        newCategoryInput.focus();
        return;
      }
      category = addCategory(currentType, pending);
    }

    var paymentMethod = null;
    var cardName = null;
    if (currentType === "expense") {
      paymentMethod = paymentMethodSelect.value;
      if (paymentMethod === NEW_PAYMENT_METHOD_VALUE || !paymentMethod) {
        var pendingMethod = newPaymentMethodInput.value.trim();
        if (!pendingMethod) {
          showToast("Digite o nome da forma de pagamento.");
          newPaymentMethodInput.focus();
          return;
        }
        paymentMethod = addPaymentMethod(pendingMethod);
      }
      if (paymentMethod === CREDIT_CARD_METHOD &&
          !cardSelectField.classList.contains("hidden") &&
          cardSelect.value !== NONE_CARD_VALUE) {
        cardName = cardSelect.value;
      }
    }

    if (editingTxId) {
      var allTxs = loadTransactions();
      var idx = allTxs.findIndex(function (t) { return t.id === editingTxId; });
      if (idx !== -1) {
        var groupId = allTxs[idx].installmentGroup;
        var applyToGroup = !!groupId &&
          !applyAllInstallmentsField.classList.contains("hidden") &&
          applyAllInstallmentsToggle.checked;
        var baseDesc = desc.replace(/\s*\(\d+\/\d+\)$/, "");

        allTxs[idx].desc = desc;
        allTxs[idx].amount = amount;
        allTxs[idx].category = category;
        allTxs[idx].date = date;
        allTxs[idx].type = currentType;
        if (currentType === "expense") {
          allTxs[idx].paymentMethod = paymentMethod;
          if (cardName) allTxs[idx].cardName = cardName;
          else delete allTxs[idx].cardName;
        } else {
          delete allTxs[idx].paymentMethod;
          delete allTxs[idx].cardName;
        }

        if (applyToGroup) {
          allTxs.forEach(function (t) {
            if (t.installmentGroup !== groupId || t.id === editingTxId) return;
            t.category = category;
            if (currentType === "expense") {
              t.paymentMethod = paymentMethod;
              if (cardName) t.cardName = cardName;
              else delete t.cardName;
            } else {
              delete t.paymentMethod;
              delete t.cardName;
            }
            t.desc = baseDesc + " (" + t.installmentIndex + "/" + t.installmentTotal + ")";
          });
        }

        saveTransactions(allTxs);
      }
      editingTxId = null;
      resetAddFormAfterSave();
      showToast(applyToGroup ? "Alterações salvas em todas as parcelas!" : "Alterações salvas!");
      switchView("home");
      return;
    }

    var installments = 1;
    if (currentType === "expense" && installmentToggle.checked) {
      installments = parseInt(installmentCount.value, 10);
      if (!installments || installments < 2) {
        showToast("Digite um número de parcelas válido (2–60).");
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
          cardName: cardName || undefined,
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
        cardName: currentType === "expense" ? (cardName || undefined) : undefined,
        createdAt: createdAt
      });
    }
    saveTransactions(txs);

    resetAddFormAfterSave();
    showToast(installments > 1 ? "Salvo em " + installments + " meses!" : "Salvo!");
    switchView("home");
  });

  // ---------- annual tab ----------
  function renderAnnual() {
    var year = yearWithOffset(yearOffset);
    yearNavLabel.textContent = String(year);
    yearNavSubLabel.textContent = financialYearRangeLabel(year);
    var bounds = financialYearBounds(year);
    var startDate = bounds.start;
    var endDate = bounds.end;

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
      annualBudgetAvg.textContent = "Sem dados";
    } else {
      var avg = set.reduce(function (s, k) { return s + budgetMap[k]; }, 0) / set.length;
      annualBudgetAvg.textContent = formatCurrency(avg);
    }

    var entries = buildCategoryEntries(txs, startDate, endDate, annualKind);
    var total = entries.reduce(function (s, e) { return s + e.amount; }, 0);
    var emptyMsg = (annualKind === "income" ? "Nenhuma receita em " : "Nenhuma despesa em ") + year + ".";

    renderDonut(
      { svg: annualDonutSvg, legendList: annualLegendList, donutTotal: annualDonutTotal, donutWrap: annualDonutWrap },
      entries,
      total,
      emptyMsg
    );
  }

  // ---------- monthly tab ----------
  function renderMonthly() {
    var monthKey = monthKeyWithOffset(monthOffset);
    monthNavLabel.textContent = monthLabelFor(monthKey);
    monthNavSubLabel.textContent = cycleRangeLabel(monthKey);

    var txs = loadTransactions()
      .filter(function (t) { return financialMonthKeyFor(t.date) === monthKey; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt - a.createdAt;
      });

    var moneyIn = 0, moneyOut = 0;
    txs.forEach(function (t) {
      if (typeOf(t) === "income") moneyIn += t.amount;
      else moneyOut += t.amount;
    });

    monthStatReceitas.textContent = formatCurrency(moneyIn);
    monthStatDespesas.textContent = formatCurrency(moneyOut);
    var monthBalance = moneyIn - moneyOut;
    monthStatBalanco.textContent = formatCurrency(monthBalance);
    monthStatBalanco.classList.remove("positive", "negative");
    monthStatBalanco.classList.add(monthBalance >= 0 ? "positive" : "negative");

    if (txs.length === 0) {
      monthList.innerHTML = '<div class="empty-state">Nenhuma transação neste mês.</div>';
      return;
    }

    var html = "";
    txs.forEach(function (t) {
      html += expenseItemHtml(t, "delete-month-expense");
    });
    monthList.innerHTML = html;

    monthList.querySelectorAll(".delete-month-expense").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir esta transação?", function () {
          var remaining = loadTransactions().filter(function (t) { return t.id !== id; });
          saveTransactions(remaining);
          renderMonthly();
        });
      });
    });

    monthList.querySelectorAll(".edit-tx").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditTransaction(btn.dataset.id); });
    });
  }

  // ---------- donut chart (generic, by category) ----------
  function categoryColorVar(index) {
    return "var(--series-" + ((index % 8) + 1) + ")";
  }

  function buildCategoryEntries(txs, startDate, endDate, type) {
    return buildGroupedEntries(txs, startDate, endDate, type, function (t) { return t.category; });
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
      if (restTotal > 0) top.push({ name: "Outros", amount: restTotal, isOther: true });
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

  function renderDonut(els, entries, totalAmount, emptyMessage) {
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
      path.setAttribute("d", describeArcPath(50, 50, 44, 33, drawStart, drawEnd));
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
        cardName: first.cardName,
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
      "Total líquido: " + formatCurrency(total) +
      '<div class="muted">' + txs.length + " transação(ões)</div>";

    if (txs.length === 0) {
      historyList.innerHTML = '<div class="empty-state">Nenhuma transação ainda.</div>';
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
      html += '<div class="week-header"><span>Semana de ' + weekLabelFor(key) + '</span>' +
              '<span class="week-total">' + formatCurrency(weekTotal) + '</span></div>';
      items.forEach(function (t) {
        html += expenseItemHtml(t, "delete-expense", t.installmentGroup ? ' data-group="1"' : '');
      });
      html += '</div>';
    });
    historyList.innerHTML = html;

    historyList.querySelectorAll(".delete-expense").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        var isGroup = btn.dataset.group === "1";
        showConfirm(
          isGroup ? "Excluir esta compra e todas as suas parcelas?" : "Excluir esta transação?",
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

    historyList.querySelectorAll(".edit-tx").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditTransaction(btn.dataset.id); });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function expenseItemHtml(t, deleteClass, extraAttrs) {
    var isIncome = typeOf(t) === "income";
    var sign = isIncome ? "+" : "-";
    var amountClass = isIncome ? "positive" : "negative";
    var isCollapsedGroup = !!(t.installmentGroup && t.id === t.installmentGroup);
    var editBtn = isCollapsedGroup ? "" :
      '<button class="icon-btn edit-tx" data-id="' + t.id + '" aria-label="Editar transação">✎</button>';
    return '<div class="expense-item" data-id="' + t.id + '">' +
      '<div class="expense-info">' +
        '<div class="expense-desc">' + escapeHtml(t.desc) + '</div>' +
        '<div class="expense-meta"><span class="badge">' + escapeHtml(t.category) + '</span>' +
          (t.paymentMethod ? '<span class="badge">' + escapeHtml(t.paymentMethod) + '</span>' : '') +
          (t.cardName ? '<span class="badge">' + escapeHtml(t.cardName) + '</span>' : '') +
          '<span>' + formatDateShort(t.date) + '</span></div>' +
      '</div>' +
      '<div class="expense-right">' +
        '<span class="expense-amount ' + amountClass + '">' + sign + formatCurrency(t.amount) + '</span>' +
        editBtn +
        '<button class="icon-btn ' + deleteClass + '" data-id="' + t.id + '"' + (extraAttrs || '') + ' aria-label="Excluir transação">✕</button>' +
      '</div>' +
    '</div>';
  }

  function renderTransactionItems(container, txs, onDeleted) {
    if (txs.length === 0) {
      container.innerHTML = '<div class="empty-state">Sem transações.</div>';
      return;
    }
    var html = "";
    txs.forEach(function (t) {
      html += expenseItemHtml(t, "delete-tx");
    });
    container.innerHTML = html;

    container.querySelectorAll(".delete-tx").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir esta transação?", function () {
          var remaining = loadTransactions().filter(function (t) { return t.id !== id; });
          saveTransactions(remaining);
          onDeleted();
        });
      });
    });

    container.querySelectorAll(".edit-tx").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditTransaction(btn.dataset.id); });
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
      categoryList.innerHTML = '<div class="empty-state">Nenhuma categoria ainda.</div>';
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
          'Excluir a categoria "' + name + '"? Transações antigas mantêm ela, só desaparece da lista para novas.',
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
      if (t.paymentMethod && LEGACY_EN_METHOD_NAMES[t.paymentMethod]) {
        t.paymentMethod = LEGACY_EN_METHOD_NAMES[t.paymentMethod];
        changed = true;
      }
    });
    if (changed) saveTransactions(txs);
  })();

  dateInput.value = todayStr();
  renderCategorySelect();
  renderPaymentMethodSelect();
  updateHideBalanceIcon();
  switchView("home");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
        reg.update();
      }).catch(function () {});
    });
  }
})();
