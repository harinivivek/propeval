# Phase 6: Update & Nearby Requests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable lenders to request updated reports for existing properties and new reports for nearby properties, using listings as the entry point.

**Architecture:** Extend the existing request service to accept UPDATE/NEARBY request types with parent_report_id. Add two new lender API endpoints. Update billing to use correct payable types. Add frontend dialogs on listing detail and purchased reports pages, and show parent report context on vendor request detail.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-10-phase6-update-nearby-requests-design.md`

---

## File Structure

### Backend — Modify

| File | Change |
|------|--------|
| `backend/app/core/constants.py` | Add `UPDATE_CHECKLIST_ITEMS` dict |
| `backend/app/services/request_service.py` | Extend `create_request()` with `request_type` + `parent_report_id` params; fix billing payable type in `accept_report()` |
| `backend/app/services/billing_service.py` | Accept `payable_type` param instead of hardcoding `NEW_REQUEST` |
| `backend/app/schemas/request.py` | Add `UpdateRequestInput` and `NearbyRequestInput` schemas |
| `backend/app/api/lender/requests.py` | Add `POST /update` and `POST /nearby` endpoints |

### Frontend — Create

| File | Responsibility |
|------|---------------|
| `frontend/src/app/lender/listings/[id]/_components/update-request-dialog.tsx` | Update request modal with checklist + comments |
| `frontend/src/app/lender/listings/[id]/_components/nearby-request-dialog.tsx` | Nearby request modal with address form |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx` | Add "Request Update" button |
| `frontend/src/app/lender/listings/[id]/page.tsx` | Add "Request Nearby Report" button + wire dialogs |
| `frontend/src/app/lender/listings/purchases/page.tsx` | Add "Request Update" button per row |
| `frontend/src/app/lender/requests/[id]/page.tsx` | Show parent report context + request type badge |
| `frontend/src/app/vendor/requests/[id]/page.tsx` | Show parent report context + checklist for UPDATE |
| `frontend/src/app/vendor/requests/_components/request-table.tsx` | Add request type badges (if this file exists; else modify vendor requests page directly) |

---

## Task 1: Backend Constants — Update Checklist Items

**Files:**
- Modify: `backend/app/core/constants.py`

- [ ] **Step 1: Add checklist constants**

Append to `backend/app/core/constants.py`:

```python
UPDATE_CHECKLIST_ITEMS = {
    "RECHECK_VALUATION": "Recheck valuation amount",
    "VERIFY_BOUNDARIES": "Verify property boundaries",
    "UPDATE_PHOTOS": "Update property photos",
    "VERIFY_OCCUPANCY": "Verify current occupancy",
    "UPDATE_CONSTRUCTION": "Update construction status",
    "VERIFY_LEGAL_STATUS": "Verify legal/title status",
    "OTHER": "Other (see comments)",
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/constants.py
git commit -m "feat(phase6): add update checklist constants"
```

---

## Task 2: Billing Service — Dynamic Payable Type

**Files:**
- Modify: `backend/app/services/billing_service.py`

- [ ] **Step 1: Add payable type parameter to `create_billing_entries`**

The current function hardcodes `payable_type=PayableType.NEW_REQUEST`. Change it to accept a parameter. Read the file first, then modify:

Change the function signature from:

```python
async def create_billing_entries(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> tuple[VendorEarning, LenderPayable]:
```

To:

```python
async def create_billing_entries(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
    payable_type: PayableType | None = None,
) -> tuple[VendorEarning, LenderPayable]:
```

And change the payable creation from:

```python
    payable = LenderPayable(
        lender_id=request.lender_id,
        report_id=report.id,
        request_id=request.id,
        amount=request.price,
        payable_type=PayableType.NEW_REQUEST,
        status=PaymentStatus.PENDING,
        month=month,
    )
```

To:

```python
    resolved_payable_type = payable_type or PayableType.NEW_REQUEST
    payable = LenderPayable(
        lender_id=request.lender_id,
        report_id=report.id,
        request_id=request.id,
        amount=request.price,
        payable_type=resolved_payable_type,
        status=PaymentStatus.PENDING,
        month=month,
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/billing_service.py
git commit -m "feat(phase6): add dynamic payable type to billing entries"
```

---

## Task 3: Request Service — Support UPDATE/NEARBY

**Files:**
- Modify: `backend/app/services/request_service.py`

- [ ] **Step 1: Extend `create_request()` to accept request_type and parent_report_id**

Add two new parameters to `create_request()`:

```python
async def create_request(
    db: AsyncSession,
    *,
    lender_id: UUID,
    lender_user_id: UUID,
    branch_id: UUID | None = None,
    report_category: str,
    property_address: str,
    city: str,
    area: str | None = None,
    pin_code: str | None = None,
    property_type: str,
    plot_extent_sqft: Decimal | None = None,
    built_up_sqft: Decimal | None = None,
    loan_applicant_name: str,
    vendor_specified_id: UUID | None = None,
    allow_broadcast_on_reject: bool = True,
    comments: str | None = None,
    request_type: str = "NEW",
    parent_report_id: UUID | None = None,
) -> ReportRequest:
```

Change the pricing call from:

```python
    price_result = await pricing_service.get_price(
        db,
        lender_id=lender_id,
        report_category=report_category,
        city=city,
        area=area,
        property_type=property_type,
        request_type="NEW",
    )
```

To:

```python
    price_result = await pricing_service.get_price(
        db,
        lender_id=lender_id,
        report_category=report_category,
        city=city,
        area=area,
        property_type=property_type,
        request_type=request_type,
    )
```

Change the ReportRequest creation from:

```python
    request = ReportRequest(
        lender_id=lender_id,
        lender_user_id=lender_user_id,
        branch_id=branch_id,
        request_type=RequestType.NEW,
        report_category=ReportCategory(report_category),
```

To:

```python
    request = ReportRequest(
        lender_id=lender_id,
        lender_user_id=lender_user_id,
        branch_id=branch_id,
        request_type=RequestType(request_type),
        report_category=ReportCategory(report_category),
```

And add `parent_report_id` to the ReportRequest constructor — after the `comments=comments` line, add:

```python
        parent_report_id=parent_report_id,
```

- [ ] **Step 2: Update `accept_report()` to pass correct payable type**

Add a mapping at the top of `accept_report()` and pass it to billing:

```python
async def accept_report(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> None:
    """Lender accepts the report — billing + listing."""
    if request.lender_status not in (
        LenderRequestStatus.RECEIVED,
    ):
        raise InvalidStatusTransition(
            f"Cannot accept from status {request.lender_status}"
        )

    request.lender_status = LenderRequestStatus.ACCEPTED
    request.vendor_status = VendorRequestStatus.ACCEPTED
    report.listing_approved = True

    _PAYABLE_TYPE_MAP = {
        RequestType.NEW: PayableType.NEW_REQUEST,
        RequestType.UPDATE: PayableType.UPDATE,
        RequestType.NEARBY: PayableType.NEARBY,
    }
    payable_type = _PAYABLE_TYPE_MAP.get(request.request_type, PayableType.NEW_REQUEST)

    # Create billing entries
    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
        payable_type=payable_type,
    )

    # Create or update listing
    await _create_or_update_listing(db, report=report)

    await db.flush()
```

This requires importing `PayableType` — add to the imports at the top of the file:

```python
from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PayableType,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/request_service.py
git commit -m "feat(phase6): support UPDATE/NEARBY request types in request service"
```

---

## Task 4: Pydantic Schemas — Update and Nearby Inputs

**Files:**
- Modify: `backend/app/schemas/request.py`

- [ ] **Step 1: Add input schemas**

Append to `backend/app/schemas/request.py`:

```python
class UpdateRequestInput(BaseModel):
    report_id: UUID
    checklist: list[str]
    comments: str | None = None


class NearbyRequestInput(BaseModel):
    report_id: UUID
    property_address: str
    city: str
    pin_code: str
    area: str | None = None
    report_category: str
    comments: str | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/request.py
git commit -m "feat(phase6): add UpdateRequestInput and NearbyRequestInput schemas"
```

---

## Task 5: Lender API — Update and Nearby Endpoints

**Files:**
- Modify: `backend/app/api/lender/requests.py`

- [ ] **Step 1: Add imports for new schemas and models**

Add to the imports at the top of `backend/app/api/lender/requests.py`:

```python
import json

from app.schemas.request import (
    EligibleVendorResponse,
    NearbyRequestInput,
    RejectReportInput,
    ReportRequestCreateInput,
    ReportRequestDetail,
    ReportRequestResponse,
    UpdateRequestInput,
)
```

Also add Report and LenderUser imports at the top level (currently they're imported inline):

```python
from sqlalchemy import select
from app.models.lender import LenderUser
from app.models.report import Report
```

- [ ] **Step 2: Add the update endpoint**

Add after the existing `create_request` endpoint:

```python
@router.post("/update", response_model=ReportRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_update_request(
    payload: UpdateRequestInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    report_result = await db.execute(
        select(Report).where(Report.id == payload.report_id, Report.is_active == True)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    structured_comments = json.dumps({
        "checklist": payload.checklist,
        "text": payload.comments or "",
    })

    try:
        request = await request_service.create_request(
            db,
            lender_id=lender_user.lender_id,
            lender_user_id=current_user.id,
            report_category=report.report_category.value if hasattr(report.report_category, "value") else str(report.report_category),
            property_address=report.property_address or "",
            city=report.city or "",
            area=report.area if hasattr(report, "area") else None,
            pin_code=report.pin_code,
            property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type),
            plot_extent_sqft=report.plot_extent_sqft,
            loan_applicant_name=report.loan_applicant_name or "",
            vendor_specified_id=report.vendor_id,
            allow_broadcast_on_reject=True,
            comments=structured_comments,
            request_type="UPDATE",
            parent_report_id=report.id,
        )
    except PricingNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NoVendorsAvailableError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return request
```

- [ ] **Step 3: Add the nearby endpoint**

Add after the update endpoint:

```python
@router.post("/nearby", response_model=ReportRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_nearby_request(
    payload: NearbyRequestInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == current_user.id)
    )
    lender_user = result.scalar_one_or_none()
    if not lender_user:
        raise HTTPException(status_code=400, detail="User not associated with a lender")

    report_result = await db.execute(
        select(Report).where(Report.id == payload.report_id, Report.is_active == True)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Reference report not found")

    try:
        request = await request_service.create_request(
            db,
            lender_id=lender_user.lender_id,
            lender_user_id=current_user.id,
            report_category=payload.report_category,
            property_address=payload.property_address,
            city=payload.city,
            area=payload.area,
            pin_code=payload.pin_code,
            property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type),
            loan_applicant_name="",
            vendor_specified_id=report.vendor_id,
            allow_broadcast_on_reject=True,
            comments=payload.comments,
            request_type="NEARBY",
            parent_report_id=report.id,
        )
    except PricingNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NoVendorsAvailableError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return request
```

- [ ] **Step 4: Verify backend starts**

```bash
docker compose -f docker-compose.local.yml restart backend
docker compose -f docker-compose.local.yml logs backend --tail=5
```

Expected: Application startup complete, no import errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/lender/requests.py
git commit -m "feat(phase6): add update and nearby request endpoints"
```

---

## Task 6: Frontend — Update Request Dialog

**Files:**
- Create: `frontend/src/app/lender/listings/[id]/_components/update-request-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `frontend/src/app/lender/listings/[id]/_components/update-request-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const CHECKLIST_ITEMS: Record<string, string> = {
  RECHECK_VALUATION: "Recheck valuation amount",
  VERIFY_BOUNDARIES: "Verify property boundaries",
  UPDATE_PHOTOS: "Update property photos",
  VERIFY_OCCUPANCY: "Verify current occupancy",
  UPDATE_CONSTRUCTION: "Update construction status",
  VERIFY_LEGAL_STATUS: "Verify legal/title status",
  OTHER: "Other (see comments)",
};

interface Props {
  reportId: string;
  reportCategory: string;
  locality: string | null;
  reportDate: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UpdateRequestDialog({
  reportId,
  reportCategory,
  locality,
  reportDate,
  onSuccess,
  onCancel,
}: Props) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = (key: string) => {
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    if (checklist.length === 0) {
      setError("Please select at least one update item");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/update", {
        report_id: reportId,
        checklist,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create update request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-1">Request Report Update</h3>
        <p className="text-sm text-gray-500 mb-4">
          {reportCategory} report{locality ? ` · ${locality}` : ""}
          {reportDate ? ` · ${reportDate}` : ""}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What needs updating?
          </label>
          <div className="space-y-2">
            {Object.entries(CHECKLIST_ITEMS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.includes(key)}
                  onChange={() => toggleItem(key)}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Any specific instructions for the vendor..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Price per your lender pricing agreement.
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Update Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/listings/\[id\]/_components/update-request-dialog.tsx
git commit -m "feat(phase6): add update request dialog component"
```

---

## Task 7: Frontend — Nearby Request Dialog

**Files:**
- Create: `frontend/src/app/lender/listings/[id]/_components/nearby-request-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `frontend/src/app/lender/listings/[id]/_components/nearby-request-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  referenceReportId: string;
  listingCity: string;
  listingPinCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NearbyRequestDialog({
  referenceReportId,
  listingCity,
  listingPinCode,
  onSuccess,
  onCancel,
}: Props) {
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState(listingCity);
  const [pinCode, setPinCode] = useState(listingPinCode);
  const [area, setArea] = useState("");
  const [reportCategory, setReportCategory] = useState("VALUATION");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!propertyAddress.trim()) {
      setError("Property address is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/api/lender/requests/nearby", {
        report_id: referenceReportId,
        property_address: propertyAddress,
        city,
        pin_code: pinCode,
        area: area || null,
        report_category: reportCategory,
        comments: comments || null,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create nearby request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-1">Request Nearby Report</h3>
        <p className="text-sm text-gray-500 mb-4">
          Request a report for a property near this listing area.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="Full property address"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pin Code</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area (optional)</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., Koramangala"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="VALUATION">Valuation</option>
              <option value="LEGAL">Legal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              placeholder="Any additional details for the vendor..."
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Price per your lender pricing agreement.
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Nearby Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/listings/\[id\]/_components/nearby-request-dialog.tsx
git commit -m "feat(phase6): add nearby request dialog component"
```

---

## Task 8: Frontend — Wire Dialogs to Listing Detail Page

**Files:**
- Modify: `frontend/src/app/lender/listings/[id]/page.tsx`
- Modify: `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx`

- [ ] **Step 1: Add "Request Update" button to report preview card**

In `frontend/src/app/lender/listings/[id]/_components/report-preview-card.tsx`, add an `onRequestUpdate` prop and a button.

Update the Props interface:

```tsx
interface Props {
  report: RedactedReportPreview;
  onPurchase: (reportId: string) => void;
  onDownload: (reportId: string) => void;
  onRequestUpdate: (reportId: string) => void;
}
```

Update the component to accept `onRequestUpdate` in destructuring:

```tsx
export function ReportPreviewCard({ report, onPurchase, onDownload, onRequestUpdate }: Props) {
```

Add an "Update" button in the action area. Replace the existing `<div className="flex justify-end">` block with:

```tsx
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onRequestUpdate(report.id)}
          className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
        >
          Request Update
        </button>
        {report.is_purchased ? (
          <button
            onClick={() => onDownload(report.id)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download
          </button>
        ) : (
          <button
            onClick={() => onPurchase(report.id)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Buy Report
          </button>
        )}
      </div>
```

- [ ] **Step 2: Wire dialogs in listing detail page**

In `frontend/src/app/lender/listings/[id]/page.tsx`:

Add imports at the top:

```tsx
import { UpdateRequestDialog } from "./_components/update-request-dialog";
import { NearbyRequestDialog } from "./_components/nearby-request-dialog";
```

Add state variables after the existing state declarations:

```tsx
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [showNearbyDialog, setShowNearbyDialog] = useState(false);
  const [nearbyRefReportId, setNearbyRefReportId] = useState<string | null>(null);
```

Add a function to find report details for the update dialog:

```tsx
  const getReportForUpdate = (reportId: string) => {
    return data?.reports.find((r) => r.id === reportId) || null;
  };
```

Add the "Request Nearby Report" button in the listing header section, after the existing `<p>` showing report/vendor counts:

```tsx
        <button
          onClick={() => {
            const firstReport = reports.length > 0 ? reports[0] : null;
            if (firstReport) {
              setNearbyRefReportId(firstReport.id);
              setShowNearbyDialog(true);
            }
          }}
          className="mt-3 px-4 py-2 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50"
        >
          Request Nearby Report
        </button>
```

Pass `onRequestUpdate` to each `ReportPreviewCard`:

```tsx
          <ReportPreviewCard
            key={r.id}
            report={r}
            onPurchase={(id) => {
              const report = reports.find((rp) => rp.id === id);
              if (report) setPurchasingReport(report);
            }}
            onDownload={handleDownload}
            onRequestUpdate={(id) => setUpdateReportId(id)}
          />
```

Add the dialogs before the closing `</div>` of the return, after the purchase dialog:

```tsx
      {updateReportId && (() => {
        const rpt = getReportForUpdate(updateReportId);
        return rpt ? (
          <UpdateRequestDialog
            reportId={updateReportId}
            reportCategory={rpt.report_category}
            locality={rpt.locality}
            reportDate={rpt.report_date}
            onSuccess={() => {
              setUpdateReportId(null);
              window.location.href = "/lender/requests";
            }}
            onCancel={() => setUpdateReportId(null)}
          />
        ) : null;
      })()}

      {showNearbyDialog && nearbyRefReportId && (
        <NearbyRequestDialog
          referenceReportId={nearbyRefReportId}
          listingCity={listing.city}
          listingPinCode={listing.pin_code}
          onSuccess={() => {
            setShowNearbyDialog(false);
            window.location.href = "/lender/requests";
          }}
          onCancel={() => setShowNearbyDialog(false)}
        />
      )}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/listings/\[id\]/
git commit -m "feat(phase6): wire update and nearby request dialogs to listing detail page"
```

---

## Task 9: Frontend — Add Update Button to Purchased Reports Page

**Files:**
- Modify: `frontend/src/app/lender/listings/purchases/page.tsx`

- [ ] **Step 1: Add update request dialog import and state**

In `frontend/src/app/lender/listings/purchases/page.tsx`:

Add import:

```tsx
import { UpdateRequestDialog } from "../[id]/_components/update-request-dialog";
```

Add state after the existing state declarations:

```tsx
  const [updateReportId, setUpdateReportId] = useState<string | null>(null);
  const [updateReportMeta, setUpdateReportMeta] = useState<{category: string; address: string | null; date: string | null} | null>(null);
```

- [ ] **Step 2: Add "Update" button to desktop table rows**

In the desktop table `<tbody>`, add a new column after the Download button column. Add a header:

```tsx
<th className="text-right p-3 font-medium">Update</th>
```

Add the cell in each row:

```tsx
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setUpdateReportId(item.report.id);
                          setUpdateReportMeta({
                            category: item.report.report_category,
                            address: item.report.property_address,
                            date: item.report.report_date,
                          });
                        }}
                        className="px-3 py-1.5 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
                      >
                        Update
                      </button>
                    </td>
```

- [ ] **Step 3: Add "Update" button to mobile cards**

In the mobile card view, add an Update button next to the Download button. Replace the single download button with a button group:

```tsx
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setUpdateReportId(item.report.id);
                        setUpdateReportMeta({
                          category: item.report.report_category,
                          address: item.report.property_address,
                          date: item.report.report_date,
                        });
                      }}
                      className="px-3 py-2 text-sm border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDownload(item.purchase.id)}
                      className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Download
                    </button>
                  </div>
```

- [ ] **Step 4: Add the dialog rendering**

Before the closing `</div>` of the return statement, add:

```tsx
      {updateReportId && updateReportMeta && (
        <UpdateRequestDialog
          reportId={updateReportId}
          reportCategory={updateReportMeta.category}
          locality={updateReportMeta.address}
          reportDate={updateReportMeta.date}
          onSuccess={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
            window.location.href = "/lender/requests";
          }}
          onCancel={() => {
            setUpdateReportId(null);
            setUpdateReportMeta(null);
          }}
        />
      )}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lender/listings/purchases/
git commit -m "feat(phase6): add update request button to purchased reports page"
```

---

## Task 10: Frontend — Lender Request Detail Enhancement

**Files:**
- Modify: `frontend/src/app/lender/requests/[id]/page.tsx`

- [ ] **Step 1: Add request type badge and parent report context**

Read the current file first. Then add, near the top of the page content (after the heading/title area):

A request type badge:

```tsx
        {request.request_type !== "NEW" && (
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${
            request.request_type === "UPDATE"
              ? "bg-orange-100 text-orange-800"
              : "bg-blue-100 text-blue-800"
          }`}>
            {request.request_type === "UPDATE" ? "Update Request" : "Nearby Request"}
          </span>
        )}
```

A parent report context section (when `parent_report_id` is set):

```tsx
        {request.parent_report_id && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Related Report</h3>
            <p className="text-sm text-gray-600">
              Report ID: {request.parent_report_id}
            </p>
            {request.request_type === "UPDATE" && request.comments && (() => {
              try {
                const parsed = JSON.parse(request.comments);
                if (parsed.checklist) {
                  return (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Update items:</p>
                      <ul className="text-sm text-gray-600 list-disc list-inside">
                        {parsed.checklist.map((item: string) => (
                          <li key={item}>{item.replace(/_/g, " ").toLowerCase()}</li>
                        ))}
                      </ul>
                      {parsed.text && <p className="text-sm text-gray-600 mt-1">{parsed.text}</p>}
                    </div>
                  );
                }
              } catch { /* plain text comments */ }
              return null;
            })()}
          </div>
        )}
```

The exact insertion point depends on the page structure — the implementer should read the file and place these after the page title/heading.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/lender/requests/\[id\]/
git commit -m "feat(phase6): add request type badge and parent report context to lender request detail"
```

---

## Task 11: Frontend — Vendor Request Detail Enhancement

**Files:**
- Modify: `frontend/src/app/vendor/requests/[id]/page.tsx`

- [ ] **Step 1: Add parent report context section**

Read the current file. Add a parent report context section near the top of the page content, after the heading. When `request.parent_report_id` is set and `request.request_type` is UPDATE or NEARBY, show:

```tsx
        {request.parent_report_id && (request.request_type === "UPDATE" || request.request_type === "NEARBY") && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              {request.request_type === "UPDATE"
                ? "Update request for previous report"
                : "Nearby property request"}
            </h3>
            <div className="text-sm text-amber-900 space-y-1">
              <p><span className="font-medium">Original property:</span> {request.property_address}</p>
              <p><span className="font-medium">City:</span> {request.city} · {request.pin_code || ""}</p>
              <p><span className="font-medium">Type:</span> {request.property_type} · {request.report_category}</p>
            </div>

            {request.request_type === "UPDATE" && request.comments && (() => {
              try {
                const parsed = JSON.parse(request.comments);
                if (parsed.checklist) {
                  return (
                    <div className="mt-3 border-t border-amber-200 pt-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Lender requested updates:</p>
                      <ul className="text-sm text-amber-900 space-y-1">
                        {parsed.checklist.map((item: string) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="text-amber-500">●</span>
                            {item.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </li>
                        ))}
                      </ul>
                      {parsed.text && (
                        <p className="text-sm text-amber-900 mt-2 italic">&quot;{parsed.text}&quot;</p>
                      )}
                    </div>
                  );
                }
              } catch { /* plain text comments */ }
              return null;
            })()}
          </div>
        )}
```

- [ ] **Step 2: Add request type badge to vendor request list**

Check if `frontend/src/app/vendor/requests/_components/request-table.tsx` exists. If it does, add a request type badge column. If it doesn't (requests are rendered inline in the page), add a badge next to the status in the list view.

The badge markup:

```tsx
{request.request_type !== "NEW" && (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
    request.request_type === "UPDATE"
      ? "bg-orange-100 text-orange-800"
      : "bg-blue-100 text-blue-800"
  }`}>
    {request.request_type === "UPDATE" ? "Update" : "Nearby"}
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/requests/
git commit -m "feat(phase6): add parent report context and type badges to vendor request views"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Rebuild and restart backend**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build backend
```

- [ ] **Step 2: Verify new endpoints appear in OpenAPI**

```bash
curl -s http://localhost:8020/openapi.json | python3 -c "
import json, sys
spec = json.load(sys.stdin)
for path in sorted(spec['paths']):
    if 'update' in path or 'nearby' in path:
        methods = list(spec['paths'][path].keys())
        print(f'{path}: {methods}')
"
```

Expected: `/api/lender/requests/update` and `/api/lender/requests/nearby` with POST methods.

- [ ] **Step 3: Smoke test the flow**

1. Log in as vendor, ensure there's at least one PUBLISHED report with a pin_code
2. List that report on the marketplace (via `/vendor/listings`)
3. Log in as lender, navigate to `/lender/listings`
4. Click into the listing, verify "Request Update" and "Request Nearby Report" buttons appear
5. Test the Update dialog: select checklist items, add comments, submit
6. Test the Nearby dialog: fill in address, submit
7. Verify both requests appear in `/lender/requests` with correct type badges
8. Log in as vendor, verify the requests appear with parent report context

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(phase6): address issues found during e2e verification"
```

---

## Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Phase 6 status**

Add to the "Current Status" section after Phase 5:

```
**Phase 6 (Update & Nearby Requests):** Complete — extended request service for UPDATE/NEARBY types with parent_report_id, dynamic billing payable types, 2 new lender API endpoints (update/nearby), update request dialog with predefined checklist, nearby request dialog with address form, parent report context on vendor request detail, request type badges
```

Add to "Key Files" section:

```
- `backend/app/schemas/request.py` — Request schemas including UpdateRequestInput, NearbyRequestInput
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 6 completion status"
```
