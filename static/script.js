// Select DOM elements
const budgetForm = document.getElementById("budget-form");
const budgetInput = document.getElementById("budget-input");
const totalBudgetEl = document.getElementById("total-budget");
const totalExpenseEl = document.getElementById("total-expense");
const remainingEl = document.getElementById("remaining");

const openModalBtn = document.getElementById("open-modal");
const closeModalBtn = document.getElementById("close-modal");
const modal = document.getElementById("expense-modal");

const expenseForm = document.getElementById("expense-form");
const expenseTitle = document.getElementById("expense-title");
const expenseAmount = document.getElementById("expense-amount");
const expenseDate = document.getElementById("expense-date");
const expenseCategory = document.getElementById("expense-category");
const expenseList = document.getElementById("expense-list");

const categoryChartCtx = document.getElementById("categoryChart").getContext("2d");

// Settings
const openSettingsBtn = document.getElementById("open-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const settingsModal = document.getElementById("settings-modal");
const darkModeToggle = document.getElementById("dark-mode-toggle");

// Profile Dropdown
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');

profileBtn?.addEventListener('click', () => {
  dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});

window.addEventListener('click', function (e) {
  if (!profileBtn?.contains(e.target) && !dropdownMenu?.contains(e.target)) {
    dropdownMenu.style.display = 'none';
  }
});

// Variables
let expenses = [];
let budget = 0;

// === Budget Submit ===
budgetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newBudget = parseFloat(budgetInput.value);
  if (isNaN(newBudget) || newBudget < 0) {
    alert("Enter a valid budget.");
    return;
  }

  try {
    const res = await fetch("/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: newBudget }),
    });

    const data = await res.json();
    if (res.ok) {
      budget = newBudget;
      updateUI();
    } else {
      alert(data.error || "Failed to update budget.");
    }
  } catch (err) {
    console.error(err);
    alert("Error updating budget.");
  }
});

// === Expense Modal Handlers ===
openModalBtn?.addEventListener("click", () => modal.classList.remove("hidden"));
closeModalBtn?.addEventListener("click", () => modal.classList.add("hidden"));

// === Expense Submit ===
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const expense = {
    title: expenseTitle.value,
    amount: parseFloat(expenseAmount.value),
    date: expenseDate.value,
    category: expenseCategory.value,
  };

  await fetch("/add-expense", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense),
  });

  expenseForm.reset();
  modal.classList.add("hidden");

  await loadExpenses();
});

// === Delete Expense ===
async function deleteExpense(id) {
  await fetch(`/delete-expense/${id}`, { method: "DELETE" });
  await loadExpenses();
}

// === Load Budget & Expenses ===
async function loadInitialData() {
  try {
    const [budgetRes, expensesRes] = await Promise.all([
      fetch("/budget"),
      fetch("/expenses")
    ]);

    const budgetData = await budgetRes.json();
    const expensesData = await expensesRes.json();

    budget = budgetData.budget || 0;
    expenses = expensesData || [];

    updateUI();
  } catch (err) {
    console.error("Failed to load initial data", err);
  }
}

async function loadExpenses() {
  const res = await fetch("/expenses");
  expenses = await res.json();
  updateUI();
}

// === Update UI ===
function updateUI() {
  totalBudgetEl.textContent = budget.toFixed(2);

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  totalExpenseEl.textContent = totalExpense.toFixed(2);

  const remaining = budget - totalExpense;
  remainingEl.textContent = remaining.toFixed(2);

  const alertModal = document.getElementById("budget-alert");
  const closeAlertBtn = document.getElementById("close-alert");

  if (remaining < 0 && alertModal) {
    alertModal.classList.remove("hidden");
  } else if (alertModal) {
    alertModal.classList.add("hidden");
  }

  if (closeAlertBtn) {
    closeAlertBtn.onclick = () => alertModal.classList.add("hidden");
  }

  expenseList.innerHTML = "";
  expenses.forEach((exp) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        ${exp.title} - ₹${exp.amount} (${exp.category})<br>
        <small style="color: gray;">Date: ${new Date(exp.date).toLocaleDateString()}</small>
      </span>
      <button onclick="deleteExpense(${exp.id})" style="background:red;padding:5px 10px;border-radius:6px;color:#fff;">X</button>
    `;
    expenseList.appendChild(li);
  });

  renderCategoryChart();
  updateHighlights(expenses);
}

// === Chart ===
let categoryChart;
function renderCategoryChart() {
  const categories = {};
  expenses.forEach(exp => {
    categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
  });

  const labels = Object.keys(categories);
  const data = Object.values(categories);

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(categoryChartCtx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        label: "Expenses by Category",
        data,
        backgroundColor: ['#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// === Highlights ===
function updateHighlights(expenses) {
  const mostExpDiv = document.getElementById("most-expensive");
  const leastExpDiv = document.getElementById("least-expensive");

  if (!expenses.length) {
    mostExpDiv.textContent = "No expenses available.";
    leastExpDiv.textContent = "";
    return;
  }

  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  const most = sorted[0], least = sorted[sorted.length - 1];

  mostExpDiv.innerHTML = `💸 <strong>Most Expensive:</strong> ${most.title} - ₹${most.amount} (${most.category})`;
  leastExpDiv.innerHTML = `🪙 <strong>Least Expensive:</strong> ${least.title} - ₹${least.amount} (${least.category})`;
}

// === Settings Modal ===
openSettingsBtn?.addEventListener("click", () => settingsModal?.classList.remove("hidden"));
closeSettingsBtn?.addEventListener("click", () => settingsModal?.classList.add("hidden"));

// === Dark Mode ===
document.addEventListener("DOMContentLoaded", () => {
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  // Check stored preference
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  // Handle toggle switch changes
  darkModeToggle?.addEventListener("change", () => {
    const isDark = darkModeToggle.checked;

    document.body.classList.toggle("dark-mode", isDark);

    if (isDark) {
      localStorage.setItem("darkMode", "enabled");
    } else {
      localStorage.setItem("darkMode", "disabled");
    }
  });

  // Load page-specific data
  loadInitialData();
});

