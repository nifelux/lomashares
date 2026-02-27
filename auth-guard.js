(function() {
    const authUser = JSON.parse(localStorage.getItem('authUser'));
    const currentPage = window.location.pathname.split("/").pop();

    const protectedPages = [
        "dashboard.html",
        "investment.html",
        "deposit.html",
        "withdraw.html",
        "profile.html",
        "refer.html",
        "team.html",
        "transactions.html",
        "withdrawals.html",
        "deposits.html"
    ];

    const publicPages = [
        "index.html",
        "login.html",
        "register.html"
    ];

    if (authUser && publicPages.includes(currentPage)) {
        window.location.href = "dashboard.html";
        return;
    }

    if (!authUser && protectedPages.includes(currentPage)) {
        window.location.href = "index.html";
        return;
    }
})();
