export const LAST_REVIEWED = "July 27, 2026";

export const curriculumModules = [
  {
    id: "module-01",
    number: "01",
    title: "Foundations, ethics & expectations",
    summary:
      "Understand the wholesale transaction, where value is created, and why a structured process is not a closing guarantee.",
    action: "Write your role statement and personal guardrails.",
    tool: "Expectations worksheet",
    check: "Explain the difference between controlling an interest and owning title.",
    completion: "Role statement and guardrails are complete.",
  },
  {
    id: "module-02",
    number: "02",
    title: "Massachusetts & Rhode Island lanes",
    summary:
      "Choose one state workflow at a time and identify principal, licensed, and counsel-review boundaries.",
    action: "Complete the state and participation-path decision guide.",
    tool: "State-lane checklist",
    check: "Identify the actions that can resemble brokerage for another.",
    completion: "A state lane and participation path are recorded.",
  },
  {
    id: "module-03",
    number: "03",
    title: "Business operating setup",
    summary:
      "Organize entity, banking, bookkeeping, insurance, and professional relationships before transaction pressure arrives.",
    action: "Create a professional setup gap list.",
    tool: "Vendor interview sheet",
    check: "Name the records that must stay separate from personal finances.",
    completion: "The setup gap list has owners and dates.",
  },
  {
    id: "module-04",
    number: "04",
    title: "Market selection",
    summary:
      "Build a focused market thesis using property facts, transaction activity, repair feasibility, and real buyer demand.",
    action: "Select no more than three initial markets.",
    tool: "Market scorecard",
    check: "Explain why demographic targeting is not an acquisition criterion.",
    completion: "Markets and objective selection reasons are recorded.",
  },
  {
    id: "module-05",
    number: "05",
    title: "Ethical lead sourcing",
    summary:
      "Research lawful public records and authorized providers while recording source, freshness, rights, and uncertainty.",
    action: "Document one authorized research workflow.",
    tool: "Source provenance log",
    check: "Distinguish a factual indicator from a motivation prediction.",
    completion: "A repeatable, source-dated research process exists.",
  },
  {
    id: "module-06",
    number: "06",
    title: "Value, repairs & exits",
    summary:
      "Use comparable evidence, repair ranges, holding costs, buyer economics, and sensitivity—not one universal percentage rule.",
    action: "Complete one analysis using only verified or clearly labeled inputs.",
    tool: "Deal Lab",
    check: "Explain why an ARV range can be more honest than a single number.",
    completion: "The analysis identifies assumptions and missing evidence.",
  },
  {
    id: "module-07",
    number: "07",
    title: "Compliant outreach planning",
    summary:
      "Separate direct mail, telephone, email, and consent-based messaging requirements before any campaign is launched.",
    action: "Build a channel-by-channel compliance checklist.",
    tool: "Outreach readiness gate",
    check: "Identify why a found phone number is not consent to text.",
    completion: "No channel is marked ready without its legal basis.",
  },
  {
    id: "module-08",
    number: "08",
    title: "Seller discovery & offers",
    summary:
      "Listen for the owner’s goals, verify decision-makers, and compare transparent solutions without pressure or false urgency.",
    action: "Practice a permission-based seller conversation.",
    tool: "Conversation review",
    check: "Name the questions that require voluntary disclosure.",
    completion: "A reviewed discovery outline and follow-up plan exist.",
  },
  {
    id: "module-09",
    number: "09",
    title: "Agreements, title & counsel",
    summary:
      "Understand contingencies, inspections, title review, closing professionals, and the line between education and legal advice.",
    action: "Interview a state-qualified real-estate attorney.",
    tool: "Counsel interview checklist",
    check: "Identify every event that requires professional review.",
    completion: "Counsel and closing-professional pathways are recorded.",
  },
  {
    id: "module-10",
    number: "10",
    title: "Buyer verification & marketing",
    summary:
      "Build a real buyer database, verify criteria and funds, and describe only the interest the member actually controls.",
    action: "Verify one real buyer profile or document why none exists yet.",
    tool: "Buyer workspace",
    check: "Explain legal-title and equitable-interest disclosure.",
    completion: "Buyer criteria and verification dates are evidence-backed.",
  },
  {
    id: "module-11",
    number: "11",
    title: "Transaction structures",
    summary:
      "Compare acquisitions, assignments, double closings, novations, financing structures, referrals, and responsible no-deal outcomes.",
    action: "Map required professionals and disclosures for each considered exit.",
    tool: "Structure comparison",
    check: "Identify structures that always require specialist review.",
    completion: "No complex structure is treated as a template transaction.",
  },
  {
    id: "module-12",
    number: "12",
    title: "Closing, accounting & scale",
    summary:
      "Prepare for closing, reconcile actual results, retain records, review failures, and scale only validated workflows.",
    action: "Create a closing and post-closing control list.",
    tool: "Transaction closeout",
    check: "Separate projected margin from realized margin.",
    completion: "A complete closeout and improvement loop is documented.",
  },
] as const;

export const executionWeeks = [
  "Choose your state lane and role",
  "Set up operating fundamentals",
  "Build a narrow market thesis",
  "Map lawful research sources",
  "Practice value and repair ranges",
  "Define a written buy box",
  "Complete outreach readiness review",
  "Practice seller discovery",
  "Build attorney and title relationships",
  "Create and verify buyer profiles",
  "Analyze transaction structures",
  "Prepare a Deal Desk packet",
  "Review evidence, gaps, and next 90 days",
] as const;

export const officialSources = [
  {
    group: "Massachusetts",
    title: "M.G.L. c. 112, § 87PP — broker definition",
    href: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87PP",
  },
  {
    group: "Massachusetts",
    title: "M.G.L. c. 112, § 87QQ — exemptions",
    href: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87QQ",
  },
  {
    group: "Massachusetts",
    title: "M.G.L. c. 112, § 87RR — unlicensed activity",
    href: "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXVI/Chapter112/Section87RR",
  },
  {
    group: "Rhode Island",
    title: "Public Law 2026, chapter 410 (H 7840 Substitute A)",
    href: "https://webserver.rilegislature.gov/PublicLaws/law26/law26410.htm",
  },
  {
    group: "Outreach",
    title: "Massachusetts Do Not Call registry guidance",
    href: "https://www.mass.gov/info-details/do-not-call-registry-for-residents-and-businesses",
  },
  {
    group: "Outreach",
    title: "201 CMR 12.00 — Massachusetts Do Not Call Registry",
    href: "https://www.mass.gov/regulations/201-CMR-1200-massachusetts-do-not-call-registry",
  },
  {
    group: "Outreach",
    title: "Rhode Island Telephone Sales Solicitation Act",
    href: "https://webserver.rilegislature.gov/Statutes/TITLE5/5-61/INDEX.htm",
  },
  {
    group: "Outreach",
    title: "Rhode Island Attorney General registration forms",
    href: "https://riag.ri.gov/about-our-office/divisions-and-units/civil-division/public-protection/consumer-protection-0",
  },
  {
    group: "Federal",
    title: "FTC Telemarketing Sales Rule",
    href: "https://www.ftc.gov/legal-library/browse/rules/telemarketing-sales-rule",
  },
  {
    group: "Federal",
    title: "FCC unwanted robocalls and texts guide",
    href: "https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts",
  },
] as const;

export const propertyResearchSources = [
  {
    state: "MA",
    title: "MassGIS standardized property tax parcels",
    href: "https://www.mass.gov/info-details/massgis-data-property-tax-parcels",
    note: "Statewide parcel starting point; verify against the municipality and registry.",
  },
  {
    state: "MA",
    title: "Massachusetts interactive property map",
    href: "https://www.mass.gov/info-details/massachusetts-interactive-property-map",
    note: "Public map for parcel research; displayed data is not a title opinion.",
  },
  {
    state: "RI",
    title: "Rhode Island land and tax records directory",
    href: "https://www.ri.gov/towns/landtaxdata/",
    note: "Links to participating municipal resources; coverage and currency vary.",
  },
] as const;

export const stateDecisionChecks = {
  MA: [
    "Record whether you are acting for yourself as a bona fide principal or through a licensed, supervised brokerage.",
    "Do not negotiate a transaction for another person for compensation unless counsel confirms a licensed pathway.",
    "Before marketing an interest, record an executed agreement, the actual interest controlled, and that legal title is not held.",
    "Obtain Massachusetts counsel review before execution or disposition.",
  ],
  RI: [
    "Treat recurring equitable-interest wholesaling as a licensed-path question before January 1, 2027.",
    "Use written seller and assignee disclosures reviewed by Rhode Island counsel.",
    "Track seller and assignee three-business-day cancellation periods separately.",
    "Do not mark an assignment ready while either recorded cancellation window is unresolved.",
  ],
} as const;

export const outreachChecklist = [
  "Business and state registration status verified",
  "National and applicable state Do Not Call suppression checked",
  "Channel-specific consent or other counsel-approved legal basis recorded",
  "Company suppression and prior opt-outs checked",
  "Calling hours and contact-frequency limits configured",
  "Caller identity and required disclosures approved",
  "Complaint and immediate opt-out process ready",
  "Campaign and template approved by a human",
] as const;

export const marketingChecklist = [
  "Executed agreement recorded",
  "Contractual or equitable-interest basis recorded",
  "Legal-title disclosure prepared",
  "Member is not negotiating for another party",
  "Applicable state attorney review recorded",
  "Only legally shareable documents selected",
] as const;
