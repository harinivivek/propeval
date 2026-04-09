from enum import Enum


class UserType(str, Enum):
    LENDER = "LENDER"
    VENDOR = "VENDOR"
    ADMIN = "ADMIN"


class LenderRole(str, Enum):
    ORG_ADMIN = "ORG_ADMIN"
    BRANCH_ADMIN = "BRANCH_ADMIN"
    REQUESTER = "REQUESTER"
    ANALYST = "ANALYST"


class VendorRole(str, Enum):
    VENDOR_ADMIN = "VENDOR_ADMIN"
    OFFICE_ADMIN = "OFFICE_ADMIN"


class AdminRole(str, Enum):
    GTR_ADMIN = "GTR_ADMIN"
    GTR_OPS = "GTR_OPS"


class ServiceType(str, Enum):
    VALUATION = "VALUATION"
    LEGAL = "LEGAL"


class ReportCategory(str, Enum):
    VALUATION = "VALUATION"
    LEGAL = "LEGAL"


class PropertyType(str, Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    INDUSTRIAL = "INDUSTRIAL"
    AGRICULTURAL = "AGRICULTURAL"


class RequestType(str, Enum):
    NEW = "NEW"
    UPDATE = "UPDATE"
    NEARBY = "NEARBY"


class LenderRequestStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    AWAITED = "AWAITED"
    RECEIVED = "RECEIVED"
    ACCEPTED = "ACCEPTED"
    SENT_FOR_REVIEW = "SENT_FOR_REVIEW"
    REJECTED = "REJECTED"


class VendorRequestStatus(str, Enum):
    INCOMING = "INCOMING"
    DENIED = "DENIED"
    PENDING = "PENDING"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REVISION = "REVISION"


class ReportStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY_TO_PUBLISH = "READY_TO_PUBLISH"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ListingStatus(str, Enum):
    DRAFT = "DRAFT"
    AVAILABLE = "AVAILABLE"
    ARCHIVED = "ARCHIVED"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    BILLED = "BILLED"
    PAID = "PAID"


class RejectionReason(str, Enum):
    LOW_PRICE = "LOW_PRICE"
    NOT_AVAILABLE = "NOT_AVAILABLE"
    DO_NOT_WANT_TO_SHARE = "DO_NOT_WANT_TO_SHARE"


class EarningType(str, Enum):
    REQUEST = "REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"


class PayableType(str, Enum):
    NEW_REQUEST = "NEW_REQUEST"
    LISTING_DOWNLOAD = "LISTING_DOWNLOAD"
    UPDATE = "UPDATE"
    NEARBY = "NEARBY"


class InvoiceType(str, Enum):
    PAYABLE = "PAYABLE"
    RECEIVABLE = "RECEIVABLE"


class BroadcastStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    ACCEPTED = "ACCEPTED"
