"""
Demo seed script for PropEval — populates dashboards with rich realistic data.

Run from within the backend container:
    python -m scripts.seed_demo
"""

import asyncio
import hashlib
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.database import get_async_session_context
from app.models.billing import LenderPayable, VendorEarning
from app.models.lender import Lender
from app.models.vendor import Vendor
from app.models.user import Organization, User
from app.models.enums import (
    BroadcastStatus,
    EarningType,
    LenderRequestStatus,
    LenderRole,
    ListingStatus,
    NotificationEventType,
    NotificationReferenceType,
    PayableType,
    PaymentStatus,
    PropertyType,
    ReportCategory,
    ReportStatus,
    RequestType,
    UserType,
    VendorRequestStatus,
    VendorRole,
)
from app.models.listing import Listing, ListingReport
from app.models.notification import Notification
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.request import RequestAcceptance, RequestBroadcast, ReportRequest
from app.services import lender_service, pricing_service, user_service, vendor_service

# ── helpers ──────────────────────────────────────────────────────────────────


def months_ago(n: int) -> str:
    """Return 'YYYY-MM' string for n months before April 2026."""
    base = date(2026, 4, 1)
    m = base.month - n
    y = base.year + (m - 1) // 12
    m = ((m - 1) % 12) + 1
    return f"{y}-{m:02d}"


# Weighted offsets: ~50% land in current FY (April 2026), rest in previous FY
MONTH_WEIGHTS = [0, 0, 0, 1, 2, 4, 5, 7, 9, 11]


def date_ago(days: int) -> date:
    return date(2026, 4, 10) - timedelta(days=days)


def dt_ago(days: int) -> datetime:
    return datetime(2026, 4, 10, 10, 0, 0, tzinfo=timezone.utc) - timedelta(days=days)


# ── main ─────────────────────────────────────────────────────────────────────


async def seed_demo() -> None:
    async with get_async_session_context() as db:
        # ── idempotency check ─────────────────────────────────────────────────
        result = await db.execute(
            select(Organization).where(Organization.name == "HDFC Home Loans")
        )
        if result.scalar_one_or_none():
            print("Demo data already exists. Skipping.")
            return

        print("Starting demo seed…")

        # ── call base seed first ──────────────────────────────────────────────
        # We import lazily here so the module isn't executed at import time
        from scripts.seed import seed as base_seed  # noqa: PLC0415

    # base_seed opens its own session; run it separately
    await base_seed()

    async with get_async_session_context() as db:
        # ── fetch objects created by base seed ────────────────────────────────
        abcl_lender = (await db.execute(select(Lender).where(Lender.name == "ABCL Bank"))).scalar_one()
        valuepro_vendor = (await db.execute(select(Vendor).where(Vendor.name == "ValuePro Consultants"))).scalar_one()
        abcl_user = (await db.execute(select(User).where(User.email == "lender@abcl.com"))).scalar_one()
        valuepro_user = (await db.execute(select(User).where(User.email == "vendor@valuepro.com"))).scalar_one()

        # ── 3 more lenders ────────────────────────────────────────────────────
        print("\n[1/8] Creating additional lenders…")

        hdfc = await lender_service.create_lender(db, name="HDFC Home Loans", city="Mumbai")
        hdfc_branch = await lender_service.create_branch(db, lender_id=hdfc.id, name="Bandra Branch", city="Mumbai")
        hdfc_user = await user_service.create_user(
            db,
            email="lender@hdfc.com",
            mobile="9100000001",
            full_name="HDFC Lender",
            password="lender123",
            user_type=UserType.LENDER,
            organization_id=hdfc.organization_id,
        )
        await lender_service.create_lender_user(
            db, user_id=hdfc_user.id, lender_id=hdfc.id, role=LenderRole.ORG_ADMIN, branch_ids=[str(hdfc_branch.id)]
        )
        print(f"  Created {hdfc.name} + user {hdfc_user.email}")

        sbi = await lender_service.create_lender(db, name="SBI Housing", city="Delhi")
        sbi_branch = await lender_service.create_branch(db, lender_id=sbi.id, name="Connaught Place Branch", city="Delhi")
        sbi_user = await user_service.create_user(
            db,
            email="lender@sbi.com",
            mobile="9100000002",
            full_name="SBI Lender",
            password="lender123",
            user_type=UserType.LENDER,
            organization_id=sbi.organization_id,
        )
        await lender_service.create_lender_user(
            db, user_id=sbi_user.id, lender_id=sbi.id, role=LenderRole.ORG_ADMIN, branch_ids=[str(sbi_branch.id)]
        )
        print(f"  Created {sbi.name} + user {sbi_user.email}")

        icici = await lender_service.create_lender(db, name="ICICI Bank", city="Chennai")
        icici_branch = await lender_service.create_branch(db, lender_id=icici.id, name="Anna Nagar Branch", city="Chennai")
        icici_user = await user_service.create_user(
            db,
            email="lender@icici.com",
            mobile="9100000003",
            full_name="ICICI Lender",
            password="lender123",
            user_type=UserType.LENDER,
            organization_id=icici.organization_id,
        )
        await lender_service.create_lender_user(
            db, user_id=icici_user.id, lender_id=icici.id, role=LenderRole.ORG_ADMIN, branch_ids=[str(icici_branch.id)]
        )
        print(f"  Created {icici.name} + user {icici_user.email}")

        # ── pricing rules for new lenders ─────────────────────────────────────
        print("\n[2/8] Creating pricing rules for new lenders…")
        for lender_obj, city_name in [
            (hdfc, "Mumbai"),
            (sbi, "Delhi"),
            (icici, "Chennai"),
        ]:
            for cat, ptype, new_p, lst_p, upd_p, nbr_p in [
                ("VALUATION", "RESIDENTIAL", "3000.00", "1800.00", "1200.00", "1200.00"),
                ("VALUATION", "COMMERCIAL", "6000.00", "3500.00", "2500.00", "2500.00"),
                ("LEGAL", "RESIDENTIAL", "2500.00", "1500.00", "1000.00", "1000.00"),
                ("LEGAL", "COMMERCIAL", "4500.00", "2800.00", "1800.00", "1800.00"),
            ]:
                await pricing_service.create_pricing_rule(
                    db,
                    lender_id=lender_obj.id,
                    report_category=cat,
                    city=city_name,
                    area=None,
                    property_type=ptype,
                    new_request_price=Decimal(new_p),
                    listing_download_price=Decimal(lst_p),
                    update_additional_price=Decimal(upd_p),
                    nearby_additional_price=Decimal(nbr_p),
                )
        print("  Pricing rules created.")

        # ── 3 more vendors ────────────────────────────────────────────────────
        print("\n[3/8] Creating additional vendors…")

        propassess = await vendor_service.create_vendor(
            db, name="PropAssess India", office_city="Mumbai", office_area="Bandra", services=["VALUATION", "LEGAL"]
        )
        await vendor_service.create_service_area(db, vendor_id=propassess.id, city="Mumbai", areas=["Bandra", "Andheri", "Borivali", "Dadar"], service_type="VALUATION")
        await vendor_service.create_service_area(db, vendor_id=propassess.id, city="Mumbai", areas=None, service_type="LEGAL")
        propassess_user = await user_service.create_user(
            db,
            email="vendor@propassess.com",
            mobile="9200000001",
            full_name="PropAssess Vendor",
            password="vendor123",
            user_type=UserType.VENDOR,
            organization_id=propassess.organization_id,
        )
        await vendor_service.create_vendor_user(db, user_id=propassess_user.id, vendor_id=propassess.id, role=VendorRole.VENDOR_ADMIN)
        print(f"  Created {propassess.name} + user {propassess_user.email}")

        legaleye = await vendor_service.create_vendor(
            db, name="LegalEye Associates", office_city="Delhi", office_area="Saket", services=["LEGAL"]
        )
        await vendor_service.create_service_area(db, vendor_id=legaleye.id, city="Delhi", areas=["Saket", "Dwarka", "Rohini", "Vasant Kunj"], service_type="LEGAL")
        legaleye_user = await user_service.create_user(
            db,
            email="vendor@legaleye.com",
            mobile="9200000002",
            full_name="LegalEye Vendor",
            password="vendor123",
            user_type=UserType.VENDOR,
            organization_id=legaleye.organization_id,
        )
        await vendor_service.create_vendor_user(db, user_id=legaleye_user.id, vendor_id=legaleye.id, role=VendorRole.VENDOR_ADMIN)
        print(f"  Created {legaleye.name} + user {legaleye_user.email}")

        southval = await vendor_service.create_vendor(
            db, name="SouthVal Services", office_city="Chennai", office_area="T. Nagar", services=["VALUATION"]
        )
        await vendor_service.create_service_area(db, vendor_id=southval.id, city="Chennai", areas=["T. Nagar", "Adyar", "Velachery", "Mylapore"], service_type="VALUATION")
        southval_user = await user_service.create_user(
            db,
            email="vendor@southval.com",
            mobile="9200000003",
            full_name="SouthVal Vendor",
            password="vendor123",
            user_type=UserType.VENDOR,
            organization_id=southval.organization_id,
        )
        await vendor_service.create_vendor_user(db, user_id=southval_user.id, vendor_id=southval.id, role=VendorRole.VENDOR_ADMIN)
        print(f"  Created {southval.name} + user {southval_user.email}")

        # ── 30+ reports ───────────────────────────────────────────────────────
        print("\n[4/8] Creating reports…")

        # (vendor, category, city, pin_code, property_type, status, valuation_amount, days_ago, listing_approved, applicant, address, macro_location, latitude, longitude)
        report_specs = [
            # ValuePro — Bengaluru
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", "4500000", 180, True, "Rajesh Kumar", "12/3, 5th Cross, Koramangala 4th Block", "Koramangala", "12.9352", "77.6245"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", "7800000", 150, True, "Priya Sharma", "45, 8th Main, Koramangala 6th Block", "Koramangala", "12.9340", "77.6218"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560038", "COMMERCIAL", "PUBLISHED", "25000000", 120, True, "Sunita Patel", "103, HSR Layout, Sector 2", "HSR Layout", "12.9116", "77.6389"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560034", "RESIDENTIAL", "PUBLISHED", None, 90, True, "Amit Verma", "78, 3rd Main, Koramangala 5th Block", "Koramangala", "12.9346", "77.6230"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560071", "RESIDENTIAL", "PUBLISHED", "3200000", 60, True, "Deepa Nair", "22, 15th Cross, Jayanagar 4th Block", "Jayanagar", "12.9250", "77.5838"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560038", "RESIDENTIAL", "READY_TO_PUBLISH", "5500000", 30, False, "Mohan Rao", "56, Sector 7, HSR Layout", "HSR Layout", "12.9081", "77.6476"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560071", "COMMERCIAL", "PROCESSING", None, 10, False, "Kavitha Reddy", "88, 2nd Main, Jayanagar 3rd Block", "Jayanagar", "12.9263", "77.5821"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560008", "RESIDENTIAL", "UPLOADED", "2800000", 5, False, "Suresh Babu", "14/A, Indiranagar 1st Stage", "Indiranagar", "12.9784", "77.6408"),
            (valuepro_vendor, "VALUATION", "Bengaluru", "560034", "INDUSTRIAL", "PUBLISHED", "18000000", 200, True, "Ganesh Iyer", "Plot 7, Industrial Estate, Koramangala", "Koramangala", "12.9310", "77.6195"),
            (valuepro_vendor, "LEGAL", "Bengaluru", "560038", "RESIDENTIAL", "ARCHIVED", None, 365, False, "Lakshmi Devi", "33, 10th Main, HSR Layout", "HSR Layout", "12.9135", "77.6412"),

            # PropAssess — Mumbai
            (propassess, "VALUATION", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", "9500000", 160, True, "Anil Mehta", "B-204, Sea View Apartments, Bandra West", "Bandra", "19.0596", "72.8295"),
            (propassess, "VALUATION", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", "12000000", 130, True, "Neha Joshi", "A-301, Sai Kripa, Bandra East", "Bandra", "19.0544", "72.8402"),
            (propassess, "VALUATION", "Mumbai", "400053", "COMMERCIAL", "PUBLISHED", "45000000", 100, True, "Ramesh Shah", "Unit 5, Andheri Industrial Area", "Andheri", "19.1136", "72.8697"),
            (propassess, "LEGAL", "Mumbai", "400050", "RESIDENTIAL", "PUBLISHED", None, 80, True, "Pooja Kulkarni", "C-102, Palm Grove, Bandra", "Bandra", "19.0570", "72.8350"),
            (propassess, "VALUATION", "Mumbai", "400092", "RESIDENTIAL", "PUBLISHED", "6800000", 55, True, "Vijay Patil", "12, Borivali East, Sector 4", "Borivali", "19.2307", "72.8567"),
            (propassess, "VALUATION", "Mumbai", "400053", "RESIDENTIAL", "READY_TO_PUBLISH", "8200000", 25, False, "Suman Ghosh", "301, Skyline Heights, Andheri West", "Andheri", "19.1197", "72.8463"),
            (propassess, "LEGAL", "Mumbai", "400092", "COMMERCIAL", "PROCESSING", None, 12, False, "Hema Sawant", "Office 7, Borivali Commercial Plaza", "Borivali", "19.2283", "72.8591"),
            (propassess, "VALUATION", "Mumbai", "400028", "RESIDENTIAL", "UPLOADED", "15000000", 3, False, "Prakash Desai", "5A, Dadar Tilak Bridge Road", "Dadar", "19.0178", "72.8478"),

            # LegalEye — Delhi
            (legaleye, "LEGAL", "Delhi", "110017", "RESIDENTIAL", "PUBLISHED", None, 170, True, "Manish Gupta", "14, Saket Block C, South Delhi", "Saket", "28.5244", "77.2090"),
            (legaleye, "LEGAL", "Delhi", "110045", "RESIDENTIAL", "PUBLISHED", None, 140, True, "Reema Singh", "8, Pocket 3, Dwarka Sector 10", "Dwarka", "28.5823", "77.0500"),
            (legaleye, "LEGAL", "Delhi", "110085", "COMMERCIAL", "PUBLISHED", None, 110, True, "Alok Sharma", "Shop 22, Rohini Sector 7 Market", "Rohini", "28.7150", "77.1144"),
            (legaleye, "LEGAL", "Delhi", "110070", "RESIDENTIAL", "PUBLISHED", None, 75, True, "Sunita Tiwari", "Block A, Vasant Kunj Flat 203", "Vasant Kunj", "28.5205", "77.1567"),
            (legaleye, "LEGAL", "Delhi", "110017", "COMMERCIAL", "READY_TO_PUBLISH", None, 20, False, "Ashok Yadav", "Office 15, Saket District Centre", "Saket", "28.5270", "77.2127"),
            (legaleye, "LEGAL", "Delhi", "110045", "RESIDENTIAL", "PROCESSING", None, 8, False, "Meena Kapoor", "Flat 506, Dwarka Sector 12", "Dwarka", "28.5890", "77.0378"),

            # SouthVal — Chennai
            (southval, "VALUATION", "Chennai", "600017", "RESIDENTIAL", "PUBLISHED", "5200000", 190, True, "Krishnamurthy R", "23, T. Nagar 3rd Lane", "T. Nagar", "13.0418", "80.2341"),
            (southval, "VALUATION", "Chennai", "600020", "RESIDENTIAL", "PUBLISHED", "4800000", 145, True, "Saranya K", "6/2, Adyar Lattice Bridge Road", "Adyar", "13.0067", "80.2565"),
            (southval, "VALUATION", "Chennai", "600042", "COMMERCIAL", "PUBLISHED", "28000000", 105, True, "Venkat S", "Plot 44, Velachery Main Road", "Velachery", "12.9815", "80.2180"),
            (southval, "VALUATION", "Chennai", "600004", "RESIDENTIAL", "PUBLISHED", "6100000", 70, True, "Usha Rajan", "18, Mylapore 4th Street", "Mylapore", "13.0339", "80.2691"),
            (southval, "VALUATION", "Chennai", "600017", "AGRICULTURAL", "READY_TO_PUBLISH", "12000000", 22, False, "Balasubramaniam P", "Survey No 45, Poonamallee Road", "T. Nagar", "13.0450", "80.2290"),
            (southval, "VALUATION", "Chennai", "600020", "RESIDENTIAL", "UPLOADED", "3900000", 4, False, "Padma Vijay", "44, Adyar River View Apartments", "Adyar", "13.0035", "80.2598"),
            (southval, "VALUATION", "Chennai", "600042", "INDUSTRIAL", "PUBLISHED", "55000000", 230, True, "Raghunath T", "Industrial Plot 9, Velachery Industrial Estate", "Velachery", "12.9780", "80.2210"),
        ]

        reports = []
        for spec in report_specs:
            (vendor_obj, cat, city_name, pin, ptype, status, val_amt, days, lst_approved, applicant, address, macro, lat, lng) = spec
            r = Report(
                vendor_id=vendor_obj.id,
                report_category=ReportCategory(cat),
                status=ReportStatus(status),
                property_address=address,
                macro_location=macro,
                city=city_name,
                pin_code=pin,
                property_type=PropertyType(ptype),
                valuation_amount=Decimal(val_amt) if val_amt else None,
                loan_applicant_name=applicant,
                report_date=date_ago(days),
                listing_approved=lst_approved,
                latitude=Decimal(lat),
                longitude=Decimal(lng),
                is_active=True,
            )
            db.add(r)
            reports.append(r)
        await db.flush()
        print(f"  Created {len(reports)} reports.")

        # ── listings ──────────────────────────────────────────────────────────
        print("\n[5/8] Creating listings from published+approved reports…")

        listing_map: dict[tuple, Listing] = {}
        listing_report_entries = []
        listing_report_entries_by_key: list[tuple] = []

        for rpt in reports:
            if rpt.status == ReportStatus.PUBLISHED and rpt.listing_approved:
                key = (rpt.pin_code, rpt.property_type)
                if key not in listing_map:
                    lst = Listing(
                        macro_location=rpt.macro_location or "",
                        city=rpt.city or "",
                        pin_code=rpt.pin_code or "",
                        property_type=rpt.property_type,
                        status=ListingStatus.AVAILABLE,
                        report_count=0,
                        vendor_count=0,
                        latest_report_date=rpt.report_date,
                        is_active=True,
                    )
                    db.add(lst)
                    listing_map[key] = lst
                else:
                    lst = listing_map[key]
                    if rpt.report_date and (lst.latest_report_date is None or rpt.report_date > lst.latest_report_date):
                        lst.latest_report_date = rpt.report_date

                lst.report_count += 1
                listing_report_entries.append((lst, rpt))
                listing_report_entries_by_key.append((key, rpt))

        await db.flush()

        # update vendor_count per listing
        vendor_counts: dict[tuple, set] = defaultdict(set)
        for lst, rpt in listing_report_entries:
            key = (rpt.pin_code, rpt.property_type)
            vendor_counts[key].add(rpt.vendor_id)
        for key, lst in listing_map.items():
            lst.vendor_count = len(vendor_counts[key])

        # Compute averaged coordinates per listing
        for key, lst in listing_map.items():
            related_reports = [rpt for (k, rpt) in listing_report_entries_by_key if k == key]
            coords = [(rpt.latitude, rpt.longitude) for rpt in related_reports if rpt.latitude and rpt.longitude]
            if coords:
                lst.latitude = sum(c[0] for c in coords) / len(coords)
                lst.longitude = sum(c[1] for c in coords) / len(coords)

        for order, (lst, rpt) in enumerate(listing_report_entries):
            lr = ListingReport(listing_id=lst.id, report_id=rpt.id, display_order=order)
            db.add(lr)
        await db.flush()
        print(f"  Created {len(listing_map)} listings with {len(listing_report_entries)} listing-report links.")

        # ── report requests ───────────────────────────────────────────────────
        print("\n[6/8] Creating report requests…")

        # (lender, lender_user, request_type, cat, ptype, city, area, price, lender_status, vendor_status, days_ago, eta_days, applicant, address, accepted_vendor, accepted_report_idx_or_None)
        #  accepted_vendor / accepted_report_idx only used when lender_status=ACCEPTED
        request_specs = [
            # ABCL — Bengaluru
            (abcl_lender, abcl_user, "NEW", "VALUATION", "RESIDENTIAL", "Bengaluru", "Koramangala", "2500.00", "ACCEPTED", "ACCEPTED", 180, 5, "Rajesh Kumar", "12/3, 5th Cross, Koramangala", valuepro_vendor, 0),
            (abcl_lender, abcl_user, "NEW", "LEGAL", "RESIDENTIAL", "Bengaluru", "Jayanagar", "2000.00", "ACCEPTED", "ACCEPTED", 90, 7, "Deepa Nair", "22, 15th Cross, Jayanagar", valuepro_vendor, 3),
            (abcl_lender, abcl_user, "NEW", "VALUATION", "COMMERCIAL", "Bengaluru", "HSR Layout", "5000.00", "RECEIVED", "SENT", 30, 7, "Sunita Patel", "103, HSR Layout Sector 2", valuepro_vendor, None),
            (abcl_lender, abcl_user, "UPDATE", "VALUATION", "RESIDENTIAL", "Bengaluru", "Koramangala", "3500.00", "AWAITED", "PENDING", 15, 5, "Priya Sharma", "45, 8th Main, Koramangala", None, None),
            (abcl_lender, abcl_user, "NEARBY", "VALUATION", "RESIDENTIAL", "Bengaluru", "Indiranagar", "2500.00", "SENT", "INCOMING", 5, 5, "Suresh Babu", "14/A, Indiranagar 1st Stage", None, None),

            # HDFC — Mumbai
            (hdfc, hdfc_user, "NEW", "VALUATION", "RESIDENTIAL", "Mumbai", "Bandra", "3000.00", "ACCEPTED", "ACCEPTED", 160, 7, "Anil Mehta", "B-204, Sea View Apartments", propassess, 10),
            (hdfc, hdfc_user, "NEW", "LEGAL", "RESIDENTIAL", "Mumbai", "Bandra", "2500.00", "ACCEPTED", "ACCEPTED", 80, 7, "Pooja Kulkarni", "C-102, Palm Grove, Bandra", propassess, 13),
            (hdfc, hdfc_user, "NEW", "VALUATION", "COMMERCIAL", "Mumbai", "Andheri", "6000.00", "RECEIVED", "SENT", 40, 10, "Ramesh Shah", "Unit 5, Andheri Industrial Area", propassess, None),
            (hdfc, hdfc_user, "UPDATE", "VALUATION", "RESIDENTIAL", "Mumbai", "Borivali", "4200.00", "AWAITED", "PENDING", 20, 7, "Vijay Patil", "12, Borivali East", None, None),
            (hdfc, hdfc_user, "NEW", "VALUATION", "RESIDENTIAL", "Mumbai", "Andheri", "3000.00", "SENT", "INCOMING", 3, 7, "Suman Ghosh", "301, Skyline Heights", None, None),

            # SBI — Delhi
            (sbi, sbi_user, "NEW", "LEGAL", "RESIDENTIAL", "Delhi", "Saket", "2500.00", "ACCEPTED", "ACCEPTED", 170, 7, "Manish Gupta", "14, Saket Block C", legaleye, 18),
            (sbi, sbi_user, "NEW", "LEGAL", "RESIDENTIAL", "Delhi", "Dwarka", "2500.00", "ACCEPTED", "ACCEPTED", 140, 7, "Reema Singh", "8, Pocket 3, Dwarka", legaleye, 19),
            (sbi, sbi_user, "NEW", "LEGAL", "COMMERCIAL", "Delhi", "Rohini", "4500.00", "RECEIVED", "SENT", 50, 10, "Alok Sharma", "Shop 22, Rohini Sector 7", legaleye, None),
            (sbi, sbi_user, "NEARBY", "LEGAL", "RESIDENTIAL", "Delhi", "Vasant Kunj", "2500.00", "AWAITED", "PENDING", 18, 7, "Sunita Tiwari", "Block A, Vasant Kunj", None, None),
            (sbi, sbi_user, "NEW", "LEGAL", "RESIDENTIAL", "Delhi", "Saket", "2500.00", "SENT", "INCOMING", 2, 7, "Ashok Yadav", "Office 15, Saket", None, None),

            # ICICI — Chennai
            (icici, icici_user, "NEW", "VALUATION", "RESIDENTIAL", "Chennai", "T. Nagar", "3000.00", "ACCEPTED", "ACCEPTED", 190, 7, "Krishnamurthy R", "23, T. Nagar 3rd Lane", southval, 24),
            (icici, icici_user, "NEW", "VALUATION", "RESIDENTIAL", "Chennai", "Adyar", "3000.00", "ACCEPTED", "ACCEPTED", 145, 5, "Saranya K", "6/2, Adyar Lattice Bridge Road", southval, 25),
            (icici, icici_user, "NEW", "VALUATION", "COMMERCIAL", "Chennai", "Velachery", "6000.00", "RECEIVED", "SENT", 45, 10, "Venkat S", "Plot 44, Velachery Main Road", southval, None),
            (icici, icici_user, "UPDATE", "VALUATION", "RESIDENTIAL", "Chennai", "Mylapore", "4000.00", "AWAITED", "PENDING", 10, 7, "Usha Rajan", "18, Mylapore 4th Street", None, None),
            (icici, icici_user, "NEW", "VALUATION", "RESIDENTIAL", "Chennai", "T. Nagar", "3000.00", "SENT", "INCOMING", 1, 5, "Padma Vijay", "44, Adyar River View", None, None),
            (icici, icici_user, "NEW", "VALUATION", "INDUSTRIAL", "Chennai", "Velachery", "8000.00", "ACCEPTED", "ACCEPTED", 230, 14, "Raghunath T", "Industrial Plot 9, Velachery", southval, 30),
        ]

        req_objects = []
        for spec in request_specs:
            (lender_obj, lu, rtype, cat, ptype, city_name, area_name, price_str,
             l_status, v_status, days, eta, applicant, address, acc_vendor, acc_rpt_idx) = spec

            parent_report_id = None
            if rtype in ("UPDATE", "NEARBY") and acc_rpt_idx is not None:
                parent_report_id = reports[acc_rpt_idx].id

            req = ReportRequest(
                lender_id=lender_obj.id,
                lender_user_id=lu.id,
                request_type=RequestType(rtype),
                report_category=ReportCategory(cat),
                property_type=PropertyType(ptype),
                property_address=address,
                city=city_name,
                area=area_name,
                price=Decimal(price_str),
                lender_status=LenderRequestStatus(l_status),
                vendor_status=VendorRequestStatus(v_status) if v_status else None,
                eta_days=eta,
                loan_applicant_name=applicant,
                parent_report_id=parent_report_id,
            )
            db.add(req)
            req_objects.append((req, acc_vendor, acc_rpt_idx))

        await db.flush()

        # Broadcasts + Acceptances for accepted/received requests
        for req, acc_vendor, acc_rpt_idx in req_objects:
            if req.lender_status in (LenderRequestStatus.ACCEPTED, LenderRequestStatus.RECEIVED,
                                      LenderRequestStatus.AWAITED, LenderRequestStatus.SENT):
                bcast_status = BroadcastStatus.ACCEPTED if req.lender_status == LenderRequestStatus.ACCEPTED else BroadcastStatus.ACTIVE
                deadline = dt_ago(0) + timedelta(hours=24)
                bcast = RequestBroadcast(
                    request_id=req.id,
                    vendor_ids=[acc_vendor.id] if acc_vendor else None,
                    broadcast_round=1,
                    accept_deadline=deadline,
                    status=bcast_status,
                )
                db.add(bcast)

                if req.lender_status == LenderRequestStatus.ACCEPTED and acc_vendor and acc_rpt_idx is not None:
                    acceptance = RequestAcceptance(
                        request_id=req.id,
                        vendor_id=acc_vendor.id,
                        report_id=reports[acc_rpt_idx].id,
                        accepted_at=dt_ago(5),
                    )
                    db.add(acceptance)

        await db.flush()
        print(f"  Created {len(req_objects)} requests with broadcasts/acceptances.")

        # ── report purchases ──────────────────────────────────────────────────
        print("\n[7/8] Creating report purchases & billing data…")

        # Pick some published+listing_approved reports and have cross-lender purchases
        # Reports indices: 0-9=ValuePro, 10-17=PropAssess, 18-23=LegalEye, 24-30=SouthVal
        purchase_specs = [
            # (lender, lender_user, report_idx, price)
            (hdfc, hdfc_user, 0, "1500.00"),   # HDFC buys ValuePro Bengaluru residential
            (hdfc, hdfc_user, 3, "1200.00"),   # HDFC buys ValuePro Bengaluru legal
            (sbi, sbi_user, 0, "1500.00"),     # SBI buys ValuePro Bengaluru residential
            (sbi, sbi_user, 8, "1800.00"),     # SBI buys ValuePro industrial
            (icici, icici_user, 10, "1800.00"),# ICICI buys PropAssess Mumbai residential
            (icici, icici_user, 13, "1500.00"),# ICICI buys PropAssess Mumbai legal
            (abcl_lender, abcl_user, 10, "1800.00"),  # ABCL buys PropAssess Mumbai
            (abcl_lender, abcl_user, 18, "1500.00"),  # ABCL buys LegalEye Delhi
            (hdfc, hdfc_user, 24, "1800.00"),  # HDFC buys SouthVal Chennai
            (sbi, sbi_user, 25, "1800.00"),    # SBI buys SouthVal Chennai
            (icici, icici_user, 1, "1500.00"), # ICICI buys ValuePro Bengaluru
        ]

        # collect accepted requests by lender for billing linkage
        accepted_requests_by_lender = {}
        for req, acc_vendor, acc_rpt_idx in req_objects:
            if req.lender_status == LenderRequestStatus.ACCEPTED:
                accepted_requests_by_lender.setdefault(req.lender_id, []).append(req)

        purchases = []
        for lender_obj, lu, rpt_idx, price_str in purchase_specs:
            rpt = reports[rpt_idx]
            # find listing for this report
            lst_key = (rpt.pin_code, rpt.property_type)
            lst = listing_map.get(lst_key)
            if not lst:
                continue
            purchase = ReportPurchase(
                report_id=rpt.id,
                listing_id=lst.id,
                lender_id=lender_obj.id,
                purchased_by=lu.id,
                price=Decimal(price_str),
            )
            db.add(purchase)
            purchases.append((lender_obj, rpt, Decimal(price_str)))

        await db.flush()
        print(f"  Created {len(purchases)} report purchases.")

        # ── billing: VendorEarnings + LenderPayables ──────────────────────────
        # From accepted requests
        billing_entries = 0
        for req, acc_vendor, acc_rpt_idx in req_objects:
            if req.lender_status == LenderRequestStatus.ACCEPTED and acc_vendor and acc_rpt_idx is not None:
                rpt = reports[acc_rpt_idx]
                price = req.price or Decimal("2500.00")
                # month = ~days_ago of creation
                month_str = months_ago(0)  # just use current month for simplicity

                payable_type_map = {
                    RequestType.NEW: PayableType.NEW_REQUEST,
                    RequestType.UPDATE: PayableType.UPDATE,
                    RequestType.NEARBY: PayableType.NEARBY,
                }
                pt = payable_type_map.get(req.request_type, PayableType.NEW_REQUEST)

                # spread across current + previous FY with weighted distribution
                h = int(hashlib.md5(str(req.id).encode()).hexdigest(), 16)
                m_offset = MONTH_WEIGHTS[h % len(MONTH_WEIGHTS)]
                month_str = months_ago(m_offset)

                status_choices = [PaymentStatus.PAID, PaymentStatus.PAID, PaymentStatus.BILLED, PaymentStatus.PENDING]
                pay_status = status_choices[h % len(status_choices)]

                ve = VendorEarning(
                    vendor_id=acc_vendor.id,
                    report_id=rpt.id,
                    request_id=req.id,
                    lender_id=req.lender_id,
                    amount=price * Decimal("0.85"),
                    earning_type=EarningType.REQUEST,
                    month=month_str,
                )
                db.add(ve)

                lp = LenderPayable(
                    lender_id=req.lender_id,
                    report_id=rpt.id,
                    request_id=req.id,
                    amount=price,
                    payable_type=pt,
                    status=pay_status,
                    month=month_str,
                )
                db.add(lp)
                billing_entries += 2

        # From listing purchases
        for idx, (lender_obj, rpt, price) in enumerate(purchases):
            m_offset = MONTH_WEIGHTS[idx % len(MONTH_WEIGHTS)]
            month_str = months_ago(m_offset)
            status_choices = [PaymentStatus.PAID, PaymentStatus.BILLED, PaymentStatus.PENDING]
            pay_status = status_choices[idx % len(status_choices)]

            ve = VendorEarning(
                vendor_id=rpt.vendor_id,
                report_id=rpt.id,
                request_id=None,
                lender_id=lender_obj.id,
                amount=price * Decimal("0.80"),
                earning_type=EarningType.LISTING_DOWNLOAD,
                month=month_str,
            )
            db.add(ve)

            lp = LenderPayable(
                lender_id=lender_obj.id,
                report_id=rpt.id,
                request_id=None,
                amount=price,
                payable_type=PayableType.LISTING_DOWNLOAD,
                status=pay_status,
                month=month_str,
            )
            db.add(lp)
            billing_entries += 2

        await db.flush()
        print(f"  Created {billing_entries} billing entries (VendorEarnings + LenderPayables).")

        # ── notifications ─────────────────────────────────────────────────────
        print("\n[8/8] Creating notifications…")

        notif_specs = [
            # (user, event_type, title, message, reference_id_from, reference_type, is_read)
            (valuepro_user, "NEW_BROADCAST", "New Request Available", "A new valuation request for Koramangala RESIDENTIAL is available.", req_objects[0][0].id, "REQUEST", True),
            (valuepro_user, "REQUEST_ACCEPTED", "Request Accepted", "Your valuation report for Rajesh Kumar has been accepted by ABCL Bank.", req_objects[0][0].id, "REQUEST", True),
            (valuepro_user, "NEW_BROADCAST", "New Request Available", "A new legal request for Jayanagar RESIDENTIAL is available.", req_objects[1][0].id, "REQUEST", True),
            (valuepro_user, "LISTING_DOWNLOADED", "Listing Downloaded", "HDFC Home Loans downloaded your Koramangala RESIDENTIAL report.", reports[0].id, "REPORT", False),
            (valuepro_user, "LISTING_DOWNLOADED", "Listing Downloaded", "SBI Housing downloaded your Bengaluru RESIDENTIAL report.", reports[0].id, "REPORT", False),
            (propassess_user, "NEW_BROADCAST", "New Request Available", "A new valuation request for Bandra RESIDENTIAL is available.", req_objects[5][0].id, "REQUEST", True),
            (propassess_user, "REQUEST_ACCEPTED", "Request Accepted", "Your valuation report for Anil Mehta accepted by HDFC Home Loans.", req_objects[5][0].id, "REQUEST", True),
            (propassess_user, "LISTING_DOWNLOADED", "Listing Downloaded", "ABCL Bank downloaded your Mumbai RESIDENTIAL report.", reports[10].id, "REPORT", False),
            (legaleye_user, "NEW_BROADCAST", "New Request Available", "A new legal request for Saket RESIDENTIAL is available.", req_objects[10][0].id, "REQUEST", True),
            (legaleye_user, "REQUEST_ACCEPTED", "Request Accepted", "Your legal report for Manish Gupta accepted by SBI Housing.", req_objects[10][0].id, "REQUEST", True),
            (southval_user, "NEW_BROADCAST", "New Request Available", "A new valuation request for T. Nagar RESIDENTIAL is available.", req_objects[15][0].id, "REQUEST", True),
            (southval_user, "REQUEST_ACCEPTED", "Request Accepted", "Your valuation report for Krishnamurthy R accepted by ICICI Bank.", req_objects[15][0].id, "REQUEST", True),
            (southval_user, "LISTING_DOWNLOADED", "Listing Downloaded", "HDFC Home Loans downloaded your Chennai RESIDENTIAL report.", reports[24].id, "REPORT", False),
            (abcl_user, "REVISION_REQUESTED", "Revision Requested", "Revision requested on valuation report for HSR Layout COMMERCIAL.", req_objects[2][0].id, "REQUEST", False),
            (hdfc_user, "NEW_BROADCAST", "New Request Available", "Your request for Andheri COMMERCIAL has been broadcast.", req_objects[7][0].id, "REQUEST", True),
            (sbi_user, "REQUEST_ACCEPTED", "Request Accepted", "Legal report for Reema Singh has been accepted.", req_objects[11][0].id, "REQUEST", True),
            (icici_user, "REQUEST_ACCEPTED", "Request Accepted", "Valuation report for Saranya K has been accepted.", req_objects[16][0].id, "REQUEST", False),
        ]

        notif_count = 0
        for spec in notif_specs:
            user_obj, event_type, title, message, ref_id, ref_type, is_read = spec
            n = Notification(
                user_id=user_obj.id,
                event_type=NotificationEventType(event_type),
                title=title,
                message=message,
                reference_id=ref_id,
                reference_type=NotificationReferenceType(ref_type),
                is_read=is_read,
            )
            db.add(n)
            notif_count += 1

        await db.flush()
        print(f"  Created {notif_count} notifications.")

        # ── Sample report templates ──────────────────────────────────────
        from app.models.template import ReportTemplate

        template_configs = [
            {
                "lender": abcl_lender,
                "name": "ABCL Standard Template",
                "config": {
                    "header": {
                        "bank_name": "ABCL Bank",
                        "primary_color": "#1a3b5c",
                        "secondary_color": "#f0f4f8",
                        "show_logo": True,
                        "subtitle": "Property Valuation Report",
                    },
                    "sections": [
                        {"key": "property_address", "label": "Property Address", "enabled": True, "order": 1},
                        {"key": "property_type", "label": "Property Type", "enabled": True, "order": 2},
                        {"key": "valuation_amount", "label": "Valuation Amount", "enabled": True, "order": 3},
                        {"key": "loan_applicant_name", "label": "Applicant Name", "enabled": True, "order": 4},
                        {"key": "report_date", "label": "Report Date", "enabled": True, "order": 5},
                        {"key": "city", "label": "City", "enabled": True, "order": 6},
                        {"key": "pin_code", "label": "PIN Code", "enabled": True, "order": 7},
                        {"key": "plot_extent_sqft", "label": "Plot Area (sq ft)", "enabled": False, "order": 8},
                        {"key": "built_up_sqft", "label": "Built-up Area (sq ft)", "enabled": False, "order": 9},
                        {"key": "expiry_date", "label": "Expiry Date", "enabled": False, "order": 10},
                    ],
                    "footer": {
                        "text": "Confidential - ABCL Bank Internal Use Only",
                        "show_page_numbers": True,
                    },
                },
            },
            {
                "lender": hdfc,
                "name": "HDFC Valuation Format",
                "config": {
                    "header": {
                        "bank_name": "HDFC Home Loans",
                        "primary_color": "#004b87",
                        "secondary_color": "#e8f0fe",
                        "show_logo": True,
                        "subtitle": "Property Assessment Report",
                    },
                    "sections": [
                        {"key": "loan_applicant_name", "label": "Borrower Name", "enabled": True, "order": 1},
                        {"key": "property_address", "label": "Property Location", "enabled": True, "order": 2},
                        {"key": "city", "label": "City", "enabled": True, "order": 3},
                        {"key": "property_type", "label": "Property Category", "enabled": True, "order": 4},
                        {"key": "valuation_amount", "label": "Assessed Market Value", "enabled": True, "order": 5},
                        {"key": "plot_extent_sqft", "label": "Plot Extent (sq ft)", "enabled": True, "order": 6},
                        {"key": "built_up_sqft", "label": "Built-up Area (sq ft)", "enabled": True, "order": 7},
                        {"key": "report_date", "label": "Assessment Date", "enabled": True, "order": 8},
                        {"key": "expiry_date", "label": "Valid Until", "enabled": True, "order": 9},
                    ],
                    "footer": {
                        "text": "HDFC Home Loans - Confidential Document",
                        "show_page_numbers": True,
                    },
                },
            },
        ]

        for tc in template_configs:
            t = ReportTemplate(
                lender_id=tc["lender"].id,
                name=tc["name"],
                is_active=True,
                config_json=tc["config"],
            )
            db.add(t)
        await db.flush()
        print(f"  Created {len(template_configs)} report templates.")

        print("\nDemo seed complete!")
        print(f"  Lenders:   4 (ABCL Bank, HDFC Home Loans, SBI Housing, ICICI Bank)")
        print(f"  Vendors:   4 (ValuePro Consultants, PropAssess India, LegalEye Associates, SouthVal Services)")
        print(f"  Reports:   {len(reports)}")
        print(f"  Listings:  {len(listing_map)}")
        print(f"  Requests:  {len(req_objects)}")
        print(f"  Purchases: {len(purchases)}")
        print(f"  Billing:   {billing_entries} entries")
        print(f"  Notifs:    {notif_count}")


if __name__ == "__main__":
    asyncio.run(seed_demo())
