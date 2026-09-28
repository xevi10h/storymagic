-- Apply AFTER the code that inserts orders with the service role is live.
-- Orders are created only by /api/checkout (service role). The old policy let any
-- signed-in user insert a row with status 'paid', which the fulfilment cron would
-- then generate and print for free.
drop policy if exists "Users can insert own orders" on public.orders;
