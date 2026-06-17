"""Invoicing routes — Austrian B2B / GDPR compliant invoice generation & dispatch.

Super-Admin only. Invoices are generated from the chosen license tier / pricing,
rendered as PDF (WeasyPrint) and sent by email (Resend) with the PDF attached.

Tax handling (seller = Regelbesteuerung / 20% USt):
  * Recipient in seller country (AT)            -> 20% USt ("standard")
  * Recipient in another EU country WITH UID    -> Reverse Charge (0% USt)
  * Recipient in another EU country WITHOUT UID -> 20% USt ("standard")
  * Recipient outside the EU                     -> not taxable in AT ("not_taxable")
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal, ROUND_HALF_UP
import uuid
import io

try:
    from ..auth import require_super_admin
    from ..config import db, logger
    from .notifications import send_email
    from .billing import TIER_CONFIG, LicenseTier, get_org_subscription
except ImportError:  # pragma: no cover - fallback for direct module execution
    from auth import require_super_admin  # type: ignore
    from config import db, logger  # type: ignore
    from routers.notifications import send_email  # type: ignore
    from routers.billing import TIER_CONFIG, LicenseTier, get_org_subscription  # type: ignore

router = APIRouter(prefix="/admin", tags=["Invoicing"])

SETTINGS_ID = "billing_settings"

# EU member states (ISO-3166 alpha-2)
EU_COUNTRIES = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE",
}

# ============ MODELS ============

class BillingSettings(BaseModel):
    company_name: str = ""
    address_line: str = ""
    zip: str = ""
    city: str = ""
    country: str = "AT"
    uid: str = ""                 # UID-Nummer (ATU…)
    email: str = ""
    phone: str = ""
    iban: str = ""
    bic: str = ""
    bank_name: str = ""
    firmenbuch_nr: str = ""
    firmenbuch_gericht: str = ""
    vat_rate: float = 20.0
    tax_mode: str = "standard"    # "standard" (Regelbesteuerung) | "small_business"
    invoice_prefix: str = ""
    payment_terms_days: int = 14
    footer_note: str = ""

class OrgBilling(BaseModel):
    company_name: str = ""
    address_line: str = ""
    zip: str = ""
    city: str = ""
    country: str = "AT"
    uid: str = ""
    email: str = ""
    contact_name: str = ""

class InvoiceLineItemIn(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price_net: float

class InvoiceCreate(BaseModel):
    organization_id: str
    issue_date: Optional[str] = None          # ISO date; defaults to today
    service_period_start: Optional[str] = None
    service_period_end: Optional[str] = None
    due_days: Optional[int] = None            # defaults to settings.payment_terms_days
    line_items: List[InvoiceLineItemIn]
    tax_treatment: Optional[str] = None       # auto-detected when omitted
    notes: str = ""
    send: bool = False                        # create and send immediately

# ============ HELPERS ============

def _q(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def fmt_eur(value) -> str:
    """Format a number as European currency string, e.g. 1234.5 -> '1.234,50'."""
    d = _q(value)
    s = f"{d:,.2f}"  # 1,234.50
    return s.replace(",", "X").replace(".", ",").replace("X", ".")

async def get_billing_settings() -> dict:
    doc = await db.billing_settings.find_one({"_id": SETTINGS_ID})
    if not doc:
        return BillingSettings().model_dump()
    doc.pop("_id", None)
    # merge with defaults so new fields are always present
    merged = BillingSettings().model_dump()
    merged.update(doc)
    return merged

async def get_org_billing(org_id: str) -> Optional[dict]:
    doc = await db.org_billing.find_one({"organization_id": org_id}, {"_id": 0})
    return doc

def determine_treatment(settings: dict, recipient: dict) -> str:
    """Determine the VAT treatment for an invoice."""
    if settings.get("tax_mode") == "small_business":
        return "small_business"
    seller_country = (settings.get("country") or "AT").upper()
    rc = (recipient.get("country") or "AT").upper()
    if rc == seller_country:
        return "standard"
    if rc in EU_COUNTRIES:
        return "reverse_charge" if recipient.get("uid") else "standard"
    return "not_taxable"

def compute_totals(line_items: List[dict], treatment: str, vat_rate: float) -> dict:
    net = sum((_q(li["quantity"]) * _q(li["unit_price_net"]) for li in line_items), Decimal("0"))
    net = _q(net)
    rate = Decimal(str(vat_rate)) if treatment == "standard" else Decimal("0")
    vat = _q(net * rate / Decimal("100"))
    gross = _q(net + vat)
    return {
        "net_total": float(net),
        "vat_rate": float(rate),
        "vat_amount": float(vat),
        "gross_total": float(gross),
    }

async def next_invoice_number(prefix: str) -> str:
    """Return a gapless, sequential invoice number per year, e.g. 'WK-2026-0001'."""
    year = datetime.now(timezone.utc).year
    counter_id = f"invoice_{year}"
    try:
        from pymongo import ReturnDocument
        doc = await db.counters.find_one_and_update(
            {"_id": counter_id},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        seq = doc["seq"]
    except Exception:
        # extremely defensive fallback
        existing = await db.counters.find_one({"_id": counter_id})
        seq = (existing.get("seq", 0) if existing else 0) + 1
        await db.counters.update_one({"_id": counter_id}, {"$set": {"seq": seq}}, upsert=True)
    p = (prefix + "-") if prefix else ""
    return f"{p}{year}-{seq:04d}"

TREATMENT_NOTE = {
    "reverse_charge": "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge gem. Art. 196 MwSt-RL / § 19 UStG). Die Umsatzsteuer ist vom Leistungsempfänger zu entrichten.",
    "small_business": "Umsatzsteuerbefreit aufgrund der Kleinunternehmerregelung gem. § 6 Abs. 1 Z 27 UStG. Es wird keine Umsatzsteuer ausgewiesen.",
    "not_taxable": "Nicht steuerbare sonstige Leistung. Der Leistungsort liegt gem. § 3a Abs. 6 UStG im Empfängerland (Drittland).",
}

def render_invoice_html(inv: dict) -> str:
    s = inv["seller"]
    r = inv["recipient"]
    treatment = inv["tax_treatment"]

    rows = "".join(
        f"""<tr>
            <td>{li['description']}</td>
            <td class='num'>{fmt_eur(li['quantity']) if li['quantity'] % 1 else int(li['quantity'])}</td>
            <td class='num'>{fmt_eur(li['unit_price_net'])} €</td>
            <td class='num'>{fmt_eur(_q(li['quantity']) * _q(li['unit_price_net']))} €</td>
        </tr>"""
        for li in inv["line_items"]
    )

    if treatment == "standard":
        vat_row = f"""<tr><td>USt {inv['vat_rate']:g} %</td><td class='num'>{fmt_eur(inv['vat_amount'])} €</td></tr>"""
    else:
        vat_row = """<tr><td>USt</td><td class='num'>0,00 €</td></tr>"""

    tax_note = TREATMENT_NOTE.get(treatment, "")
    seller_uid = f"<div>UID: {s['uid']}</div>" if s.get("uid") else ""
    recipient_uid = f"<div>UID: {r['uid']}</div>" if r.get("uid") else ""
    fb = ""
    if s.get("firmenbuch_nr"):
        fb = f"<div>FN {s['firmenbuch_nr']}{(' · ' + s['firmenbuch_gericht']) if s.get('firmenbuch_gericht') else ''}</div>"

    period = ""
    if inv.get("service_period_start") or inv.get("service_period_end"):
        period = f"<div><strong>Leistungszeitraum:</strong> {inv.get('service_period_start','')} – {inv.get('service_period_end','')}</div>"

    bank = ""
    if s.get("iban"):
        bank = f"""<div style='margin-top:6px'>
            <strong>Bankverbindung:</strong> {s.get('bank_name','')}<br>
            IBAN: {s['iban']}{(' · BIC: ' + s['bic']) if s.get('bic') else ''}
        </div>"""

    footer_note = f"<p>{s['footer_note']}</p>" if s.get("footer_note") else ""

    return f"""<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 22mm 18mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.5; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }}
  .brand {{ font-size: 22px; font-weight: 800; color: #2563eb; }}
  .seller-small {{ font-size: 10px; color: #64748b; margin-top: 4px; }}
  .meta {{ text-align: right; font-size: 11px; }}
  .parties {{ display: flex; justify-content: space-between; margin: 24px 0; }}
  .box-label {{ font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; margin-bottom: 4px; }}
  h1 {{ font-size: 20px; margin: 10px 0 4px; }}
  table.items {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  table.items th {{ background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; }}
  table.items td {{ padding: 8px; border-bottom: 1px solid #e2e8f0; }}
  .num {{ text-align: right; white-space: nowrap; }}
  table.totals {{ margin-left: auto; margin-top: 14px; width: 45%; border-collapse: collapse; }}
  table.totals td {{ padding: 6px 8px; }}
  table.totals tr.grand td {{ border-top: 2px solid #1e293b; font-weight: 800; font-size: 14px; }}
  .note {{ margin-top: 18px; padding: 10px 12px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 11px; }}
  .payment {{ margin-top: 18px; font-size: 11px; }}
  .footer {{ margin-top: 30px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }}
</style></head><body>
  <div class="header">
    <div>
      <div class="brand">⚡ {s.get('company_name','Welkora')}</div>
      <div class="seller-small">
        {s.get('address_line','')}, {s.get('zip','')} {s.get('city','')}, {s.get('country','')}
        {seller_uid}{fb}
      </div>
    </div>
    <div class="meta">
      <h1>Rechnung</h1>
      <div><strong>Nr.:</strong> {inv['invoice_number']}</div>
      <div><strong>Datum:</strong> {inv['issue_date']}</div>
      <div><strong>Fällig:</strong> {inv['due_date']}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="box-label">Rechnungsempfänger</div>
      <div><strong>{r.get('company_name','')}</strong></div>
      <div>{r.get('address_line','')}</div>
      <div>{r.get('zip','')} {r.get('city','')}</div>
      <div>{r.get('country','')}</div>
      {recipient_uid}
    </div>
    <div style="text-align:right">
      {period}
    </div>
  </div>

  <table class="items">
    <thead><tr><th>Bezeichnung</th><th class='num'>Menge</th><th class='num'>Einzelpreis (netto)</th><th class='num'>Betrag (netto)</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Nettobetrag</td><td class="num">{fmt_eur(inv['net_total'])} €</td></tr>
    {vat_row}
    <tr class="grand"><td>Gesamtbetrag</td><td class="num">{fmt_eur(inv['gross_total'])} €</td></tr>
  </table>

  {f'<div class="note">{tax_note}</div>' if tax_note else ''}

  <div class="payment">
    <strong>Zahlbar bis {inv['due_date']}</strong> ohne Abzug. Bitte geben Sie bei der Überweisung die Rechnungsnummer <strong>{inv['invoice_number']}</strong> als Verwendungszweck an.
    {bank}
  </div>

  <div class="footer">
    {footer_note}
    <div>{s.get('company_name','')} · {s.get('address_line','')}, {s.get('zip','')} {s.get('city','')} · {s.get('email','')} {(' · ' + s.get('phone')) if s.get('phone') else ''}</div>
  </div>
</body></html>"""

def build_invoice_pdf(inv: dict) -> bytes:
    from weasyprint import HTML
    return HTML(string=render_invoice_html(inv)).write_pdf()

async def _load_invoice(invoice_id: str) -> dict:
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return inv

# ============ SETTINGS ENDPOINTS ============

@router.get("/billing-settings")
async def read_billing_settings(admin: dict = Depends(require_super_admin)):
    return await get_billing_settings()

@router.put("/billing-settings")
async def update_billing_settings(data: BillingSettings, admin: dict = Depends(require_super_admin)):
    payload = data.model_dump()
    await db.billing_settings.update_one({"_id": SETTINGS_ID}, {"$set": payload}, upsert=True)
    logger.info(f"Billing settings updated by {admin['email']}")
    return {"message": "Rechnungs-Einstellungen gespeichert", **payload}

@router.get("/organizations/{org_id}/billing")
async def read_org_billing(org_id: str, admin: dict = Depends(require_super_admin)):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    billing = await get_org_billing(org_id)
    if not billing:
        # sensible defaults seeded from the organization name
        billing = OrgBilling(company_name=org.get("name", "")).model_dump()
        billing["organization_id"] = org_id
    return billing

@router.put("/organizations/{org_id}/billing")
async def update_org_billing(org_id: str, data: OrgBilling, admin: dict = Depends(require_super_admin)):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    payload = data.model_dump()
    payload["organization_id"] = org_id
    await db.org_billing.update_one({"organization_id": org_id}, {"$set": payload}, upsert=True)
    return {"message": "Rechnungsdaten der Organisation gespeichert", **payload}

@router.get("/organizations/{org_id}/invoice-defaults")
async def invoice_defaults(org_id: str, admin: dict = Depends(require_super_admin)):
    """Suggest line items + recipient based on the org's current license tier."""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")

    subscription = await get_org_subscription(org_id)
    tier_value = subscription.get("tier", LicenseTier.STARTER.value)
    cycle = subscription.get("billing_cycle", "monthly")
    tier_config = TIER_CONFIG.get(LicenseTier(tier_value), TIER_CONFIG[LicenseTier.STARTER])
    price = tier_config["price_yearly"] if cycle == "yearly" else tier_config["price_monthly"]
    period_label = "Jahr" if cycle == "yearly" else "Monat"

    today = date.today()
    settings = await get_billing_settings()
    billing = await get_org_billing(org_id) or {}

    return {
        "line_items": [{
            "description": f"Welkora {tier_config['name']} Lizenz – {tier_config['user_limit'] if tier_config['user_limit'] != -1 else 'unbegrenzt'} Benutzer ({period_label})",
            "quantity": 1,
            "unit_price_net": price,
        }],
        "tier": tier_value,
        "tier_name": tier_config["name"],
        "billing_cycle": cycle,
        "suggested_treatment": determine_treatment(settings, billing or {"country": "AT"}),
        "recipient": billing,
        "issue_date": today.isoformat(),
        "service_period_start": today.replace(day=1).isoformat(),
        "due_days": settings.get("payment_terms_days", 14),
    }

# ============ INVOICE ENDPOINTS ============

@router.get("/invoices")
async def list_invoices(organization_id: Optional[str] = None, admin: dict = Depends(require_super_admin)):
    query = {"organization_id": organization_id} if organization_id else {}
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return invoices

@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, admin: dict = Depends(require_super_admin)):
    return await _load_invoice(invoice_id)

@router.post("/invoices")
async def create_invoice(data: InvoiceCreate, admin: dict = Depends(require_super_admin)):
    org = await db.organizations.find_one({"id": data.organization_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organisation nicht gefunden")
    if not data.line_items:
        raise HTTPException(status_code=400, detail="Mindestens eine Rechnungsposition erforderlich")

    settings = await get_billing_settings()
    recipient = await get_org_billing(data.organization_id)

    # ---- validation of mandatory legal data ----
    missing_seller = [f for f in ("company_name", "address_line", "zip", "city") if not settings.get(f)]
    if settings.get("tax_mode") == "standard" and not settings.get("uid"):
        missing_seller.append("uid")
    if missing_seller:
        raise HTTPException(status_code=400, detail=f"Aussteller-Daten unvollständig: {', '.join(missing_seller)}. Bitte zuerst die Rechnungs-Einstellungen ausfüllen.")

    if not recipient:
        raise HTTPException(status_code=400, detail="Keine Rechnungsdaten für diese Organisation hinterlegt. Bitte zuerst die Rechnungsdaten der Organisation erfassen.")
    missing_rec = [f for f in ("company_name", "address_line", "zip", "city") if not recipient.get(f)]
    if missing_rec:
        raise HTTPException(status_code=400, detail=f"Empfänger-Daten unvollständig: {', '.join(missing_rec)}.")

    treatment = data.tax_treatment or determine_treatment(settings, recipient)
    if treatment == "reverse_charge" and not recipient.get("uid"):
        raise HTTPException(status_code=400, detail="Reverse Charge erfordert eine gültige UID-Nummer des Empfängers.")

    line_items = [li.model_dump() for li in data.line_items]
    totals = compute_totals(line_items, treatment, settings.get("vat_rate", 20.0))

    issue = data.issue_date or date.today().isoformat()
    due_days = data.due_days if data.due_days is not None else settings.get("payment_terms_days", 14)
    due = (datetime.fromisoformat(issue).date() + timedelta(days=due_days)).isoformat()

    invoice_number = await next_invoice_number(settings.get("invoice_prefix", ""))

    invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "organization_id": data.organization_id,
        "organization_name": org.get("name", ""),
        "status": "draft",
        "issue_date": issue,
        "due_date": due,
        "service_period_start": data.service_period_start,
        "service_period_end": data.service_period_end,
        "currency": "EUR",
        "tax_treatment": treatment,
        "line_items": line_items,
        "notes": data.notes,
        # immutable snapshots so historical invoices stay correct
        "seller": settings,
        "recipient": recipient,
        **totals,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["email"],
        "sent_at": None,
        "paid_at": None,
    }
    await db.invoices.insert_one(dict(invoice))

    if data.send:
        await _send_invoice(invoice)
        invoice = await _load_invoice(invoice["id"])

    invoice.pop("_id", None)
    logger.info(f"Invoice {invoice_number} created for org {data.organization_id} by {admin['email']}")
    return invoice

@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, admin: dict = Depends(require_super_admin)):
    inv = await _load_invoice(invoice_id)
    pdf = build_invoice_pdf(inv)
    filename = f"Rechnung_{inv['invoice_number'].replace('/', '-')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )

async def _send_invoice(inv: dict) -> bool:
    recipient = inv.get("recipient") or {}
    to_email = recipient.get("email")
    if not to_email:
        org = await db.organizations.find_one({"id": inv["organization_id"]}, {"_id": 0})
        admin_user = await db.users.find_one(
            {"organization_id": inv["organization_id"], "role": "admin"}, {"_id": 0, "email": 1}
        ) if org else None
        to_email = admin_user.get("email") if admin_user else None
    if not to_email:
        raise HTTPException(status_code=400, detail="Keine Empfänger-E-Mail-Adresse gefunden.")

    pdf = build_invoice_pdf(inv)
    filename = f"Rechnung_{inv['invoice_number'].replace('/', '-')}.pdf"
    html = f"""
    <div style='font-family:sans-serif;max-width:600px;margin:auto'>
      <div style='background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:24px;border-radius:12px 12px 0 0'>
        <h1 style='color:white;margin:0;font-size:22px'>⚡ {inv['seller'].get('company_name','Welkora')}</h1>
      </div>
      <div style='background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0'>
        <p>Sehr geehrte Damen und Herren,</p>
        <p>anbei erhalten Sie Ihre Rechnung <strong>{inv['invoice_number']}</strong> vom {inv['issue_date']}
        über <strong>{fmt_eur(inv['gross_total'])} €</strong>.</p>
        <p>Zahlbar bis <strong>{inv['due_date']}</strong>. Die Rechnung finden Sie im PDF-Anhang.</p>
        <p style='color:#94a3b8;font-size:12px;margin-top:24px'>{inv['seller'].get('company_name','Welkora')}</p>
      </div>
    </div>"""

    ok = await send_email(
        to_email,
        f"[{inv['seller'].get('company_name','Welkora')}] Rechnung {inv['invoice_number']}",
        html,
        attachments=[{"filename": filename, "content": pdf, "content_type": "application/pdf"}],
    )
    update = {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat(), "sent_to": to_email}
    if not ok:
        # keep status but record the attempt failure
        update = {"sent_to": to_email, "send_error": "E-Mail-Versand fehlgeschlagen (Resend nicht konfiguriert?)"}
    await db.invoices.update_one({"id": inv["id"]}, {"$set": update})
    return ok

@router.post("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: str, admin: dict = Depends(require_super_admin)):
    inv = await _load_invoice(invoice_id)
    if inv["status"] == "canceled":
        raise HTTPException(status_code=400, detail="Stornierte Rechnungen können nicht versendet werden.")
    ok = await _send_invoice(inv)
    if not ok:
        raise HTTPException(status_code=502, detail="E-Mail konnte nicht versendet werden. Ist RESEND_API_KEY gesetzt?")
    logger.info(f"Invoice {inv['invoice_number']} sent by {admin['email']}")
    return {"message": f"Rechnung {inv['invoice_number']} versendet", "invoice_id": invoice_id}

@router.post("/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: str, admin: dict = Depends(require_super_admin)):
    inv = await _load_invoice(invoice_id)
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": f"Rechnung {inv['invoice_number']} als bezahlt markiert"}

@router.post("/invoices/{invoice_id}/cancel")
async def cancel_invoice(invoice_id: str, admin: dict = Depends(require_super_admin)):
    """Cancel (storno) an invoice. The number is kept to preserve the gapless sequence."""
    inv = await _load_invoice(invoice_id)
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "canceled", "canceled_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": f"Rechnung {inv['invoice_number']} storniert"}
