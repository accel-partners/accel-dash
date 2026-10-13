-- =============================================
-- 実務従事：Excel 名簿で「行を非表示」にしていた申込（キャンセル・別の回へ変更）を消す
-- =============================================
-- Excel では非表示の行＝キャンセルや別の回への変更だったが、取り込みでは普通の申込として入っていた。
--   ・消すのは、取り込んだ Excel（10/2 にもらったもの）で非表示だった行の申込だけ（55 件。すでに画面で消したものは何もしない）
--   ・画面から登録した申込・非表示でなかった申込には触らない
--   ・申込が 1 件も残らなくなった人だけ、申込者の一覧からも消す（ほかの回の申込がある人は残す）
-- 1 つの文なので、途中で失敗したら何も消えない。消したものは元に戻せない。
-- 結果に消した申込の一覧（回・名前・備考、申込者も消したか）が出る。2 回目は 0 行（何もしない）。

with hidden(id) as (
  values
    ('e0f27029-8605-5dca-b485-a439a3743e04'::uuid),
    ('cc13084b-5764-5b0e-9215-7339f038987a'::uuid),
    ('0d9fad06-dac7-5880-972b-c88e642411cf'::uuid),
    ('1b8cf17b-2993-5fae-830e-0c1f18972461'::uuid),
    ('88be3522-5e64-5e4e-bb63-33c6feeaf4b5'::uuid),
    ('87cad17b-810f-555a-bb08-d6875a7bbc6e'::uuid),
    ('f9dad320-e4fd-5795-a704-2b89a3d25bf0'::uuid),
    ('57d7408a-eeb5-5eb5-a70e-9df7cc8d6cec'::uuid),
    ('fda4dd3f-66d3-5020-9151-d2af12bd51cd'::uuid),
    ('b1bf6614-96be-5bb6-a3a3-c3c701ab0b2f'::uuid),
    ('2e9ae0d2-9006-553e-968f-b1c8481e27e0'::uuid),
    ('d00db960-24a3-562e-8dc1-8675f2c3b0cd'::uuid),
    ('138818bc-11b6-520e-ac79-134ad7a7cbea'::uuid),
    ('49460187-05ec-5b48-8b2e-62a80da60992'::uuid),
    ('0ccc1e43-91d3-55ef-b20b-8da3acee1ac3'::uuid),
    ('4a559664-1a64-503c-be24-bea3294e5b95'::uuid),
    ('826d4a8a-914c-5805-a3b3-c46d3ba53f98'::uuid),
    ('86142ef2-851e-58e5-8c4d-d70aabac5fbd'::uuid),
    ('d154045c-fab0-5c90-a45b-703e703f7a03'::uuid),
    ('3cb0fce6-905b-5349-944b-fe57d49321a1'::uuid),
    ('a86bc0b6-cea4-50e5-af2c-75a972183e2b'::uuid),
    ('ce9010be-6e04-5274-ae04-cd3390841846'::uuid),
    ('ca2eb36b-5854-5369-9ee9-976fd51c7a56'::uuid),
    ('2611b976-92cf-5ed0-b90a-b060262523cb'::uuid),
    ('a5f3f3f4-f141-5494-81eb-04134c102a80'::uuid),
    ('843dc0a3-641d-53fc-81a6-cb41343c8d0e'::uuid),
    ('f10ec42e-a927-5b5f-ad88-f5512f430144'::uuid),
    ('cd65b6cc-e090-5675-8adc-6f338986c28b'::uuid),
    ('371164c8-d615-5454-a1f2-0b6f2ad9141f'::uuid),
    ('e6335bdf-ba23-5807-96d9-30e6bd944737'::uuid),
    ('43ed59f9-ec7a-5ac0-97d4-687c8238a465'::uuid),
    ('abb84bf8-176c-5d26-9607-a0c7a8b62a8c'::uuid),
    ('bb6a9f9d-452b-51b1-a1e3-aea13b464a64'::uuid),
    ('4068f5ec-4534-52a8-a779-b27f0a9d9e25'::uuid),
    ('945eef4c-da27-58bf-ba0b-21f21212058b'::uuid),
    ('625c7ee7-8e90-5fca-87fa-c1ce64188bc3'::uuid),
    ('6bf30fe5-242e-56dc-bb44-17e975def0c4'::uuid),
    ('fbfd8e65-46f0-5952-91da-07fcdaba895e'::uuid),
    ('387fc59b-7059-5c8b-87a7-81526015f1c7'::uuid),
    ('89adadb8-44af-5bec-9c12-da5a4b91ea9c'::uuid),
    ('0473dead-1ceb-5f55-b78d-cf1f45844d28'::uuid),
    ('a5d46660-686f-56ef-a494-c1ba5a9a04f0'::uuid),
    ('009b47a9-4121-52e7-bffe-0d9c17a62e44'::uuid),
    ('7ecc5fbc-0825-5f9b-9526-3ef443b38c68'::uuid),
    ('fb6368f7-2f90-5aec-be2d-efc79f069c51'::uuid),
    ('593af188-ee22-5402-bb1c-69b526afa9f1'::uuid),
    ('1a966971-27db-50f4-81cd-07d780facd00'::uuid),
    ('03602abf-8997-5c89-869c-5865848f5482'::uuid),
    ('e9d8824b-f93d-5dfd-8202-c2533a1100f3'::uuid),
    ('2e101deb-f47c-5a60-827d-1821f5a5184e'::uuid),
    ('e5790609-5892-507a-b733-3cec8329b58a'::uuid),
    ('4169a5dd-4fe7-5ff9-a9b8-d468aee84fef'::uuid),
    ('d986971b-b9fd-5e5d-bc31-591a30b8ee5f'::uuid),
    ('3424ac5a-f159-52b7-8111-5d21a0125b9f'::uuid),
    ('a214f112-3bfa-5624-ae79-6a86a8ed28fe'::uuid)
),
del_entries as (
  delete from public.jitsumu_entries e
  using hidden h
  where e.id = h.id
  returning e.id, e.person_id, e.session_id, e.status, e.note
),
del_people as (
  delete from public.jitsumu_people p
  where p.id in (select person_id from del_entries)
    and not exists (
      select 1 from public.jitsumu_entries e
      where e.person_id = p.id and e.id not in (select id from del_entries)
    )
  returning p.id
)
select s.ym, s.venue, p.name, d.status, left(d.note, 40) as note,
       (d.person_id in (select id from del_people)) as 申込者も消した
from del_entries d
left join public.jitsumu_sessions s on s.id = d.session_id
left join public.jitsumu_people p on p.id = d.person_id
order by s.ym, s.venue, p.name;
