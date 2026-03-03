-- Create otp_codes table for OTP storage and dynamic PIN management
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purpose TEXT UNIQUE NOT NULL, -- 'admin_verify', 'pin_reset', 'vault_pin', 'admin_pin', 'admin_granted', 'pin_reset_granted'
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (Edge Functions use service role key)
-- No policies for anon/authenticated — only service_role bypass RLS
-- This ensures no client can read/write OTPs or PINs directly

-- Index for fast lookup by purpose
CREATE INDEX IF NOT EXISTS idx_otp_codes_purpose ON public.otp_codes(purpose);
