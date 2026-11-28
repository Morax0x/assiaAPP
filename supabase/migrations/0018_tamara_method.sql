-- 0018: add "tamara" payment method (its own migration: a new enum value cannot be used in the transaction that creates it).
alter type pay_method add value if not exists 'tamara';
