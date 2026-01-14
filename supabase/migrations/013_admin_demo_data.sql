-- Create demo data for admin account (ph78815@gmail.com)
-- This gives the admin a full store experience while keeping super admin powers

DO $$
DECLARE
  v_admin_email TEXT := 'ph78815@gmail.com';
  v_tenant_id UUID;
  v_user_id UUID;
  v_product_ids UUID[];
  v_session_id UUID;
  v_sale_id UUID;
BEGIN
  -- Check if admin already has a tenant
  SELECT su.tenant_id INTO v_tenant_id
  FROM store_users su
  WHERE LOWER(su.email) = LOWER(v_admin_email)
  LIMIT 1;

  -- If admin doesn't have a tenant, create one
  IF v_tenant_id IS NULL THEN
    -- Create demo tenant for admin
    INSERT INTO tenants (
      store_name,
      owner_name,
      owner_email,
      owner_phone,
      cnpj,
      address,
      subscription_status,
      trial_ends_at,
      approved_by_admin
    ) VALUES (
      'Verdurão do Paulo (Demo)',
      'Paulo Admin',
      v_admin_email,
      '(11) 99999-9999',
      '12.345.678/0001-90',
      'Rua das Frutas, 123 - Centro',
      'active',
      NOW() + INTERVAL '365 days',
      TRUE
    )
    RETURNING id INTO v_tenant_id;

    -- Create store user for admin
    INSERT INTO store_users (tenant_id, email, name, role)
    VALUES (v_tenant_id, v_admin_email, 'Paulo Admin', 'owner')
    RETURNING id INTO v_user_id;
  ELSE
    -- Get existing user_id
    SELECT id INTO v_user_id
    FROM store_users
    WHERE tenant_id = v_tenant_id AND LOWER(email) = LOWER(v_admin_email)
    LIMIT 1;
    
    -- Update tenant to active
    UPDATE tenants
    SET subscription_status = 'active',
        trial_ends_at = NOW() + INTERVAL '365 days',
        approved_by_admin = TRUE
    WHERE id = v_tenant_id;
  END IF;

  -- Delete existing demo products to avoid duplicates
  DELETE FROM products WHERE tenant_id = v_tenant_id;

  -- Insert demo products (typical verdurão items)
  INSERT INTO products (tenant_id, sku, name, price, cost_price, unit, stock, category, default_quantity)
  VALUES
    -- Frutas
    (v_tenant_id, 'FRU001', 'Banana Prata', 5.99, 3.50, 'kg', 45.5, 'Frutas', 1),
    (v_tenant_id, 'FRU002', 'Maçã Fuji', 8.99, 5.00, 'kg', 32.0, 'Frutas', 1),
    (v_tenant_id, 'FRU003', 'Laranja Pera', 4.99, 2.80, 'kg', 58.0, 'Frutas', 1),
    (v_tenant_id, 'FRU004', 'Mamão Papaya', 7.99, 4.50, 'kg', 18.5, 'Frutas', 1),
    (v_tenant_id, 'FRU005', 'Melancia', 2.99, 1.50, 'kg', 85.0, 'Frutas', 1),
    (v_tenant_id, 'FRU006', 'Abacaxi', 6.99, 4.00, 'un', 24, 'Frutas', 1),
    (v_tenant_id, 'FRU007', 'Manga Palmer', 5.49, 3.00, 'kg', 28.0, 'Frutas', 1),
    (v_tenant_id, 'FRU008', 'Uva Itália', 12.99, 8.00, 'kg', 15.0, 'Frutas', 0.5),
    -- Verduras
    (v_tenant_id, 'VER001', 'Alface Crespa', 2.99, 1.50, 'un', 35, 'Verduras', 1),
    (v_tenant_id, 'VER002', 'Couve Manteiga', 3.49, 2.00, 'un', 28, 'Verduras', 1),
    (v_tenant_id, 'VER003', 'Rúcula', 4.99, 3.00, 'un', 22, 'Verduras', 1),
    (v_tenant_id, 'VER004', 'Espinafre', 5.99, 3.50, 'un', 18, 'Verduras', 1),
    (v_tenant_id, 'VER005', 'Agrião', 4.49, 2.50, 'un', 20, 'Verduras', 1),
    (v_tenant_id, 'VER006', 'Brócolis', 8.99, 5.50, 'kg', 12.5, 'Verduras', 0.5),
    -- Legumes
    (v_tenant_id, 'LEG001', 'Tomate Italiano', 6.99, 4.00, 'kg', 42.0, 'Legumes', 1),
    (v_tenant_id, 'LEG002', 'Cebola', 4.99, 2.80, 'kg', 55.0, 'Legumes', 1),
    (v_tenant_id, 'LEG003', 'Batata', 5.49, 3.20, 'kg', 68.0, 'Legumes', 1),
    (v_tenant_id, 'LEG004', 'Cenoura', 4.49, 2.50, 'kg', 38.0, 'Legumes', 1),
    (v_tenant_id, 'LEG005', 'Beterraba', 5.99, 3.50, 'kg', 25.0, 'Legumes', 1),
    (v_tenant_id, 'LEG006', 'Abobrinha', 6.49, 3.80, 'kg', 22.0, 'Legumes', 1),
    (v_tenant_id, 'LEG007', 'Pepino', 5.99, 3.20, 'kg', 30.0, 'Legumes', 1),
    (v_tenant_id, 'LEG008', 'Pimentão Verde', 7.99, 4.50, 'kg', 18.0, 'Legumes', 1),
    (v_tenant_id, 'LEG009', 'Pimentão Vermelho', 12.99, 8.00, 'kg', 12.0, 'Legumes', 1),
    (v_tenant_id, 'LEG010', 'Alho', 39.99, 25.00, 'kg', 8.5, 'Legumes', 0.1),
    -- Temperos
    (v_tenant_id, 'TEM001', 'Cheiro Verde', 2.99, 1.50, 'un', 40, 'Temperos', 1),
    (v_tenant_id, 'TEM002', 'Salsinha', 2.49, 1.20, 'un', 35, 'Temperos', 1),
    (v_tenant_id, 'TEM003', 'Cebolinha', 2.49, 1.20, 'un', 32, 'Temperos', 1),
    (v_tenant_id, 'TEM004', 'Hortelã', 3.99, 2.00, 'un', 25, 'Temperos', 1),
    (v_tenant_id, 'TEM005', 'Manjericão', 4.99, 2.80, 'un', 20, 'Temperos', 1),
    -- Ovos e outros
    (v_tenant_id, 'OUT001', 'Ovos Caipira (dz)', 15.99, 10.00, 'un', 45, 'Outros', 1),
    (v_tenant_id, 'OUT002', 'Ovos Brancos (dz)', 12.99, 8.00, 'un', 60, 'Outros', 1)
  RETURNING id INTO v_product_ids;

  -- Get product IDs for sales
  SELECT ARRAY_AGG(id) INTO v_product_ids FROM products WHERE tenant_id = v_tenant_id;

  -- Create some demo sales (last 7 days)
  FOR i IN 0..6 LOOP
    -- 3-5 sales per day
    FOR j IN 1..FLOOR(RANDOM() * 3 + 3)::INT LOOP
      INSERT INTO sales (tenant_id, user_id, total, payment_method, created_at)
      VALUES (
        v_tenant_id,
        v_user_id,
        ROUND((RANDOM() * 150 + 20)::NUMERIC, 2),
        (ARRAY['dinheiro', 'pix', 'cartao', 'dinheiro', 'pix'])[FLOOR(RANDOM() * 5 + 1)::INT],
        NOW() - (i || ' days')::INTERVAL - (RANDOM() * 8 || ' hours')::INTERVAL
      )
      RETURNING id INTO v_sale_id;

      -- Add 2-5 items per sale
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
      SELECT
        v_sale_id,
        v_product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_product_ids, 1) + 1)::INT],
        ROUND((RANDOM() * 2 + 0.5)::NUMERIC, 2),
        ROUND((RANDOM() * 10 + 3)::NUMERIC, 2),
        ROUND((RANDOM() * 25 + 5)::NUMERIC, 2)
      FROM generate_series(1, FLOOR(RANDOM() * 4 + 2)::INT);
    END LOOP;
  END LOOP;

  -- Create some demo losses
  INSERT INTO losses (tenant_id, product_id, user_id, quantity, reason, notes, created_at)
  SELECT
    v_tenant_id,
    v_product_ids[FLOOR(RANDOM() * ARRAY_LENGTH(v_product_ids, 1) + 1)::INT],
    v_user_id,
    ROUND((RANDOM() * 2 + 0.5)::NUMERIC, 2),
    (ARRAY['expiration', 'damage', 'expiration', 'damage'])[FLOOR(RANDOM() * 4 + 1)::INT],
    CASE FLOOR(RANDOM() * 3)::INT
      WHEN 0 THEN 'Produto passou da validade'
      WHEN 1 THEN 'Danificado no transporte'
      ELSE 'Estragou na prateleira'
    END,
    NOW() - (FLOOR(RANDOM() * 7) || ' days')::INTERVAL
  FROM generate_series(1, 8);

  RAISE NOTICE 'Demo data created for admin: tenant_id=%, user_id=%', v_tenant_id, v_user_id;
END $$;
