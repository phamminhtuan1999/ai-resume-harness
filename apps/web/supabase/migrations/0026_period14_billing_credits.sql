-- US-065 credit payment processing.
-- Credits are granted and spent through an append-only ledger. The current
-- balance is derived from posted rows; checkout return URLs never mutate it.

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processing_result text not null check (processing_result in (
    'received', 'ignored', 'granted', 'duplicate', 'failed'
  )),
  error_message text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.billing_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  entry_type text not null check (entry_type in (
    'purchase', 'spend', 'adjustment'
  )),
  credits_delta integer not null check (credits_delta <> 0),
  status text not null default 'posted' check (status in (
    'posted', 'void'
  )),
  source text not null check (source in (
    'stripe_checkout', 'workflow_spend', 'admin_adjustment'
  )),
  stripe_event_id text references public.billing_events(stripe_event_id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (stripe_checkout_session_id)
);

create index if not exists billing_credit_ledger_user_id_created_at_idx
  on public.billing_credit_ledger (user_id, created_at desc);

create index if not exists billing_credit_ledger_user_id_status_idx
  on public.billing_credit_ledger (user_id, status);

alter table public.billing_events enable row level security;
alter table public.billing_credit_ledger enable row level security;

create or replace function public.spend_billing_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_subject_type text default null,
  p_subject_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'p_credits must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(credits_delta), 0)
    into current_balance
    from public.billing_credit_ledger
   where user_id = p_user_id
     and status = 'posted';

  if current_balance < p_credits then
    return false;
  end if;

  insert into public.billing_credit_ledger (
    user_id,
    entry_type,
    credits_delta,
    status,
    source,
    metadata_json
  )
  values (
    p_user_id,
    'spend',
    -p_credits,
    'posted',
    'workflow_spend',
    jsonb_build_object(
      'reason', p_reason,
      'subject_type', p_subject_type,
      'subject_id', p_subject_id
    )
  );

  return true;
end;
$$;

-- Server routes/actions use the Supabase service role after Clerk identity,
-- webhook signature, or ownership checks. Browser clients should not write
-- billing rows directly.
