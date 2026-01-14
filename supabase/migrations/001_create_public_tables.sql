  -- VerdurãoPro SaaS - Public Schema Tables
  -- Requirements: 13.1, 13.2, 13.5

  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Super Admin users table
  CREATE TABLE IF NOT EXISTS super_admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Tenants (stores) table
  CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_email TEXT UNIQUE NOT NULL,
    owner_phone TEXT NOT NULL,
    cnpj TEXT,
    address TEXT,
    subscription_status TEXT DEFAULT 'pending' 
      CHECK (subscription_status IN ('pending', 'active', 'suspended', 'cancelled')),
    trial_ends_at DATE DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
    monthly_price DECIMAL(10,2) DEFAULT 97.90,
    approved_by_admin BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES super_admin_users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Billing charges table
  CREATE TABLE IF NOT EXISTS charges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' 
      CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method TEXT CHECK (payment_method IN ('mercado_pago', 'pix', 'boleto')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
  CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);
  CREATE INDEX IF NOT EXISTS idx_charges_tenant_id ON charges(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
  CREATE INDEX IF NOT EXISTS idx_charges_due_date ON charges(due_date);

  -- Trigger to update updated_at on tenants
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
