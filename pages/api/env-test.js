import { createClient } from '@supabase/supabase-js'

export default function handler(req, res) {
  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log(
    "SERVICE ROLE LOADED:",
    process.env.SUPABASE_SERVICE_ROLE_KEY ? "YES" : "NO"
  )

  res.status(200).json({
    message: "Check Vercel server logs",
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
      }
