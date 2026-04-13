# PropEval Product Specification
## Functional & User Experience Document

**Document Version:** 1.0
**Date:** April 13, 2026
**Prepared by:** Get-It-Right (GTR) Product Team
**Classification:** Internal / Stakeholder Review
**Status:** Living Document

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Mission](#2-product-vision--mission)
3. [Market Context & Opportunity](#3-market-context--opportunity)
4. [Problem Statement](#4-problem-statement)
5. [User Personas](#5-user-personas)
6. [Product Overview](#6-product-overview)
7. [Core Workflows](#7-core-workflows)
8. [Feature Specifications](#8-feature-specifications)
9. [User Experience Specification](#9-user-experience-specification)
10. [Report Format & Content Standards](#10-report-format--content-standards)
11. [Pricing & Billing Model](#11-pricing--billing-model)
12. [Trust, Quality & Governance](#12-trust-quality--governance)
13. [Notifications & Communication](#13-notifications--communication)
14. [Configuration & Platform Controls](#14-configuration--platform-controls)
15. [Analytics & Reporting](#15-analytics--reporting)
16. [Mobile & Field Experience](#16-mobile--field-experience)
17. [Future Roadmap (Phases 13-16)](#17-future-roadmap-phases-13-16)
18. [Glossary of Terms](#18-glossary-of-terms)
19. [Appendices](#19-appendices)

---

# 1. Executive Summary

PropEval is a **B2B digital marketplace** that connects lending institutions (banks and NBFCs) with property valuation professionals (valuers and lawyers) through a managed platform operated by **Get-It-Right (GTR)**. The platform digitizes the entire lifecycle of property report procurement — from request creation and vendor matching, through report submission and quality review, to billing reconciliation and secondary marketplace trading of completed reports.

**In a single sentence:** PropEval makes it as easy for a bank to get a property valuation report as it is to order a ride on a cab aggregator — transparent pricing, automatic vendor matching, real-time tracking, and quality assurance built in.

### Why This Product Matters

Every property loan in India requires at least one independent valuation report. The Reserve Bank of India mandates it. Yet the process of getting that report is stuck in the 1990s — phone calls to empaneled valuers, email follow-ups, PDF reports arriving in inconsistent formats, manual billing reconciliation, and no visibility into turnaround time or quality. PropEval replaces this with a digital-first workflow that benefits all three participants:

| Participant | Current Reality | With PropEval |
|---|---|---|
| **Lender (Bank/NBFC)** | Calls 3-5 valuers, waits 3-10 days, gets inconsistent PDFs, reconciles bills manually | Creates a request in 2 minutes, gets matched vendor automatically, tracks status in real-time, downloads branded reports, auto-reconciled billing |
| **Vendor (Valuer/Lawyer)** | Depends on personal relationships for work, no digital presence, fills paper forms, chases payments | Receives broadcast notifications on mobile, accepts work instantly, uploads reports with AI-assisted data extraction, tracks earnings transparently |
| **GTR (Platform Operator)** | N/A (this role does not exist today) | Controls marketplace quality, sets pricing, manages onboarding, monitors SLAs, handles billing, builds trust through vendor scoring |

### Key Numbers

- **USD 330 billion** — India's home loan market (2024)
- **2.6 million** — New home loans issued in H1 FY2025-26 alone
- **3-5 million** — Estimated property valuation reports needed annually
- **3-10 working days** — Current average turnaround time for a valuation report
- **INR 139 billion** — Value of bank fraud in FY2024, much of it collateral-related
- **Zero** — India-native B2B platforms combining valuation + legal report procurement in one marketplace

---

# 2. Product Vision & Mission

## Product Vision

> **To become India's definitive infrastructure for property intelligence — the platform where every property loan report in the country is requested, delivered, and trusted.**

PropEval envisions a future where:
- No bank employee ever needs to make a phone call to find a valuer
- No qualified valuer lacks access to work because they don't have the right personal connections
- No property report sits unused in a filing cabinet when another lender needs the same information
- Every report is digitally structured, quality-scored, and instantly verifiable
- Fraud through inflated valuations becomes structurally impossible because the platform creates transparency, accountability, and audit trails

## Mission Statement

> **Get-It-Right (GTR) operates PropEval to bring transparency, speed, and trust to India's property valuation and legal due diligence ecosystem — connecting lending institutions with qualified professionals through fair pricing, intelligent matching, and platform-assured quality.**

## Product Principles

1. **Platform Neutrality** — GTR operates the marketplace but does not compete with vendors. GTR's role is to ensure quality, fairness, and compliance — not to favor any participant.

2. **Trust Through Transparency** — Every price is visible before commitment. Every status is tracked in real-time. Every billing entry is auditable. No hidden fees, no opaque processes.

3. **Vendor-First Mobile Experience** — Valuers and lawyers work in the field, not at desks. The vendor experience must be designed for a 5-inch screen, intermittent connectivity, and one-handed operation.

4. **Structured Data Over Documents** — A PDF is an endpoint, not the product. Every report's content is extracted, structured, validated, and made searchable. The platform trades in data, not files.

5. **Progressive Trust** — New vendors start with limited access and earn their way up through demonstrated quality. The platform's trust system protects lenders while giving new talent a fair on-ramp.

6. **Compliance by Design** — RBI mandates (dual valuation, independent valuers, revaluation cycles) are embedded in the workflow, not bolted on as afterthoughts.

7. **Zero Waste Reports** — Every completed report has residual value. The secondary marketplace (listings) ensures that a report commissioned by one lender can benefit others — reducing industry-wide duplication and cost.

## Success Metrics (Product KPIs)

| KPI | Target | Measurement |
|---|---|---|
| Request-to-Report Turnaround | < 3 working days (from request to report acceptance) | Median across all completed requests |
| Vendor First-Accept Rate | > 70% (reports accepted by lender without revision) | % of reports accepted on first submission |
| Listing Reuse Rate | > 15% of all lender report acquisitions come from listings | Listing purchases / (new requests + listing purchases) |
| Vendor Response Time | < 2 hours (from broadcast to accept/reject) | Median broadcast-to-response time |
| Platform NPS | > 40 (Lender), > 50 (Vendor) | Quarterly survey |
| Monthly Active Vendors | > 500 within 12 months of launch | Vendors who accepted at least 1 request or listed 1 report |
| Billing Accuracy | 100% reconciled — zero disputed invoices | Monthly audit |

---

# 3. Market Context & Opportunity

## The Indian Property Loan Ecosystem

India's real estate market is valued at **USD 585 billion (2026)** and is projected to reach **USD 1.26 trillion by 2034**. The housing loan market alone stands at **USD 330 billion**, with 2.6 million new loans worth INR 8.3 trillion issued in just the first half of FY2025-26.

Every one of these loans requires independent property assessment. The Reserve Bank of India (RBI) mandates that all banks maintain board-approved policies for property valuation. Loans above INR 1 crore with collateral exceeding INR 50 lakh require **two independent valuations**. Performing assets must be revalued every three years; non-performing assets annually.

This creates a market of an estimated **3-5 million valuation reports annually** — a number that grows with every new loan, every revaluation cycle, and every NPA review.

## The Lending Participants

**Public Sector Banks** (50.3% of housing loans): SBI, Bank of Baroda, PNB, Union Bank — large empanelment lists, slow-moving processes, strong compliance focus.

**Private Banks** (23.3%): HDFC Bank, ICICI, Axis, Kotak — faster adoption of digital tools, willing to pay premium for speed and quality.

**Housing Finance Companies & NBFCs** (26.4%): Bajaj Housing Finance, LIC Housing, Aditya Birla Finance, PNB Housing — aggressive growth, digital-first mindset, smaller empanelment pools, strong need for vendor discovery.

## The Vendor Supply Side

India has approximately **15,000 empaneled property valuers**, but only about **4,000 are actively working**. The Insolvency and Bankruptcy Board of India (IBBI) maintains the official registry of Registered Valuers across three asset classes (Land & Building, Plant & Machinery, Securities/Financial Assets).

Valuers range from individual practitioners to mid-size firms (5-20 engineers/valuers) to large practices with RICS accreditation. Most are concentrated in metros and Tier-1 cities, creating significant coverage gaps in Tier-2/3 markets where lending is growing fastest.

Legal practitioners (advocates specializing in property title search and due diligence) are even more fragmented — typically solo practitioners or small firms with no digital presence whatsoever.

## Competitive Landscape

| Competitor | What They Do | What They Don't Do |
|---|---|---|
| **Valocity** (NZ-origin) | Connects 20 Indian lenders with 7,000+ valuers via mobile app; geotagged site visits; bank-specific templates | No legal reports; no secondary marketplace; no India-native compliance layer; no vendor scoring/trust system |
| **Sigmavalue** | AI-driven AVM (Automated Valuation Model), PropGPT for data analytics | Not a marketplace; no vendor dispatch; no report procurement workflow |
| **BuildIQ** | Digital workflow for Approved Project Finance (APF) process | Developer/project-focused, not individual property transactions |
| **NoBroker Legal** | Consumer-facing legal services for property title verification | Consumer-facing; not structured for B2B bank-vendor workflows |
| **PropEquity** | Property data and analytics for developers/investors | Not a valuation-for-lending marketplace |

**PropEval's Unique Position:** No existing platform in India combines: request dispatch + vendor broadcast matching + valuation AND legal report workflows + OCR data extraction + secondary marketplace + billing/invoicing + vendor trust scoring — all within a GTR-operated neutral marketplace. This is the gap PropEval fills.

## Regulatory Tailwinds

Several regulatory developments actively support PropEval's timing:

1. **IBBI Registered Valuers Framework** — Creates a standardized credential that PropEval can verify and display
2. **RBI Early Warning System mandate (2024)** — Forces NBFCs to have structured collateral monitoring, which PropEval's data layer enables
3. **CERSAI (Central Registry)** — Enables double-mortgage detection; PropEval can integrate this check
4. **Account Aggregator Framework** — Moves lending toward digital-first data exchange; property reports are the next frontier
5. **DigiLocker** — KYC documents already digital; property documents moving in the same direction

---

# 4. Problem Statement

## For Lending Institutions

### Problem 1: Finding the Right Vendor is Manual and Relationship-Dependent

A bank branch manager in Tier-2 city Hubli needs a property valuation for a home loan application. Their empanelment list has 12 valuers. Three are inactive. Two don't cover the specific locality. The branch manager makes phone calls, sends WhatsApp messages, and waits for responses. If no one is available, they escalate to the regional office. This takes 1-3 days before work even begins.

**PropEval Solution:** The lender creates a request in 2 minutes. The platform's broadcast system automatically identifies eligible vendors based on service area, availability, pricing threshold, and trust tier — and sends the request to matched vendors simultaneously. First vendor to accept gets the assignment. If all decline, the system automatically broadcasts to the next set. Zero phone calls required.

### Problem 2: No Visibility into Report Progress

After assigning a valuation, the bank has no way to track progress. Did the valuer visit the site? When will the report arrive? Is it stuck somewhere? The only option is to call the valuer and ask. For a bank processing hundreds of loans monthly, this creates an enormous coordination overhead.

**PropEval Solution:** Every request has a real-time status timeline visible to the lender: Sent → Accepted → Site Visit Scheduled → Report Uploaded → Under Review → Accepted. WebSocket-driven notifications alert the lender the moment a status changes. Auto-accept rules ensure reports don't sit unreviewed indefinitely.

### Problem 3: Inconsistent Report Quality and Format

Different valuers submit reports in wildly different formats. Some use Word documents, some submit scanned handwritten forms, some use their own PDF templates. The data points captured vary. There's no structured data — just unstructured documents that a credit analyst must manually read and interpret.

**PropEval Solution:** Every uploaded PDF goes through AI-powered OCR extraction (Claude Vision) that converts it into structured, validated data. Vendors review and confirm extracted fields before publishing. Lenders can download reports in their own branded template format with standardized field ordering. The platform trades in structured data, not just files.

### Problem 4: Duplicate Valuation Spend

Three different banks each commission a fresh valuation for the same property within 6 months because they don't know a recent report already exists. The industry collectively wastes millions on redundant work.

**PropEval Solution:** The Listings Marketplace makes published reports discoverable (with PII redacted). A lender can search by pin code, property type, and locality to find existing reports and purchase them at a fraction of the new-request price — instant access, no waiting.

### Problem 5: Billing is a Monthly Nightmare

Banks receive invoices from dozens of valuers, each in different formats, with different payment terms. Reconciling valuation fees against loan files is a manual, error-prone process.

**PropEval Solution:** Every transaction creates automatic billing entries. Monthly invoices are generated by the platform with structured numbering (GTR-PAY-YYYY-MM-NNNN). Lenders see a single dashboard of all payables with drill-down to individual transactions. CSV exports for ERP integration.

## For Vendors (Valuers & Lawyers)

### Problem 6: New Talent Can't Break In

A freshly qualified IBBI-registered valuer has the skills but not the relationships. Banks empanel valuers through lengthy processes that favor established firms. There's no marketplace where new talent can demonstrate capability and earn work on merit.

**PropEval Solution:** Progressive trust tiers (New → Verified → Top Valuer) give new vendors a starter path. They begin with simpler assignments, build a track record on the platform, earn ratings from lenders, and gradually unlock access to higher-value work and marketplace features.

### Problem 7: Chasing Payments

Valuers complete reports and then wait 30-60 days for payment. There's no transparency into when or how much they'll be paid. Disputed amounts require phone calls and emails.

**PropEval Solution:** Every completed report immediately generates a VendorEarning record with the exact amount. Monthly invoices are generated automatically. Vendors see their receivables dashboard with month-wise breakdown, invoice status (Pending → Billed → Paid), and CSV export for their own accounting.

### Problem 8: Wasted Reports

A valuer completes a detailed report for Bank A. Six months later, Bank B needs the same property valued. The valuer can't easily monetize their existing work because there's no marketplace for it.

**PropEval Solution:** Vendors can list published reports on the marketplace with a single toggle. Every purchase generates passive income. The platform handles PII redaction, pricing, payment, and delivery automatically.

## For the Industry

### Problem 9: Fraud Through Inflated Valuations

Borrowers collude with valuers to inflate property values, enabling loans larger than the property can support. When defaults happen, the bank discovers the collateral is worth a fraction of what was reported. RBI reported INR 139 billion in bank fraud in FY2024, with overvalued collateral being a primary mechanism.

**PropEval Solution:** Platform-level quality scoring, lender ratings, mandatory structured data extraction, trend analysis across multiple reports for the same area, and audit trails create structural accountability. Vendor trust tiers incentivize honest reporting because a vendor's livelihood depends on their platform reputation, not a single relationship.

---

# 5. User Personas

## Persona 1: Rajesh — Branch Credit Manager (Lender)

**Role:** Branch Manager at a mid-size private bank in Bengaluru
**Age:** 38 | **Experience:** 12 years in banking
**Device:** Desktop (primary), Laptop, occasionally iPad

**Goals:**
- Process home loan applications within the 15-day TAT his bank promises customers
- Ensure property valuations are accurate and defensible to auditors
- Minimize time spent on vendor coordination so he can focus on credit decisions

**Pain Points:**
- Spends 2-3 hours/week chasing valuers for report status updates
- Gets inconsistent report formats that his analysts struggle to compare
- Has had two cases in the past year where the auditor questioned valuation quality
- Year-end billing reconciliation with 8 different valuers takes his team a full week

**How PropEval Helps:**
- Creates requests in minutes, tracks them on a real-time dashboard
- Downloads reports in his bank's branded template with standardized fields
- Rates vendors after each engagement, building a reliable quality signal
- Gets auto-generated monthly invoices with zero manual reconciliation

**Key Scenarios:**
- Monday morning: reviews 5 pending loan files, creates 3 new valuation requests
- Mid-week: checks dashboard for incoming reports, accepts 2, sends 1 back for revision
- Friday: browses listings marketplace for a property his customer mentioned — finds an existing report, purchases it, saves 5 days

---

## Persona 2: Meena — Independent Property Valuer (Vendor)

**Role:** IBBI-Registered Valuer, solo practitioner in Pune
**Age:** 45 | **Experience:** 18 years in property valuation
**Device:** Android smartphone (primary), basic laptop at home office

**Goals:**
- Get a steady stream of valuation assignments without depending on personal contacts at banks
- Complete reports efficiently using mobile tools
- Get paid promptly and transparently

**Pain Points:**
- Empaneled with 3 banks but only gets 4-5 assignments per month (wants 15+)
- Spends significant time on administrative paperwork and billing follow-up
- Cannot monetize the hundreds of reports she's completed over the years
- Has qualifications (IBBI-registered, MRICS) but no digital presence to showcase them

**How PropEval Helps:**
- Receives broadcast notifications on her phone the moment a matching request comes in
- Accepts work with one tap while on-site at another property
- Uploads report PDFs; AI extracts the data automatically — she just reviews and confirms
- Bulk-uploads her archive of 200+ historical reports and lists them for passive income
- Sees her earnings dashboard, trust tier progress, and quality score

**Key Scenarios:**
- On-site at 10am: phone buzzes with new broadcast for residential valuation in Kothrud — accepts immediately
- 3pm: back at office, uploads the completed PDF; reviews the AI-extracted data, corrects one field, publishes
- Weekend: bulk-uploads 50 old reports from her archives, toggles them to "Listed"
- Month-end: checks receivables dashboard — 12 reports completed, 3 listing downloads, total earnings INR 1,85,000

---

## Persona 3: Sunita — Legal Associate (Vendor — Lawyer)

**Role:** Property law associate at a 4-person law firm in Chennai
**Age:** 32 | **Experience:** 7 years in property law
**Device:** Android smartphone + Desktop at office

**Goals:**
- Build her firm's reputation with lending institutions
- Streamline the title search and legal opinion workflow
- Get more legal due diligence assignments beyond her current 2-bank network

**Pain Points:**
- Legal due diligence takes 2-4 weeks through traditional sub-registrar visits
- Banks pay INR 3,000-8,000 per legal opinion — barely covers the effort
- Her firm has no visibility to banks outside their personal network
- Duplicate effort: same property's title searched multiple times by different banks

**How PropEval Helps:**
- Receives legal report requests through the same platform as valuation requests
- Can list completed legal opinions for other lenders to purchase
- Builds a public profile with specializations, rating, and completed job count
- Progressive trust tier incentivizes quality and unlocks higher-value assignments

---

## Persona 4: Amit — GTR Operations Manager (Admin)

**Role:** Platform Operations Lead at Get-It-Right
**Age:** 35 | **Experience:** 8 years in fintech operations
**Device:** Desktop (multiple monitors)

**Goals:**
- Ensure smooth platform operations — no request goes unserviced
- Maintain vendor quality standards across the marketplace
- Manage billing cycles accurately and on time
- Onboard new lenders and vendors efficiently

**Pain Points (before PropEval):**
- N/A — GTR is created specifically to operate PropEval

**How PropEval Helps:**
- Admin dashboard shows platform-wide metrics: open requests, vendor performance, billing status
- Can configure system parameters (broadcast size, acceptance windows, auto-accept thresholds) without code changes
- Onboards lenders and vendors through admin UI — creates accounts, sets up pricing, defines service areas
- Monitors activity logs for compliance and audit purposes
- Manages monthly invoice generation and payment status tracking

**Key Scenarios:**
- Morning: checks admin dashboard — 3 open requests with no vendor acceptance after 2 rounds; manually reviews broadcast eligibility
- Midday: onboards a new NBFC — creates lender account, sets up 15 pricing rules across 4 cities
- Weekly: reviews vendor quality scores, identifies 2 vendors trending toward demotion, initiates outreach
- Monthly: triggers invoice generation, reviews billing summaries, exports CSV for finance team

---

## Persona 5: Priya — Bank Credit Analyst (Lender User)

**Role:** Credit Analyst at an HFC in Mumbai
**Age:** 28 | **Experience:** 3 years
**Device:** Desktop

**Goals:**
- Quickly review incoming valuation reports against loan application data
- Ensure report data is complete and consistent before forwarding for approval
- Request updates or nearby reports when property conditions warrant

**How PropEval Helps:**
- Receives notifications when reports arrive; opens structured data view alongside original PDF
- Uses the branded template download for standardized presentation to approving authority
- Requests updates on previously valued properties when borrowers report construction changes
- Searches listings for comparable reports in the same pin code/locality

---

# 6. Product Overview

## Platform Structure

PropEval is a **three-portal marketplace** with distinct experiences for each participant type:

```
                    +-------------------+
                    |    GTR Admin      |
                    |   (Marketplace    |
                    |    Operator)      |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v---------+
    |   Lender Portal   |       |   Vendor Portal     |
    |  (Banks / NBFCs)  |       | (Valuers / Lawyers) |
    +-------------------+       +---------------------+
```

**Lender Portal** — Where lending institutions raise requests, review reports, browse the marketplace, manage billing, and configure their preferences.

**Vendor Portal** — Where valuers and lawyers receive work, submit reports, manage their marketplace listings, track earnings, and build their professional profile.

**Admin Portal** — Where GTR manages the entire ecosystem: onboarding, pricing, system configuration, billing, quality monitoring, and audit.

## Access Model

PropEval is an **invite-only B2B platform**. There is no self-registration.

- GTR Admin creates all Lender and Vendor organization accounts
- Within their organization, Lenders and Vendors can manage their own internal users
- Every user has a defined role with specific permissions (RBAC — Role-Based Access Control)

### Lender Roles

| Role | Capabilities |
|---|---|
| **Org Admin** | Full access: manage users, configure templates, set preferences, view all branches |
| **Branch Admin** | Manage users within their branch, view branch-level data |
| **Requester** | Create requests, browse listings, purchase reports |
| **Analyst** | Review incoming reports, accept/reject, request updates |

### Vendor Roles

| Role | Capabilities |
|---|---|
| **Vendor Admin** | Full access: manage users, configure settings, view all reports and earnings |
| **Office Admin** | Manage users, view reports — cannot change configuration |

### GTR Admin Roles

| Role | Capabilities |
|---|---|
| **GTR Admin** | Full platform access including revenue figures, billing, and system configuration |
| **GTR Ops** | Full operational access but cannot see revenue/financial numbers |

## Authentication

- **Lender users:** Email + password login (office-based workflow)
- **Vendor users:** Mobile number + OTP login (field-friendly, no password to remember)
- Both methods supported across all portals; the default differs by portal
- Password reset via email link
- JWT-based session management with automatic token refresh

---

# 7. Core Workflows

## Workflow 1: New Report Request (The Primary Revenue Flow)

This is the central workflow of PropEval — a lender needs a property report, and the platform orchestrates getting it done.

### Step-by-Step Flow

```
LENDER                          PLATFORM                         VENDOR
  |                                |                                |
  | 1. Create Request              |                                |
  |  (property details,            |                                |
  |   report type, city,           |                                |
  |   pin code, property type)     |                                |
  |------------------------------->|                                |
  |                                |                                |
  |                                | 2. Calculate Price              |
  |                                |  (pricing engine lookup)        |
  |                                |                                |
  | 3. Confirm Price               |                                |
  |  (shown before submit)         |                                |
  |------------------------------->|                                |
  |                                |                                |
  |                                | 4. Match Vendors                |
  |                                |  (service area + availability   |
  |                                |   + price threshold + tier)     |
  |                                |                                |
  |                                | 5. Broadcast Round 1            |
  |                                |  (send to up to 5 vendors)     |
  |                                |-------------------------------> |
  |                                |                                |
  |                                |                   6. Accept/Reject
  |                                |                   (30-min window)
  |                                | <-------------------------------|
  |                                |                                |
  |                                | [If all reject: Round 2, 3...] |
  |                                |                                |
  |                                | 7. Assignment Confirmed         |
  | <------------------------------|-------------------------------> |
  |  (notification: vendor         |                (notification:   |
  |   accepted your request)       |                 you've been     |
  |                                |                 assigned)       |
  |                                |                                |
  |                                |                   8. Upload PDF |
  |                                | <-------------------------------|
  |                                |                                |
  |                                | 9. OCR Extraction               |
  |                                |  (AI extracts structured data)  |
  |                                |                                |
  |                                |                  10. Review &   |
  |                                |                      Publish    |
  |                                | <-------------------------------|
  |                                |                                |
  | 11. Report Received            |                                |
  |  (notification + dashboard)    |                                |
  | <------------------------------|                                |
  |                                |                                |
  | 12. Accept or Send Back        |                                |
  |------------------------------->|                                |
  |                                |                                |
  | [If Send Back: vendor revises, |                                |
  |  re-uploads, cycle repeats]    |                                |
  |                                |                                |
  | 13. ACCEPTED                   |                                |
  |------------------------------->|                                |
  |                                | 14. Billing Created             |
  |                                |  (VendorEarning + LenderPayable)|
  |                                |                                |
  |                                | 15. Listing Created/Updated     |
  |                                |  (report added to marketplace)  |
  |                                |                                |
  | 16. Download Report            |                                |
  |  (original or branded template)|                                |
```

### Key Business Rules

1. **Vendor Matching:** The platform selects vendors based on:
   - Service area match (city + report category → service type)
   - Vendor's price threshold (vendors who set a minimum price below the request price are excluded)
   - Vendor's lender exclusion list (vendors who have excluded this lender are skipped)
   - Vendor trust tier (in future phases, starter-tier vendors are limited to eligible request types)

2. **Broadcast Rounds:** Vendors are sent the request in batches (default: 5 per round). Each round has a time window (default: 30 minutes). If all vendors in a round decline or the window expires, the next batch is contacted. This continues until a vendor accepts or all eligible vendors are exhausted.

3. **Direct Assignment:** Lenders can optionally specify a preferred vendor. If specified, the request goes directly to that vendor (no broadcast). If the preferred vendor declines and the lender has enabled "allow broadcast on reject," the request falls through to the standard broadcast process.

4. **Vendor Rejection Reasons:** When declining a request, vendors must select a reason:
   - *Low Price* — the offered rate is below their expectations
   - *Not Available* — scheduling conflict
   - *Do Not Want to Share* — vendor prefers not to work with this lender/property

5. **Auto-Accept:** If a lender does not review a received report within 7 days (configurable), the system automatically accepts it — triggering billing and listing creation. This prevents reports from sitting in limbo indefinitely.

6. **Revisions:** When a lender sends a report back, they must provide comments explaining what needs to change. The vendor re-uploads a revised PDF (original preserved for audit). The review cycle repeats until accepted.

7. **On Acceptance:** Three things happen simultaneously:
   - A VendorEarning record is created (money owed to the vendor)
   - A LenderPayable record is created (money owed by the lender)
   - The report is added to (or updates) a Listing in the marketplace, grouped by pin code + property type

---

## Workflow 2: Listings Marketplace (The Secondary Market)

The listings marketplace is PropEval's "Airbnb for property reports" — vendors list completed reports, and other lenders can discover and purchase them.

### How Listings Work

```
VENDOR                          PLATFORM                         LENDER
  |                                |                                |
  | 1. Toggle "List on             |                                |
  |    Marketplace"                |                                |
  |------------------------------->|                                |
  |                                |                                |
  |                                | 2. Report added to             |
  |                                |    Listing Group               |
  |                                |    (pin_code + property_type)  |
  |                                |                                |
  |                                |                   3. Browse     |
  |                                |                   Listings      |
  |                                |                   (filter by    |
  |                                |                    city, pin,   |
  |                                |                    type)        |
  |                                | <-------------------------------|
  |                                |                                |
  |                                | 4. Show PII-Redacted           |
  |                                |    Preview                     |
  |                                |-------------------------------> |
  |                                |                                |
  |                                |                   5. Purchase   |
  |                                |                   (instant)     |
  |                                | <-------------------------------|
  |                                |                                |
  |                                | 6. Billing Created             |
  |                                | 7. Full Access Granted         |
  |                                |                                |
  |  (notification:                |                                |
  |   report downloaded)           |                   8. Download   |
  | <------------------------------|-------------------------------> |
```

### Key Business Rules

1. **Listing Grouping:** Reports are automatically grouped by `pin_code + property_type`. A "listing" is not a single report — it's a collection of reports about the same type of property in the same pin code area, potentially from multiple vendors.

2. **PII Redaction (Pre-Purchase):** When browsing listings, lenders see redacted information:
   - Property address: street/house number removed, only locality + city shown
   - Loan applicant name: completely hidden
   - Valuation amount: completely hidden
   - Plot/built-up area: rounded to nearest 100 sq ft
   - Coordinates: rounded to ~1.1km precision
   After purchase, full unredacted data and PDF download are available.

3. **Purchase is Instant and Permanent:** No vendor approval required. Once purchased, the lender has permanent access — no expiry, no revocation.

4. **One Purchase Per Report Per Lender:** A lender organization can only purchase a specific report once (prevents duplicate billing).

5. **Vendor Control:** Vendors actively choose to list or delist reports. Auto-listing can be enabled in vendor settings so that accepted reports are automatically listed without manual action.

6. **Lender Exclusions:** If a vendor has added a specific lender to their exclusion list, that lender will not see any of that vendor's listings. This is transparent to the lender — excluded listings simply don't appear in browse results.

---

## Workflow 3: Update Request

When a lender has an existing report (from a request or listing purchase) but needs updated information — perhaps the property has undergone construction changes, the report has aged, or market conditions have shifted significantly.

### Flow

1. Lender clicks "Request Update" on an existing report (from listing detail or purchased reports page)
2. A dialog appears with a **predefined checklist** of update areas:
   - Recheck valuation amount
   - Verify boundaries
   - Update photographs
   - Verify occupancy status
   - Update construction status
   - Verify legal/title status
   - Other (free text)
3. Lender selects applicable items and adds optional comments
4. System creates a request linked to the parent report, priced at the `update_additional_price`
5. The **same vendor** who created the original report is directly assigned (no broadcast)
6. If the vendor declines and "allow broadcast on reject" is enabled, the request falls to standard broadcast
7. Full OCR pipeline applies to the updated report
8. On acceptance, a new listing entry is created (the original report remains listed separately)

---

## Workflow 4: Nearby Property Request

When a lender needs a fresh evaluation on a property adjacent to or near an already-reported property — common for collateral assessment of adjacent land, or when the borrower's property is close to a previously valued one.

### Flow

1. Lender clicks "Request Nearby Report" on a listing header
2. A dialog appears with:
   - Original property reference details (pre-filled, read-only)
   - New property address form (street, locality, city, pin code)
   - Optional notes
3. System creates a request linked to the reference report, priced at the `nearby_additional_price`
4. The same vendor as the reference report is directly assigned
5. If the vendor declines, broadcast fallback applies
6. Full OCR pipeline applies; new report creates its own listing entry

---

# 8. Feature Specifications

## 8.1 Account & User Management

### Organization Onboarding (Admin Only)

**Lender Account Creation:**
- Organization name, primary contact, city, registration details
- Branch creation: branch name, city, area, address
- User assignment: name, email, mobile, role, branch

**Vendor Account Creation:**
- Organization name, office city, office area, services offered (Valuation / Legal / Both)
- Service area definition: for each service type, specify city + specific areas covered
- User assignment: name, email, mobile, role

**Key Rules:**
- Only GTR Admin can create organizations — no self-signup
- Organizations can manage their own users within their settings
- Deactivation (soft delete) supported — deactivated users cannot log in but records are preserved

### User Settings (Per Portal)

**Lender Settings Tabs:**
1. **Users** — Manage internal users (add, edit, deactivate)
2. **Report Template** — Configure branded report download format (see Section 8.5)
3. **Configuration** — Per-vendor auto-approve preferences, other preferences

**Vendor Settings Tabs:**
1. **Users** — Manage internal users
2. **Configuration** — Auto-listing toggle, price threshold, lender exclusion list

---

## 8.2 Request Management

### Lender: Creating a Request

**Step 1 — Property Details:**
- Property address (street, locality, city, pin code)
- Property type (Residential / Commercial / Industrial / Mixed-Use)
- Loan applicant name
- Latitude/Longitude (optional)

**Step 2 — Report Configuration:**
- Report category: Valuation or Legal
- Preferred vendor (optional — dropdown of known vendors)
- Allow broadcast on reject (toggle, shown if preferred vendor selected)
- Additional notes (free text)

**Step 3 — Price Confirmation:**
- System displays the calculated price (from pricing engine)
- Breakdown shown: base price, any area-specific premium
- "Submit Request" button to confirm

### Lender: Request List View
- Filterable by status, date range, request type (New / Update / Nearby)
- Status badges: Sent (grey), Awaited (amber), Received (blue), Accepted (green)
- Type badges: Update (orange), Nearby (blue), no badge for New
- Each row links to the request detail page

### Lender: Request Detail View
- Visual status timeline (Sent → Awaited → Received → Accepted)
- Property details summary
- Report preview (when received) with extracted data fields
- Actions: Accept / Send Back (with required comment field)
- Download button: "Download (My Template)" / "Download (Original)" split button

### Vendor: Request List View
- Three tabs: **Incoming** (broadcast requests awaiting response), **Pending** (accepted, awaiting upload), **Completed**
- Incoming tab shows countdown timer (remaining broadcast window)
- Status badges with prominent Accept/Reject buttons

### Vendor: Request Detail View
- Property details, lender info, offered price
- For Update requests: parent report context + checklist items prominently displayed
- For Nearby requests: original address alongside new address (side-by-side)
- Upload area (drag-drop PDF, max size as per system config)
- After upload: extraction review form → Publish button

---

## 8.3 OCR & Report Data Extraction

### What Happens When a PDF is Uploaded

1. **Compression:** PDF is losslessly compressed (pikepdf) to reduce processing payload
2. **Page Conversion:** Each page is converted to an image
3. **AI Extraction:** Images sent to Claude Vision API, which extracts structured data
4. **Data Structuring:** Results stored as JSON with two sections:
   - **Anchor Fields** — Standard fields expected in every report: property address, property type, valuation amount, built-up area, owner name
   - **Additional Fields** — Any other fields the AI identifies as relevant
5. **Confidence Scoring:** Each extracted field gets a confidence score (0-100%)

### Vendor Review Experience

When a report is in "Ready to Publish" status, the vendor sees:

- **Extraction Review Form** with all fields displayed
- **Confidence Indicators** per field:
  - Green (90%+): high confidence, likely correct
  - Yellow (60-89%): moderate confidence, should verify
  - Red (<60%): low confidence, manual verification needed
- **"View Original" button** opens the PDF in a side panel for cross-referencing
- **Editable fields** — vendor can correct any extracted value
- **"Add Field" button** — vendor can add custom key-value pairs
- **Save Draft** — saves progress without publishing
- **Publish** — validates mandatory fields, then makes the report available

### Mandatory Fields for Publishing
- Property address
- Property type
- Valuation amount

These must be filled (either by AI extraction or manual entry) before a report can be published.

### Bulk Upload

For vendors with a backlog of historical reports:
- Multi-file picker: select up to 50 PDFs at once
- Each file enters the OCR pipeline independently
- Bulk job status page shows per-file progress
- Failed extractions can be retried individually or as a group
- Successfully extracted reports appear in the vendor's report list for review and publishing

---

## 8.4 Listings Marketplace

### Listing Structure

A "listing" is a group of reports sharing the same **pin code + property type**. For example:
- Pin code 560034 + Residential = one listing (may contain reports from 3 different vendors)
- Pin code 560034 + Commercial = a separate listing

### Listing Card (Browse View) Shows:
- Macro-location (neighborhood/locality name)
- City
- Pin code
- Property type badge
- Number of reports in this listing
- Number of vendors contributing
- Age of most recent report
- Listing price (per report)

### Listing Detail Page Shows:
- All reports in the listing as individual preview cards
- Each card: report date, vendor name, property type, PII-redacted summary fields
- "Buy for INR X" button per report → confirmation dialog → purchase → download enabled
- "Request Update" button per report card
- "Request Nearby Report" button in listing header area

### Purchased Reports Page
- All reports the lender has purchased, with download access
- Shows purchase date, amount paid, vendor name, report type
- "Request Update" button available on each purchased report

### Map View (Toggle on Listings Page)
- Blue markers for each listing at averaged coordinates
- Marker clustering for dense areas (nearby listings group into numbered circles)
- Click marker → popup with listing summary + "View Details" link
- Same filters apply in both map and list view

---

## 8.5 Report Templates & Branded Downloads

### What the Lender Configures

In their settings under "Report Template" tab:

**Header Section:**
- Bank/institution name
- Subtitle text (optional, e.g., "Property Valuation Department")
- Logo upload (auto-resized to 200x80px)
- Primary color (header background)
- Secondary color (accent/row alternating)

**Field Selection & Ordering:**
- Draggable list of all available fields (from report's extracted data)
- Each field has: enable/disable checkbox, editable display label, drag handle for reordering
- Available fields include: property address, property type, valuation amount, plot area, built-up area, applicant name, report date, city, pin code, coordinates, report category, expiry date, plus all additional extracted fields

**Footer Section:**
- Custom footer text
- Show/hide page numbers toggle

### Download Experience

When a lender has a configured template:
- Download button becomes a split button: "Download (My Template)" as primary action, "Download (Original)" as dropdown option
- Template-rendered PDFs are cached — repeat downloads are instant
- If no template configured: single "Download PDF" button delivers the original file

### Template Management
- One active template per lender organization at a time
- Saving a new configuration archives the previous one
- Template history is viewable; archived templates can be re-activated
- Only inactive (archived) templates can be deleted

---

## 8.6 Map & Geographic Views

### Lender Listings Map

Available as a toggle on the listings browse page:

- **Map view** shows blue markers for each listing
- Coordinates derived from averaging all reports' lat/lng in each listing group
- **Marker clustering** groups nearby listings into numbered circles
- Click a cluster → map zooms in to show individual markers
- Click a marker → popup showing: macro-location, property type, report count, vendor count, latest report date, "View Details" link
- All filters from the list view apply to the map view simultaneously
- Desktop: map fills content area. Mobile: map at 60% viewport height

### Vendor Coverage Map

Standalone page at `/vendor/map` showing:

- **Green markers** — Vendor's own published reports (click for address, category, date)
- **Red circles** — Competitor report density by pin code area
  - Circle size and opacity reflect report count
  - Click shows: "{N} reports by other vendors in {pin_code}, {city}"
- **Legend** — Bottom-left overlay: Green = "Your Reports", Red = "Other Vendors"
- **City filter** — Focus on a specific market
- **Purpose:** Gap identification — areas with red but no green represent expansion opportunities for the vendor

---

# 9. User Experience Specification

## 9.1 Design Principles

1. **Clarity Over Cleverness** — Every screen should be immediately understandable. Labels are descriptive ("Create New Request" not "New"). Status indicators use both color and text. No jargon without explanation.

2. **Mobile-First for Vendors** — Vendor portal designed for smartphone screens first, then enhanced for desktop. Touch targets minimum 44x44px. Single-column layouts on mobile. Bottom navigation for primary actions.

3. **Desktop-Optimized for Lenders** — Lender portal assumes a seated, keyboard-and-mouse environment. Tables with sortable columns. Keyboard shortcuts for common actions. Side panels for detail views.

4. **Progressive Disclosure** — Don't show everything at once. Listing previews are redacted; full data appears after purchase. Dashboard shows summary cards first; detailed breakdowns are expandable. Settings are organized into tabs.

5. **Real-Time Feedback** — Status changes appear instantly via WebSocket. Upload progress is visible. Extraction status shows a live indicator. No user should ever need to manually refresh.

6. **Accessibility** — Color is never the only indicator (badges include text, confidence has icons). Touch targets meet WCAG guidelines. Form validation messages are descriptive.

## 9.2 Navigation Structure

### Lender Portal Sidebar
```
Dashboard
Requests
  ├── All Requests
  └── New Request
Listings
  ├── Browse Marketplace
  └── Purchased Reports
Settings
  ├── Users
  ├── Report Template
  └── Configuration
```

### Vendor Portal Sidebar
```
Dashboard
Requests
  ├── Incoming
  ├── Pending
  └── Completed
Reports
  ├── All Reports
  ├── Bulk Upload
  └── Bulk Jobs
Listings
  └── My Listings
Coverage Map
Settings
  ├── Users
  └── Configuration
```

### Admin Portal Sidebar
```
Dashboard
Accounts
  ├── Lenders
  └── Vendors
Pricing
Billing
Activity Log
Settings
  └── System Configuration
```

### Navigation Behavior
- **Desktop (1024px+):** Sidebar always visible, 240px width, collapsible to icon-only
- **Tablet (768-1023px):** Sidebar hidden by default, hamburger menu button, slides in as overlay
- **Mobile (<768px):** Bottom navigation bar with 4-5 primary items; remaining items in "More" menu

## 9.3 User Journeys

### Journey 1: Lender Creates First Request

```
Login → Dashboard (empty state with "Create Your First Request" CTA)
  → Click CTA → New Request Form (Step 1: Property Details)
  → Fill address, city, pin code, property type, applicant name
  → Next → Step 2: Report Configuration
  → Select "Valuation", optionally select preferred vendor
  → Next → Step 3: Price Confirmation
  → See calculated price, review summary
  → Submit → Redirect to Request Detail (status: SENT)
  → Notification bell shows "Request submitted successfully"
```

**Empty State Design:** When a lender has no requests yet, the dashboard shows:
- A welcoming illustration
- "You haven't created any requests yet"
- Large "Create Your First Request" button
- Brief explanation of what happens next

### Journey 2: Vendor Receives and Completes a Broadcast Request

```
Phone notification buzzes → "New valuation request in Koramangala, Bengaluru"
  → Tap notification → Opens vendor portal → Incoming Requests tab
  → See request card with countdown timer (28:45 remaining)
  → Tap card → Request Detail (property info, lender, price: INR 8,500)
  → Tap "Accept" → Confirmation dialog → Accepted
  → Status changes to PENDING
  → [Vendor visits property, completes report]
  → Return to Pending tab → Tap the request
  → Upload area: tap "Upload PDF" → Select from phone files
  → Upload progress indicator → Processing (spinner with "Extracting data...")
  → [AI extraction completes in ~30 seconds]
  → Extraction Review form appears with fields + confidence indicators
  → Yellow-flagged field: "Valuation Amount: 42,00,000" (82% confidence)
  → Vendor checks original PDF → correct → moves on
  → Red-flagged field: "Built-up Area: 1,250 sqft" (45% confidence)
  → Vendor corrects to "1,480 sqft"
  → Tap "Publish" → Report published, status → SENT
  → Notification: "Report submitted to ABCL Bank"
```

### Journey 3: Lender Discovers and Purchases a Listing

```
Login → Listings → Browse Marketplace
  → Filter: City=Bengaluru, Property Type=Residential, Pin Code=560034
  → See 3 listing cards in this pin code area
  → Click "Koramangala 4th Block" listing → Detail page
  → See 5 report cards with redacted previews:
      "Residential | 560034 | ~1,500 sqft | 2 months ago | Vendor: ValPro"
  → Report looks relevant → Click "Buy for INR 2,500"
  → Confirmation dialog: "Purchase this report for INR 2,500?"
  → Confirm → Access granted immediately
  → Full unredacted data visible + Download button appears
  → Download in "My Template" format → Branded PDF with bank logo
```

### Journey 4: Admin Onboards a New Lender

```
Login → Accounts → Lenders → "Add Lender" button
  → Fill: Organization name (XYZ Bank), contact name, email, city
  → Save → Lender account created
  → "Add Branch" → Branch name (Indiranagar Branch), city, area
  → Save → Branch created
  → "Add User" → Name, email, mobile, role (Org Admin), branch assignment
  → Save → User created, welcome email sent
  → Navigate to Pricing → Select "XYZ Bank" from lender dropdown
  → "Add Rule" → City: Bengaluru, Property Type: Residential, Category: Valuation
  → Prices: New Request: INR 8,500 | Listing: INR 2,500 | Update: INR 3,000 | Nearby: INR 5,000
  → Save → Pricing rule active
  → [Repeat for Commercial, Legal, other cities as needed]
```

### Journey 5: Vendor Bulk-Uploads Historical Reports

```
Login → Reports → Bulk Upload
  → "Select Files" → Choose 30 PDFs from computer
  → Files listed with names → "Start Upload" button
  → Progress: uploading 1 of 30... 2 of 30... [progress bar]
  → All uploaded → Redirect to Bulk Jobs page
  → Job status: "IN_PROGRESS — 15 of 30 processed"
  → [Wait / refresh] → "COMPLETED — 27 success, 3 failed"
  → Click to expand → See per-file status
  → 3 failed files: "Extraction failed — image-only PDF, try higher quality scan"
  → "Retry Failed" button → Retries the 3 files
  → Navigate to Reports → All Reports → 27 new reports in READY_TO_PUBLISH status
  → Vendor reviews each, publishes, toggles "List on Marketplace"
```

### Journey 6: Monthly Billing Cycle (Admin)

```
Login → Billing page → Month selector (shows "April 2026")
  → "Generate Invoices" button (enabled because April invoices don't exist yet)
  → Click → Confirmation: "Generate invoices for March 2026?" → Confirm
  → Processing... → "12 vendor invoices and 8 lender invoices generated"
  → Summary cards update: Total Payables: INR 12,45,000 | Total Receivables: INR 9,80,000
  → Two tabs: Lender Payables / Vendor Receivables
  → Lender Payables tab: 8 rows with invoice numbers (GTR-PAY-2026-03-0001 through -0008)
  → Select 3 invoices → "Mark as Billed" → Status changes to BILLED (blue badge)
  → [After payment confirmed externally]
  → Select same 3 → "Mark as Paid" → Status changes to PAID (green badge)
  → Vendors and lenders receive notifications about their invoice status changes
  → CSV Export → Downloads full detail for finance team
```

## 9.4 Responsive Design Specifications

### Breakpoints

| Breakpoint | Name | Target |
|---|---|---|
| < 640px | Mobile | Phones (vendor primary device) |
| 640-767px | Large Mobile | Large phones, small tablets |
| 768-1023px | Tablet | Tablets, small laptops |
| 1024px+ | Desktop | Laptops, desktops (lender/admin primary) |

### Layout Adaptations

**Sidebar Navigation:**
- Desktop: Fixed sidebar, always visible, 240px width
- Tablet: Hidden by default, hamburger button top-left, slides in as overlay
- Mobile: Bottom navigation bar with 4-5 icons + labels

**Data Tables (Requests, Reports, Billing, etc.):**
- Desktop: Full table with sortable column headers, row actions
- Mobile: Card-based list view — each record becomes a card with key fields stacked vertically, action buttons at card bottom

**Forms (New Request, Settings, etc.):**
- Desktop: Optional 2-column layout for related fields
- Mobile: Always single-column, full-width inputs

**Modals/Dialogs:**
- Desktop: Centered overlay, max-width 600px
- Mobile: Full-screen bottom sheet, sliding up from bottom

**Login Page:**
- Desktop: Split-screen — brand panel (left 40%) + login form (right 60%)
- Mobile: Brand panel hidden entirely, compact logo above the form

### Touch Target Requirements
- All interactive elements: minimum 44x44px tap area
- Navigation links: py-3 padding (tall enough for comfortable tapping)
- Spacing between tappable items: minimum 8px gap
- Form inputs: full-width with generous padding

## 9.5 Key UI Components

### Notification Bell
- Located in the top header bar across all portals
- Red badge with unread count
- Click → dropdown showing last 20 notifications
- Each notification: icon, message text, relative timestamp ("2 min ago")
- "Mark all as read" action at top
- Click any notification → navigates to the relevant request/report/page
- Desktop: positioned dropdown. Mobile: full-screen overlay

### Status Timeline (Request Detail)
- Horizontal timeline on desktop, vertical on mobile
- Steps: Sent → Awaited → Received → Accepted (or Sent Back → Revised → ...)
- Current step highlighted, future steps greyed
- Timestamps on each completed step

### Confidence Indicators (OCR Review)
- Green pill with checkmark: 90%+ confidence
- Yellow pill with warning icon: 60-89% confidence
- Red pill with alert icon: <60% confidence
- Hover/tap shows exact percentage

### Split Download Button
- Primary action (left): "Download (My Template)" with template icon
- Dropdown arrow (right): opens menu with "Download (Original PDF)" option
- If no template configured: single "Download PDF" button

### Price Display
- Always shown in INR with comma-separated formatting (INR 8,500)
- Breakdown visible on confirmation screens
- Listing cards show "from INR X" (lowest report price in the listing)

---

# 10. Report Format & Content Standards

## What a Property Valuation Report Contains

Based on analysis of actual Indian property valuation reports used by major lending institutions, PropEval's data extraction captures the following standardized structure:

### Section 1: Report Header
- Commissioning bank/NBFC name and branch
- Valuer firm name and registration details
- Case reference number
- Type of case (Home Loan, LAP, Mortgage, Commercial)
- Date of site visit and date of report
- Valuation outcome (Positive / Negative / Conditional)

### Section 2: Basic Property Details
- Owner / applicant name
- Property type: original approved use vs. current actual use
- Property address: as per request, as per site visit, as per legal documents
- Pin code
- Latitude / Longitude (GPS coordinates from site visit)
- Property category: Apartment, Villa, Row House, Independent Floor, Commercial Shop, Industrial Unit, Plot
- Prior valuation history (if applicable)

### Section 3: Location & Surroundings
- Location classification: Commercial / Residential / Industrial / Mixed
- Locality class: Posh / Upper Middle / Middle / Lower Middle / Low
- Site development status: Fully Developed / Developing / Underdeveloped
- Civic amenities proximity: hospitals, schools, markets
- Distance to railway station and bus stop
- Distance from city center
- Nearest landmark
- Road condition and width

### Section 4: Legal & Access Details
- Road width category
- Physical approach: Clear or obstructed
- Legal approach per documents: Clear or contested
- Encumbrance status: existing mortgages, court orders, liens
- Ownership type: Freehold or Leasehold

### Section 5: Property Specifications
- Occupancy: Vacant / Self-Occupied / Rented / Under Construction
- Structure type: RCC / Load Bearing / Composite / Steel
- Total land/plot area
- Number of floors, units, lifts
- Configuration (BHK for residential)
- Construction quality: Exteriors and Interiors rated (Excellent / Good / Average / Poor)
- Age of property and estimated residual life
- Stage of construction (percentage complete)

### Section 6: Approval & Compliance
- Sanctioning authority and approval number
- Building plan approval status
- Occupation Certificate (OC) status
- Documents verified: sale deed, agreement, sanction plan, tax receipts, society NOC
- Municipal jurisdiction: Corporation / Town Municipality / Gram Panchayat
- Permissible use per master plan
- Risk of demolition (Nil / Low / Medium / High)
- Deviations: horizontal (encroachment beyond approved area), vertical (extra floors), usage (residential vs. commercial mismatch)
- Caution zones: CRZ (Coastal Regulation Zone), river line, high-tension lines, archaeological monuments, road widening risk

### Section 7: Area Measurement
- Carpet area: per documents / per sanction plan / per site measurement
- Built-up area: per documents / per sanction plan / per site measurement
- Super built-up area
- Setbacks: front, sides, rear — as approved vs. actual

### Section 8: Valuation (The Financial Core)
- **Market Value (Fair Market Value / FMV):** Land area x rate + Construction area x rate, adjusted for depreciation, amenities, and market conditions
- **Guideline Value:** Government-published circle rate / Annual Statement of Rates (ASR)
- **Forced Sale Value (FSV):** Typically 70-80% of FMV — the distress liquidation estimate that banks use for lending decisions
- **Insurance / Replacement Value:** Cost to rebuild the structure
- **Rental Estimate:** Monthly rental value if applicable

### Section 9: Boundaries
- East, West, North, South boundaries as per deed vs. as per site
- Match status: Matching / Not Matching / Not Verifiable

### Section 10: Remarks & Observations
- Narrative observations from the site visit
- Discrepancies between documents and site reality
- Unauthorized construction flagged
- Market condition notes
- Any red flags for the lender

### Section 11: Declaration & Certification
- Personal inspection statement
- No direct/indirect interest declaration
- Truth and accuracy certification
- Named valuer who visited + authorized signatory
- Firm stamp and seal

### Section 12: Supporting Evidence
- **Location map:** Google Maps screenshot with GPS coordinates
- **Property sketch:** Floor plan with measurements (hand-drawn or CAD)
- **Site photographs:** Exterior, interior, approach road, name plate, surrounding views
- **Field executive selfie:** With GPS/timestamp metadata embedded (proof of visit)
- **Government rate evidence:** Screenshots from ASR/circle rate portals
- **Comparable listings:** Screenshots from property portals (optional, for rate justification)

---

# 11. Pricing & Billing Model

## Pricing Architecture

### How Prices Are Set

GTR Admin configures pricing rules per lender. Each rule is defined by the combination of:

```
Lender + City + Property Type + Report Category + (Optional) Area
```

Each rule has four price points:

| Price Type | When Applied | Typical Range |
|---|---|---|
| **New Request Price** | Lender commissions a fresh report | INR 5,000 - 25,000 |
| **Listing Download Price** | Lender purchases an existing report from marketplace | INR 1,500 - 5,000 |
| **Update Additional Price** | Lender requests an update to an existing report | INR 2,000 - 8,000 |
| **Nearby Additional Price** | Lender requests a report on a nearby property | INR 3,000 - 12,000 |

### Area-Level Pricing Override

Pricing supports two levels of specificity:
1. **City-level rule:** Applies to all areas within the city (e.g., Bengaluru, Residential, Valuation → INR 8,000)
2. **Area-level override:** Applies to a specific area within the city (e.g., Bengaluru, Koramangala, Residential, Valuation → INR 10,000)

When calculating a price, the system first looks for an area-specific match. If none exists, it falls back to the city-level rule. This allows premium pricing for high-value localities without creating rules for every area.

### Price Visibility

- **Lenders** see the calculated price at Step 3 of request creation (before submitting)
- **Vendors** see the offered price in the broadcast notification and request detail
- **Listings** show the per-report purchase price on each report card
- No hidden fees (platform fee to be introduced in Phase 15)

## Billing Model

### Two-Sided Billing

Every completed transaction creates two billing records:

1. **VendorEarning** — Money owed TO the vendor
   - Types: REQUEST (for new/update/nearby reports) or LISTING_DOWNLOAD (for marketplace purchases)
   - Created at the moment of report acceptance or listing purchase

2. **LenderPayable** — Money owed BY the lender
   - Types: NEW_REQUEST, LISTING_DOWNLOAD, UPDATE, NEARBY
   - Created at the same moment as VendorEarning

### Monthly Invoice Cycle

```
Transaction occurs → Billing entry created (real-time)
  → Month ends → Invoice generation job runs (1st of following month)
  → Individual entries aggregated into:
      One RECEIVABLE invoice per vendor (GTR-RCV-YYYY-MM-NNNN)
      One PAYABLE invoice per lender (GTR-PAY-YYYY-MM-NNNN)
  → GTR Admin reviews → Marks as BILLED (sent to party)
  → Payment received/confirmed → Marks as PAID
```

### Invoice Lifecycle

```
PENDING → BILLED → PAID
  (generated)  (sent)   (confirmed)
```

- **PENDING:** Invoice generated but not yet communicated to the party
- **BILLED:** Invoice sent/communicated; awaiting payment
- **PAID:** Payment received and confirmed
- Reversal: PAID → BILLED is allowed (for payment disputes)
- Invoices are permanent records — they cannot be deleted

### Billing Visibility

**Vendor Receivables Dashboard:**
- Month-wise totals with invoice number and status badge
- Expandable to show individual earning entries (report ID, request ID, type, amount, date)
- CSV export per month

**Lender Payables Dashboard:**
- Month-wise totals with invoice number and status badge
- Expandable to show individual payable entries
- CSV export per month

**Admin Billing Page:**
- All invoices across all lenders and vendors
- Filter by type (Payable/Receivable), status, month
- Bulk status update: select multiple invoices → "Mark as Billed" / "Mark as Paid"
- Summary cards: Total Payables, Total Receivables, Pending Count, Paid Count
- CSV export: invoice summary or per-invoice line item detail

---

# 12. Trust, Quality & Governance

## Vendor Trust Framework (Current + Planned)

### Vendor Quality Score (0-100)

A composite metric calculated from platform performance:

| Signal | Weight | Measurement |
|---|---|---|
| Lender Star Rating (avg) | 30% | Average of all ratings received (1-5 stars) |
| First-Time Acceptance Rate | 25% | % of reports accepted by lender without revision |
| On-Time Delivery Rate | 20% | % of reports submitted within expected turnaround |
| Revision Rate (inverse) | 15% | Lower is better — fewer revisions = higher quality |
| OCR Completeness | 10% | % of fields successfully extracted from uploaded reports |

### Vendor Trust Tiers

| Tier | Badge | Criteria | Access Level |
|---|---|---|---|
| **New** | Grey | Verified credentials, fewer than 10 completed jobs | Starter pool only (simpler, lower-value requests); GTR reviews reports before forwarding to lender |
| **Verified** | Blue | 10+ completed jobs, quality score 60+ | Full marketplace access, all property types, self-pricing (within admin-set bands) |
| **Top Valuer** | Gold | 50+ completed jobs, quality score 80+, avg response < 24 hours | Featured placement in marketplace, priority in broadcast rounds, gold badge on profile |

### Tier Movement Rules
- **Promotion:** Automatically checked on every report completion and rating event
- **Demotion:** Requires 30 consecutive days below the threshold to trigger (with warning at day 15)
- **Safety:** Demotion requires minimum 20 rated jobs to prevent small-sample penalization
- **Override:** GTR Admin can manually promote, demote, or freeze demotion for any vendor

### Lender Rating System
- After accepting a report, the lender is prompted to rate the vendor (1-5 stars)
- Rating is optional but encouraged via notification nudge
- One rating per request per lender (unique constraint)
- No text reviews in the current version — purely numeric rating
- 30-day window after acceptance to submit a rating

### Vendor Public Profile (Planned)
- Display photo, bio, founding year
- Certifications (IBBI registration number, RICS, etc.)
- Specialization tags (e.g., "Industrial", "Residential", "Legal Title Search")
- Profile completeness percentage (incentivizes filling out all fields)
- Portfolio: auto-generated from completed reports (PII-redacted)
- Performance metrics: rating, first-time acceptance rate, average turnaround, total completed jobs

## Quality Assurance Mechanisms

1. **OCR Extraction + Vendor Review:** AI extracts data; vendor verifies and corrects — creating a quality checkpoint before data reaches the lender
2. **Mandatory Fields:** Reports cannot be published without property address, type, and valuation amount — ensuring minimum data completeness
3. **Lender Review:** Every report goes through lender accept/reject — creating accountability
4. **Revision Tracking:** All revisions are preserved with comments — creating an audit trail of quality issues
5. **Auto-Accept Safety Net:** The 7-day auto-accept prevents reports from being ignored, but also means vendors know their work will be evaluated
6. **Activity Logging:** 18 action types logged with actor, timestamp, and target — full audit trail for compliance and dispute resolution
7. **GTR Quality Gate (New-Tier Vendors):** Reports from new/unproven vendors are reviewed by GTR operations before forwarding to the lender — protecting lenders from poor quality while giving new vendors a supervised on-ramp

---

# 13. Notifications & Communication

## Notification Architecture

PropEval uses a layered notification system designed to reach users through the most appropriate channel based on urgency and context:

### Layer 1: In-App Notifications (All Users)
- Delivered via WebSocket for instant display
- Visible in the notification bell dropdown
- Persistent until marked as read
- Click-through to relevant page

### Layer 2: Web Push (Vendor Mobile Only)
- Push notifications even when the browser/app is closed
- Triggered only for time-critical events (NEW_BROADCAST)
- Requires user permission (prompted via banner)
- Shows property address and request type — no sensitive PII

### Layer 3: Polling Fallback
- If WebSocket connection fails, 60-second polling maintains functionality
- Automatic reconnection with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s cap)
- Seamless — user doesn't notice the fallback

## Notification Events

| Event | Recipients | Urgency | Channels |
|---|---|---|---|
| **New Broadcast Request** | Matching vendor users | HIGH | In-app + Web Push |
| **Request Accepted by Vendor** | Requesting lender users | MEDIUM | In-app |
| **Report Received** | Requesting lender users | MEDIUM | In-app |
| **Revision Requested** | Assigned vendor users | HIGH | In-app |
| **Report Accepted** | Assigned vendor users | MEDIUM | In-app |
| **Listing Report Downloaded** | Report owner (vendor) | LOW | In-app |
| **Invoice Generated** | Vendor or Lender users | LOW | In-app |
| **Payment Confirmed** | Vendor or Lender users | LOW | In-app |

## Notification Preferences

Users can opt out of specific notification types via their settings:
- Per-event-type toggle switches
- Opt-out means the notification is never created (not just hidden)
- GTR Admin users cannot opt out — they receive all notifications
- Default: all notification types enabled

---

# 14. Configuration & Platform Controls

## Three Levels of Configuration

### Level 1: System Configuration (GTR Admin)

Platform-wide parameters that affect all users:

| Parameter | Default | Description |
|---|---|---|
| Vendors per broadcast round | 5 | How many vendors receive each broadcast wave |
| Broadcast acceptance window | 30 minutes | How long vendors have to respond per round |
| Auto-accept threshold | 7 days | Days before unreceived reports are auto-accepted |
| Max upload size | 20 MB | Maximum PDF file size for uploads |
| Required report fields | address, type, amount | Fields that must be filled before publishing |

Changes take effect platform-wide within 60 seconds (cached in Redis with TTL).

### Level 2: Vendor Configuration

Per-vendor settings that the vendor controls:

| Setting | Description |
|---|---|
| **Auto-listing** | When enabled, accepted reports are automatically listed on marketplace (no manual toggle needed) |
| **Price threshold** | Minimum acceptable request price — broadcasts below this amount are filtered out for this vendor |
| **Lender exclusion list** | Specific lenders blocked from seeing this vendor's listings |

### Level 3: Lender Configuration

Per-lender settings that the lender controls:

| Setting | Description |
|---|---|
| **Per-vendor auto-approve** | When a trusted vendor submits a report, the system auto-accepts without lender review |
| **Report template** | Branded download format with logo, colors, field selection |

### How Configurations Interact

```
Broadcast Request Created
  → System checks: vendor's price threshold (skip if request price too low)
  → System checks: vendor's service area match (skip if no coverage)
  → Vendor accepts, uploads report
  → System checks: lender's auto-approve preference for this vendor
    → If auto-approve ON: report auto-accepted → billing created
    → System checks: vendor's auto-listing preference
      → If auto-listing ON: report automatically added to marketplace
```

---

# 15. Analytics & Reporting

## Vendor Dashboard

**Summary Metrics (6 cards):**
- Requests Received (total incoming broadcasts)
- Requests Accepted (total assignments taken)
- Reports Served (total reports published to lenders)
- Reports Listed (total reports on marketplace)
- Downloads (total marketplace purchases of their reports)
- Active Listings (currently live marketplace listings)

**Receivables Section:**
- Lender-wise totals table (which banks owe how much)
- Month-wise breakdown (current Indian financial year: April–March)

**Earnings Section:**
- Lender-wise bar chart (earnings distribution across clients)
- Report-wise top-10 table (highest-earning reports, paginated)
- Month-wise trend bar chart (earnings over time)

**Pending Requests:**
- Highlighted table of INCOMING and PENDING requests with countdown timers

**Reports Table:**
- Searchable, filterable full report inventory with status, date, and listing status

## Lender Dashboard

**Summary Metrics (5 cards):**
- Requests Raised (total requests created)
- Awaiting Reports (requests in progress)
- Reports Received (awaiting lender review)
- Reports Accepted (completed)
- Listings Purchased (marketplace purchases)

**Payables Section:**
- Summary by status: PENDING / BILLED / PAID
- Month-wise table with amounts
- Type breakdown pie chart (New Request vs. Listing vs. Update vs. Nearby)

**Recent Requests:**
- Last 10 requests with status and link to detail page

## Admin Dashboard

**Summary Metrics (6 cards):**
- Total Vendors (registered on platform)
- Total Lenders (registered on platform)
- Total Reports (all statuses)
- Total Revenue (platform-wide)
- Pending Payables (outstanding amount)
- Open Requests (unresolved)

**Tabbed Detail Views:**

| Tab | Contents | Actions |
|---|---|---|
| Vendors | Vendor list with earnings, download count, lender count | CSV export |
| Lenders | Lender list with payables, vendor count | CSV export |
| Reports | Report list with status, vendor, lender, date | CSV export |
| Open Requests | All requests without accepted reports, auto-refresh 60s | Monitor only |
| Activity | Audit log with filters (actor, action type, date range) | CSV export |
| Billing | Invoice management (see Section 11) | Bulk status update, CSV |

**Financial Year Convention:** All month-wise breakdowns use the Indian fiscal year (April–March) as the default time range.

---

# 16. Mobile & Field Experience

## Progressive Web App (PWA) — Vendor Portal

### Why PWA

Vendors are field professionals who spend most of their day at property sites. They need:
- Instant access without App Store downloads
- Push notifications even when the browser is closed
- Offline browsing of previously loaded pages
- Home screen launch with native-app feel

### Installation Experience

**Install Banner (Smart Prompt):**
- Appears on the vendor dashboard after first login
- "Install PropEval for instant notifications and quick access"
- "Install" button + dismiss (X) that snoozes for 7 days
- Only shows on mobile browsers that support PWA
- Not shown if the app is already installed

**Notification Permission Banner:**
- Three states:
  - **Prompt** (yellow): "Enable notifications to get instant alerts for new requests" + "Enable" button
  - **Denied** (red): "Notifications are blocked. Open your browser settings to enable them." + link to instructions
  - **Granted** (hidden): Banner disappears once permission is granted

### Push Notification Behavior
- **Trigger:** Only NEW_BROADCAST events (time-critical for vendor response)
- **Content:** "New valuation request in [locality], [city]" — no PII
- **Click action:** Opens `/vendor/requests` (incoming requests page)
- **Multi-device:** Each device/browser registers separately; push sent to all registered devices
- **Expired subscriptions:** Automatically cleaned up (HTTP 410 responses from push service)

### Offline Capability
- Service worker caches all static assets (JavaScript, CSS, images, fonts)
- Previously loaded pages remain viewable offline
- API calls use network-first strategy (try network, fall back to cache)
- Offline indicator shown when connectivity is lost

---

# 17. Future Roadmap (Phases 13-16)

The following capabilities are planned for future development, building on the current foundation:

## Phase 13: Vendor Profiles & Trust Foundation

**Goal:** Make vendor quality visible and give lenders confidence to work with unfamiliar vendors.

- Public vendor profile pages with bio, certifications, specialization tags
- Profile completeness score to incentivize full profiles
- Quality score (0-100 composite) visible to lenders
- Three trust tiers: New → Verified → Top Valuer
- Automated tier promotion/demotion based on performance
- 1-5 star lender rating system for vendors
- Vendor tier badges displayed on all marketplace cards

## Phase 14: Unified Marketplace & Discovery

**Goal:** Transform the listings page from a simple browse into an "Airbnb-style" discovery experience.

- Split-view layout: map (45%) + card grid (55%) on desktop
- Two result types in one unified feed:
  - **Report Listing Cards** — Existing reports available for purchase
  - **Available Vendor Cards** — Vendors accepting new requests in that area
- Rich filtering: location (city/pin/radius), property type, vendor quality (min rating, tier), report age
- Sort options: Relevance, Price, Rating, Recency, Turnaround
- Locality autocomplete search with typeahead
- Map drag/zoom updates results in real-time

## Phase 15: Marketplace Pricing

**Goal:** Enable fair, transparent, market-driven pricing.

- **Price Bands:** GTR Admin sets min/max price per city + property type + category
- **Vendor Self-Pricing:** Verified and Top Valuer vendors set their own prices within the band
- **Platform Fee:** Transparent fee added on top of report price, shown at checkout
  - Example: "Report: INR 4,500 + Platform Fee: INR 300 = Total: INR 4,800"
- **Vendor Pricing UI:** Visual indicator showing where their price sits within the band

## Phase 16: Graduated Trust Engine

**Goal:** Create a structured on-ramp for new vendors while protecting lender confidence.

- **Starter Pool:** New-tier vendors only receive eligible requests (residential, below value threshold, non-urgent)
- **GTR Quality Gate:** Reports from new vendors go through GTR review before reaching the lender
- **Quality Review Queue:** Admin page for GTR to review, approve, or return reports
- **Automated Tier Progression:** Checked on every report completion and rating
- **Vendor Progress Dashboard:** Visual progress bars toward next tier with estimated timeline
- **Demotion Safeguards:** 30-day grace period, warning at day 15, minimum sample size required

---

# 18. Glossary of Terms

| Term | Definition |
|---|---|
| **ABFL** | Aditya Birla Finance Limited — an example NBFC used in sample reports |
| **Area** | A specific locality within a city (e.g., Koramangala within Bengaluru) |
| **ASR (Annual Statement of Rates)** | Government-published property price rates per locality — used as a baseline for valuation |
| **Auto-Accept** | System automatically accepts a report if the lender does not review within the configured threshold (default: 7 days) |
| **Auto-Listing** | Vendor setting that automatically lists accepted reports on the marketplace |
| **Broadcast** | The process of sending a report request to multiple eligible vendors simultaneously |
| **Broadcast Round** | One batch of vendors (default: 5) who receive the request with a time-limited acceptance window |
| **BUA (Built-Up Area)** | Total constructed area including walls; a key measurement in Indian property valuation |
| **Carpet Area** | Usable floor area excluding walls — the legally relevant measurement under RERA |
| **CERSAI** | Central Registry of Securitisation Asset Reconstruction and Security Interest — central registry to detect double mortgages |
| **Circle Rate** | See ASR — government minimum property rates |
| **CRZ (Coastal Regulation Zone)** | Government-designated coastal buffer zone restricting construction |
| **Empanelment** | The process by which banks approve and list valuers authorized to provide reports for their loans |
| **Forced Sale Value (FSV)** | The estimated price a property would fetch in a distress/quick sale — typically 70-80% of Fair Market Value; used by banks as the lending limit |
| **FSI (Floor Space Index)** | The ratio of total permitted built-up area to plot area — a key construction compliance metric |
| **FMV (Fair Market Value)** | The estimated price a property would fetch in a willing-buyer-willing-seller transaction |
| **GTR (Get-It-Right)** | The company that operates the PropEval marketplace platform |
| **HFC (Housing Finance Company)** | Non-bank entities specifically licensed to provide housing loans (e.g., LIC Housing, PNB Housing) |
| **IBBI** | Insolvency and Bankruptcy Board of India — regulatory authority for Registered Valuers |
| **LAP (Loan Against Property)** | A loan where existing property is pledged as collateral (as opposed to a home loan for purchasing) |
| **Lender** | A bank, NBFC, or HFC that uses PropEval to commission property reports |
| **Listing** | A group of marketplace reports sharing the same pin code and property type |
| **Macro-Location** | Neighborhood/locality-level address used for listing grouping (as opposed to exact street address) |
| **NBFC (Non-Banking Financial Company)** | Financial institutions that provide loans but don't hold a banking license (e.g., Bajaj Finance, Aditya Birla Finance) |
| **NHB (National Housing Bank)** | Regulator for housing finance companies in India (supervision transferred to RBI in 2019) |
| **NPA (Non-Performing Asset)** | A loan where the borrower has defaulted on payments — requires annual property revaluation |
| **OC (Occupancy Certificate)** | Government certificate confirming a building complies with approved plans and is fit for occupation |
| **OCR (Optical Character Recognition)** | Technology used to extract text and structured data from uploaded PDF reports |
| **PII (Personally Identifiable Information)** | Sensitive data (applicant name, exact address) that is redacted in marketplace previews |
| **Pin Code** | Indian postal code — used as the primary geographic grouping unit for listings |
| **Price Threshold** | Vendor-set minimum acceptable price — broadcast requests below this amount skip the vendor |
| **Quality Score** | Composite metric (0-100) reflecting a vendor's platform performance across multiple signals |
| **RBI (Reserve Bank of India)** | India's central bank and primary financial regulator |
| **RERA (Real Estate Regulatory Authority)** | State-level regulator for real estate projects — requires registration for under-construction projects |
| **RICS (Royal Institution of Chartered Surveyors)** | International professional body for property professionals — accreditation indicates high standards |
| **RVO (Registered Valuers Organisation)** | Body recognized by IBBI to certify and supervise registered valuers |
| **Service Area** | The geographic region (city + specific areas) and service type (Valuation/Legal) that a vendor covers |
| **Trust Tier** | Platform-assigned vendor level: New → Verified → Top Valuer — based on quality score and volume |
| **Vendor** | A property valuation firm or legal practice that provides reports through PropEval |
| **VendorEarning** | Billing record tracking money owed to a vendor for completed work |
| **LenderPayable** | Billing record tracking money owed by a lender for received reports |

---

# 19. Appendices

## Appendix A: Sample Report Field Mapping

The following table maps common fields found in Indian property valuation reports to PropEval's extracted data fields:

| Report Field (as seen in PDFs) | PropEval Field Name | Category | Required |
|---|---|---|---|
| Property Address / Site Address | property_address | Anchor | Yes |
| Property Type / Nature of Property | property_type | Anchor | Yes |
| Fair Market Value / Total Market Value | valuation_amount | Anchor | Yes |
| Built-Up Area (BUA) | built_up_sqft | Anchor | No |
| Owner / Applicant Name | loan_applicant_name | Anchor | No |
| Plot Area / Land Area | plot_extent_sqft | Additional | No |
| City | city | Additional | No |
| Pin Code | pin_code | Additional | No |
| Latitude | lat | Additional | No |
| Longitude | lng | Additional | No |
| Forced Sale Value | forced_sale_value | Additional | No |
| Guideline Value / Circle Rate | guideline_value | Additional | No |
| Carpet Area | carpet_area_sqft | Additional | No |
| Age of Property | property_age_years | Additional | No |
| Residual Life | residual_life_years | Additional | No |
| Occupancy Status | occupancy_status | Additional | No |
| Structure Type | structure_type | Additional | No |
| Construction Quality | construction_quality | Additional | No |
| Rental Estimate | rental_estimate | Additional | No |

## Appendix B: Regulatory Requirements Summary

| Regulation | Requirement | PropEval Compliance |
|---|---|---|
| RBI Board-Approved Valuation Policy | Banks must have formal policy for property valuation | Platform enforces standardized process |
| RBI Dual Valuation | Two independent valuations for loans > INR 1 crore with collateral > INR 50 lakh | Lenders can create two separate requests; system ensures different vendors |
| RBI Valuer Independence | Valuers must have no interest in the property | Declaration captured in report; platform separates assignment from valuer selection |
| RBI Revaluation Cycle | Performing assets every 3 years; NPAs annually | Update request workflow enables scheduled revaluation |
| NHB HFC Guidelines | Similar to RBI; dual valuation, qualified valuers | Same platform compliance as above |
| IBBI Registered Valuers | Valuers should be IBBI-registered for regulated work | Vendor profile captures registration number; verifiable |
| RERA | Under-construction projects must be RERA-registered | Report extraction captures RERA number if present |
| CERSAI | Equitable mortgages must be registered centrally | Future integration point for double-mortgage detection |

## Appendix C: Pricing Configuration Examples

**Example 1: ABCL Bank — Bengaluru (City-Level)**
| Property Type | Category | New Request | Listing | Update | Nearby |
|---|---|---|---|---|---|
| Residential | Valuation | INR 8,000 | INR 2,500 | INR 3,500 | INR 5,000 |
| Commercial | Valuation | INR 12,000 | INR 4,000 | INR 5,000 | INR 7,000 |
| Residential | Legal | INR 6,000 | INR 2,000 | INR 2,500 | INR 4,000 |

**Example 2: ABCL Bank — Bengaluru, Koramangala (Area Override)**
| Property Type | Category | New Request | Listing | Update | Nearby |
|---|---|---|---|---|---|
| Residential | Valuation | INR 10,000 | INR 3,000 | INR 4,000 | INR 6,000 |

In this example, a residential valuation request in Koramangala costs INR 10,000 (area-specific), while the same request in HSR Layout costs INR 8,000 (city-level fallback).

## Appendix D: Feature Delivery Phases

| Phase | Name | Scope | Status |
|---|---|---|---|
| 0 | Scaffold | Project structure, Docker, CI/CD | Complete |
| 1 | Auth & Users | Login, OTP, RBAC, account management | Complete |
| 2 | Pricing & Models | Data models, pricing engine, admin pricing UI | Complete |
| 3 | New Request Workflow | End-to-end request → broadcast → report → accept flow | Complete |
| 4 | OCR & Processing | AI data extraction, vendor review UI, bulk upload | Complete |
| 5 | Listings Marketplace | Secondary market, PII redaction, purchase, browse | Complete |
| 6 | Update & Nearby | Two new request types with parent report context | Complete |
| 7 | Dashboards | Vendor/Lender/Admin dashboards, notifications, CSV export | Complete |
| 8 | Templates | Lender-branded report download, template builder | Complete |
| 9 | Map Views | Lender listings map, vendor coverage map | Complete |
| 10 | Real-Time | WebSocket notifications, activity logging, preferences | Complete |
| 11 | Mobile PWA | Service worker, Web Push, install/permission banners | Complete |
| 12A | Billing & Invoicing | Monthly invoices, lifecycle management, admin billing | Complete |
| 12B | System Config | Runtime-configurable platform parameters | Complete |
| 12C | Polish & Hardening | Pagination, rate limiting, query optimization, cleanup | Complete |
| 13 | Vendor Profiles | Public profiles, quality score, trust tiers, ratings | Planned |
| 14 | Unified Marketplace | Airbnb-style discovery, split-view, rich filters | Planned |
| 15 | Marketplace Pricing | Price bands, vendor self-pricing, platform fee | Planned |
| 16 | Graduated Trust | Starter pool, GTR quality gate, tier progression | Planned |

## Appendix E: Market Data Sources

- India real estate market: Mordor Intelligence, IMARC Group (2025-2026 projections)
- Housing loan market: Research and Markets, Global Property Guide, RBI data
- Loan origination data: ANAROCK, Business Standard, Entrackr (FY2025-26)
- Bank fraud statistics: RBI Annual Report FY2024
- PropTech investment: Tracxn, Inc42, Entrackr (2024-2025)
- Competitive intelligence: Valocity press releases, Sigmavalue website, BuildIQ documentation
- Regulatory: RBI Master Circulars, NHB Directions, IBBI Registry, RERA portals
- Valuation report standards: Analysis of 6 actual ABFL-commissioned reports from multiple valuer firms

---

*This document is maintained by the GTR Product Team. Last updated: April 13, 2026.*
*For questions or contributions, contact the PropEval product lead.*
