import { getSessionUser } from "./auth.js";

export function svgIcon(name){
  const icons = {
    home:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    invest:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5m0 14h16M7 15l3-3 3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    team:`<svg viewBox="0 0 24 24" fill="none"><path d="M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z" stroke="currentColor" stroke-width="2"/><path d="M3 20c1.5-4 6-5 9-5s7.5 1 9 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    profile:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.6-4 6-5 8-5s6.4 1 8 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    deposit:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v10m0-10 4 4m-4-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" stroke="currentColor" stroke-width="2"/></svg>`,
    withdraw:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 21V11m0 10 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6" stroke="currentColor" stroke-width="2"/></svg>`,
    gift:`<svg viewBox="0 0 24 24" fill="none"><path d="M20 12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9" stroke="currentColor" stroke-width="2"/><path d="M3 7h18v5H3V7Z" stroke="currentColor" stroke-width="2"/><path d="M12 7v15" stroke="currentColor" stroke-width="2"/><path d="M12 7c-2 0-4-1-4-3 0-1 1-2 2.5-2C12 2 12 7 12 7Zm0 0c2 0 4-1 4-3 0-1-1-2-2.5-2C12 2 12 7 12 7Z" stroke="currentColor" stroke-width="2"/></svg>`,
    refer:`<svg viewBox="0 0 24 24" fill="none"><path d="M15 14a5 5 0 1 0-6 0" stroke="currentColor" stroke-width="2"/><path d="M7 20c1-3 3-4 5-4s4 1 5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 8h2m-1-1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  return icons[name] || icons.home;
}

export function mountHeader({ menuLinks }) {
  const header = document.querySelector(".header");
  if (!header) return;

  header.innerHTML = `
    <div class="menuBtn" id="menuBtn" aria-label="menu">
      <svg viewBox="0 0 24 24" fill="none" style="width:22px;height:22px;color:#7db7ff">
        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="brand">LOMASHARES</div>
    <div class="menu" id="menu">
      ${menuLinks.map(l => `<a href="${l.href}">${svgIcon(l.icon)} ${l.label}</a>`).join("")}
    </div>
  `;

  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) menu.style.display = "none";
  });
}

export function mountFooter(active) {
  const footer = document.querySelector(".footer");
  if (!footer) return;

  footer.innerHTML = `
    <a class="fItem ${active==='home'?'fActive':''}" href="dashboard.html">${svgIcon('home')}Home</a>
    <a class="fItem ${active==='invest'?'fActive':''}" href="investment.html">${svgIcon('invest')}Invest</a>
    <a class="fItem ${active==='team'?'fActive':''}" href="team.html">${svgIcon('team')}Team</a>
    <a class="fItem ${active==='profile'?'fActive':''}" href="profile.html">${svgIcon('profile')}Profile</a>
  `;
}

export async function fetchWalletBalanceByEmail(email){
  const res = await fetch("/api/wallet-balance", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.error) throw new Error(data.error || "Wallet API error");
  return Number(data.balance || 0);
}

export async function getUserEmail(){
  const u = await getSessionUser();
  return u?.email ? String(u.email).toLowerCase() : null;
}

export function emailToName(email){
  if (!email) return "User";
  return (email.split("@")[0] || "User").replace(/[._-]+/g, " ");
  }
