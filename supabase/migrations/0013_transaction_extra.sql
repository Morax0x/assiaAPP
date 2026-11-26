-- Extra columns for the transactions table: service type, last payment method and payment (transfer) date.
-- A view (like transaction_payment_summary) so staff without treasury access still see how a transaction was paid.
create or replace view transaction_extra as
select t.id as transaction_id,
       st.name as service_name,
       (select l.method::text from ledger_entries l
         where l.transaction_id = t.id and l.kind = 'client_payment' and l.voided_at is null
         order by l.occurred_at desc limit 1) as method,
       (select max(l.occurred_at) from ledger_entries l
         where l.transaction_id = t.id and l.kind = 'client_payment' and l.voided_at is null) as paid_on
from transactions t
left join service_templates st on st.id = t.template_id
where t.deleted_at is null and is_member();

grant select on transaction_extra to authenticated;
