-- ==========================================
-- QUICKFIX DATABASE SETUP
-- Run these SQL commands in Supabase SQL Editor
-- ==========================================

-- ==========================================
-- RATINGS & REVIEWS TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Update providers table to add rating fields
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS total_rating_sum INTEGER DEFAULT 0;

-- ==========================================
-- MESSAGING TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  related_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- PAYMENT & TRANSACTION TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) DEFAULT 15,
  commission_amount DECIMAL(10,2),
  provider_earnings DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  stripe_payment_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  stripe_payout_id VARCHAR(255),
  requested_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- GEOLOCATION & AVAILABILITY
-- ==========================================

ALTER TABLE providers ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 10;

CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- DISPUTES & SUPPORT
-- ==========================================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open',
  resolution TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_request_id ON transactions(request_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_location ON providers(latitude, longitude);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Reviews RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view reviews for providers they rated"
  ON reviews FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = provider_id);

CREATE POLICY "Customers can create reviews on their own requests"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Notifications RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = (SELECT user_id FROM providers WHERE id = provider_id));

CREATE POLICY "Transactions are created by system only"
  ON transactions FOR INSERT
  WITH CHECK (FALSE);

-- Provider Payouts RLS
ALTER TABLE provider_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view their own payouts"
  ON provider_payouts FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM providers WHERE id = provider_id));

-- Disputes RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disputes they reported"
  ON disputes FOR SELECT
  USING (auth.uid() = reported_by);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to update provider rating
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE providers
  SET 
    total_rating_sum = total_rating_sum + NEW.rating,
    review_count = review_count + 1,
    rating = (total_rating_sum + NEW.rating)::DECIMAL / (review_count + 1)
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_provider_rating();

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_request_id UUID
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, related_request_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_request_id);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate commission
CREATE OR REPLACE FUNCTION calculate_commission(
  p_amount DECIMAL,
  p_commission_percentage DECIMAL
)
RETURNS TABLE(commission DECIMAL, provider_earnings DECIMAL) AS $$
BEGIN
  RETURN QUERY SELECT
    (p_amount * p_commission_percentage / 100)::DECIMAL as commission,
    (p_amount * (100 - p_commission_percentage) / 100)::DECIMAL as provider_earnings;
END;
$$ LANGUAGE plpgsql;
