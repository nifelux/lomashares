/* =====================================================
   LOMASHARES FRONTEND COMPLETE SYSTEM
   Version: Backend v2 Compatible (Supabase Wallet API)
===================================================== */

/* =====================================================
   DATABASE HELPERS (LocalStorage fallback)
===================================================== */
function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || [];
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getAuthUser() {
  return JSON.parse(localStorage.getItem("authUser"));
}

function setAuthUser(user) {
  localStorage.setItem("authUser", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("authUser");
  window.location.href = "index.html";
}

/* =====================================================
   REFERRAL SYSTEM
===================================================== */
function generateReferralCode() {
  return "LOMA" + Math.floor(100000 + Math.random() * 900000);
}

function isValidReferral(code) {
  if (!code) return true;
  return getUsers().some(u => u.myReferralCode === code);
}

function rewardSponsor(referralCode, amount) {
  if (!referralCode) return;
  const users = getUsers();
  const sponsor = users.find(u => u.myReferralCode === referralCode);
  if (!sponsor) return;

  const bonus = amount * 0.10; // 10% referral bonus
  sponsor.balance += bonus;
  sponsor.transactions.push({
    type: "Referral Bonus",
    amount: bonus,
    date: new Date().toISOString()
  });
  saveUsers(users);
}

/* =====================================================
   AUTHENTICATION
===================================================== */
window.handleRegister = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirm-password").value.trim();
  const referral = document.getElementById("referral-code")?.value.trim();

  if (!email || !password || !confirmPassword) {
    alert("All fields required");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  if (!isValidReferral(referral)) {
    alert("Invalid referral code");
    return;
  }

  const users = getUsers();
  if (users.some(u => u.email === email)) {
    alert("Email already exists");
    return;
  }

  const newUser = {
    email,
    password,
    referralUsed: referral || null,
    myReferralCode: generateReferralCode(),
    balance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    investments: [],
    transactions: [],
    deposits: [],
    withdrawals: [],
    role: "user",
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  alert("Registration successful");
  window.location.href = "index.html";
};

window.handleLogin = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    alert("Invalid login details");
    return;
  }

  setAuthUser(user);
  window.location.href = "dashboard.html";
};

/* =====================================================
   PAGE PROTECTION
===================================================== */
window.addEventListener("load", function () {
  const protectedPages = [
    "dashboard.html",
    "investment.html",
    "deposit.html",
    "withdraw.html",
    "profile.html",
    "refer.html",
    "team.html",
    "transactions.html",
    "admin-withdrawals.html"
  ];

  const page = window.location.pathname.split("/").pop();
  if (protectedPages.includes(page) && !getAuthUser()) {
    window.location.href = "index.html";
  }
});

/* =====================================================
   INVESTMENT PRODUCTS (10 Products, 200% return in 30 days)
===================================================== */
const PRODUCTS = [
  { id: 1, price: 3000 },
  { id: 2, price: 5000 },
  { id: 3, price: 7000 },
  { id: 4, price: 10000 },
  { id: 5, price: 15000 },
  { id: 6, price: 20000 },
  { id: 7, price: 30000 },
  { id: 8, price: 40000 },
  { id: 9, price: 50000 },
  { id: 10, price: 100000 }
];

/* =====================================================
   INVEST FUNCTION
===================================================== */
window.invest = function (productId) {
  const users = getUsers();
  const auth = getAuthUser();
  const user = users.find(u => u.email === auth.email);
  const product = PRODUCTS.find(p => p.id === productId);

  if (user.balance < product.price) {
    alert("Insufficient balance");
    return;
  }

  const investedTimes = user.investments.filter(inv => inv.productId === productId).length;
  if (investedTimes >= 2) {
    alert("You can only invest in this product twice lifetime");
    return;
  }

  user.balance -= product.price;

  const totalReturn = product.price * 2; 
  const dailyIncome = totalReturn / 30;

  const investment = {
    productId,
    price: product.price,
    daily: dailyIncome,
    days: 30,
    startDate: new Date().toISOString(),
    lastPaid: null,
    completedDays: 0,
    active: true
  };

  user.investments.push(investment);

  rewardSponsor(user.referralUsed, product.price);

  user.transactions.push({
    type: "Investment",
    amount: product.price,
    date: new Date().toISOString()
  });

  saveUsers(users);
  setAuthUser(user);

  alert("Investment successful");
};

/* =====================================================
   DAILY PROFIT SYSTEM
===================================================== */
function processDailyIncome() {
  const users = getUsers();
  const auth = getAuthUser();
  const user = users.find(u => u.email === auth.email);
  const now = new Date();

  user.investments.forEach(inv => {
    if (!inv.active) return;

    const last = inv.lastPaid ? new Date(inv.lastPaid) : new Date(inv.startDate);
    const diffHours = (now - last) / (1000 * 60 * 60);

    if (diffHours >= 24 && inv.completedDays < inv.days) {
      user.balance += inv.daily;
      inv.completedDays += 1;
      inv.lastPaid = now.toISOString();

      user.transactions.push({
        type: "Daily Income",
        amount: inv.daily,
        date: now.toISOString()
      });

      if (inv.completedDays >= inv.days) {
        inv.active = false;
      }
    }
  });

  saveUsers(users);
  setAuthUser(user);
}

/* =====================================================
   DEPOSIT (Integrated with /api/wallet)
===================================================== */
window.deposit = async function (amount) {
  try {
    const input = document.getElementById("deposit-amount");
    if (!amount) {
      amount = parseFloat(input.value.trim());
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      alert("Enter a valid amount");
      return;
    }

    const user = getAuthUser();
    const response = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, userEmail: user.email })
    });

    const data = await response.json();

    if (response.ok) {
      user.balance = data.balance; // Update balance from API
      setAuthUser(user);
      alert("Deposit successful: ₦" + amount.toLocaleString());
      input.value = "";
    } else {
      alert(data.error || "Deposit failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error connecting to wallet API");
  }
};

// Quick amount buttons
window.setQuickAmount = function (amount) {
  const input = document.getElementById("deposit-amount");
  if (input) input.value = amount;
};

/* =====================================================
   WITHDRAW
===================================================== */
window.withdraw = function (amount) {
  const users = getUsers();
  const auth = getAuthUser();
  const user = users.find(u => u.email === auth.email);
  amount = parseFloat(amount);

  if (user.balance < amount) {
    alert("Insufficient balance");
    return;
  }

  user.withdrawals.push({
    amount,
    status: "Pending",
    date: new Date().toISOString()
  });

  saveUsers(users);
  setAuthUser(user);

  alert("Withdrawal request submitted");
};

/* =====================================================
   ADMIN WITHDRAW APPROVAL
===================================================== */
window.approveWithdrawal = function (userEmail, index) {
  const users = getUsers();
  const user = users.find(u => u.email === userEmail);
  const withdrawal = user.withdrawals[index];

  if (withdrawal.status !== "Pending") return;

  withdrawal.status = "Approved";
  user.balance -= withdrawal.amount;
  user.totalWithdrawn += withdrawal.amount;

  user.transactions.push({
    type: "Withdrawal",
    amount: withdrawal.amount,
    date: new Date().toISOString()
  });

  saveUsers(users);
};

/* =====================================================
   DASHBOARD AUTO UPDATE
===================================================== */
window.addEventListener("load", function () {
  processDailyIncome();
  renderProducts(); // investment cards
});

/* =====================================================
   DROPDOWN MENU (LOGIN/REGISTER/ABOUT)
===================================================== */
window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
};

window.addEventListener("click", function (e) {
  const menu = document.getElementById("dropdownMenu");
  const icon = document.querySelector(".menu-icon");

  if (!icon.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});

/* =====================================================
   RENDER PRODUCTS ON DASHBOARD
===================================================== */
function renderProducts() {
  const container = document.getElementById("products-container");
  if (!container) return;

  container.innerHTML = "";
  PRODUCTS.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <h3>Investment: ₦${product.price.toLocaleString()}</h3>
      <p>Return: 200% in 30 days</p>
      <p>Daily Income: ₦${(product.price * 2 / 30).toLocaleString()}</p>
      <button onclick="invest(${product.id})">Invest</button>
    `;
    container.appendChild(card);
  });
   }
