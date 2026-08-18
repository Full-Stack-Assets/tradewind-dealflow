# Diligence room skeleton

Status: public template only  
Rule: never commit production PII, cap-table personal data, executed contracts, or partner metrics into this repository.

This folder is the **index and empty packet** a buyer would expect. Filled artifacts belong in a private, access-controlled location (local encrypted store, counsel workspace, or `docs/diligence/private/` which is gitignored).

## How to use

1. Copy each numbered template into the private packet.
2. Replace `TBD` fields with facts. Do not invent customers, revenue, or legal conclusions.
3. Keep the public copies in Git as the checklist of what still needs to exist.
4. Share the private packet only under NDA after the gates in `docs/superpowers/plans/2026-08-18-acquisition-readiness.md` pass.

## Packet index

| File | Contents | Public Git |
| --- | --- | --- |
| `01-entity-and-transaction.md` | Entity, what is sold, equity vs assets | Template only |
| `02-ip-assignment.md` | Contributor inventory and required assignment artifacts | Inventory yes; signed agreements no |
| `03-licenses-and-sbom.md` | First-party and third-party licenses | Dependency names yes; generated SBOM optional/private |
| `04-architecture.md` | Runtime, data stores, fail-closed providers | Yes |
| `05-security.md` | Controls that match shipped code | Yes |
| `06-provider-contracts.md` | Secrets and assignability | Names yes; keys and contracts no |
| `07-metrics.md` | ARR, logos, retention | Empty; no fabricated numbers |
| `../KNOWN_LIMITATIONS.md` | Honest product limits | Yes |

## Do not put in Git

- Real seller, owner, buyer, or partner records
- Proof-of-funds files
- Executed NDAs, assignment agreements, or cap tables with personal SSNs/EINs beyond what counsel requires in the private packet
- Live API keys
- A CIM that claims ARR or customer outcomes
