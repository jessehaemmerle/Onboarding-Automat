"""Central pricing model for Welkora — mirror of frontend/src/lib/pricing.js.

Keep the tier rates here in sync with the frontend so the landing-page
calculator and the invoice generation always produce identical prices.

Volume tiers: the per-user rate of the reached tier applies to ALL users.
Anchor points: 10→€49, 25→€99, 50→€179, 100→€299 (per month).
"""
import math

PRICE_TIERS = [
    (10, 4.9),
    (25, 3.96),
    (50, 3.58),
    (100, 2.99),
    (250, 2.49),
    (math.inf, 1.99),
]

MIN_USERS = 1
MAX_SLIDER_USERS = 250          # above this we suggest an individual offer
DEFAULT_USERS = 25              # pre-selected amount on the pricing calculator
ANNUAL_FREE_MONTHS = 2          # annual billing: pay for 10 instead of 12 months
PRESET_PLANS = [10, 25, 50, 100]  # quick-select buttons on the pricing section


def _round_half_up(value: float) -> int:
    """Match JavaScript's Math.round (round half up) for positive numbers."""
    return int(value + 0.5)


def rate_for_users(users: int) -> float:
    for up_to, rate in PRICE_TIERS:
        if users <= up_to:
            return rate
    return PRICE_TIERS[-1][1]


def pricing_config() -> dict:
    """JSON-serializable pricing configuration shared with the frontend.

    This is the single source of truth: the frontend fetches it from
    GET /api/pricing and uses it for the landing-page calculator and the
    invoice creation, so rates only need to be maintained here.
    """
    return {
        "tiers": [
            {"upTo": (None if up_to == math.inf else up_to), "rate": rate}
            for up_to, rate in PRICE_TIERS
        ],
        "minUsers": MIN_USERS,
        "maxSliderUsers": MAX_SLIDER_USERS,
        "defaultUsers": DEFAULT_USERS,
        "annualFreeMonths": ANNUAL_FREE_MONTHS,
        "presetPlans": PRESET_PLANS,
    }


def calculate_price(users_input, annual: bool = False) -> dict:
    """Return the pricing breakdown for a given number of users."""
    try:
        users = max(MIN_USERS, int(users_input or MIN_USERS))
    except (TypeError, ValueError):
        users = MIN_USERS
    per_user = rate_for_users(users)
    monthly = _round_half_up(users * per_user)
    annual_total = _round_half_up(monthly * (12 - ANNUAL_FREE_MONTHS))
    annual_monthly = _round_half_up(annual_total / 12)
    return {
        "users": users,
        "per_user": per_user,
        "monthly": monthly,
        "annual": annual_total,
        "annual_monthly": annual_monthly,
        "is_enterprise": users > MAX_SLIDER_USERS,
        # the amount to bill for the requested cycle
        "amount": annual_total if annual else monthly,
    }
