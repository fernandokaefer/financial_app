(function () {
  "use strict";

  var STORAGE_KEYS = {
    categories: "gastos_categories",
    expenses: "gastos_expenses"
  };
  var NEW_CATEGORY_VALUE = "__new__";

  // ---------- storage ----------
  function loadCategories() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.categories)) || []; }
    catch (e) { return []; }
  }
  function saveCategories(cats) {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(cats));
  }
  function loadExpenses() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses)) || []; }
    catch (e) { return []; }
  }
  function saveExpenses(exps) {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(exps));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- formatting ----------
  var currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function formatCurrency(v) { return currencyFmt.format(v || 0); }

  function formatDateShort(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
    };
    return fmt(monday) + " – " + fmt(sunday);
  }

  function todayStr() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // ---------- elements ----------
  var pageTitle = document.getElementById("pageTitle");
  var tabs = document.querySelectorAll(".tab");
  var views = document.querySelectorAll(".view");

  var expenseForm = document.getElementById("expenseForm");
  var descInput = document.getElementById("descInput");
  var amountInput = document.getElementById("amountInput");
  var categorySelect = document.getElementById("categorySelect");
  var newCategoryBox = document.getElementById("newCategoryBox");
  var newCategoryInput = document.getElementById("newCategoryInput");
  var confirmNewCategoryBtn = document.getElementById("confirmNewCategoryBtn");
  var dateInput = document.getElementById("dateInput");
  var toast = document.getElementById("toast");

  var summaryBar = document.getElementById("summaryBar");
  var historyList = document.getElementById("historyList");

  var categoryForm = document.getElementById("categoryForm");
  var categoryNameInput = document.getElementById("categoryNameInput");
  var categoryList = document.getElementById("categoryList");

  var modalOverlay = document.getElementById("modalOverlay");
  var modalMessage = document.getElementById("modalMessage");
  var modalCancel = document.getElementById("modalCancel");
  var modalConfirm = document.getElementById("modalConfirm");

  var TITLES = { lancar: "Lançar gasto", historico: "Histórico", categorias: "Categorias" };

  // ---------- view switching ----------
  function switchView(name) {
    views.forEach(function (v) { v.classList.toggle("active", v.id === "view-" + name); });
    tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.view === name); });
    pageTitle.textContent = TITLES[name];
    if (name === "historico") renderHistory();
    if (name === "categorias") renderCategoryManager();
    if (name === "lancar") renderCategorySelect();
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () { switchView(btn.dataset.view); });
  });

  // ---------- modal ----------
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

  // ---------- category select (Lançar tab) ----------
  function renderCategorySelect(selectValue) {
    var cats = loadCategories();
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
    } else if (cats.length === 0) {
      categorySelect.value = NEW_CATEGORY_VALUE;
      newCategoryBox.classList.remove("hidden");
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

  function addCategory(name) {
    var cats = loadCategories();
    var exists = cats.some(function (c) { return c.toLowerCase() === name.toLowerCase(); });
    if (!exists) {
      cats.push(name);
      saveCategories(cats);
    }
    return name;
  }

  confirmNewCategoryBtn.addEventListener("click", function () {
    var name = newCategoryInput.value.trim();
    if (!name) return;
    addCategory(name);
    newCategoryInput.value = "";
    newCategoryBox.classList.add("hidden");
    renderCategorySelect(name);
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
      category = addCategory(pending);
    }

    var expenses = loadExpenses();
    expenses.push({
      id: uid(),
      desc: desc,
      amount: amount,
      category: category,
      date: date,
      createdAt: Date.now()
    });
    saveExpenses(expenses);

    descInput.value = "";
    amountInput.value = "";
    newCategoryInput.value = "";
    newCategoryBox.classList.add("hidden");
    renderCategorySelect(category);
    descInput.focus();
    showToast("Gasto salvo!");
  });

  // ---------- history ----------
  function renderHistory() {
    var expenses = loadExpenses().slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    var total = expenses.reduce(function (sum, e) { return sum + e.amount; }, 0);
    summaryBar.innerHTML =
      "Total geral: " + formatCurrency(total) +
      '<div class="muted">' + expenses.length + " lançamento(s)</div>";

    if (expenses.length === 0) {
      historyList.innerHTML = '<div class="empty-state">Nenhum gasto lançado ainda.</div>';
      return;
    }

    var groups = {};
    var order = [];
    expenses.forEach(function (e) {
      var key = weekKeyFor(e.date);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(e);
    });
    order.sort().reverse();

    var html = "";
    order.forEach(function (key) {
      var items = groups[key];
      var weekTotal = items.reduce(function (s, e) { return s + e.amount; }, 0);
      html += '<div class="week-group">';
      html += '<div class="week-header"><span>Semana ' + weekLabelFor(key) + '</span>' +
              '<span class="week-total">' + formatCurrency(weekTotal) + '</span></div>';
      items.forEach(function (e) {
        html += '<div class="expense-item" data-id="' + e.id + '">' +
          '<div class="expense-info">' +
            '<div class="expense-desc">' + escapeHtml(e.desc) + '</div>' +
            '<div class="expense-meta"><span class="badge">' + escapeHtml(e.category) + '</span><span>' + formatDateShort(e.date) + '</span></div>' +
          '</div>' +
          '<div class="expense-right">' +
            '<span class="expense-amount">' + formatCurrency(e.amount) + '</span>' +
            '<button class="icon-btn delete-expense" data-id="' + e.id + '">✕</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    });
    historyList.innerHTML = html;

    historyList.querySelectorAll(".delete-expense").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        showConfirm("Excluir este lançamento?", function () {
          var remaining = loadExpenses().filter(function (e) { return e.id !== id; });
          saveExpenses(remaining);
          renderHistory();
        });
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- category manager (Categorias tab) ----------
  function renderCategoryManager() {
    var cats = loadCategories();
    if (cats.length === 0) {
      categoryList.innerHTML = '<div class="empty-state">Nenhuma categoria criada ainda.</div>';
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
          'Excluir a categoria "' + name + '"? O histórico já lançado com ela é mantido, só some da lista para novos gastos.',
          function () {
            var cats = loadCategories().filter(function (c) { return c !== name; });
            saveCategories(cats);
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
    addCategory(name);
    categoryNameInput.value = "";
    renderCategoryManager();
  });

  // ---------- init ----------
  dateInput.value = todayStr();
  renderCategorySelect();
  switchView("lancar");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
