-- 0006: add "cheque" payment method (must be its own migration: a new enum value
-- cannot be used in the same transaction that creates it).
alter type pay_method add value if not exists 'cheque';
