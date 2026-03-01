export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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

    // ---------------- Helpers ----------------
    const json = (code, data) => res.status(code).json(data);

    function safeNum(x) {
      const n = Number(x);
      return Number.isFinite(n) ? n : NaN;
    }

    function makeRef(prefix = "DEP") {
      return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
      // profiles first (your current system)
      const profUrl =
        `${SUPABASE_URL}/rest/v1/profiles?select=id,email,referral_code` +
        `&email=eq.${encodeURIComponent(email)}&limit=1`;

      const prof = await sbGet(profUrl);
      if (prof.ok && Array.isArray(prof.data) && prof.data[0]?.id) {
        return { user_id: prof.data[0].id, source: "profiles" };
      }

      // fallback legacy users table if it still exists
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

      if (Array.isArray(w.data) && w.data[0]) return { wallet: w.data[0] };

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

    async function txFindByReference(reference) {
      // requires transactions.reference column
      const url =
        `${SUPABASE_URL}/rest/v1/transactions?select=id,user_id,type,amount,status,reference,provider,meta,created_at` +
        `&reference=eq.${encodeURIComponent(reference)}&limit=1`;
      const r = await sbGet(url);
      if (!r.ok) return { error: "Transaction query failed", details: r.data };
      const row = Array.isArray(r.data) ? r.data[0] : null;
      return { tx: row || null };
    }

    async function txInsert({ user_id, type, amount, status, reference, provider, meta }) {
      const r = await sbPost(`${SUPABASE_URL}/rest/v1/transactions`, {
        user_id,
        type,
        amount,
        status: status || "pending",
        reference: reference || null,
        provider: provider || null,
        meta: meta || null,
        created_at: new Date().toISOString()
      });
      if (!r.ok) return { error: "Transaction insert failed", details: r.data };
      return { ok: true };
    }

    async function txUpdateByReference(reference, patch) {
      const url = `${SUPABASE_URL}/rest/v1/transactions?reference=eq.${encodeURIComponent(reference)}`;
      const r = await sbPatch(url, patch);
      if (!r.ok) return { error: "Transaction update failed", details: r.data };
      return { ok: true };
    }

    async function creditWalletByUserId({ user_id, amount }) {
      const amt = safeNum(amount);
      if (!amt || amt <= 0) return { error: "Valid amount required" };

      const w = await getOrCreateWallet(user_id);
      if (w.error) return { error: w.error, details: w.details };

      const current = Number(w.wallet.balance || 0);
      const next = current + amt;

      const up = await sbPatch(
        `${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}`,
        { balance: next, updated_at: new Date().toISOString() }
      );
      if (!up.ok) return { error: "Wallet update failed", details: up.data };

      return { ok: true, balance_before: current, balance_after: next };
    }

    // ---------------- Paystack helpers ----------------
    async function paystackInit({ email, amount, reference, callback_url }) {
      if (!PAYSTACK_SECRET_KEY) return { error: "Missing PAYSTACK_SECRET_KEY" };

      const r = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(amount) * 100), // kobo
          reference,
          callback_url
        })
      });

      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.status) {
        return { error: "Paystack init failed", details: d };
      }

      return { ok: true, authorization_url: d.data.authorization_url, access_code: d.data.access_code };
    }

    async function paystackVerify(reference) {
      if (!PAYSTACK_SECRET_KEY) return { error: "Missing PAYSTACK_SECRET_KEY" };

      const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      });

      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.status) {
        return { error: "Paystack verify failed", details: d };
      }

      return { ok: true, data: d.data };
    }

    // ==========================================================
    // ROUTES
    // ==========================================================
    // GET  /api/wallet?email=
    // POST /api/wallet { action: "balance", email }
    // POST /api/wallet { action: "paystack_init_deposit", email, amount, return_url }
    // POST /api/wallet { action: "paystack_verify_deposit", reference }
    // ==========================================================

    if (req.method === "GET") {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required" });

      const out = await getBalanceByEmail(email);
      if (out.error) return json(404, out);

      return json(200, { ok: true, balance: out.balance, user_id: out.user_id });
    }

    const body = req.body || {};
    const action = String(body.action || "balance").trim().toLowerCase();

    if (action === "balance") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required" });

      const out = await getBalanceByEmail(email);
      if (out.error) return json(404, out);

      return json(200, { ok: true, balance: out.balance, user_id: out.user_id });
    }

    // ---------------- Paystack redirect: INIT ----------------
    if (action === "paystack_init_deposit") {
      const email = String(body.email || "").trim().toLowerCase();
      const amount = safeNum(body.amount);
      const return_url = String(body.return_url || "").trim();

      if (!email) return json(400, { error: "email is required" });
      if (!amount || amount < 1000) return json(400, { error: "Minimum deposit is ₦1,000" });
      if (!return_url) return json(400, { error: "return_url is required" });

      const u = await findUserByEmail(email);
      if (!u) return json(404, { error: "User not found" });

      // Ensure wallet exists
      const w = await getOrCreateWallet(u.user_id);
      if (w.error) return json(500, { error: w.error, details: w.details });

      // Create reference and pending tx
      const reference = makeRef("DEP");

      // IMPORTANT: this requires transactions.reference column
      const ins = await txInsert({
        user_id: u.user_id,
        type: "deposit",
        amount,
        status: "pending",
        reference,
        provider: "paystack",
        meta: { stage: "initialized" }
      });

      if (ins.error) return json(500, ins);

      // Paystack callback url – ensure reference comes back
      const callback_url = `${return_url}${return_url.includes("?") ? "&" : "?"}reference=${encodeURIComponent(reference)}`;

      const ps = await paystackInit({ email, amount, reference, callback_url });
      if (ps.error) {
        // mark tx failed
        await txUpdateByReference(reference, { status: "failed", meta: { stage: "init_failed", ps: ps.details || null } });
        return json(500, ps);
      }

      await txUpdateByReference(reference, {
        meta: { stage: "init_ok", callback_url, authorization_url: ps.authorization_url }
      });

      return json(200, {
        ok: true,
        reference,
        authorization_url: ps.authorization_url
      });
    }

    // ---------------- Paystack redirect: VERIFY ----------------
    if (action === "paystack_verify_deposit") {
      const reference = String(body.reference || "").trim();
      if (!reference) return json(400, { error: "reference is required" });

      // Find tx
      const found = await txFindByReference(reference);
      if (found.error) return json(500, found);
      if (!found.tx) return json(404, { error: "Transaction not found" });

      // If already success -> return wallet balance
      if (String(found.tx.status || "").toLowerCase() === "success") {
        // Get wallet
        const w = await getOrCreateWallet(found.tx.user_id);
        if (w.error) return json(500, { error: w.error, details: w.details });

        return json(200, {
          ok: true,
          status: "success",
          message: "Already verified",
          balance: Number(w.wallet.balance || 0)
        });
      }

      // Verify with Paystack
      const vr = await paystackVerify(reference);
      if (vr.error) {
        await txUpdateByReference(reference, { status: "failed", meta: { stage: "verify_failed", ps: vr.details || null } });
        return json(500, vr);
      }

      const data = vr.data;
      const payStatus = String(data.status || "").toLowerCase();
      const paidAmount = Number(data.amount || 0) / 100; // naira

      // Must be successful
      if (payStatus !== "success") {
        await txUpdateByReference(reference, { status: "failed", meta: { stage: "not_success", ps: data } });
        return json(400, { error: "Payment not successful", paystack_status: payStatus });
      }

      // Amount check (basic)
      const expected = Number(found.tx.amount || 0);
      if (paidAmount + 0.0001 < expected) {
        await txUpdateByReference(reference, { status: "failed", meta: { stage: "amount_mismatch", expected, paidAmount, ps: data } });
        return json(400, { error: "Amount mismatch", expected, paidAmount });
      }

      // Credit wallet once
      const cred = await creditWalletByUserId({ user_id: found.tx.user_id, amount: expected });
      if (cred.error) return json(500, cred);

      await txUpdateByReference(reference, {
        status: "success",
        meta: { stage: "credited", ps: data, credited_amount: expected, balance_after: cred.balance_after }
      });

      return json(200, {
        ok: true,
        status: "success",
        credited: expected,
        balance: cred.balance_after
      });
    }

    return json(400, {
      error: "Invalid action",
      allowed: ["balance", "paystack_init_deposit", "paystack_verify_deposit"]
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
      }
