-- FeiraPro - Cash Register (Caixa) System
-- Sistema de abertura e fechamento de caixa

-- Cash register sessions table
CREATE TABLE IF NOT EXISTS cash_register_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES store_users(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- Valor inicial do caixa
  expected_amount DECIMAL(10,2), -- Valor esperado no fechamento
  actual_amount DECIMAL(10,2), -- Valor real contado
  difference DECIMAL(10,2), -- Diferença (sobra/falta)
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- Cash movements (sangrias, suprimentos)
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES store_users(id),
  type TEXT NOT NULL CHECK (type IN ('withdrawal', 'deposit')), -- sangria ou suprimento
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add payment_method to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('dinheiro', 'pix', 'cartao', 'fiado'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES cash_register_sessions(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant ON cash_register_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_register_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user ON cash_register_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
