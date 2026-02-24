export default function handler(req, res) {
  res.status(200).json({
    message: "API working",
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}
