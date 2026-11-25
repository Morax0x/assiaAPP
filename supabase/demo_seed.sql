-- =====================================================================
-- Demo data (used ONLY by `npm run demo`; never run on the real project)
-- =====================================================================
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','owner@demo.local','{"full_name":"عبدالعزيز الأحمد"}'),
 ('00000000-0000-4000-8000-000000000002','admin@demo.local','{"full_name":"سارة المنصوري"}'),
 ('00000000-0000-4000-8000-000000000003','staff@demo.local','{"full_name":"أحمد الكعبي"}');
update profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000002';
update profiles set phone = '0501000001' where id = '00000000-0000-4000-8000-000000000001';

update office_settings set office_name = 'آسيا لخدمات رجال الأعمال', phone = '06 744 1234',
  address = 'عجمان، الإمارات العربية المتحدة', invoice_footer = 'شكراً لتعاملكم مع آسيا لخدمات رجال الأعمال';
update accounts set opening_balance = 25000 where kind = 'cash';
update accounts set opening_balance = 40000 where kind = 'bank';

insert into clients(name, kind, phone, whatsapp, email, notes) values
 ('شركة النور للتجارة','company','0501112233','0501112233','info@alnoor.example','عميل قديم، يفضل التواصل واتساب'),
 ('محمد علي العامري','individual','0502223344',null,null,null),
 ('مؤسسة الأفق للمقاولات','company','0503334455','0503334455','ops@afaq.example',null),
 ('فاطمة سالم الشامسي','individual','0504445566',null,null,null),
 ('شركة الخليج للخدمات اللوجستية','company','0505556677','0505556677','hr@gulf-log.example','تجديدات سنوية كل ديسمبر'),
 ('خالد إبراهيم النقبي','individual','0506667788',null,null,null),
 ('مطعم بيت الشام','company','0507778899','0507778899',null,null),
 ('يوسف حسن الزعابي','individual','0508889900',null,null,null),
 ('صالون ليالي للتجميل','company','0509990011',null,null,null),
 ('عبدالله ناصر المهيري','individual','0501231234',null,null,null);

create function pg_temp.cid(n text) returns uuid language sql as $$ select id from clients where name like n || '%' limit 1 $$;

create function pg_temp.mk(client text, title text, govt numeric, fee numeric, st txn_status, days int, assignee uuid, creator uuid, due int default null)
returns uuid language plpgsql as $$
declare t uuid;
begin
  perform set_config('request.jwt.claim.sub', creator::text, false);
  insert into transactions(client_id, title, govt_fees, office_fee, status, assignee_id, created_by, due_date)
  values (pg_temp.cid(client), title, govt, fee, st, assignee, creator, case when due is null then null else current_date + due end)
  returning id into t;
  update transactions set created_at = now() - make_interval(days => days),
    completed_at = case when st = 'completed' then now() - make_interval(days => greatest(days - 3, 0)) else null end
  where id = t;
  return t;
end $$;

create function pg_temp.pay(t uuid, amt numeric, m pay_method, acct text, days int, ref text, payer text, uid uuid)
returns void language plpgsql as $$
declare cid uuid;
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  select client_id into cid from transactions where id = t;
  insert into ledger_entries(account_id, direction, kind, amount, method, transaction_id, client_id, occurred_at, reference_no, paid_by, created_by)
  values ((select id from accounts where kind = acct::account_kind limit 1), 'in', 'client_payment', amt, m, t, cid,
          now() - make_interval(days => days), nullif(ref, ''), nullif(payer, ''), uid);
end $$;

create function pg_temp.gov(t uuid, amt numeric, acct text, days int, ref text, uid uuid)
returns void language plpgsql as $$
declare cid uuid;
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  select client_id into cid from transactions where id = t;
  insert into ledger_entries(account_id, direction, kind, amount, method, transaction_id, client_id, occurred_at, reference_no, created_by)
  values ((select id from accounts where kind = acct::account_kind limit 1), 'out', 'govt_fee', amt,
          (case when acct = 'cash' then 'cash' else 'bank_card' end)::pay_method, t, cid, now() - make_interval(days => days), nullif(ref, ''), uid);
end $$;

create function pg_temp.spend(cat text, amt numeric, acct text, days int, descr text, uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  insert into ledger_entries(account_id, direction, kind, amount, method, category_id, description, occurred_at, created_by)
  values ((select id from accounts where kind = acct::account_kind limit 1), 'out', 'expense', amt,
          (case when acct = 'cash' then 'cash' else 'bank_card' end)::pay_method,
          (select id from expense_categories where name = cat), descr, now() - make_interval(days => days), uid);
end $$;

create function pg_temp.doc(client text, typ text, title text, issue_off int, expiry_off int, txn uuid, uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  insert into documents(client_id, transaction_id, type_id, title, issue_date, expiry_date, storage_path, mime_type, size_bytes, uploaded_by)
  values (pg_temp.cid(client), txn, (select id from document_types where name = typ), title,
          case when issue_off is null then null else current_date + issue_off end,
          case when expiry_off is null then null else current_date + expiry_off end,
          'demo/' || gen_random_uuid() || '.svg', 'image/svg+xml', 24000, uid);
end $$;

do $$
declare
  o uuid := '00000000-0000-4000-8000-000000000001';
  a uuid := '00000000-0000-4000-8000-000000000002';
  s uuid := '00000000-0000-4000-8000-000000000003';
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid; t9 uuid; t10 uuid; t11 uuid; t12 uuid; t13 uuid; t15 uuid; t16 uuid;
  cash uuid; bank uuid;
begin
  select id into cash from accounts where kind = 'cash' limit 1;
  select id into bank from accounts where kind = 'bank' limit 1;

  t16 := pg_temp.mk('شركة الخليج', 'تسجيل ضريبة القيمة المضافة', 0, 800, 'completed', 130, s, o);
  perform pg_temp.pay(t16, 800, 'cash', 'cash', 128, 'REC-118', null, s);
  t13 := pg_temp.mk('مؤسسة الأفق', 'تجديد بطاقة عمل', 1200, 300, 'completed', 150, s, o);
  perform pg_temp.pay(t13, 1500, 'bank_transfer', 'bank', 148, 'FT26186AB12', 'م. الأفق للمقاولات', s);
  perform pg_temp.gov(t13, 1200, 'bank', 147, 'MOHRE-77120', a);
  t1 := pg_temp.mk('شركة النور', 'تجديد رخصة تجارية', 1500, 400, 'completed', 120, s, o);
  perform pg_temp.pay(t1, 1900, 'cash', 'cash', 118, 'REC-131', null, s);
  perform pg_temp.gov(t1, 1500, 'bank', 117, 'AJM-ECO-5521', a);
  t15 := pg_temp.mk('فاطمة سالم', 'تأمين صحي', 1400, 200, 'completed', 100, s, a);
  perform pg_temp.pay(t15, 1600, 'bank_card', 'bank', 99, 'POS-88231', null, s);
  perform pg_temp.gov(t15, 1400, 'bank', 98, 'INS-3391', a);
  t2 := pg_temp.mk('شركة النور', 'تجديد إقامة المدير', 650, 200, 'completed', 90, s, o);
  perform pg_temp.pay(t2, 850, 'bank_transfer', 'bank', 88, 'FT26237QW90', 'شركة النور للتجارة', s);
  perform pg_temp.gov(t2, 650, 'bank', 87, 'GDRFA-10342', a);
  t3 := pg_temp.mk('محمد علي', 'تجديد إقامة', 1000, 250, 'completed', 75, s, o);
  perform pg_temp.pay(t3, 1250, 'bank_card', 'bank', 74, 'POS-70112', null, s);
  perform pg_temp.gov(t3, 1000, 'bank', 73, 'GDRFA-11876', a);
  t10 := pg_temp.mk('صالون ليالي', 'تجديد عضوية الغرفة', 1200, 350, 'completed', 60, a, a);
  perform pg_temp.pay(t10, 1550, 'bank_transfer', 'bank', 58, 'FT26265LK44', 'ليالي ناصر', a);
  perform pg_temp.gov(t10, 1200, 'bank', 57, 'CHAMBER-2210', a);
  t5 := pg_temp.mk('فاطمة سالم', 'تأشيرة زيارة وتمديد', 600, 150, 'completed', 45, s, o);
  perform pg_temp.pay(t5, 750, 'cash', 'cash', 44, 'REC-152', null, s);
  perform pg_temp.gov(t5, 600, 'cash', 43, null, a);
  perform pg_temp.mk('محمد علي', 'تغيير الاسم التجاري', 1000, 300, 'cancelled', 40, s, o);
  t7 := pg_temp.mk('خالد إبراهيم', 'إصدار هوية إماراتية', 370, 130, 'completed', 30, s, s);
  perform pg_temp.pay(t7, 500, 'cash', 'cash', 29, 'REC-171', null, s);
  perform pg_temp.gov(t7, 370, 'cash', 28, null, a);
  t4 := pg_temp.mk('مؤسسة الأفق', 'تأسيس رخصة تجارية جديدة', 8500, 1500, 'in_progress', 20, a, o, 5);
  perform pg_temp.pay(t4, 5000, 'bank_transfer', 'bank', 18, 'FT26310CD08', 'مؤسسة الأفق', a);
  perform pg_temp.gov(t4, 4000, 'bank', 15, 'DED-99120', a);
  t6 := pg_temp.mk('شركة الخليج', 'تجديد رخصة تجارية', 2200, 500, 'awaiting_docs', 12, s, o, 2);
  perform pg_temp.pay(t6, 1000, 'cheque', 'bank', 10, 'CHQ-2041', 'شركة الخليج للخدمات', s);
  t8 := pg_temp.mk('مطعم بيت الشام', 'شهادة دفاع مدني', 900, 300, 'in_progress', 9, s, s, -1);
  t11 := pg_temp.mk('عبدالله ناصر', 'تصديق عقود', 300, 200, 'in_progress', 6, a, a, 3);
  perform pg_temp.pay(t11, 200, 'cash', 'cash', 6, 'REC-190', null, a);
  t9 := pg_temp.mk('يوسف حسن', 'نقل ملكية مركبة', 450, 150, 'new', 3, s, s, 7);
  t12 := pg_temp.mk('شركة النور', 'إضافة شريك', 1800, 700, 'new', 1, a, o);

  -- operating expenses
  perform pg_temp.spend('إيجار', 4500, 'bank', 95, 'إيجار المكتب', a);
  perform pg_temp.spend('إيجار', 4500, 'bank', 65, 'إيجار المكتب', a);
  perform pg_temp.spend('إيجار', 4500, 'bank', 35, 'إيجار المكتب', a);
  perform pg_temp.spend('إيجار', 4500, 'bank', 5, 'إيجار المكتب', a);
  perform pg_temp.spend('رواتب', 6000, 'bank', 88, 'رواتب الموظفين', o);
  perform pg_temp.spend('رواتب', 6000, 'bank', 58, 'رواتب الموظفين', o);
  perform pg_temp.spend('رواتب', 6000, 'bank', 28, 'رواتب الموظفين', o);
  perform pg_temp.spend('كهرباء وماء', 380, 'cash', 50, 'فاتورة الكهرباء والماء', a);
  perform pg_temp.spend('ضيافة', 120, 'cash', 14, 'ضيافة العملاء', s);
  perform pg_temp.spend('مشتريات', 340, 'cash', 22, 'قرطاسية وحبر طابعة', s);
  perform pg_temp.spend('اتصالات', 250, 'bank', 25, 'باقة الإنترنت والهاتف', a);

  -- internal transfers (cash deposited to the bank, and a cash withdrawal)
  perform set_config('request.jwt.claim.sub', a::text, false);
  insert into ledger_entries(account_id, direction, kind, amount, transfer_id, description, occurred_at, reference_no, created_by)
  select cash, 'out', 'transfer', 3000, tid, 'إيداع كاش في البنك', now() - interval '20 days', 'DEP-5521', a from (select gen_random_uuid() tid) x;
  insert into ledger_entries(account_id, direction, kind, amount, transfer_id, description, occurred_at, reference_no, created_by)
  select bank, 'in', 'transfer', 3000, transfer_id, description, occurred_at, reference_no, a from ledger_entries where description = 'إيداع كاش في البنك';
  insert into ledger_entries(account_id, direction, kind, amount, transfer_id, description, occurred_at, created_by)
  select bank, 'out', 'transfer', 1500, tid, 'سحب للصندوق', now() - interval '7 days', a from (select gen_random_uuid() tid) x;
  insert into ledger_entries(account_id, direction, kind, amount, transfer_id, description, occurred_at, created_by)
  select cash, 'in', 'transfer', 1500, transfer_id, description, occurred_at, a from ledger_entries where description = 'سحب للصندوق';

  insert into reconciliations(account_id, system_balance, actual_balance, note, reconciled_at, created_by) values
    (cash, 24630, 24630, 'جرد نهاية الشهر', now() - interval '30 days', o),
    (cash, 28590, 28570, 'فرق بسيط في الفكة', now() - interval '5 days', a);

  -- documents (a mix of expired, urgent, upcoming, valid, and files without expiry)
  perform pg_temp.doc('شركة النور', 'رخصة تجارية', 'رخصة شركة النور 2026', -350, -12, null, s);
  perform pg_temp.doc('شركة النور', 'إقامة', 'إقامة مدير الشركة', -700, 9, t2, s);
  perform pg_temp.doc('شركة النور', 'عقد إيجار', 'عقد إيجار المكتب', -290, 75, null, s);
  perform pg_temp.doc('شركة النور', 'فاتورة', 'فاتورة تجديد الرخصة', null, null, t1, s);
  perform pg_temp.doc('شركة النور', 'إيصال دفع', 'إيصال استلام 1900 درهم', null, null, t1, s);
  perform pg_temp.doc('محمد علي', 'إقامة', 'إقامة محمد العامري', -165, 200, t3, s);
  perform pg_temp.doc('محمد علي', 'جواز سفر', 'جواز سفر محمد', -900, 1500, null, s);
  perform pg_temp.doc('محمد علي', 'هوية', 'الهوية الإماراتية', -300, 400, null, s);
  perform pg_temp.doc('مؤسسة الأفق', 'رخصة تجارية', 'رخصة مؤسسة الأفق', -360, 5, null, a);
  perform pg_temp.doc('مؤسسة الأفق', 'تأمين', 'تأمين المنشأة', -325, 40, null, a);
  perform pg_temp.doc('مؤسسة الأفق', 'حوالة بنكية', 'إشعار حوالة 5000 درهم', null, null, t4, a);
  perform pg_temp.doc('فاطمة سالم', 'إقامة', 'إقامة فاطمة الشامسي', -350, 18, null, s);
  perform pg_temp.doc('فاطمة سالم', 'جواز سفر', 'جواز فاطمة', -800, 900, null, s);
  perform pg_temp.doc('شركة الخليج', 'رخصة تجارية', 'رخصة الخليج للخدمات', -200, 140, t6, s);
  perform pg_temp.doc('شركة الخليج', 'وكالة', 'وكالة عامة للمدير', null, null, null, s);
  perform pg_temp.doc('شركة الخليج', 'شيك', 'صورة شيك رقم CHQ-2041', null, null, t6, s);
  perform pg_temp.doc('خالد إبراهيم', 'هوية', 'هوية خالد النقبي', -1300, 25, t7, s);
  perform pg_temp.doc('مطعم بيت الشام', 'رخصة تجارية', 'رخصة مطعم بيت الشام', -335, 30, null, s);
  perform pg_temp.doc('صالون ليالي', 'رخصة تجارية', 'رخصة صالون ليالي', -65, 300, t10, a);
  perform pg_temp.doc('صالون ليالي', 'تأمين', 'تأمين الصالون', -362, 3, null, a);

  perform set_config('request.jwt.claim.sub', '', false);
end $$;
