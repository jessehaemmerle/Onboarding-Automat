"""Billing & Monetization Routes - Lizenzierung, Usage Tracking, Subscriptions"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
import uuid

import sys
sys.path.append('/app/backend')

from config import db, logger

router = APIRouter(prefix="/billing", tags=["Billing & Monetization"])

# ============ DEPENDENCIES ============
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from config import SECRET_KEY, ALGORITHM, security

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"] and not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Admin-Berechtigung erforderlich")
    return current_user

async def require_super_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super-Admin-Berechtigung erforderlich")
    return current_user

# ============ MODELS ============

class LicenseTier(str, Enum):
    STARTER = "starter"      # 10 users
    TEAM = "team"            # 25 users
    BUSINESS = "business"    # 50 users
    ENTERPRISE = "enterprise" # 100 users
    UNLIMITED = "unlimited"  # Unlimited users

# Tier configurations
TIER_CONFIG = {
    LicenseTier.STARTER: {
        "name": "Starter",
        "user_limit": 10,
        "case_limit": 50,          # Cases per month
        "storage_limit_mb": 500,   # Storage in MB
        "templates_limit": 5,
        "price_monthly": 49,
        "price_yearly": 490,       # ~2 months free
        "features": ["basic_onboarding", "email_support"]
    },
    LicenseTier.TEAM: {
        "name": "Team",
        "user_limit": 25,
        "case_limit": 150,
        "storage_limit_mb": 2000,
        "templates_limit": 15,
        "price_monthly": 99,
        "price_yearly": 990,
        "features": ["basic_onboarding", "offboarding", "email_support", "reports"]
    },
    LicenseTier.BUSINESS: {
        "name": "Business",
        "user_limit": 50,
        "case_limit": 500,
        "storage_limit_mb": 5000,
        "templates_limit": 50,
        "price_monthly": 199,
        "price_yearly": 1990,
        "features": ["basic_onboarding", "offboarding", "rolechange", "priority_support", "reports", "api_access"]
    },
    LicenseTier.ENTERPRISE: {
        "name": "Enterprise",
        "user_limit": 100,
        "case_limit": 2000,
        "storage_limit_mb": 20000,
        "templates_limit": -1,  # Unlimited
        "price_monthly": 399,
        "price_yearly": 3990,
        "features": ["basic_onboarding", "offboarding", "rolechange", "priority_support", "reports", "api_access", "sso", "audit_logs"]
    },
    LicenseTier.UNLIMITED: {
        "name": "Unlimited",
        "user_limit": -1,  # Unlimited
        "case_limit": -1,
        "storage_limit_mb": -1,
        "templates_limit": -1,
        "price_monthly": 799,
        "price_yearly": 7990,
        "features": ["all"]
    }
}

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    TRIAL = "trial"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"

class UsageResponse(BaseModel):
    users: dict
    cases: dict
    storage: dict
    templates: dict
    tier: str
    tier_name: str
    subscription_status: str
    renewal_date: Optional[str]

class TierResponse(BaseModel):
    tier: str
    name: str
    user_limit: int
    case_limit: int
    storage_limit_mb: int
    templates_limit: int
    price_monthly: int
    price_yearly: int
    features: List[str]

class UpgradeRequest(BaseModel):
    new_tier: LicenseTier
    billing_cycle: str = "monthly"  # "monthly" or "yearly"

class SubscriptionUpdate(BaseModel):
    tier: LicenseTier
    status: SubscriptionStatus
    billing_cycle: str = "monthly"
    payment_method: Optional[str] = None

# ============ HELPER FUNCTIONS ============

async def get_org_usage(org_id: str) -> dict:
    """Calculate current resource usage for an organization"""
    # User count
    user_count = await db.users.count_documents({"organization_id": org_id})
    
    # Cases this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    cases_this_month = await db.cases.count_documents({
        "organization_id": org_id,
        "created_at": {"$gte": month_start.isoformat()}
    })
    total_cases = await db.cases.count_documents({"organization_id": org_id})
    
    # Storage (evidence files)
    pipeline = [
        {"$match": {"organization_id": org_id}},
        {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
    ]
    storage_result = await db.evidence.aggregate(pipeline).to_list(1)
    storage_bytes = storage_result[0]["total_size"] if storage_result else 0
    storage_mb = round(storage_bytes / (1024 * 1024), 2)
    
    # Templates count
    templates_count = await db.templates.count_documents({"organization_id": org_id})
    
    return {
        "users": user_count,
        "cases_this_month": cases_this_month,
        "cases_total": total_cases,
        "storage_mb": storage_mb,
        "templates": templates_count
    }

async def get_org_subscription(org_id: str) -> dict:
    """Get subscription details for an organization"""
    subscription = await db.subscriptions.find_one({"organization_id": org_id}, {"_id": 0})
    
    if not subscription:
        # Create default trial subscription
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        user_limit = org.get("user_limit", 10) if org else 10
        
        # Determine tier from user limit
        tier = LicenseTier.STARTER
        if user_limit >= 100:
            tier = LicenseTier.ENTERPRISE
        elif user_limit >= 50:
            tier = LicenseTier.BUSINESS
        elif user_limit >= 25:
            tier = LicenseTier.TEAM
        elif user_limit == -1:
            tier = LicenseTier.UNLIMITED
        
        subscription = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "tier": tier.value,
            "status": SubscriptionStatus.ACTIVE.value,
            "billing_cycle": "monthly",
            "current_period_start": datetime.now(timezone.utc).isoformat(),
            "current_period_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(subscription)
    
    return subscription

async def check_limit(org_id: str, resource: str, requested: int = 1) -> tuple[bool, str]:
    """
    Check if an organization can add more of a resource.
    Returns (allowed: bool, message: str)
    """
    subscription = await get_org_subscription(org_id)
    tier = subscription.get("tier", LicenseTier.STARTER.value)
    tier_config = TIER_CONFIG.get(LicenseTier(tier), TIER_CONFIG[LicenseTier.STARTER])
    
    usage = await get_org_usage(org_id)
    
    if resource == "users":
        limit = tier_config["user_limit"]
        current = usage["users"]
        if limit != -1 and current + requested > limit:
            return False, f"Benutzer-Limit erreicht ({current}/{limit}). Bitte upgraden Sie Ihr Paket."
    
    elif resource == "cases":
        limit = tier_config["case_limit"]
        current = usage["cases_this_month"]
        if limit != -1 and current + requested > limit:
            return False, f"Monatliches Case-Limit erreicht ({current}/{limit}). Bitte upgraden Sie Ihr Paket."
    
    elif resource == "storage":
        limit = tier_config["storage_limit_mb"]
        current = usage["storage_mb"]
        if limit != -1 and current + requested > limit:
            return False, f"Speicher-Limit erreicht ({current}/{limit} MB). Bitte upgraden Sie Ihr Paket."
    
    elif resource == "templates":
        limit = tier_config["templates_limit"]
        current = usage["templates"]
        if limit != -1 and current + requested > limit:
            return False, f"Template-Limit erreicht ({current}/{limit}). Bitte upgraden Sie Ihr Paket."
    
    return True, "OK"

# ============ ROUTES ============

@router.get("/tiers", response_model=List[TierResponse])
async def get_available_tiers():
    """Get all available pricing tiers"""
    tiers = []
    for tier, config in TIER_CONFIG.items():
        tiers.append(TierResponse(
            tier=tier.value,
            name=config["name"],
            user_limit=config["user_limit"],
            case_limit=config["case_limit"],
            storage_limit_mb=config["storage_limit_mb"],
            templates_limit=config["templates_limit"],
            price_monthly=config["price_monthly"],
            price_yearly=config["price_yearly"],
            features=config["features"]
        ))
    return tiers

@router.get("/usage", response_model=UsageResponse)
async def get_usage(current_user: dict = Depends(require_admin)):
    """Get current usage and limits for the organization"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    subscription = await get_org_subscription(org_id)
    tier = subscription.get("tier", LicenseTier.STARTER.value)
    tier_config = TIER_CONFIG.get(LicenseTier(tier), TIER_CONFIG[LicenseTier.STARTER])
    
    usage = await get_org_usage(org_id)
    
    return UsageResponse(
        users={
            "current": usage["users"],
            "limit": tier_config["user_limit"],
            "percentage": round(usage["users"] / tier_config["user_limit"] * 100, 1) if tier_config["user_limit"] > 0 else 0
        },
        cases={
            "current": usage["cases_this_month"],
            "limit": tier_config["case_limit"],
            "total": usage["cases_total"],
            "percentage": round(usage["cases_this_month"] / tier_config["case_limit"] * 100, 1) if tier_config["case_limit"] > 0 else 0
        },
        storage={
            "current_mb": usage["storage_mb"],
            "limit_mb": tier_config["storage_limit_mb"],
            "percentage": round(usage["storage_mb"] / tier_config["storage_limit_mb"] * 100, 1) if tier_config["storage_limit_mb"] > 0 else 0
        },
        templates={
            "current": usage["templates"],
            "limit": tier_config["templates_limit"],
            "percentage": round(usage["templates"] / tier_config["templates_limit"] * 100, 1) if tier_config["templates_limit"] > 0 else 0
        },
        tier=tier,
        tier_name=tier_config["name"],
        subscription_status=subscription.get("status", "active"),
        renewal_date=subscription.get("current_period_end")
    )

@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(require_admin)):
    """Get subscription details for the organization"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    subscription = await get_org_subscription(org_id)
    tier_config = TIER_CONFIG.get(LicenseTier(subscription["tier"]), TIER_CONFIG[LicenseTier.STARTER])
    
    return {
        **subscription,
        "tier_name": tier_config["name"],
        "price_monthly": tier_config["price_monthly"],
        "price_yearly": tier_config["price_yearly"],
        "features": tier_config["features"]
    }

@router.post("/check-limit")
async def check_resource_limit(resource: str, amount: int = 1, current_user: dict = Depends(get_current_user)):
    """Check if organization can add more of a resource"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    allowed, message = await check_limit(org_id, resource, amount)
    return {"allowed": allowed, "message": message}

@router.post("/upgrade")
async def request_upgrade(request: UpgradeRequest, current_user: dict = Depends(require_admin)):
    """Request an upgrade to a higher tier"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Keine Organisation zugeordnet")
    
    subscription = await get_org_subscription(org_id)
    current_tier = subscription.get("tier", LicenseTier.STARTER.value)
    new_tier = request.new_tier.value
    
    # Validate upgrade path
    tier_order = [LicenseTier.STARTER, LicenseTier.TEAM, LicenseTier.BUSINESS, LicenseTier.ENTERPRISE, LicenseTier.UNLIMITED]
    current_index = tier_order.index(LicenseTier(current_tier))
    new_index = tier_order.index(request.new_tier)
    
    if new_index <= current_index:
        raise HTTPException(status_code=400, detail="Kann nur auf höhere Pakete upgraden")
    
    new_tier_config = TIER_CONFIG[request.new_tier]
    
    # Create upgrade request
    upgrade_request = {
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "requested_by": current_user["email"],
        "current_tier": current_tier,
        "requested_tier": new_tier,
        "billing_cycle": request.billing_cycle,
        "price": new_tier_config["price_yearly"] if request.billing_cycle == "yearly" else new_tier_config["price_monthly"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.upgrade_requests.insert_one(upgrade_request)
    
    logger.info(f"Upgrade request: {org_id} from {current_tier} to {new_tier}")
    
    return {
        "message": "Upgrade-Anfrage eingereicht",
        "request_id": upgrade_request["id"],
        "new_tier": new_tier,
        "price": upgrade_request["price"],
        "billing_cycle": request.billing_cycle
    }

@router.get("/upgrade-requests")
async def get_upgrade_requests(admin: dict = Depends(require_super_admin)):
    """Get all pending upgrade requests - Super Admin only"""
    requests = await db.upgrade_requests.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with org names
    for req in requests:
        org = await db.organizations.find_one({"id": req["organization_id"]}, {"_id": 0, "name": 1})
        req["organization_name"] = org["name"] if org else "Unknown"
    
    return requests

@router.post("/upgrade-requests/{request_id}/approve")
async def approve_upgrade(request_id: str, admin: dict = Depends(require_super_admin)):
    """Approve an upgrade request - Super Admin only"""
    upgrade_req = await db.upgrade_requests.find_one({"id": request_id}, {"_id": 0})
    if not upgrade_req:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    if upgrade_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Anfrage wurde bereits bearbeitet")
    
    org_id = upgrade_req["organization_id"]
    new_tier = upgrade_req["requested_tier"]
    new_tier_config = TIER_CONFIG[LicenseTier(new_tier)]
    
    # Update subscription
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=365 if upgrade_req["billing_cycle"] == "yearly" else 30)
    
    await db.subscriptions.update_one(
        {"organization_id": org_id},
        {"$set": {
            "tier": new_tier,
            "billing_cycle": upgrade_req["billing_cycle"],
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Update organization user limit
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"user_limit": new_tier_config["user_limit"]}}
    )
    
    # Update request status
    await db.upgrade_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": admin["email"],
            "approved_at": now.isoformat()
        }}
    )
    
    logger.info(f"Upgrade approved: {org_id} to {new_tier} by {admin['email']}")
    
    return {"message": "Upgrade genehmigt", "new_tier": new_tier}

@router.post("/upgrade-requests/{request_id}/reject")
async def reject_upgrade(request_id: str, reason: str = "", admin: dict = Depends(require_super_admin)):
    """Reject an upgrade request - Super Admin only"""
    upgrade_req = await db.upgrade_requests.find_one({"id": request_id}, {"_id": 0})
    if not upgrade_req:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    await db.upgrade_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": admin["email"],
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason
        }}
    )
    
    return {"message": "Upgrade abgelehnt", "reason": reason}

# ============ SUPER ADMIN: SUBSCRIPTION MANAGEMENT ============

@router.get("/all-subscriptions")
async def get_all_subscriptions(admin: dict = Depends(require_super_admin)):
    """Get all organization subscriptions - Super Admin only"""
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with org info
    for sub in subscriptions:
        org = await db.organizations.find_one({"id": sub["organization_id"]}, {"_id": 0, "name": 1})
        sub["organization_name"] = org["name"] if org else "Unknown"
        tier_config = TIER_CONFIG.get(LicenseTier(sub["tier"]), TIER_CONFIG[LicenseTier.STARTER])
        sub["tier_name"] = tier_config["name"]
        
        # Calculate usage
        usage = await get_org_usage(sub["organization_id"])
        sub["usage"] = usage
    
    return subscriptions

@router.put("/subscriptions/{org_id}")
async def update_subscription(org_id: str, data: SubscriptionUpdate, admin: dict = Depends(require_super_admin)):
    """Update subscription for an organization - Super Admin only"""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    
    tier_config = TIER_CONFIG[data.tier]
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=365 if data.billing_cycle == "yearly" else 30)
    
    update_data = {
        "tier": data.tier.value,
        "status": data.status.value,
        "billing_cycle": data.billing_cycle,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
        "updated_at": now.isoformat(),
        "updated_by": admin["email"]
    }
    
    if data.payment_method:
        update_data["payment_method"] = data.payment_method
    
    await db.subscriptions.update_one(
        {"organization_id": org_id},
        {"$set": update_data},
        upsert=True
    )
    
    # Update organization user limit
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"user_limit": tier_config["user_limit"]}}
    )
    
    logger.info(f"Subscription updated: {org_id} to {data.tier.value} by {admin['email']}")
    
    return {"message": "Subscription aktualisiert", "tier": data.tier.value}

# ============ REVENUE ANALYTICS ============

@router.get("/analytics/revenue")
async def get_revenue_analytics(admin: dict = Depends(require_super_admin)):
    """Get revenue analytics - Super Admin only"""
    subscriptions = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(1000)
    
    monthly_revenue = 0
    yearly_revenue = 0
    tier_distribution = {}
    
    for sub in subscriptions:
        tier = sub.get("tier", "starter")
        tier_config = TIER_CONFIG.get(LicenseTier(tier), TIER_CONFIG[LicenseTier.STARTER])
        
        if sub.get("billing_cycle") == "yearly":
            yearly_revenue += tier_config["price_yearly"]
            monthly_revenue += tier_config["price_yearly"] / 12
        else:
            monthly_revenue += tier_config["price_monthly"]
            yearly_revenue += tier_config["price_monthly"] * 12
        
        tier_distribution[tier] = tier_distribution.get(tier, 0) + 1
    
    return {
        "monthly_recurring_revenue": round(monthly_revenue, 2),
        "annual_recurring_revenue": round(yearly_revenue, 2),
        "total_subscriptions": len(subscriptions),
        "tier_distribution": tier_distribution
    }
