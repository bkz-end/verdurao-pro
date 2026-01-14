-- Fix store_users INSERT policy
-- Super admins need to be able to insert store_users for any tenant when approving

-- Drop existing insert policy
DROP POLICY IF EXISTS "store_users_insert" ON store_users;

-- Create new insert policy that allows:
-- 1. Super admins to insert for any tenant
-- 2. Users to insert for their own tenant
CREATE POLICY "store_users_insert" ON store_users
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR
    tenant_id = get_user_tenant_id()
  );

-- Also need to allow tenants to be inserted by anyone (for registration)
-- and allow super admins to update any tenant

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
DROP POLICY IF EXISTS "tenants_all" ON tenants;

-- Anyone can insert a tenant (for registration)
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT
  WITH CHECK (true);

-- Super admins can do anything with tenants
-- Regular users can only see/update their own tenant
DROP POLICY IF EXISTS "tenants_select" ON tenants;
DROP POLICY IF EXISTS "tenants_update" ON tenants;

CREATE POLICY "tenants_select" ON tenants
  FOR SELECT
  USING (
    is_super_admin()
    OR
    id = get_user_tenant_id()
    OR
    owner_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE
  USING (
    is_super_admin()
    OR
    id = get_user_tenant_id()
  );
