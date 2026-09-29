# PinDou co-op and paid calls

Prepared 29 September 2026. Prices below are estimates in **USD**, except the explicitly marked Singapore Stripe example. No hosting, payment account or call service has been purchased or activated.

## What works and what needs setup

Free co-op needs one continuously running Node server. Hosts create a table and immediately see its invitation. Friends open it or paste it into **Join a friend**, enter a name, then join without an account. Beads, boxes, spills and cursors synchronize; edits queue during a temporary disconnect. Idle polling is slower and unchanged polls omit the artwork to reduce bandwidth.

Paid-call code uses Supabase email sign-in, Stripe monthly Checkout and customer portal, and private Daily Prebuilt calls. A paid member hosts; friends join the active call free using the co-op invitation. The call dock stays beside the artwork. Nothing requests camera/microphone access until a person explicitly joins, and both start off. Calls need HTTPS (localhost also works).

**Calls and payments are not live until your provider credentials and database are configured.** The app shows this explicitly; a Checkout success URL cannot activate a subscription. The migration and its access/allowance rules have been tested with a local PostgreSQL engine. Real payment, email and media behavior must be validated against your test accounts before launch.

## Starting budget

| Setup | App server | Auth / billing database | Base per month |
|---|---:|---:|---:|
| Small private pilot | Render 0.5 CPU / 512 MB: $7 | Supabase Free: $0 | **$7** |
| Suggested initial paid beta | Render 1 CPU / 2 GB: $25 | Supabase Pro: $25 | **$50** |

The $7 option has limited memory; measure your build/runtime and move up if needed. The $25 runtime is a starting recommendation, not a measured concurrency guarantee. Use Render's Hobby workspace when its features suffice; workspace upgrades add fees. Render Hobby includes 5 GB outbound bandwidth, then $0.15/GB. Images, downloads and co-op polling count toward usage. Domain registration, transactional email, taxes, payment fees and excess provider usage are extra. Free sleeping app runtimes are unsuitable for these in-memory rooms.

Sources: [Render pricing](https://render.com/pricing), [Render compute plans](https://render.com/docs/compute-plans), [Render free service behavior](https://render.com/docs/free), [Supabase pricing](https://supabase.com/pricing).

## Voice and video usage

Daily includes the first **10,000 participant-minutes per month**. In the next usage tier, video costs **$0.004 per participant-minute** and audio-only **$0.00099**. Participant-minutes = people connected × minutes connected. The free allowance is shared, not a separate 10,000 for each media type. If a session sends any video, including screen share, Daily bills that session at the video rate. PinDou voice rooms disallow both camera and screen-share sending server-side.

For two friends connected for 30 minutes: 60 participant-minutes; after the free allowance, about **$0.24 video** or **$0.0594 voice**. Four people for 30 minutes: $0.48 video or $0.1188 voice.

| Monthly video usage (two people, 30 minutes each) | Participant-minutes | Daily estimate after free allowance | Total with $50 base |
|---|---:|---:|---:|
| 100 sessions | 6,000 | $0 | **$50** |
| 500 sessions | 30,000 | $80 | **$130** |
| 1,000 sessions | 60,000 | $200 | **$250** |

These are calculated examples assuming no other usage on the Daily account. [Daily pricing](https://www.daily.co/pricing/video-sdk/) has graduated discounts above 100,000 minutes. The free allowance is not a spending cap; configure billing alerts and monitor usage.

## Proposed Plus allowance and price

The implementation starts with a bounded beta allowance: **5 hosted sessions per UTC calendar month**, **30 minutes per session**, **4 participants maximum including the host**, and **one concurrent hosted call per subscriber**. Friends need no subscription or account. Rejoining an unexpired call consumes no extra session. The timer starts when the server reserves the session, not when the last person arrives. Closing a window does not reset it. A provider failure reserves that same session for retry; an abandoned failed reservation can consume one allowance.

This gives a maximum of 600 participant-minutes per host per month, or $2.40 in video usage before Daily's free allowance. It is a proposed beta product policy, not a requirement from the user; change both the SQL migration and `lib/call-policy.ts` before launch if you choose different limits. Prices are read from the configured Stripe Price rather than hard-coded in the interface.

A possible launch price is **S$9.90/month**. For a Singapore account and domestic card, Stripe Payments currently charges 3.4% + S$0.50 and Billing adds 0.7%: approximately **S$0.91** per renewal, leaving **S$8.99** before infrastructure, tax, refunds and other costs. Hosting/call figures are USD, so convert at your actual settlement rate when evaluating margin. International cards and currency conversion can add fees. This is a pricing suggestion, not an activated plan.

Sources: [Stripe Singapore Payments](https://stripe.com/en-sg/pricing), [Stripe Billing](https://stripe.com/en-sg/billing/pricing).

## Configure a test environment

1. Create your own Supabase, Stripe and Daily accounts. Keep Stripe in test mode initially.
2. Apply `supabase/migrations/202609280001_paid_calls.sql` to your Supabase project. It creates private billing/subscription/call tables and a server-only reservation function. Browser roles have no table privileges. Reservations use transaction locks so simultaneous requests cannot exceed the allowance or create overlapping sessions.
3. Enable Supabase email sign-in. Change the email template to include `{{ .Token }}` for the code-entry flow. Set the public Site URL and configure a transactional SMTP provider for delivery to real users. See [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless).
4. Create a fixed recurring monthly Stripe Price, no trial, quantity one. Set `STRIPE_PLUS_PRICE_ID`. Enable Stripe's customer portal for payment updates and subscription cancellation; do not enable plan/quantity switching in the portal for this single-plan beta.
5. Register `/api/billing/webhook` for `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Use its signing secret. Only a verified webhook writes entitlement data; it retrieves the current Stripe subscription and applies updates through an atomic database function that rejects older events and prevents canceled subscriptions from reactivating. Payment failures suspend access when status ceases to be `active`. Cancellation at period end retains access until that period ends.
6. Put the values from `.env.example` in your hosting provider's environment settings. Only the Supabase URL, anon key and public app URL use `NEXT_PUBLIC_`. Stripe secret, webhook secret, Price ID, Supabase service role key and Daily API key stay server-side. Never paste secrets into committed source or a chat.
7. Deploy one Node process/instance. Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`. Start: `pnpm exec next start --hostname 0.0.0.0 --port $PORT`. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin before building. Public env values are compiled into the client.
8. Test email sign-in, successful and declined test payments, duplicate Checkout clicks, portal cancellation, webhook retries, guest joins with no auth, voice rooms rejecting video, camera/mic permission denial, five-session exhaustion, four-participant capacity, and forced disconnect at 30 minutes. Verify audio/video with two physical devices. Confirm Daily and Stripe dashboards match the expected usage before switching to live Stripe keys and Price ID.

## Operational limits to know

- Co-op artwork is still in process memory: rooms close on restart/deployment or 12 hours idle. Each browser saves a copy. Supabase stores billing and call reservations, not shared artwork. Use one process; serverless functions, multiple instances and autoscaling need a shared room store first.
- The existing cap is 100 rooms and 64 distinct peer IDs per room lifetime. Refreshing a tab currently creates another peer ID. These are defensive caps, not validated capacity targets.
- Next steps for a broader public launch are a persistent room/event store, abuse/rate controls at the edge, load tests, monitoring and a recovery path across deployments. A small controlled beta can run on the current one-instance model with the restart limitation disclosed.
- Call tokens are private, bound to a provider room and expire at the reservation deadline. New joins check the host's current stored entitlement. Existing tokens can remain usable until the call expires (at most 30 minutes), even if the host cancels immediately.
- Starting a call twice safely reuses its reservation and deterministic provider room name. Failed provider setup does not automatically create a fresh billable reservation on retry.
- The application does not record calls. Camera/microphone permission and controls are supplied by Daily Prebuilt; provider privacy settings still need to be reviewed for your account.
