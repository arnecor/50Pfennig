-- =============================================================================
-- 50Pfennig — Local Development Seed Data
-- =============================================================================
--
-- HOW TO APPLY (users already exist — do NOT run db:reset):
--   1. Open Supabase Studio → http://localhost:54323
--   2. Go to SQL Editor
--   3. Paste this entire file and run it
--
-- Creates 3 groups and 9 expenses across those groups.
-- All monetary amounts are stored as integer CENTS (€12,50 → 1250).
-- All splits are equal. No settlements — record those through the app.
--
-- User UUID mapping:
--   Arne:   a2d516d4-9a43-4f2f-86d7-89b9a5537133  ← main test account
--   Maria:  1810ad67-08b4-422a-aa60-b1d31a01179a
--   Tim:    f1013898-cb84-4e5d-8b61-8ab211f26464
--   Sophie: cab5193f-662b-4653-a1b7-f14aaa63b7de
--
-- Expected home screen for Arne:
--   Du bekommst:   €120,00   (WG München +€30, Mallorca +€90)
--   Du schuldest:   −€6,50   (Büro Mittagessen)
--   Gesamt:        +€113,50
-- =============================================================================


-- =============================================================================
-- GROUPS
-- =============================================================================
--   10000000-... → WG München
--   20000000-... → Mallorca 2024
--   30000000-... → Büro Mittagessen
-- =============================================================================

INSERT INTO public.groups (id, name, created_by) VALUES
  ('10000000-0000-0000-0000-000000000001', 'WG München',        'a2d516d4-9a43-4f2f-86d7-89b9a5537133'),
  ('20000000-0000-0000-0000-000000000002', 'Mallorca 2024',     'a2d516d4-9a43-4f2f-86d7-89b9a5537133'),
  ('30000000-0000-0000-0000-000000000003', 'Büro Mittagessen',  'a2d516d4-9a43-4f2f-86d7-89b9a5537133');


-- =============================================================================
-- GROUP MEMBERS
-- =============================================================================
--   WG München:       Arne, Maria, Tim
--   Mallorca 2024:    Arne, Maria, Sophie
--   Büro Mittagessen: Arne, Tim
-- =============================================================================

INSERT INTO public.group_members (user_id, group_id, display_name) VALUES
  -- WG München
  ('a2d516d4-9a43-4f2f-86d7-89b9a5537133', '10000000-0000-0000-0000-000000000001', 'Arne Cornils'),
  ('1810ad67-08b4-422a-aa60-b1d31a01179a', '10000000-0000-0000-0000-000000000001', 'Maria Schmidt'),
  ('f1013898-cb84-4e5d-8b61-8ab211f26464', '10000000-0000-0000-0000-000000000001', 'Tim Weber'),
  -- Mallorca 2024
  ('a2d516d4-9a43-4f2f-86d7-89b9a5537133', '20000000-0000-0000-0000-000000000002', 'Arne Cornils'),
  ('1810ad67-08b4-422a-aa60-b1d31a01179a', '20000000-0000-0000-0000-000000000002', 'Maria Schmidt'),
  ('cab5193f-662b-4653-a1b7-f14aaa63b7de', '20000000-0000-0000-0000-000000000002', 'Sophie Müller'),
  -- Büro Mittagessen
  ('a2d516d4-9a43-4f2f-86d7-89b9a5537133', '30000000-0000-0000-0000-000000000003', 'Arne Cornils'),
  ('f1013898-cb84-4e5d-8b61-8ab211f26464', '30000000-0000-0000-0000-000000000003', 'Tim Weber');


-- =============================================================================
-- EXPENSES + SPLITS
-- =============================================================================
-- All expenses use equal splits. split_config = '{}' for equal type.
-- Splits must always sum to total_amount exactly.
--
-- Fixed expense UUIDs:
--   e1...01 = WG: Lebensmittel     e1...02 = WG: Haushaltswaren   e1...03 = WG: Internet
--   e2...01 = Mall: Flüge          e2...02 = Mall: Hotel           e2...03 = Mall: Ausflüge
--   e3...01 = Büro: Döner          e3...02 = Büro: Sushi           e3...03 = Büro: Pizza
-- =============================================================================


-- ---------------------------------------------------------------------------
-- WG München
-- ---------------------------------------------------------------------------

-- Lebensmittel: Arne paid €120,00 (12000¢), split 3 ways → 4000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Lebensmittel', 12000, 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 'equal', '{}', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 4000),
  ('e1000000-0000-0000-0000-000000000001', '1810ad67-08b4-422a-aa60-b1d31a01179a', 4000),
  ('e1000000-0000-0000-0000-000000000001', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 4000);

-- Haushaltswaren: Maria paid €90,00 (9000¢), split 3 ways → 3000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
        'Haushaltswaren', 9000, '1810ad67-08b4-422a-aa60-b1d31a01179a', 'equal', '{}', '1810ad67-08b4-422a-aa60-b1d31a01179a');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e1000000-0000-0000-0000-000000000002', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 3000),
  ('e1000000-0000-0000-0000-000000000002', '1810ad67-08b4-422a-aa60-b1d31a01179a', 3000),
  ('e1000000-0000-0000-0000-000000000002', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 3000);

-- Internet: Tim paid €60,00 (6000¢), split 3 ways → 2000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e1000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
        'Internet', 6000, 'f1013898-cb84-4e5d-8b61-8ab211f26464', 'equal', '{}', 'f1013898-cb84-4e5d-8b61-8ab211f26464');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e1000000-0000-0000-0000-000000000003', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 2000),
  ('e1000000-0000-0000-0000-000000000003', '1810ad67-08b4-422a-aa60-b1d31a01179a', 2000),
  ('e1000000-0000-0000-0000-000000000003', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 2000);

-- WG München balance for Arne: +12000 paid − 4000 own − 3000 (Maria's) − 2000 (Tim's) = +3000 (+€30,00)


-- ---------------------------------------------------------------------------
-- Mallorca 2024
-- ---------------------------------------------------------------------------

-- Flüge: Arne paid €300,00 (30000¢), split 3 ways → 10000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e2000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
        'Flüge', 30000, 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 'equal', '{}', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 10000),
  ('e2000000-0000-0000-0000-000000000001', '1810ad67-08b4-422a-aa60-b1d31a01179a', 10000),
  ('e2000000-0000-0000-0000-000000000001', 'cab5193f-662b-4653-a1b7-f14aaa63b7de', 10000);

-- Hotel: Sophie paid €150,00 (15000¢), split 3 ways → 5000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e2000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        'Hotel', 15000, 'cab5193f-662b-4653-a1b7-f14aaa63b7de', 'equal', '{}', 'cab5193f-662b-4653-a1b7-f14aaa63b7de');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e2000000-0000-0000-0000-000000000002', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 5000),
  ('e2000000-0000-0000-0000-000000000002', '1810ad67-08b4-422a-aa60-b1d31a01179a', 5000),
  ('e2000000-0000-0000-0000-000000000002', 'cab5193f-662b-4653-a1b7-f14aaa63b7de', 5000);

-- Ausflüge & Restaurants: Maria paid €180,00 (18000¢), split 3 ways → 6000¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e2000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002',
        'Ausflüge & Restaurants', 18000, '1810ad67-08b4-422a-aa60-b1d31a01179a', 'equal', '{}', '1810ad67-08b4-422a-aa60-b1d31a01179a');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e2000000-0000-0000-0000-000000000003', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 6000),
  ('e2000000-0000-0000-0000-000000000003', '1810ad67-08b4-422a-aa60-b1d31a01179a', 6000),
  ('e2000000-0000-0000-0000-000000000003', 'cab5193f-662b-4653-a1b7-f14aaa63b7de', 6000);

-- Mallorca balance for Arne: +30000 paid − 10000 own − 5000 (Sophie's) − 6000 (Maria's) = +9000 (+€90,00)


-- ---------------------------------------------------------------------------
-- Büro Mittagessen
-- ---------------------------------------------------------------------------

-- Döner beim Türken: Tim paid €25,00 (2500¢), split 2 ways → 1250¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e3000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
        'Döner beim Türken', 2500, 'f1013898-cb84-4e5d-8b61-8ab211f26464', 'equal', '{}', 'f1013898-cb84-4e5d-8b61-8ab211f26464');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e3000000-0000-0000-0000-000000000001', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 1250),
  ('e3000000-0000-0000-0000-000000000001', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 1250);

-- Sushi Mittwoch: Tim paid €32,00 (3200¢), split 2 ways → 1600¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e3000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003',
        'Sushi Mittwoch', 3200, 'f1013898-cb84-4e5d-8b61-8ab211f26464', 'equal', '{}', 'f1013898-cb84-4e5d-8b61-8ab211f26464');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e3000000-0000-0000-0000-000000000002', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 1600),
  ('e3000000-0000-0000-0000-000000000002', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 1600);

-- Pizza Freitag: Arne paid €44,00 (4400¢), split 2 ways → 2200¢ each
INSERT INTO public.expenses (id, group_id, description, total_amount, paid_by, split_type, split_config, created_by)
VALUES ('e3000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
        'Pizza Freitag', 4400, 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 'equal', '{}', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133');
INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
  ('e3000000-0000-0000-0000-000000000003', 'a2d516d4-9a43-4f2f-86d7-89b9a5537133', 2200),
  ('e3000000-0000-0000-0000-000000000003', 'f1013898-cb84-4e5d-8b61-8ab211f26464', 2200);

-- Büro balance for Arne: +4400 paid − 2200 own − 1250 (Döner) − 1600 (Sushi) = −650 (−€6,50)
