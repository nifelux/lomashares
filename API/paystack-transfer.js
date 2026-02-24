export default async function handler(req,res){
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const body = req.body; // {email, amount, reason}
  const response = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await response.json();
  res.status(200).json(data);
}
