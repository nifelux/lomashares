/* =====================================================
   LOMASHARES FRONTEND COMPLETE SYSTEM
   Version: Backend v2 Compatible
===================================================== */


/* =====================================================
   DATABASE HELPERS
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

  const bonus = amount * 0.10;

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
  const referral = document.getElementById("referral-code").value.trim();

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

  if (protectedPages.includes(page)) {
    if (!getAuthUser()) {
      window.location.href = "index.html";
    }
  }
});


/* =====================================================
   INVESTMENT PRODUCTS
===================================================== */

const PRODUCTS = [
  { id: 1, price: 1000, daily: 500, days: 3 },
  { id: 2, price: 3000, daily: 800, days: 5 },
  { id: 3, price: 7000, daily: 1500, days: 7 },
  { id: 4, price: 12000, daily: 2000, days: 9 },
  { id: 5, price: 25000, daily: 5000, days: 7 }
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

  user.balance -= product.price;

  const investment = {
    productId,
    price: product.price,
    daily: product.daily,
    days: product.days,
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
   DEPOSIT
===================================================== */

window.deposit = function (amount) {
  const users = getUsers();
  const auth = getAuthUser();
  const user = users.find(u => u.email === auth.email);

  amount = parseFloat(amount);

  user.balance += amount;
  user.totalDeposited += amount;

  user.deposits.push({ amount, date: new Date().toISOString() });

  user.transactions.push({
    type: "Deposit",
    amount,
    date: new Date().toISOString()
  });

  saveUsers(users);
  setAuthUser(user);

  alert("Deposit successful");
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
});

window.toggleMenu = function () {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
};

window.addEventListener("click", function(e) {
    const menu = document.getElementById("dropdownMenu");
    const icon = document.querySelector(".menu-icon");

    if (!icon.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
    }
});
