-- Add super admin user
-- This migration adds ph78815@gmail.com as a super admin

INSERT INTO super_admin_users (email, name) 
VALUES ('ph78815@gmail.com', 'Paulo Admin')
ON CONFLICT (email) DO NOTHING;