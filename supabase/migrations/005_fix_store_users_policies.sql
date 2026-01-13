-- VerdurãoPro SaaS - Fix Store Users Policies
-- Permite que super admins criem store_users ao aprovar tenants
-- Permite leitura pública de super_admin_users para verificação de auth

-- Allow public read for super_admin_users (needed for auth check in middleware)
CREATE POLICY "Allow public read for auth"
  ON super_admin_users FOR SELECT
  USING (true);

-- Allow super admins to insert store_users (needed when approving tenants)
CREATE POLICY "Super admins can insert store users"
  ON store_users FOR INSERT
  WITH CHECK (is_super_admin());

-- Allow public read for store_users (needed for auth check in middleware)
CREATE POLICY "Allow public read for store_users auth"
  ON store_users FOR SELECT
  USING (true);
