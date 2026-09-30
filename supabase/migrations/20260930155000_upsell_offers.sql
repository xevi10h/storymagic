-- Post-purchase offers (owner decisions 2026-09-30, src/lib/upsell.ts):
--   pdf_upgrade        a paid PDF order → its printed book with the 9,90 € PDF
--                      deducted (hardcover 40,00 € / softcover 25,00 €, IVA incluido)
--   extra_copy_repeat  a paid printed order → another printed copy at the checkout
--                      extra-copy price (29,90 / 19,90 €) for 60 days
--
-- /api/checkout decides the offer server-side and records it on the order so the
-- admin, the invoice line and later eligibility checks know which price applied.
-- Such an order is an ordinary physical order for fulfilment (one copy, its own
-- Gelato order and shipping).
--
-- DEPLOY ORDER: apply this migration BEFORE deploying the code (checkout writes
-- and the dashboard / admin read these columns).
-- Rollback: alter table public.orders drop column offer_source_order_id, drop column offer;

alter table public.orders
  add column if not exists offer text
    constraint orders_offer_check check (offer in ('pdf_upgrade', 'extra_copy_repeat')),
  add column if not exists offer_source_order_id uuid
    references public.orders(id) on delete set null;

comment on column public.orders.offer is
  'Post-purchase offer this order was bought with (pdf_upgrade | extra_copy_repeat), null = normal price.';
comment on column public.orders.offer_source_order_id is
  'The paid order that made the buyer eligible for the offer (the PDF order / the printed order).';

-- Eligibility lookups read a buyer's orders of one story.
create index if not exists orders_user_story_idx on public.orders (user_id, story_id);
