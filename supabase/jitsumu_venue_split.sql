-- =============================================
-- 実務従事：2024年11月〜2025年12月の回を会場（東京・大阪・名古屋・福岡・Zoom）ごとに分け直す（1 回だけ実行）
-- =============================================
-- Excel のこの時期のシートは、2 つ目からの表（「zoom」「大阪」「名古屋」など）に見出し行がなく、
-- 取り込みで最初の表（東京）にまとめて入っていた。Excel の行の位置から本来の会場を割り出して移す。
--   ・動かすのは Excel から取り込んだ申込のうち、まだ取り込んだときの回に入っているものだけ（画面で振替・編集したものはそのまま）
--   ・2026 年以降の回・画面から登録した申込には触らない。申込を消すことはない
--   ・同じ月・会場の回がすでにあればそこへ、なければ作る
--   ・定員：Excel の「max」の書き方に合わせて 2025年8月 東京 25（大阪 12）、2025年11月 東京 25（名古屋 8）
-- 何度実行しても同じ結果になる。

begin;

create temp table _jitsumu_move (entry_id uuid, from_id uuid, ym text, venue text, new_id uuid, cap int, sort int) on commit drop;
insert into _jitsumu_move values
  ('79a2b830-45ea-5ae8-9db8-43a391e61109'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('fe44ce54-477c-50be-9eb0-97a57f28c5f3'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('b1bf6614-96be-5bb6-a3a3-c3c701ab0b2f'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('20aff053-6049-5db4-b695-fbbc3d23dbf9'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('ba5956a8-8c7b-5b63-b254-8a64f3efd05b'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('94a760e8-5bd5-5f6a-90f0-b5e4833c5340'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('3b559244-0163-562e-817f-755502e3780f'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('2e9ae0d2-9006-553e-968f-b1c8481e27e0'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('37bd59fe-a34c-5144-8811-45d2c138f1f5'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('2c9e196a-5fc0-5806-b9ea-127906e26c9d'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('12e01eab-6f80-5ad8-a3d8-b0fc8c861204'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('22c36cf0-621e-58e4-9925-25f676aa770f'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('991835ed-21c6-59fb-861a-07afdcc5fc30'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('ddddfdac-4647-5ce4-97f9-338570c6bf99'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('687663e7-93df-50d1-94df-4f74841ff6e3'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('d7cd36f9-5084-5747-be92-f5fd555b8258'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('c792c6d1-0b5b-52a7-a2b2-455df1fd86cd'::uuid, '499ddf04-7c6f-5efd-9f5d-f181e09b3768'::uuid, '2025-02', 'Zoom', '038c785d-a775-53d0-bd25-a0ffc00a0879'::uuid, null, 4),
  ('138818bc-11b6-520e-ac79-134ad7a7cbea'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('85f9414c-6919-5e05-adec-413b9efff171'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('13337670-e3c6-5132-91f9-948f3c83d2d9'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('27812f6d-14e3-5ee5-ab1a-780ac1ddf7a1'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('7328ea8b-a599-5c0f-b346-ecccd7a28d0b'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('b5ada202-e07d-5c0d-89e0-4d9a87c21bbd'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('1b41ef84-ca5e-5684-9a1d-ecdfd29ac421'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('663dd8e9-6e85-567e-b4a1-5247a4a23ba3'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('feac7d33-4379-5447-b898-c4fcf629ff6c'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('4459a424-e5da-5415-bf64-929c794bbb63'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('c4fea15c-c144-5177-b925-ae61b1fa4dac'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('213f7a70-3217-53ed-9971-5ca522c57a58'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('63747ca6-b2e8-519b-ae36-a485ef69d250'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('782c3435-163e-5fe3-b9f9-5b36c4d71806'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('bafa1486-5d39-58a0-853d-e3f3f2eedd7a'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('1228fa9d-3fc7-50a3-8db9-6b02d4ccc36e'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('9d68ada3-6dcd-5856-a9d2-7b14577b8680'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('0770c809-12a1-59c5-9c47-746162b61504'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('9a1cb57f-701a-5b6d-a353-2b8e644e0ded'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('87ca86da-a41b-571c-975b-dafae365ad40'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', 'Zoom', 'c4c9b330-d307-542b-95ee-4dbe4cae2dfc'::uuid, null, 4),
  ('fc7f5b8c-6271-546b-baaf-c6df312d82b4'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('49460187-05ec-5b48-8b2e-62a80da60992'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('b8cfd9ac-3e06-5fdf-8040-958b7bbdb003'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('db8b81e0-a2d4-5f8f-84a8-ec88b17a01af'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('bb75a8e6-9fec-5bf5-9a4d-3c23985b6706'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('7be1018c-7347-5008-bbd0-e2c9c00fb357'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('3db1e35f-60cb-510d-a3bc-b0b550fb9f9e'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('ba0e41b4-c2b5-500e-a5b9-ae59e0528e0e'::uuid, '7fac728a-0519-53f5-99db-9131d1fb4a4a'::uuid, '2025-03', '名古屋', 'a4f51ec3-b1cf-5007-b762-1c234b0fceb2'::uuid, null, 2),
  ('ce9010be-6e04-5274-ae04-cd3390841846'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', '福岡', 'c9e08b2c-7428-5d4b-8c4e-0112171bb0bc'::uuid, null, 3),
  ('e4d743d7-6d37-5000-838b-3b66ea10fdfd'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', '福岡', 'c9e08b2c-7428-5d4b-8c4e-0112171bb0bc'::uuid, null, 3),
  ('a512136d-5468-5241-8b83-2078d0132a37'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', '福岡', 'c9e08b2c-7428-5d4b-8c4e-0112171bb0bc'::uuid, null, 3),
  ('86ed1e71-44f7-5a12-880b-2bcf3bb60610'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', '福岡', 'c9e08b2c-7428-5d4b-8c4e-0112171bb0bc'::uuid, null, 3),
  ('af12562c-008c-503a-a372-61de035a5d93'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('3c336eac-0c64-5d28-8af0-52f52d1483e5'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('1a8e9e3e-eff5-5704-94cc-26b0f8c851cb'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('d1b4a21e-c6f1-587d-adcc-8fd8effe1310'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('178db1d1-0488-5dcd-99a0-9f3be60c626c'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('dade5721-2b2e-5b85-8489-c9cac5254fcf'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('ca2eb36b-5854-5369-9ee9-976fd51c7a56'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('b3a225be-b89f-5619-afec-c5c28572e115'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('3531c03d-da5b-562c-9082-58c3f57a810d'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('a821d57f-7d29-5873-b2b6-82714b0b33a3'::uuid, 'dc275637-a598-539a-940c-60bfff8d06ae'::uuid, '2025-04', 'Zoom', '99b8298f-47fa-550f-a9ae-abbb9bd5b6d1'::uuid, null, 4),
  ('970ddfe5-c536-592b-83ea-92941d7af9e9'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('fc511060-7fae-52df-b500-3fb1f79acc54'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('baff51de-165c-571d-8313-913dcd3ddab5'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('6976593c-c2d1-5472-b37f-a5898de5306e'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('e74586b1-2389-5681-9ff9-931573b01d17'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('40e6377a-4c1a-555f-a493-9ea37cee32f5'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('e4c0e0d5-1a6a-5975-8bb6-94faa44ce778'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('118e5173-33ce-5f8c-95a0-730b4a4b11e1'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('e8be8505-31ea-54d7-9369-1152cd3c95de'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('562184f0-58a0-55e3-9026-86cdc90d1f40'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('64a8ed13-817d-5988-81c1-50147c451e66'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('d8d3d5ac-60fd-55d4-afa4-74318484d34e'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('11e4a471-043c-5bb0-b5fe-7ab887b37f87'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('af17da59-e851-591d-9946-00cbe31cc69c'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('661084a9-a21b-5269-af9d-e23edb2ad99d'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', '大阪', '83626c6a-fbc8-51a6-827f-62d7c0e80c1f'::uuid, null, 1),
  ('3fe016d9-0d05-5b12-9acd-def2fdc1bcfb'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('bbb63270-e1c8-5e8a-82b9-dd9f5e145ee4'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('20b21407-af38-53fc-8dc1-860eb91602c4'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('b6b611d8-d63b-527b-9a9d-348cf135b24e'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('f02a3ef7-5261-5c3f-86fd-14e95d5c24db'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('6d94318f-53b0-51fb-b227-51420c89ae8d'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('472c0957-07ed-5246-9548-3bcbaef1b7f4'::uuid, '4538a434-b6a0-5c7e-b0f0-0869f9125206'::uuid, '2025-05', 'Zoom', 'fd33bba9-1de6-5e26-96ef-a5ababb014c2'::uuid, null, 4),
  ('04db5733-a685-597d-b010-64830a827ce7'::uuid, '8987deef-f93c-51f2-aaae-6882efaf99f9'::uuid, '2025-06', 'Zoom', '5176649e-642d-577f-abd5-809a685fdf50'::uuid, null, 4),
  ('e6335bdf-ba23-5807-96d9-30e6bd944737'::uuid, '8987deef-f93c-51f2-aaae-6882efaf99f9'::uuid, '2025-06', 'Zoom', '5176649e-642d-577f-abd5-809a685fdf50'::uuid, null, 4),
  ('f078c4ac-4023-5bbd-af7b-94d603bdbc9a'::uuid, '8987deef-f93c-51f2-aaae-6882efaf99f9'::uuid, '2025-06', 'Zoom', '5176649e-642d-577f-abd5-809a685fdf50'::uuid, null, 4),
  ('b8e43812-458a-5df8-b67a-05621c0a32ad'::uuid, '8987deef-f93c-51f2-aaae-6882efaf99f9'::uuid, '2025-06', 'Zoom', '5176649e-642d-577f-abd5-809a685fdf50'::uuid, null, 4),
  ('43ed59f9-ec7a-5ac0-97d4-687c8238a465'::uuid, '8987deef-f93c-51f2-aaae-6882efaf99f9'::uuid, '2025-06', 'Zoom', '5176649e-642d-577f-abd5-809a685fdf50'::uuid, null, 4),
  ('46d96d7c-ad8f-5645-8128-7a38c23c750d'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('317f1936-3996-506f-8b48-e147850071b1'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('fbfd8e65-46f0-5952-91da-07fcdaba895e'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('46518831-8dc4-5473-ba7c-a6957a914a38'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('019b2397-2c5f-5096-a915-cb32681f74ed'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('2a8262f2-4be5-5e2b-9733-b362620ed8b1'::uuid, '786990a0-4a92-5b78-9626-27b0eeba5f97'::uuid, '2025-07', 'Zoom', '924d6747-bee9-579f-b982-cf42dbba7345'::uuid, null, 4),
  ('38c397d5-e894-51ee-8700-5e578e46b733'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('7b818fb5-7507-50e6-84c9-dd9ca484bec8'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('6e2c5f06-dac5-5ea4-9cbd-e3a3f4ffb220'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('97baa541-e4d3-5976-a7ce-7ac98fb7d74a'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('dbd1530a-ecc4-513b-8a1c-2184fbb865a1'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('11ba188a-f745-56fb-b32f-47d928db42ae'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('d524f835-fd2f-57f0-966a-7fff04305e43'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('ac048fe4-fd8d-5a43-ab40-d263332ea683'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', '大阪', 'fc4978d7-ce77-5002-905e-d1d7b96bd3c3'::uuid, 12, 1),
  ('91521c2d-e98f-5917-8b40-7efa34d9a882'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('ce851cd7-9faf-523c-9298-c7c4810802e9'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('c03190ea-cefe-56af-b573-8285c9676152'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('6f8c4262-1d4a-5a96-8b78-9416d3012279'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('c138c2c7-8288-5330-8cac-e2b5ffc514a6'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('1cecbd84-d678-546f-80f3-f3cb4b11d7d5'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('2c517453-2d51-522e-b3c9-63769b97fc49'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('f6ad004b-3523-5b56-b235-5f3368d8a7ec'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('8058fba9-61ad-5ec4-b8ad-67726299bc67'::uuid, '44968e7c-817c-59d9-a1ca-d5a07f097025'::uuid, '2025-08', 'Zoom', '0d9831c7-54a0-53cf-b5d2-4033977d64ee'::uuid, null, 4),
  ('75f040cd-18e8-5602-963b-538f0375b041'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('30c84177-8335-5f73-ad78-cc4ed40e0672'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('afd7a3b1-063a-535c-82fc-275f7b007f93'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('83387187-006a-59f8-bc46-edb5c33c8a1f'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('f4e2d1cb-dbd2-5a5a-8973-3ba8faf42f60'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('f3ce84eb-ea24-55e1-88f9-e4b3814216df'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('8e7fe857-d1a1-5fc8-ba24-14328ee51464'::uuid, 'e941afe0-c39e-5122-9325-3a076eb2fe2f'::uuid, '2025-09', 'Zoom', '944ddd41-8dfd-5aaf-8558-5ab0727829cd'::uuid, null, 4),
  ('077c2479-13c1-5463-b496-8febe17dbae0'::uuid, '31d1a06d-8c45-50c7-a52a-88aad52b3468'::uuid, '2025-10', 'Zoom', 'ee8b78e7-91e6-5ee9-ac0b-c6eaf2ec3409'::uuid, null, 4),
  ('d5c410d7-446e-5cfd-aea3-87f0ba6b77c3'::uuid, '31d1a06d-8c45-50c7-a52a-88aad52b3468'::uuid, '2025-10', 'Zoom', 'ee8b78e7-91e6-5ee9-ac0b-c6eaf2ec3409'::uuid, null, 4),
  ('07d391fe-4ab8-5140-9869-2ccdbb826215'::uuid, '31d1a06d-8c45-50c7-a52a-88aad52b3468'::uuid, '2025-10', 'Zoom', 'ee8b78e7-91e6-5ee9-ac0b-c6eaf2ec3409'::uuid, null, 4),
  ('0faa4696-80fb-592e-84c9-983d95c0e2c4'::uuid, '31d1a06d-8c45-50c7-a52a-88aad52b3468'::uuid, '2025-10', 'Zoom', 'ee8b78e7-91e6-5ee9-ac0b-c6eaf2ec3409'::uuid, null, 4),
  ('a8764ea9-4945-5222-beb0-fd9addc13940'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', '名古屋', '68422829-2de7-5b92-b848-1793c675b9f7'::uuid, 8, 2),
  ('acd811fe-8f31-5c8a-afa7-a866f738dbb5'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', '名古屋', '68422829-2de7-5b92-b848-1793c675b9f7'::uuid, 8, 2),
  ('797d2782-ad8c-5d7c-b41a-e36d86b211a0'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', '名古屋', '68422829-2de7-5b92-b848-1793c675b9f7'::uuid, 8, 2),
  ('b8c92768-0e38-5a8f-83e0-5e9ca7bf4a73'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', '名古屋', '68422829-2de7-5b92-b848-1793c675b9f7'::uuid, 8, 2),
  ('500af8c9-ce97-5794-97e7-d3fe315f4589'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', '名古屋', '68422829-2de7-5b92-b848-1793c675b9f7'::uuid, 8, 2),
  ('8e1895cd-bc27-5cc6-a8f9-9e02b4ffde5e'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', 'Zoom', '425d19fa-4389-5b2d-aa2c-3c36394516be'::uuid, null, 4),
  ('ac2af1ce-82b4-5636-a356-ec90557c36c7'::uuid, 'c870345a-d50f-56f9-9742-1ceb6535f12d'::uuid, '2025-11', 'Zoom', '425d19fa-4389-5b2d-aa2c-3c36394516be'::uuid, null, 4),
  ('c24bf28e-6fe6-5143-9bec-47e2960df2d0'::uuid, '4aafa23c-de6d-580e-b010-b523d9111cd1'::uuid, '2025-12', 'Zoom', '25fffa9a-a6ca-54d7-9cb2-95d78100d707'::uuid, null, 4);

-- 足りない回を作る（同じ月・会場の回があれば作らない）。中止の月は中止のまま
insert into public.jitsumu_sessions (id, ym, venue, label, capacity, status, sort)
select distinct on (m.ym, m.venue) m.new_id, m.ym, m.venue, m.venue, m.cap, case when s.status = '中止' then '中止' else '' end, m.sort
from _jitsumu_move m join public.jitsumu_sessions s on s.id = m.from_id
where not exists (select 1 from public.jitsumu_sessions x where x.ym = m.ym and x.venue = m.venue)
on conflict (id) do nothing;

-- 申込を本来の会場の回へ
update public.jitsumu_entries e
set session_id = t.id, updated_at = now()
from _jitsumu_move m
join lateral (select x.id from public.jitsumu_sessions x where x.ym = m.ym and x.venue = m.venue order by x.created_at, x.id limit 1) t on true
where e.id = m.entry_id and e.session_id = m.from_id;

-- 東京の定員が別の会場の数字になっていたもの
update public.jitsumu_sessions set capacity = 25, updated_at = now()
where venue = '東京' and ((ym = '2025-08' and capacity = 12) or (ym = '2025-11' and capacity = 8));

commit;

-- 確かめる：2024年11月〜2025年12月の回ごとの申込数（キャンセルを除く）
select s.ym, s.venue, s.status, s.capacity, count(e.id) filter (where e.status <> 'キャンセル') as 申込
from public.jitsumu_sessions s left join public.jitsumu_entries e on e.session_id = s.id
where s.ym between '2024-11' and '2025-12'
group by s.id order by s.ym, s.sort, s.venue;
