export default async function handler(req, res) {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!PAYSTACK_SECRET_KEY) return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
    if (!SUPABASE_URL) return res.status(500).json({ error: "Missing SUPABASE_URL" });
    if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" });

    const ref =
      (req.method === "GET" ? req.query?.reference : req.body?.reference) ||
      req.query?.ref ||
      req.body?.ref;

    const reference = String(ref || "").trim();
    if (!reference) return res.status(400).json({ error: "Missing reference" });

    // 1) Verify Paystack transaction
    const vRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const vData = await vRes.json();

    if (!vRes.ok || !vData.status) {
      return res.status(400).json({ error: vData?.message || "Verification failed", raw: vData });
    }

    const tx = vData.data;

    if (tx.status !== "success") {
      return res.status(400).json({ error: "Payment not successful", status: tx.status });
    }
    if (tx.currency !== "NGN") {
      return res.status(400).json({ error: "Invalid currency", currency: tx.currency });
    }

    const paidAmount = Number(tx.amount || 0) / 100; // back to naira
    const customerEmail = String(tx.customer?.email || "").toLowerCase();

    if (!customerEmail) return res.status(400).json({ error: "Customer email missing from Paystack" });
    if (!paidAmount || paidAmount < 1000) return res.status(400).json({ error: "Invalid amount from Paystack" });

    // 2) Find user_id from profiles by email
    const profilesUrl =
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(customerEmail)}&limit=1`;

    const pRes = await fetch(profilesUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    const pData = await pRes.json();
    if (!pRes.ok) return res.status(500).json({ error: "Supabase profiles fetch failed", raw: pData });

    const profile = Array.isArray(pData) ? pData[0] : null;
    if (!profile?.id) {
      return res.status(404).json({ error: "User not found in profiles (email mismatch?)", email: customerEmail });
    }

    // 3) Credit wallet using RPC (prevents duplicates)
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/credit_wallet`;

    const cRes = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: profile.id,
        p_amount: paidAmount,
        p_reference: reference,
      }),
    });

    const cData = await cRes.json();
    if (!cRes.ok) return res.status(500).json({ error: "Wallet credit failed", raw: cData });

    return res.status(200).json({
      ok: true,
      email: customerEmail,
      amount: paidAmount,
      reference,
      credit: cData,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
  }
