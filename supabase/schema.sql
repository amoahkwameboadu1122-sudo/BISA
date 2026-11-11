-- BISA application schema. Run after confirming the public schema has no BISA tables.
-- This does not create, update or delete Supabase Auth users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_content (key, value) values
  ('home.hero_title', '"Big ideas. Great finds. All on campus."'::jsonb),
  ('home.hero_text', '"Discover products, services and student businesses — and help great campus ideas find their people."'::jsonb),
  ('home.announcement', '""'::jsonb),
  ('contact.email', '"hello@bisa-campus.com"'::jsonb),
  ('contact.phone', '"+233 20 000 0000"'::jsonb),
  ('contact.location', '"Main Campus, Student Centre"'::jsonb)
on conflict (key) do nothing;

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_profile_id uuid references public.profiles(id) on delete set null,
  applicant_name text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  category_id uuid references public.categories(id),
  campus_location text,
  description text not null,
  offerings text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'UNDER REVIEW', 'APPROVED', 'REJECTED', 'CHANGES REQUESTED')),
  reference_code text not null unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.business_applications(id) on delete set null,
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

create table if not exists public.business_media (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.business_applications(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  file_name text not null,
  bucket_name text not null default 'business-media',
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  check (application_id is not null or business_id is not null)
);

create table if not exists public.products_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) check (price is null or price >= 0),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_name text not null check (
    role_name in ('super_admin', 'application_manager', 'content_manager', 'moderator')
  ),
  granted_at timestamptz not null default now(),
  unique (profile_id, role_name)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  application_id uuid references public.business_applications(id) on delete set null,
  recipient_phone text,
  template text,
  message text not null,
  type text not null default 'sms' check (type in ('sms', 'email', 'internal')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.application_activity_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.business_applications(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create unique index if not exists businesses_application_id_key
  on public.businesses(application_id) where application_id is not null;
create unique index if not exists business_media_storage_path_key
  on public.business_media(storage_path) where storage_path is not null;
create index if not exists idx_businesses_status on public.businesses(status, is_featured);
create index if not exists idx_business_applications_status on public.business_applications(status, created_at desc);
create index if not exists idx_business_media_application on public.business_media(application_id);
create index if not exists idx_business_media_business on public.business_media(business_id);
create index if not exists idx_products_services_business on public.products_services(business_id, is_featured);
create index if not exists idx_admin_roles_profile on public.admin_roles(profile_id, role_name);
create index if not exists idx_activity_application on public.application_activity_logs(application_id, created_at desc);
create index if not exists idx_notifications_application on public.notifications(application_id, created_at desc);

create or replace function public.bisa_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bisa_profiles_set_updated_at on public.profiles;
create trigger bisa_profiles_set_updated_at before update on public.profiles
for each row execute function public.bisa_set_updated_at();
drop trigger if exists bisa_applications_set_updated_at on public.business_applications;
create trigger bisa_applications_set_updated_at before update on public.business_applications
for each row execute function public.bisa_set_updated_at();
drop trigger if exists bisa_businesses_set_updated_at on public.businesses;
create trigger bisa_businesses_set_updated_at before update on public.businesses
for each row execute function public.bisa_set_updated_at();
drop trigger if exists bisa_products_services_set_updated_at on public.products_services;
create trigger bisa_products_services_set_updated_at before update on public.products_services
for each row execute function public.bisa_set_updated_at();
drop trigger if exists bisa_site_content_set_updated_at on public.site_content;
create trigger bisa_site_content_set_updated_at before update on public.site_content
for each row execute function public.bisa_set_updated_at();

create or replace function public.bisa_create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.review_business_application(
  p_application_id uuid,
  p_status text,
  p_notes text,
  p_actor_id uuid
)
returns public.business_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.business_applications%rowtype;
  updated_row public.business_applications%rowtype;
  business_row_id uuid;
begin
  if p_status not in ('PENDING', 'UNDER REVIEW', 'APPROVED', 'REJECTED', 'CHANGES REQUESTED') then
    raise exception 'Invalid application status.';
  end if;

  select * into application_row
  from public.business_applications
  where id = p_application_id
  for update;
  if not found then
    raise exception 'Application not found.';
  end if;

  update public.business_applications
  set status = p_status,
      notes = coalesce(p_notes, notes)
  where id = p_application_id
  returning * into updated_row;

  if p_status = 'APPROVED' then
    insert into public.businesses (
      application_id, owner_profile_id, business_name, category_id, description,
      offerings, campus_location, contact_phone, contact_email, status
    ) values (
      application_row.id, application_row.applicant_profile_id, application_row.business_name,
      application_row.category_id, application_row.description, application_row.offerings,
      application_row.campus_location, application_row.phone, application_row.email, 'draft'
    )
    on conflict (application_id) where application_id is not null
    do update set
      owner_profile_id = excluded.owner_profile_id,
      business_name = excluded.business_name,
      category_id = excluded.category_id,
      description = excluded.description,
      offerings = excluded.offerings,
      campus_location = excluded.campus_location,
      contact_phone = excluded.contact_phone,
      contact_email = excluded.contact_email,
      status = 'draft'
    returning id into business_row_id;

    update public.business_media
    set business_id = business_row_id
    where application_id = application_row.id;
  else
    update public.businesses
    set status = 'draft'
    where application_id = application_row.id and status = 'published';
  end if;

  insert into public.application_activity_logs (application_id, actor_profile_id, action, details)
  values (
    application_row.id,
    p_actor_id,
    'STATUS_' || replace(p_status, ' ', '_'),
    nullif(btrim(p_notes), '')
  );
  return updated_row;
end;
$$;

revoke all on function public.review_business_application(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.review_business_application(uuid, text, text, uuid) to service_role;

drop trigger if exists bisa_auth_user_created_profile on auth.users;
create trigger bisa_auth_user_created_profile after insert on auth.users
for each row execute function public.bisa_create_profile_for_auth_user();

insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1))
from auth.users
where email is not null
on conflict (id) do nothing;

insert into public.admin_roles (profile_id, role_name)
select id, 'super_admin'
from public.profiles
where lower(email) = lower('amoahkwameboadu1122@gmail.com')
on conflict (profile_id, role_name) do nothing;

insert into public.categories (name) values
  ('Fashion'),
  ('Food and Drinks'),
  ('Graphic Design'),
  ('Photography'),
  ('Technology'),
  ('Beauty and Personal Care'),
  ('Education and Tutoring'),
  ('Other Services')
on conflict (name) do nothing;

-- Application and administrator data are available only through the server API.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.business_applications enable row level security;
alter table public.businesses enable row level security;
alter table public.business_media enable row level security;
alter table public.products_services enable row level security;
alter table public.admin_roles enable row level security;
alter table public.notifications enable row level security;
alter table public.application_activity_logs enable row level security;
alter table public.site_content enable row level security;

drop policy if exists "Public can read approved businesses" on public.businesses;
drop policy if exists "Applicants can create applications" on public.business_applications;
drop policy if exists "Applicants can read their own applications" on public.business_applications;
drop policy if exists "Admins can manage applications" on public.business_applications;
drop policy if exists "Admins can manage businesses" on public.businesses;
drop policy if exists "Admins can manage media" on public.business_media;
drop policy if exists "Authenticated users can manage profiles" on public.profiles;
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can read published businesses" on public.businesses;
drop policy if exists "Public can read products for published businesses" on public.products_services;

revoke all on public.profiles, public.business_applications, public.business_media,
  public.admin_roles, public.notifications, public.application_activity_logs, public.site_content
  from anon, authenticated;
revoke all on public.businesses, public.products_services, public.categories from anon, authenticated;
grant select on public.businesses, public.products_services, public.categories to anon, authenticated;

create policy "Public can read published businesses" on public.businesses
for select to anon, authenticated using (status = 'published');
create policy "Public can read products for published businesses" on public.products_services
for select to anon, authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published')
);
create policy "Public can read categories" on public.categories
for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;
