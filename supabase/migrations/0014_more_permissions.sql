-- More fine-grained permissions. Defaults keep today's behaviour: admin gets everything, staff keeps what they could already do.
insert into role_permissions(role, permission, allowed) values
 ('admin','docs.open',true),('staff','docs.open',true),
 ('admin','docs.move',true),('staff','docs.move',true),
 ('admin','docs.import',true),('staff','docs.import',true),
 ('admin','txn.fees',true),('staff','txn.fees',true),
 ('admin','invoices.write',true),('staff','invoices.write',true),
 ('admin','receivables.view',true),('staff','receivables.view',true),
 ('admin','data.export',true),('staff','data.export',true),
 ('admin','data.import',true),('staff','data.import',true),
 ('admin','services.manage',true),('staff','services.manage',false)
on conflict (role, permission) do nothing;
