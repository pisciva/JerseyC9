create table if not exists public.distribution_records (
  order_key text primary key,
  picked_up boolean not null default false,
  picked_up_at timestamptz,
  picked_up_by text,
  checklist jsonb not null default '{}'::jsonb,
  photo_url text,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.distribution_records enable row level security;

drop policy if exists "Public can read distribution status" on public.distribution_records;
create policy "Public can read distribution status"
on public.distribution_records
for select
using (true);
