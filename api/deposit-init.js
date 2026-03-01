export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ error: "Missing PAYSTACK_SECRET_KEY" });
    }

    const { email, amount } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanAmount = Number(amount);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (!cleanAmount || cleanAmount < 1000) {
      return res.status(400).json({ error: "Minimum deposit is ₦1,000" });
    }

    // Build callback URL from current origin (works on Vercel domain)
    const origin =
      (req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] : "https") +
      "://" +
      req.headers.host;

    const callback_url = `${origin}/deposit-success.html`;

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: cleanEmail,
        amount: Math.round(cleanAmount * 100), // kobo
        currency: "NGN",
        callback_url,
        metadata: {
          email: cleanEmail,
          purpose: "LomaShares Wallet Funding",
        },
      }),
    });

    const initData = await initRes.json();

    if (!initRes.ok || !initData.status) {
      return res.status(400).json({
        error: initData?.message || "Paystack initialization failed",
        raw: initData,
      });
    }

    return res.status(200).json({
      authorization_url: initData.data.authorization_url,
      reference: initData.data.reference,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
      }
