# Deployment, Domain, Backup, and Rollback

Production target: OpenAI Sites  
Application mode: static-capable React/RSC worker with local browser persistence

## 1. Release verification

From a clean checkout with Node.js 22.13 or newer:

```bash
npm ci
npm test
npm run typecheck
npm run lint
```

The build must contain `/healthz`, and that endpoint must return:

```json
{
  "status": "ok",
  "service": "tradewind-dealflow",
  "release": "local-first",
  "outreach": "disabled"
}
```

No production release should contain user records or generated seed records.

## 2. Sites release discipline

1. Review `.openai/hosting.json`; reuse its exact Sites project ID once present.
2. Commit every source and asset change.
3. Push that exact commit through the hosting provider’s source credential.
4. Build the Sites source archive from the committed state, not from a dirty
   working tree.
5. Save a Sites version using the exact pushed commit SHA.
6. Deploy only that saved version.
7. Verify status, `/`, every workspace route, and `/healthz` at the production
   URL.
8. Record the version ID, commit SHA, deployment URL, verification time, and
   operator.

Never call the create-site operation a second time for the same application.
Treat all Sites IDs and cursors as opaque values.

## 3. Environment and secrets

Phase 1 requires no environment secret. `.env.example` lists future
configuration names but leaves all provider decisions unset. Do not add API
keys to client code, `.env.example`, git history, build logs, or screenshots.

The project has no D1 or R2 binding in Phase 1. Authentication, PostgreSQL,
queues, and encrypted object storage are Phase 2 work.

An optional multi-stage `Dockerfile` builds the same production worker and
serves it as a non-root user on port 3000 with a `/healthz` container check.
Sites does not use this container path. Build it where Docker is available:

```bash
docker build -t tradewind-dealflow:local-first .
docker run --read-only --tmpfs /tmp -p 3000:3000 tradewind-dealflow:local-first
```

## 4. Staging and production

Use separate Sites projects or isolated saved versions/access policies for
staging and production. Never import production seller or buyer data into a
test environment. Automated tests use clearly synthetic fixtures only inside
the test process.

Minimum promotion record:

- source commit SHA;
- build and test results;
- legal baseline date;
- reviewer for compliance-copy changes;
- saved Sites version ID;
- deployment URL;
- rollback version ID.

## 5. Existing-domain connection

Do not change DNS without explicit domain-owner authorization.

1. Obtain the exact custom-domain target and verification record from Sites.
2. In the authoritative DNS provider, choose only the record type Sites
   specifies:
   - `A` for an IPv4 address;
   - `AAAA` for an IPv6 address;
   - `CNAME` for a provider hostname, commonly a subdomain such as `app`.
3. Enter the exact host/name and value. Do not guess an IP or derive a target
   from the deployment URL.
4. Remove a conflicting record only after resolving its purpose and receiving
   approval.
5. Keep DNS TTL conservative during cutover, then restore the organization’s
   normal TTL after validation.
6. Complete Sites ownership verification and wait for managed TLS issuance.
7. Verify HTTPS, certificate hostname, canonical route behavior, mobile load,
   and `/healthz`.
8. Keep the previous deployment/domain route available until verification is
   complete.

The public marketing home can use the apex domain or `www`; the app can use a
subdomain such as `app` only after the owner chooses that structure.

## 6. Email-domain authentication

Phase 1 sends no email, so it does not require or justify a sender-domain DNS
change. Before a later email provider is activated:

- publish only the provider-supplied SPF include/record;
- enable DKIM using the exact selector and public key supplied by the provider;
- begin DMARC with a monitored policy approved by the domain owner and counsel,
  then tighten based on verified reports;
- keep transactional and marketing streams separated where practical;
- verify alignment, bounce/complaint handling, unsubscribe, and suppression;
- never publish guessed DNS records.

## 7. Monitoring and health

Monitor:

- HTTPS availability and latency for `/healthz`;
- home and one workspace route;
- certificate expiration/renewal state;
- deployment failures;
- client-side error rate only through a future privacy-reviewed provider that
  redacts property addresses, seller/buyer data, and free-form notes.

The health response proves that the release worker is responding and that the
declared release mode has not changed. It does not prove browser storage,
external government links, or a user’s local data are healthy.

## 8. Rollback

1. Stop further promotion.
2. Identify the last verified Sites version and its commit SHA.
3. Deploy that already saved version using the Sites rollback/version controls.
4. Verify `/healthz`, the home page, and critical workspaces.
5. Record the incident, failed version, restored version, times, and operator.
6. Fix forward in a new commit and saved version.

Do not rewrite git history or overwrite the broken release record. Browser data
uses a versioned schema; any future schema migration must include a tested
backward/rollback plan before deployment.

## 9. User-data backup and recovery

Application source backup and user workspace backup are separate:

- Source is recovered from the exact git commit and Sites version.
- User records are recovered only from that user’s exported JSON backup.

Recovery procedure:

1. Open a verified production deployment.
2. Export the current workspace if it contains any records worth preserving.
3. Choose **Import JSON** and select the intended backup.
4. Confirm the file passes schema validation.
5. Confirm replacement.
6. Review state selection, record totals, at least one property, one buyer if
   present, and compliance progress.
7. Export a new recovery-point JSON file.

Test restoration periodically with non-production test fixtures in an isolated
browser profile. Never use a real seller or buyer record in a public test.
