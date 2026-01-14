-- Fix RLS policies to avoid recursion and permission errors
-- Uses SECURITY DEFINER functions to bypass RLS when checking permissions

-- ============================================
-- DROP ALL EXISTING POLICIES FIRST
-- ============================================
DROP POLICY IF EXISTS "Users can view store users in their tenant" ON store_users;
DROP POLICY IF EXISTS "Owners can insert store users" ON store_users;
DROP POLICY IF EXISTS "Owners can update store users" ON store_users;
DROP POLICY IF EXISTS "Users can manage products in their tenant" ON products;
DROP POLICY IF EXISTS "Users can manage sales in their tenant" ON sales;
DROP POLICY IF EXISTS "Users can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can manage losses in their tenant" ON losses;
DROP POLICY IF EXISTS "Users can manage stock history" ON stock_history;
DROP POLICY IF EXISTS "Users can manage cash sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "Users can manage cash movements" ON cash_movements;
DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Super admins can manage charges" ON charges;
DROP POLICY IF EXISTS "Users can view their charges" ON charges;

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS)
-- ============================================
DROP FUNCTION IF EXISTS get_current_user_email() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;

-- Get current user email from JWT
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := current_setting('request.jwt.claims', true)::json->>'email';
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  END IF;
  RETURN LOWER(v_email);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Get tenant_id for current user (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM store_users
  WHERE LOWER(email) = get_current_user_email()
  LIMIT 1;
  RETURN v_tenant_id;
END;
$$;

-- Check if current user is super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE LOWER(email) = get_current_user_email()
  );
END;
$$;

-- Get user role in tenant
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM store_users
  WHERE LOWER(email) = get_current_user_email()
  LIMIT 1;
  RETURN v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated, anon;

-- ============================================
-- STORE USERS - Simple policies using functions
-- ============================================
CREATE POLICY "store_users_select" ON store_users
  FOR SELECT USING (
    LOWER(email) = get_current_user_email()
    OR tenant_id = get_user_tenant_id()
    OR is_super_admin()
  );

CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id() AND get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id() AND get_user_role() IN ('owner', 'manager')
  );

-- ============================================
-- PRODUCTS
-- ============================================
CREATE POLICY "products_all" ON products
  FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- SALES
-- ============================================
CREATE POLICY "sales_all" ON sales
  FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- SALE ITEMS
-- ============================================
CREATE POLICY "sale_items_all" ON sale_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_id AND (s.tenant_id = get_user_tenant_id() OR is_super_admin()))
  );

-- ============================================
-- LOSSES
-- ============================================
CREATE POLICY "losses_all" ON losses
  FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- STOCK HISTORY
-- ============================================
CREATE POLICY "stock_history_all" ON stock_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND (p.tenant_id = get_user_tenant_id() OR is_super_admin()))
  );

-- ============================================
-- CASH REGISTER SESSIONS
-- ============================================
CREATE POLICY "cash_sessions_all" ON cash_register_sessions
  FOR ALL USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- CASH MOVEMENTS
-- ============================================
CREATE POLICY "cash_movements_all" ON cash_movements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cash_register_sessions crs WHERE crs.id = session_id AND (crs.tenant_id = get_user_tenant_id() OR is_super_admin()))
  );

-- ============================================
-- TENANTS
-- ============================================
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = get_user_tenant_id() OR is_super_admin());

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    (id = get_user_tenant_id() AND get_user_role() = 'owner') OR is_super_admin()
  );

-- ============================================
-- CHARGES
-- ============================================
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "charges_admin" ON charges
  FOR ALL USING (is_super_admin());

CREATE POLICY "charges_user_select" ON charges
  FOR SELECT USING (tenant_id = get_user_tenant_id());
