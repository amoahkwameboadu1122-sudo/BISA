# BISA Supabase setup

This project is designed to be connected to Supabase for storage, permissions, application review and business publishing.

## 1. Create the project

1. Sign in to Supabase.
2. Create a new project named `bisa-marketplace`.
3. Copy the project URL and public anonymous key.
4. Keep the service-role key in a secure server-side environment only.

## 2. Required environment variables

Set the following values in Vercel or your deployment environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-secret
SMS_PROVIDER_API_KEY=your-sms-provider-key
SMS_PROVIDER_SENDER_ID=BISA
```

Never expose the service role key or SMS API secret in frontend JavaScript.

## 3. Run the SQL

Open the Supabase SQL editor and run the contents of `supabase/schema.sql`.

## 4. Create storage buckets

Create these buckets:

- `business-photos`
- `business-videos`
- `applicant-documents`

Use private or public policies according to your workflow. Public listing pages should only show approved and published businesses.

## 5. Authentication and roles

- Use email/password sign-in for administrators.
- Invite only trusted administrators.
- Maintain an `admin_roles` table with roles such as `super_admin`, `application_manager`, `content_manager`, and `moderator`.

## 6. RLS and workflow

- Applicants can submit applications but cannot approve or view other applications.
- Public visitors can only read approved and published business records.
- Admins can review, reject, approve, request more information and publish listings.

## 7. SMS integration

Use a server-side function or API endpoint to send SMS. Store the provider credentials on the server and never in frontend code.

## 8. File notes

This frontend currently stores the demo application flow in browser localStorage for a simple static version. To connect to Supabase in production, replace the client-side storage logic with a secure server endpoint or Supabase client that writes to the database and storage buckets.
