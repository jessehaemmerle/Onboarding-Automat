import asyncio
from datetime import datetime, timezone
from config import db, logger, RESEND_API_KEY, SENDER_EMAIL

async def send_sales_notification_email(contact_data: dict):
    """Send email notification for new sales contact - using Resend"""
    import resend
    
    SALES_EMAIL = "jesse@haemmerle.at"
    
    if not RESEND_API_KEY or RESEND_API_KEY == "re_test_placeholder":
        logger.info(f"Resend not configured. Sales contact saved: {contact_data['company']} - {contact_data['email']}")
        return
    
    resend.api_key = RESEND_API_KEY
    
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⚡ OnboardIQ</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Neue Vertriebsanfrage</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Unternehmen:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data['company']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Name:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data['name']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>E-Mail:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:{contact_data['email']}" style="color: #2563eb;">{contact_data['email']}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Telefon:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data.get('phone', '-')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Mitarbeiter:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{contact_data.get('employees', '-')}</td>
                    </tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <strong>Nachricht:</strong>
                    <p style="margin: 10px 0 0 0; white-space: pre-wrap;">{contact_data.get('message', '-')}</p>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
                    Eingegangen am: {contact_data['created_at']}
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [SALES_EMAIL],
            "subject": f"[OnboardIQ] Neue Vertriebsanfrage von {contact_data['company']}",
            "html": html
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Sales notification email sent for {contact_data['company']}, id: {email_result.get('id', 'unknown')}")
        
        await db.contact_requests.update_one(
            {"id": contact_data["id"]},
            {"$set": {"status": "email_sent", "email_sent_at": datetime.now(timezone.utc).isoformat(), "resend_email_id": email_result.get('id')}}
        )
        
    except Exception as e:
        logger.error(f"Failed to send sales notification email: {e}")
        await db.contact_requests.update_one(
            {"id": contact_data["id"]},
            {"$set": {"status": "email_failed", "email_error": str(e)}}
        )
