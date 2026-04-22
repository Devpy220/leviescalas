create table if not exists public.whatsapp_queue (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  message text not null,
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  status text not null default 'pending',
  origin text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists whatsapp_queue_due_idx
  on public.whatsapp_queue (status, scheduled_for)
  where status = 'pending';

alter table public.whatsapp_queue enable row level security;

drop policy if exists "Service role only whatsapp_queue" on public.whatsapp_queue;
create policy "Service role only whatsapp_queue"
on public.whatsapp_queue for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');