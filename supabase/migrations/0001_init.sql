-- ============================================================================
-- crypto_trade_tool 初期スキーマ
-- 4テーブル + Row Level Security (RLS) + 新規ユーザーの profiles 自動作成トリガー
--
-- 適用方法（いずれか）:
--   A) Supabase ダッシュボード > SQL Editor にこの内容を貼り付けて実行
--   B) Supabase CLI:  supabase db push   (supabase/ をリンク済みの場合)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: auth.users と 1:1。ユーザーのプロフィールと初期仮想資金。
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  display_name    text,
  initial_balance numeric not null default 10000,   -- 初期仮想資金 (USDT)
  created_at      timestamptz not null default now()
);

comment on table public.profiles is 'ユーザープロフィールと初期仮想資金';

-- ---------------------------------------------------------------------------
-- paper_trades: デモトレードの注文/ポジション履歴。
-- ---------------------------------------------------------------------------
create table if not exists public.paper_trades (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null default 'BTCUSDT',
  side       text not null check (side in ('long', 'short')),
  type       text not null check (type in ('market', 'limit')),
  price      numeric not null,                       -- エントリー価格
  quantity   numeric not null,                       -- 数量 (BTC等)
  leverage   numeric not null default 1 check (leverage >= 1 and leverage <= 20),
  pnl        numeric,                                -- 実現損益 (クローズ時)。オープン中は null
  status     text not null default 'open' check (status in ('open', 'closed')),
  closed_at  timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists paper_trades_user_id_idx on public.paper_trades (user_id, created_at desc);
comment on table public.paper_trades is 'デモトレードの注文・ポジション履歴';

-- ---------------------------------------------------------------------------
-- tax_simulations: 税シミュレーションの保存結果。
-- ---------------------------------------------------------------------------
create table if not exists public.tax_simulations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  crypto_profit numeric not null,
  other_income  numeric not null default 0,
  tax_mode      text not null check (tax_mode in ('current_progressive', 'separate_2028')),
  tax_amount    numeric not null,
  net_profit    numeric not null,
  created_at    timestamptz not null default now()
);

create index if not exists tax_simulations_user_id_idx on public.tax_simulations (user_id, created_at desc);
comment on table public.tax_simulations is '税金シミュレーションの保存結果';

-- ---------------------------------------------------------------------------
-- notes: ユーザーの自由メモ・仮説。
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes (user_id, created_at desc);
comment on table public.notes is 'ユーザーの自由メモ・仮説';

-- ============================================================================
-- Row Level Security: 各ユーザーは自分の行のみ read/write 可能。
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.paper_trades    enable row level security;
alter table public.tax_simulations enable row level security;
alter table public.notes           enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- 汎用: user_id = auth.uid() の行のみ許可（3テーブル共通パターン）
drop policy if exists "paper_trades_all_own" on public.paper_trades;
create policy "paper_trades_all_own" on public.paper_trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tax_simulations_all_own" on public.tax_simulations;
create policy "tax_simulations_all_own" on public.tax_simulations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_all_own" on public.notes;
create policy "notes_all_own" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 新規ユーザー登録時に profiles 行を自動作成するトリガー。
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
