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

// === Settings Modal Elements ===
const openSettingsBtn = document.getElementById("open-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const settingsModal = document.getElementById("settings-modal");
const darkModeToggle = document.getElementById("dark-mode-toggle");

let budget = 0;
let expenses = [];

// Load from localStorage
window.onload = () => {
  budget = parseFloat(localStorage.getItem("budget")) || 0;
  expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  // Load and apply dark mode preference
  const darkPref = localStorage.getItem("darkMode") === "true";
  document.body.classList.toggle("dark-mode", darkPref);
  if (darkModeToggle) darkModeToggle.checked = darkPref;

  updateUI();
};

// === Budget Form ===
budgetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  budget = parseFloat(budgetInput.value);
  budgetInput.value = "";
  localStorage.setItem("budget", budget);
  updateUI();
});

// === Expense Modal Handlers ===
openModalBtn.addEventListener("click", () => modal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));

// === Expense Form ===
expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const expense = {
    id: Date.now(),
    title: expenseTitle.value,
    amount: parseFloat(expenseAmount.value),
    date: expenseDate.value,
    category: expenseCategory.value
  };
  expenses.push(expense);
  localStorage.setItem("expenses", JSON.stringify(expenses));
  expenseForm.reset();
  modal.classList.add("hidden");
  updateUI();
});

// === Delete Expense ===
function deleteExpense(id) {
  expenses = expenses.filter(exp => exp.id !== id);
  localStorage.setItem("expenses", JSON.stringify(expenses));
  updateUI();
}

// === Update UI ===
function updateUI() {
  // Budget Summary
  totalBudgetEl.textContent = budget.toFixed(2);
  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  totalExpenseEl.textContent = totalExpense.toFixed(2);
  remainingEl.textContent = (budget - totalExpense).toFixed(2);

  // Expense List
  expenseList.innerHTML = "";
  expenses.forEach((exp) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${exp.title} - ₹${exp.amount} (${exp.category})</span>
      <button onclick="deleteExpense(${exp.id})" style="background:red;padding:5px 10px;border-radius:6px;color:#fff;">X</button>
    `;
    expenseList.appendChild(li);
  });

  renderCategoryChart();
}

// === Render Chart ===
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
        backgroundColor: [
          '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// === Settings Modal Handlers ===
if (openSettingsBtn && closeSettingsBtn && settingsModal) {
  openSettingsBtn.addEventListener("click", () => settingsModal.classList.remove("hidden"));
  closeSettingsBtn.addEventListener("click", () => settingsModal.classList.add("hidden"));
}

// === Dark Mode Toggle ===
if (darkModeToggle) {
  darkModeToggle.addEventListener("change", () => {
    const isDark = darkModeToggle.checked;
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("darkMode", isDark);
  });
}
