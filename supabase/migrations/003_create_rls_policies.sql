-- VerdurãoPro SaaS - Row Level Security Policies
-- Requirements: 13.2, 13.5

-- Enable RLS on all tables
ALTER TABLE super_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id 
    FROM store_users 
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM super_admin_users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if tenant is active
CREATE OR REPLACE FUNCTION is_tenant_active(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenants 
    WHERE id = p_tenant_id 
    AND subscription_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- SUPER ADMIN USERS POLICIES
-- =====================

-- Super admins can view all super admin users
CREATE POLICY "Super admins can view super admin users"
  ON super_admin_users FOR SELECT
  USING (is_super_admin());

-- =====================
-- TENANTS POLICIES
-- =====================

-- Super admins can view all tenants
CREATE POLICY "Super admins can view all tenants"
  ON tenants FOR SELECT
  USING (is_super_admin());

-- Super admins can update tenants
CREATE POLICY "Super admins can update tenants"
  ON tenants FOR UPDATE
  USING (is_super_admin());

-- Anyone can insert a tenant (registration)
CREATE POLICY "Anyone can register a tenant"
  ON tenants FOR INSERT
  WITH CHECK (true);

-- Store users can view their own tenant
CREATE POLICY "Store users can view their tenant"
  ON tenants FOR SELECT
  USING (id = get_user_tenant_id());

-- =====================
-- CHARGES POLICIES
-- =====================

-- Super admins can manage all charges
CREATE POLICY "Super admins can view all charges"
  ON charges FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admins can insert charges"
  ON charges FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update charges"
  ON charges FOR UPDATE
  USING (is_super_admin());

-- Store owners can view their charges
CREATE POLICY "Store users can view their charges"
  ON charges FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- =====================
-- STORE USERS POLICIES
-- =====================

-- Super admins can view all store users
CREATE POLICY "Super admins can view all store users"
  ON store_users FOR SELECT
  USING (is_super_admin());

-- Store users can view users from their tenant
CREATE POLICY "Store users can view their tenant users"
  ON store_users FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Store owners/managers can manage users in their tenant
CREATE POLICY "Store owners can insert users"
  ON store_users FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id() 
    AND EXISTS (
      SELECT 1 FROM store_users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Store owners can update users"
  ON store_users FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() 
    AND EXISTS (
      SELECT 1 FROM store_users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- =====================
-- PRODUCTS POLICIES
-- =====================

-- Store users can view products from their tenant
CREATE POLICY "Store users can view their products"
  ON products FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Store owners/managers can manage products
CREATE POLICY "Store owners can insert products"
  ON products FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND is_tenant_active(tenant_id)
  );

CREATE POLICY "Store owners can update products"
  ON products FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id()
    AND is_tenant_active(tenant_id)
  );

CREATE POLICY "Store owners can delete products"
  ON products FOR DELETE
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM store_users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'manager')
    )
  );

-- =====================
-- SALES POLICIES
-- =====================

-- Store users can view sales from their tenant
CREATE POLICY "Store users can view their sales"
  ON sales FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Store users can insert sales (when tenant is active)
CREATE POLICY "Store users can insert sales"
  ON sales FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND is_tenant_active(tenant_id)
  );

-- Super admins can view all sales (for reports)
CREATE POLICY "Super admins can view all sales"
  ON sales FOR SELECT
  USING (is_super_admin());

-- =====================
-- SALE ITEMS POLICIES
-- =====================

-- Store users can view sale items from their tenant's sales
CREATE POLICY "Store users can view their sale items"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.tenant_id = get_user_tenant_id()
    )
  );

-- Store users can insert sale items
CREATE POLICY "Store users can insert sale items"
  ON sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.tenant_id = get_user_tenant_id()
    )
  );

-- =====================
-- LOSSES POLICIES
-- =====================

-- Store users can view losses from their tenant
CREATE POLICY "Store users can view their losses"
  ON losses FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Store users can insert losses
CREATE POLICY "Store users can insert losses"
  ON losses FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND is_tenant_active(tenant_id)
  );

-- =====================
-- STOCK HISTORY POLICIES
-- =====================

-- Store users can view stock history for their products
CREATE POLICY "Store users can view their stock history"
  ON stock_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = stock_history.product_id 
      AND products.tenant_id = get_user_tenant_id()
    )
  );

-- Store users can insert stock history
CREATE POLICY "Store users can insert stock history"
  ON stock_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = stock_history.product_id 
      AND products.tenant_id = get_user_tenant_id()
    )
  );
