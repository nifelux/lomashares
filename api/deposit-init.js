export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  try {
    const { amount, email } = req.body || {};
    if (!amount || !email) return res.status(400).json({ error: "Missing amount or email" });

    const amt = Number(amount);
    if (!amt || amt < 1000) return res.status(400).json({ error: "Minimum deposit is 1000" });

    // Redirect back to your site after payment
    const callback_url = `${process.env.APP_BASE_URL}/deposit-success.html`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amt * 100, // kobo
        currency: "NGN",
        callback_url,
        metadata: {
          depositAmount: amt,
          userEmail: email
        }
      }),
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(400).json({ error: data.message || "Paystack init failed", raw: data });
    }

    return res.status(200).json({ authorization_url: data.data.authorization_url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
      }
