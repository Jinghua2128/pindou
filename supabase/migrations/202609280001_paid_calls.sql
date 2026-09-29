-- Run in your own Supabase project before enabling billing. No credentials belong in this file.
create table public.billing_customers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_customer_id text not null unique
);
create table public.subscriptions (
 stripe_subscription_id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null, price_id text not null,
 current_period_end timestamptz not null, updated_at timestamptz not null default now(),
 stripe_event_created bigint not null default 0
);
create index subscriptions_owner on public.subscriptions(user_id, status, price_id);
create table public.call_sessions (
 id uuid primary key default gen_random_uuid(),
 host_user_id uuid not null references auth.users(id) on delete cascade,
 coop_room_id text not null check (coop_room_id ~ '^[a-f0-9]{48}$'),
 mode text not null check (mode in ('voice','video')),
 status text not null default 'pending' check (status in ('pending','active','ended')),
 provider_room text unique, provider_url text,
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '30 minutes')
);
create index call_sessions_owner_month on public.call_sessions(host_user_id, created_at);
create index call_sessions_coop_expiry on public.call_sessions(coop_room_id,expires_at);
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.call_sessions enable row level security;
revoke all on public.billing_customers,public.subscriptions,public.call_sessions from anon,authenticated;
grant all on public.billing_customers,public.subscriptions,public.call_sessions to service_role;
-- No browser may grant itself a plan, create a call, or read private provider rooms.
create or replace function public.reserve_call(p_user uuid,p_room text,p_mode text,p_price text)
returns setof public.call_sessions language plpgsql security invoker set search_path='' as $$
declare current_call public.call_sessions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_room,1));
 if not exists(select 1 from public.subscriptions where user_id=p_user and status='active' and price_id=p_price and current_period_end>now()) then raise exception 'An active subscription is required'; end if;
 select * into current_call from public.call_sessions where coop_room_id=p_room and expires_at>now() and status in ('pending','active') order by created_at desc limit 1;
 if found then
  if current_call.host_user_id<>p_user then raise exception 'A friend is already hosting this room'; end if;
  return next current_call; return;
 end if;
 if exists(select 1 from public.call_sessions where host_user_id=p_user and expires_at>now() and status in ('pending','active')) then raise exception 'You are already hosting a call'; end if;
 if (select count(*) from public.call_sessions where host_user_id=p_user and created_at>=(date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'))>=5 then raise exception 'This month’s five call sessions have been used'; end if;
 return query insert into public.call_sessions(host_user_id,coop_room_id,mode) values(p_user,p_room,p_mode) returning *;
end $$;
revoke all on function public.reserve_call(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_call(uuid,text,text,text) to service_role;

-- Serialize entitlement writes and reject stale webhook snapshots. Canceled Stripe
-- subscription IDs cannot reactivate; a new subscription receives a new ID.
create or replace function public.apply_subscription(p_id text,p_user uuid,p_status text,p_price text,p_end timestamptz,p_event_created bigint)
returns void language sql security invoker set search_path='' as $$
 insert into public.subscriptions as existing(stripe_subscription_id,user_id,status,price_id,current_period_end,stripe_event_created)
 values(p_id,p_user,p_status,p_price,p_end,p_event_created)
 on conflict(stripe_subscription_id) do update set status=excluded.status,price_id=excluded.price_id,current_period_end=excluded.current_period_end,stripe_event_created=excluded.stripe_event_created,updated_at=now()
 where existing.stripe_event_created<=excluded.stripe_event_created and existing.status<>'canceled';
$$;
revoke all on function public.apply_subscription(text,uuid,text,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.apply_subscription(text,uuid,text,text,timestamptz,bigint) to service_role;
