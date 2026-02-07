-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Enums
create type public.item_type as enum ('chat', 'gpt', 'file', 'instruction', 'agent');
create type public.llm_provider as enum ('openai', 'anthropic');
create type public.plan_tier as enum ('free', 'pro');

-- Timestamp trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan_tier public.plan_tier not null default 'free',
  stripe_customer_id text,
  stripe_subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_user_id)
);

create index if not exists idx_workspaces_owner on public.workspaces(owner_user_id);
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute procedure public.set_updated_at();

-- Ownership helper
create or replace function public.user_owns_workspace(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace
      and w.owner_user_id = auth.uid()
      and w.deleted_at is null
  );
$$;

-- LLM Connections
create table if not exists public.llm_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.llm_provider not null,
  label text not null,
  encrypted_api_key text not null,
  model_catalog jsonb not null default '[]'::jsonb,
  validation_status text not null default 'pending',
  validated_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_llm_connections_workspace on public.llm_connections(workspace_id, is_active);
create trigger trg_llm_connections_updated_at
before update on public.llm_connections
for each row execute procedure public.set_updated_at();

-- Items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.item_type not null,
  title text not null,
  content text,
  metadata jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_items_workspace_activity on public.items(workspace_id, last_activity_at desc);
create index if not exists idx_items_workspace_type on public.items(workspace_id, type);
create trigger trg_items_updated_at
before update on public.items
for each row execute procedure public.set_updated_at();

-- Chat threads/messages
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  llm_connection_id uuid references public.llm_connections(id) on delete set null,
  active_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_chat_threads_workspace on public.chat_threads(workspace_id, created_at desc);
create trigger trg_chat_threads_updated_at
before update on public.chat_threads
for each row execute procedure public.set_updated_at();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  token_usage integer,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at);
create index if not exists idx_chat_messages_workspace_created on public.chat_messages(workspace_id, created_at desc);

-- Topics
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_topic_id uuid references public.topics(id) on delete set null,
  name text not null,
  summary text,
  embedding vector(1536),
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_topics_workspace_parent on public.topics(workspace_id, parent_topic_id);
create index if not exists idx_topics_workspace_name on public.topics(workspace_id, name);
create trigger trg_topics_updated_at
before update on public.topics
for each row execute procedure public.set_updated_at();

-- Item-topic links
create table if not exists public.item_topic_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence numeric(5,4) not null default 0,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id, topic_id)
);

create index if not exists idx_item_topic_links_workspace_topic on public.item_topic_links(workspace_id, topic_id);
create trigger trg_item_topic_links_updated_at
before update on public.item_topic_links
for each row execute procedure public.set_updated_at();

-- Item edges for graph milestone
create table if not exists public.item_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_item_id uuid not null references public.items(id) on delete cascade,
  to_item_id uuid not null references public.items(id) on delete cascade,
  edge_type text not null,
  created_at timestamptz not null default now(),
  unique(from_item_id, to_item_id, edge_type)
);

create index if not exists idx_item_edges_workspace on public.item_edges(workspace_id);

-- Search chunks
create table if not exists public.search_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_search_chunks_workspace_item on public.search_chunks(workspace_id, item_id);
create index if not exists idx_search_chunks_tsv on public.search_chunks using gin(content_tsv);
create index if not exists idx_search_chunks_embedding on public.search_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Imports
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  source text not null,
  file_name text,
  status text not null default 'processing',
  chunk_count integer not null default 0,
  parse_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_imports_workspace_created on public.imports(workspace_id, created_at desc);
create trigger trg_imports_updated_at
before update on public.imports
for each row execute procedure public.set_updated_at();

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_workspace_created on public.audit_logs(workspace_id, created_at desc);

-- Search RPC for semantic matching
create or replace function public.match_search_chunks(
  p_workspace uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  item_id uuid,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    sc.id,
    sc.item_id,
    sc.content,
    1 - (sc.embedding <=> query_embedding) as similarity
  from public.search_chunks sc
  where sc.workspace_id = p_workspace
    and sc.deleted_at is null
    and sc.embedding is not null
    and 1 - (sc.embedding <=> query_embedding) > match_threshold
  order by sc.embedding <=> query_embedding
  limit match_count;
$$;

-- Hard delete RPC
create or replace function public.hard_delete_workspace_data(p_workspace_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_user_id = p_user_id
  ) then
    raise exception 'workspace ownership check failed';
  end if;

  delete from public.audit_logs where workspace_id = p_workspace_id;
  delete from public.imports where workspace_id = p_workspace_id;
  delete from public.search_chunks where workspace_id = p_workspace_id;
  delete from public.item_edges where workspace_id = p_workspace_id;
  delete from public.item_topic_links where workspace_id = p_workspace_id;
  delete from public.topics where workspace_id = p_workspace_id;
  delete from public.chat_messages where workspace_id = p_workspace_id;
  delete from public.chat_threads where workspace_id = p_workspace_id;
  delete from public.items where workspace_id = p_workspace_id;
  delete from public.llm_connections where workspace_id = p_workspace_id;
  delete from public.workspaces where id = p_workspace_id;
  delete from public.profiles where user_id = p_user_id;
end;
$$;

-- RLS setup
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.llm_connections enable row level security;
alter table public.items enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.topics enable row level security;
alter table public.item_topic_links enable row level security;
alter table public.item_edges enable row level security;
alter table public.search_chunks enable row level security;
alter table public.imports enable row level security;
alter table public.audit_logs enable row level security;

-- Policies: profiles
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies: workspaces
create policy "workspaces_select_own" on public.workspaces
for select using (auth.uid() = owner_user_id and deleted_at is null);
create policy "workspaces_insert_own" on public.workspaces
for insert with check (auth.uid() = owner_user_id);
create policy "workspaces_update_own" on public.workspaces
for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- Policies: workspace-scoped tables
create policy "llm_connections_workspace_owner" on public.llm_connections
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "items_workspace_owner" on public.items
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "chat_threads_workspace_owner" on public.chat_threads
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "chat_messages_workspace_owner" on public.chat_messages
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "topics_workspace_owner" on public.topics
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "item_topic_links_workspace_owner" on public.item_topic_links
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "item_edges_workspace_owner" on public.item_edges
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "search_chunks_workspace_owner" on public.search_chunks
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "imports_workspace_owner" on public.imports
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));

create policy "audit_logs_workspace_owner" on public.audit_logs
for all using (public.user_owns_workspace(workspace_id)) with check (public.user_owns_workspace(workspace_id));
