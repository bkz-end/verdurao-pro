-- Fix RLS policies for sales table
-- Allow store users to insert sales for their tenant

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can insert sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can view sales for their tenant" ON sales;

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert sales for their tenant
CREATE POLICY "Users can insert sales for their tenant" ON sales
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- Policy: Users can view sales for their tenant
CREATE POLICY "Users can view sales for their tenant" ON sales
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Policy: Users can update sales for their tenant
CREATE POLICY "Users can update sales for their tenant" ON sales
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fix sale_items policies
DROP POLICY IF EXISTS "Users can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON sale_items;

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert sale items" ON sale_items
  FOR INSERT
  WITH CHECK (
    sale_id IN (
      SELECT s.id FROM sales s
      JOIN store_users su ON s.tenant_id = su.tenant_id
      WHERE su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can view sale items" ON sale_items
  FOR SELECT
  USING (
    sale_id IN (
      SELECT s.id FROM sales s
      JOIN store_users su ON s.tenant_id = su.tenant_id
      WHERE su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fix cash_register_sessions policies
DROP POLICY IF EXISTS "Users can manage cash sessions" ON cash_register_sessions;

ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage cash sessions" ON cash_register_sessions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM store_users 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fix cash_movements policies
DROP POLICY IF EXISTS "Users can manage cash movements" ON cash_movements;

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage cash movements" ON cash_movements
  FOR ALL
  USING (
    session_id IN (
      SELECT crs.id FROM cash_register_sessions crs
      JOIN store_users su ON crs.tenant_id = su.tenant_id
      WHERE su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
