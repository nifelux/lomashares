export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const APP_BASE_URL = process.env.APP_BASE_URL; // e.g. https://lomashares.vercel.app

  try {
    const { amount, email } = req.body || {};

    const amt = Number(amount);
    if (!email || !amt) return res.status(400).json({ error: "Missing amount or email" });
    if (amt < 1000) return res.status(400).json({ error: "Minimum deposit is ₦1,000" });

    const callback_url = `${APP_BASE_URL}/deposit-success.html`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amt * 100), // kobo
        currency: "NGN",
        callback_url,
        metadata: {
          purpose: "LomaShares Deposit",
          userEmail: email,
          depositAmount: amt
        }
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(400).json({ error: data.message || "Paystack init failed", raw: data });
    }

    return res.status(200).json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
      }
