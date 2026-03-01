
export default async function handler(req, res) {
  try {
    // --------- Only allow GET/POST ----------
    if (!["GET", "POST"].includes(req.method)) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: "Missing env vars",
        needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
      });
    }

    const SB_HEADERS = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    };

    // --------- Helpers ----------
    const json = (code, data) => res.status(code).json(data);

    function safeNum(x) {
      const n = Number(x);
      return Number.isFinite(n) ? n : NaN;
    }

    async function sbGet(url) {
      const r = await fetch(url, { headers: SB_HEADERS });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    }

    async function sbPost(url, body, preferReturn = false) {
      const r = await fetch(url, {
        method: "POST",
        headers: { ...SB_HEADERS, ...(preferReturn ? { Prefer: "return=representation" } : {}) },
        body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    }

    async function sbPatch(url, body) {
      const r = await fetch(url, {
        method: "PATCH",
        headers: SB_HEADERS,
        body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: d };
    }

    async function findUserByEmail(email) {
      // Prefer profiles (your current system)
      const profUrl =
        `${SUPABASE_URL}/rest/v1/profiles?select=id,email,referral_code` +
        `&email=eq.${encodeURIComponent(email)}&limit=1`;

      const prof = await sbGet(profUrl);
      if (prof.ok && Array.isArray(prof.data) && prof.data[0]?.id) {
        return { user_id: prof.data[0].id, source: "profiles" };
      }

      // Fallback: old public.users table (in case you still have it)
      const usersUrl =
        `${SUPABASE_URL}/rest/v1/users?select=id,email` +
        `&email=eq.${encodeURIComponent(email)}&limit=1`;

      const u = await sbGet(usersUrl);
      if (u.ok && Array.isArray(u.data) && u.data[0]?.id) {
        return { user_id: u.data[0].id, source: "users" };
      }

      return null;
    }

    async function getOrCreateWallet(user_id) {
      const wUrl =
        `${SUPABASE_URL}/rest/v1/wallets?select=user_id,balance` +
        `&user_id=eq.${user_id}&limit=1`;

      const w = await sbGet(wUrl);
      if (!w.ok) return { error: "Wallet query failed", details: w.data };

      if (Array.isArray(w.data) && w.data[0]) {
        return { wallet: w.data[0] };
      }

      // Create wallet if missing (safe)
      const created = await sbPost(
        `${SUPABASE_URL}/rest/v1/wallets`,
        { user_id, balance: 0, updated_at: new Date().toISOString() },
        true
      );

      if (!created.ok) return { error: "Wallet create failed", details: created.data };

      const row = Array.isArray(created.data) ? created.data[0] : created.data;
      return { wallet: row || { user_id, balance: 0 } };
    }

    async function getBalanceByEmail(email) {
      const u = await findUserByEmail(email);
      if (!u) return { error: "User not found" };

      const w = await getOrCreateWallet(u.user_id);
      if (w.error) return { error: w.error, details: w.details };

      return { ok: true, user_id: u.user_id, balance: Number(w.wallet.balance || 0) };
    }

    async function logTransaction({ user_id, type, amount, status, reference }) {
      // If reference exists, do not duplicate
      if (reference) {
        const checkUrl =
          `${SUPABASE_URL}/rest/v1/transactions?select=id` +
          `&reference=eq.${encodeURIComponent(reference)}&limit=1`;
        const chk = await sbGet(checkUrl);
        if (chk.ok && Array.isArray(chk.data) && chk.data.length > 0) {
          return { ok: true, skipped: true, reason: "reference_exists" };
        }
      }

      const tx = await sbPost(`${SUPABASE_URL}/rest/v1/transactions`, {
        user_id,
        type,
        amount,
        status: status || "success",
        reference: reference || null,
        created_at: new Date().toISOString()
      });

      if (!tx.ok) return { ok: false, error: "Transaction insert failed", details: tx.data };
      return { ok: true };
    }

    async function creditWallet({ email, amount, type, reference }) {
      const amt = safeNum(amount);
      if (!email || !email.includes("@")) return { error: "Valid email required" };
      if (!amt || amt <= 0) return { error: "Valid amount required" };

      const u = await findUserByEmail(email);
      if (!u) return { error: "User not found" };

      const w = await getOrCreateWallet(u.user_id);
      if (w.error) return { error: w.error, details: w.details };

      const current = Number(w.wallet.balance || 0);
      const next = current + amt;

      // Update wallet
      const up = await sbPatch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${u.user_id}`,
        { balance: next, updated_at: new Date().toISOString() }
      );
      if (!up.ok) return { error: "Wallet update failed", details: up.data };

      // Log transaction
      const tx = await logTransaction({
        user_id: u.user_id,
        type: type || "credit",
        amount: amt,
        status: "success",
        reference
      });
      if (!tx.ok) return { error: tx.error, details: tx.details };

      return { ok: true, balance_before: current, balance_after: next };
    }

    async function debitWallet({ email, amount, type, reference }) {
      const amt = safeNum(amount);
      if (!email || !email.includes("@")) return { error: "Valid email required" };
      if (!amt || amt <= 0) return { error: "Valid amount required" };

      const u = await findUserByEmail(email);
      if (!u) return { error: "User not found" };

      const w = await getOrCreateWallet(u.user_id);
      if (w.error) return { error: w.error, details: w.details };

      const current = Number(w.wallet.balance || 0);
      if (current < amt) return { error: "Insufficient balance", balance: current, required: amt };

      const next = current - amt;

      // Update wallet
      const up = await sbPatch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${u.user_id}`,
        { balance: next, updated_at: new Date().toISOString() }
      );
      if (!up.ok) return { error: "Wallet update failed", details: up.data };

      // Log transaction
      const tx = await logTransaction({
        user_id: u.user_id,
        type: type || "debit",
        amount: amt,
        status: "success",
        reference
      });
      if (!tx.ok) return { error: tx.error, details: tx.details };

      return { ok: true, balance_before: current, balance_after: next };
    }

    // ===============================
    // ROUTING
    // ===============================
    // Supported:
    // 1) GET  /api/wallet?email=user@gmail.com
    //    -> returns {ok:true, balance:...}
    //
    // 2) POST /api/wallet  { action:"balance", email }
    // 3) POST /api/wallet  { action:"credit", email, amount, type, reference }
    // 4) POST /api/wallet  { action:"debit",  email, amount, type, reference }
    // ===============================

    if (req.method === "GET") {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required" });

      const out = await getBalanceByEmail(email);
      if (out.error) return json(404, out);

      return json(200, { ok: true, balance: out.balance, user_id: out.user_id });
    }

    // POST
    const body = req.body || {};
    const action = String(body.action || "balance").trim().toLowerCase();

    if (action === "balance") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required" });

      const out = await getBalanceByEmail(email);
      if (out.error) return json(404, out);

      return json(200, { ok: true, balance: out.balance, user_id: out.user_id });
    }

    if (action === "credit") {
      const out = await creditWallet({
        email: String(body.email || "").trim().toLowerCase(),
        amount: body.amount,
        type: body.type || "deposit",
        reference: body.reference || null
      });
      if (out.error) return json(400, out);
      return json(200, out);
    }

    if (action === "debit") {
      const out = await debitWallet({
        email: String(body.email || "").trim().toLowerCase(),
        amount: body.amount,
        type: body.type || "withdrawal",
        reference: body.reference || null
      });
      if (out.error) return json(400, out);
      return json(200, out);
    }

    return json(400, {
      error: "Invalid action",
      allowed: ["balance", "credit", "debit"]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
