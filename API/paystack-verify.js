export default async function handler(req,res){
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const ref = req.query.ref;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${ref}`,{
    headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`}
  });
  const data = await response.json();
  res.status(200).json(data);
}
