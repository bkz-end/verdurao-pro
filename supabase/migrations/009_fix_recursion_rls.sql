-- Fix infinite recursion in RLS policies
-- The issue is that store_users policy references itself

-- First, create a security definer function to get tenant_id without RLS
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id 
  FROM store_users 
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
$$;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admin_users 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- ============================================
-- DROP ALL EXISTING POLICIES FIRST
-- ============================================

-- Store users
DROP POLICY IF EXISTS "Users can view their own store_user" ON store_users;
DROP POLICY IF EXISTS "Users can view store users in their tenant" ON store_users;
DROP POLICY IF EXISTS "store_users_select" ON store_users;
DROP POLICY IF EXISTS "store_users_all" ON store_users;

-- Products
DROP POLICY IF EXISTS "Users can manage products in their tenant" ON products;
DROP POLICY IF EXISTS "products_all" ON products;

-- Sales
DROP POLICY IF EXISTS "Users can insert sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can view sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can update sales for their tenant" ON sales;
DROP POLICY IF EXISTS "Users can manage sales in their tenant" ON sales;
DROP POLICY IF EXISTS "sales_all" ON sales;

-- Sale items
DROP POLICY IF EXISTS "Users can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "sale_items_all" ON sale_items;

-- Losses
DROP POLICY IF EXISTS "Users can manage losses in their tenant" ON losses;
DROP POLICY IF EXISTS "losses_all" ON losses;

-- Stock history
DROP POLICY IF EXISTS "Users can manage stock history" ON stock_history;
DROP POLICY IF EXISTS "stock_history_all" ON stock_history;

-- Cash register
DROP POLICY IF EXISTS "Users can manage cash sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "cash_sessions_all" ON cash_register_sessions;

-- Cash movements
DROP POLICY IF EXISTS "Users can manage cash movements" ON cash_movements;
DROP POLICY IF EXISTS "cash_movements_all" ON cash_movements;

-- Tenants
DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Owners can update their tenant" ON tenants;
DROP POLICY IF EXISTS "tenants_select" ON tenants;
DROP POLICY IF EXISTS "tenants_update" ON tenants;
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Super admins can update all tenants" ON tenants;

-- ============================================
-- STORE USERS - Special handling to avoid recursion
-- ============================================
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own record (by email match)
CREATE POLICY "store_users_select" ON store_users
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    tenant_id = get_user_tenant_id()
    OR
    is_super_admin()
  );

-- Users can insert into their tenant
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    OR
    is_super_admin()
  );

-- Users can update in their tenant
CREATE POLICY "store_users_update" ON store_users
  FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    OR
    is_super_admin()
  );

-- ============================================
-- TENANTS
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select" ON tenants
  FOR SELECT
  USING (
    id = get_user_tenant_id()
    OR
    is_super_admin()
  );

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE
  USING (
    id = get_user_tenant_id()
    OR
    is_super_admin()
  );

-- ============================================
-- PRODUCTS
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_all" ON products
  FOR ALL
  USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- SALES
-- ============================================
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_all" ON sales
  FOR ALL
  USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- SALE ITEMS
-- ============================================
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_all" ON sale_items
  FOR ALL
  USING (
    sale_id IN (SELECT id FROM sales WHERE tenant_id = get_user_tenant_id())
    OR is_super_admin()
  );

-- ============================================
-- LOSSES
-- ============================================
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "losses_all" ON losses
  FOR ALL
  USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- STOCK HISTORY
-- ============================================
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_history_all" ON stock_history
  FOR ALL
  USING (
    product_id IN (SELECT id FROM products WHERE tenant_id = get_user_tenant_id())
    OR is_super_admin()
  );

-- ============================================
-- CASH REGISTER SESSIONS
-- ============================================
ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_all" ON cash_register_sessions
  FOR ALL
  USING (tenant_id = get_user_tenant_id() OR is_super_admin());

-- ============================================
-- CASH MOVEMENTS
-- ============================================
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_movements_all" ON cash_movements
  FOR ALL
  USING (
    session_id IN (SELECT id FROM cash_register_sessions WHERE tenant_id = get_user_tenant_id())
    OR is_super_admin()
  );

-- ============================================
-- SUPER ADMIN USERS (only super admins can see)
-- ============================================
ALTER TABLE super_admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_select" ON super_admin_users;

CREATE POLICY "super_admins_select" ON super_admin_users
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR is_super_admin()
  );
