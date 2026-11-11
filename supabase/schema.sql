-- BISA marketplace core schema
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text not null,
  phone text,
  role text not null default 'applicant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  business_name text not null,
  category_id uuid references public.categories(id),
  description text not null,
  offerings text not null,
  campus_location text,
  contact_phone text not null,
  contact_email text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_applications (
  id uuid primary key default uuid_generate_v4(),
  applicant_profile_id uuid references public.profiles(id) on delete set null,
  applicant_name text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  category_id uuid references public.categories(id),
  campus_location text,
  description text not null,
  offerings text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'UNDER REVIEW', 'APPROVED', 'REJECTED', 'CHANGES REQUESTED')),
  reference_code text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_media (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references public.business_applications(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  file_name text not null,
  bucket_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products_services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2),
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  role_name text not null check (role_name in ('super_admin', 'application_manager', 'content_manager', 'moderator')),
  granted_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  message text not null,
  type text not null default 'sms' check (type in ('sms', 'email', 'internal')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.application_activity_logs (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references public.business_applications(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_applications enable row level security;
alter table public.business_media enable row level security;
alter table public.products_services enable row level security;
alter table public.admin_roles enable row level security;
alter table public.notifications enable row level security;
alter table public.application_activity_logs enable row level security;

-- Basic public browsing policy: approved businesses only
create policy "Public can read approved businesses" on public.businesses
for select using (status = 'published');

create policy "Applicants can create applications" on public.business_applications
for insert with check (true);

create policy "Applicants can read their own applications" on public.business_applications
for select using (auth.uid() = applicant_profile_id or applicant_profile_id is null);

create policy "Admins can manage applications" on public.business_applications
for all using (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
);

create policy "Admins can manage businesses" on public.businesses
for all using (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
);

create policy "Admins can manage media" on public.business_media
for all using (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_roles ar
    join public.profiles p on p.id = ar.profile_id
    where p.id = auth.uid()
  )
);

create policy "Authenticated users can manage profiles" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Public can read categories" on public.categories for select using (true);

create index if not exists idx_businesses_status on public.businesses(status, is_featured);
create index if not exists idx_business_applications_status on public.business_applications(status, created_at);
create index if not exists idx_business_media_business on public.business_media(business_id);
create index if not exists idx_admin_roles_profile on public.admin_roles(profile_id, role_name);
