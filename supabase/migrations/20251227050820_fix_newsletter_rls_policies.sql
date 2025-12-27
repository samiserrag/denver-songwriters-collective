-- Fix newsletter_subscribers RLS policies
-- The API route needs SELECT (to check existing) and UPDATE (for upsert re-subscription)

-- Allow anyone to check if an email is already subscribed (needed for upsert logic)
CREATE POLICY "Anyone can check subscription status"
ON newsletter_subscribers
FOR SELECT
USING (true);

-- Allow anyone to update subscription (for re-subscribing after unsubscribe)
CREATE POLICY "Anyone can update subscription"
ON newsletter_subscribers
FOR UPDATE
USING (true)
WITH CHECK (true);
