-- Final fix for infinite recursion in RLS policies
-- The issue: get_user_tenant_id() queries store_users which has RLS, causing recursion

-- Drop existing functions
DROP FUNCTION IF EXISTS get_user_tenant_id();
DROP FUNCTION IF EXISTS is_super_admin();

-- Create function to get tenant_id WITHOUT triggering RLS
-- Using SET search_path and accessing table directly
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_email TEXT;
BEGIN
  -- Get current user's email
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Query store_users directly (SECURITY DEFINER bypasses RLS)
  SELECT tenant_id INTO v_tenant_id 
  FROM store_users 
  WHERE email = v_email
  LIMIT 1;
  
  RETURN v_tenant_id;
END;
$$;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Get current user's email
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is in super_admin_users table
  SELECT EXISTS (
    SELECT 1 FROM super_admin_users WHERE email = v_email
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
