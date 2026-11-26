-- 0011: a third kind of client: sponsor (كفيل). Must be its own migration file.
alter type client_kind add value if not exists 'sponsor';
