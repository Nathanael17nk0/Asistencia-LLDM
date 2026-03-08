-- =====================================================
-- Migration: Push Subscriptions Table
-- Run this in the Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_phone text NOT NULL,          -- links to nexus_users.phone
    subscription jsonb NOT NULL,        -- PushSubscription JSON (endpoint + keys)
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_phone)                  -- one subscription per user (replace on re-subscribe)
);

-- Allow the Edge Function (service_role) to read/write it
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage subscriptions"
ON push_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
