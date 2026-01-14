-- Fix ALL RLS policies for the application
-- Run this in Supabase SQL Editor

-- ============================================
-- STORE USERS
-- ============================================
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own store_user" ON store_users;
DROP POLICY IF EXISTS "Users can view store users in their tenant" ON store_users;

CREATE POLICY "Users can view store users in their tenant" ON store_users
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- PRODUCTS
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage products in their tenant" ON products;

CREATE POLICY "Users can manage products in their tenant" ON products
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- SALES
-- ============================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can view sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can update sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can manage sales in their tenant" ON sales;

CREATE POLICY "Users can manage sales in their tenant" ON sales
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- SALE ITEMS
-- ============================================
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can manage sale items" ON sale_items;

CREATE POLICY "Users can manage sale items" ON sale_items
  FOR ALL
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      WHERE s.tenant_id IN (
        SELECT tenant_id FROM store_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- ============================================
-- LOSSES
-- ============================================
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage losses in their tenant" ON losses;

CREATE POLICY "Users can manage losses in their tenant" ON losses
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- STOCK HISTORY
-- ============================================
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage stock history" ON stock_history;

CREATE POLICY "Users can manage stock history" ON stock_history
  FOR ALL
  USING (
    product_id IN (
      SELECT p.id FROM products p
      WHERE p.tenant_id IN (
        SELECT tenant_id FROM store_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- ============================================
-- CASH REGISTER SESSIONS
-- ============================================
ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage cash sessions" ON cash_register_sessions;

CREATE POLICY "Users can manage cash sessions" ON cash_register_sessions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ============================================
-- CASH MOVEMENTS
-- ============================================
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage cash movements" ON cash_movements;

CREATE POLICY "Users can manage cash movements" ON cash_movements
  FOR ALL
  USING (
    session_id IN (
      SELECT crs.id FROM cash_register_sessions crs
      WHERE crs.tenant_id IN (
        SELECT tenant_id FROM store_users 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- ============================================
-- TENANTS (users can view their own tenant)
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their tenant" ON tenants;

CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Owners can update their tenant" ON tenants
  FOR UPDATE
  USING (
    id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND role = 'owner'
    )
  );
