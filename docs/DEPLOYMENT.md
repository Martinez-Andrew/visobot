# Deployment Guide

## Services

- App/API: Vercel
- DB/Auth/Storage: Supabase
- Jobs: Inngest
- Billing: Stripe
- Rate limits: Upstash Redis

## Steps

1. Create Supabase project and run migration.
2. Configure Google OAuth + magic link in Supabase Auth.
3. Create Vercel project and set environment variables from `.env.example`.
4. Configure Stripe product/price (`STRIPE_PRO_PRICE_ID`) and webhook endpoint.
5. Configure Inngest endpoint to `/api/inngest`.
6. Set `DEV_BYPASS_AUTH=false` in production.
7. Run smoke checks:
   - sign in
   - connect provider
   - create chat
   - import file
   - search
   - checkout flow

## Production Safety Checklist

- `ENCRYPTION_KEY_BASE64` is 32-byte key and rotated policy defined.
- Supabase RLS enabled on all workspace tables.
- Stripe webhook secret configured.
- Error monitoring and alert routing enabled.
- Data export/delete endpoints tested on staging.
