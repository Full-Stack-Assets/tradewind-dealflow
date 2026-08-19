# 06 — Provider contracts and assignability

Status: names only; no live credentials  
Secrets stay in the deployment secret manager.

| Binding / variable | Purpose | In Git | Assignable? |
| --- | --- | --- | --- |
| D1 `DB` | Control plane, leads, opportunities | Schema only | TBD with host |
| OpenAI Sites project | Private app hosting | Opaque id in `.openai/hosting.json` | TBD with host |
| `RENTCAST_API_KEY` and activation flags | Optional owner enrichment | No | TBD — contract required |
| `OPENAI_API_KEY` | Draft field generation | No | TBD |
| `ELEVENLABS_*` | Webhook/outbound boundary; outreach disabled | No | TBD — do not enable for a demo |
| `SKIP_TRACING_API_KEY` / URL | Provider-neutral contract | No | TBD |
| MassGIS ArcGIS | Official parcels; no key in current adapter | N/A | Public endpoint; usage policy still required |

## Rules for a buyer demo

- Use synthetic or partner-authorized records only.
- Do not turn on outbound ElevenLabs execution to impress corp dev.
- Do not paste keys into chat, tickets, or this repository.
