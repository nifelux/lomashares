export default async function handler(req,res){
  const sk_live_e2b31fe28d46c220f6059404e44dd875feb854d3 = process.env.sk_live_e2b31fe28d46c220f6059404e44dd875feb854d3;
  const body = req.body; // {email, amount, reason}
  const response = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers:{Authorization:`Bearer ${sk_live_e2b31fe28d46c220f6059404e44dd875feb854d3}`, 'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await response.json();
  res.status(200).json(data);
}
