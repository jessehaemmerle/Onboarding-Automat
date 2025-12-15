#!/usr/bin/env python3
"""
Onboarding-Automat - Admin Tools
Einfache CLI-Tools für System-Owner

Verwendung:
  python admin_tools.py generate-licenses --count 5 --users 10 --notes "Kunde XYZ"
  python admin_tools.py list-licenses
  python admin_tools.py list-organizations
  python admin_tools.py create-super-admin --email admin@example.com
"""

import asyncio
import os
import sys
import argparse
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Konfiguration
API_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000')
MASTER_KEY = "s#Uj[Hr<KPrs_5UtT.$y(WSWDVi^D$jBRd$tpM5;3rYL(L7V]kx_f@!x,BEvWnre"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

def generate_licenses(count=1, users=10, notes=""):
    """Generiere neue Lizenzschlüssel"""
    print(f"\n🔑 Generiere {count} Lizenzschlüssel mit {users} User-Limit...\n")
    
    url = f"{API_URL}/api/admin/generate-license-keys"
    headers = {
        "Content-Type": "application/json",
        "X-Master-Key": MASTER_KEY
    }
    data = {
        "count": count,
        "user_limit": users,
        "notes": notes
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        licenses = response.json()
        
        print(f"✅ {len(licenses)} Lizenzschlüssel erfolgreich generiert!\n")
        for i, lic in enumerate(licenses, 1):
            print(f"{i}. 🔑 {lic['key']}")
            print(f"   👥 User-Limit: {lic['user_limit']}")
            print(f"   📝 Notiz: {lic['notes']}")
            print(f"   📅 Erstellt: {lic['created_at'][:19]}")
            print()
            
        print("💾 Diese Keys an Kunden senden:")
        print("-" * 50)
        for lic in licenses:
            print(lic['key'])
        print()
        
    except Exception as e:
        print(f"❌ Fehler: {e}")
        sys.exit(1)

async def list_licenses():
    """Alle Lizenzschlüssel auflisten"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    licenses = await db.license_keys.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    unused = [l for l in licenses if l['status'] == 'unused']
    active = [l for l in licenses if l['status'] == 'active']
    revoked = [l for l in licenses if l['status'] == 'revoked']
    
    print(f"\n📊 LIZENZ-ÜBERSICHT")
    print("=" * 70)
    print(f"Gesamt: {len(licenses)}")
    print(f"✅ Verfügbar: {len(unused)}")
    print(f"🔵 Aktiv: {len(active)}")
    print(f"❌ Widerrufen: {len(revoked)}")
    print()
    
    if unused:
        print("📦 VERFÜGBARE LIZENZEN:\n")
        for i, lic in enumerate(unused, 1):
            print(f"{i}. 🔑 {lic['key']}")
            print(f"   👥 {lic['user_limit']} Users | 📝 {lic.get('notes', 'Keine Notiz')}")
            print()
    
    if active:
        print("🏢 AKTIVE LIZENZEN:\n")
        for i, lic in enumerate(active, 1):
            org_id = lic.get('organization_id')
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0}) if org_id else None
            
            print(f"{i}. 🔑 {lic['key']}")
            if org:
                user_count = await db.users.count_documents({"organization_id": org_id})
                print(f"   🏢 {org['name']}")
                print(f"   👥 {user_count}/{lic['user_limit']} Benutzer")
            print(f"   ✅ Aktiviert: {lic.get('activated_at', 'N/A')[:10]}")
            print()
    
    client.close()

async def list_organizations():
    """Alle Organisationen auflisten"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    orgs = await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    print(f"\n🏢 ORGANISATIONEN-ÜBERSICHT")
    print("=" * 70)
    print(f"Gesamt: {len(orgs)} Firmen\n")
    
    for i, org in enumerate(orgs, 1):
        user_count = await db.users.count_documents({"organization_id": org['id']})
        case_count = await db.cases.count_documents({"organization_id": org['id']})
        
        print(f"{i}. 🏢 {org['name']}")
        print(f"   🔑 Lizenz: {org['license_key']}")
        print(f"   👥 {user_count}/{org['user_limit']} Benutzer")
        print(f"   📋 {case_count} Cases")
        print(f"   📅 Erstellt: {org['created_at'][:10]}")
        print(f"   🔵 Status: {org['status']}")
        print()
    
    client.close()

async def create_super_admin(email):
    """Erstelle einen Super-Admin Account"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        print(f"❌ Benutzer {email} nicht gefunden!")
        client.close()
        return
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"is_super_admin": True}}
    )
    
    if result.modified_count > 0:
        print(f"✅ {email} ist jetzt ein Super-Admin!")
        print("   Kann alle Organizations sehen und verwalten")
    else:
        print(f"⚠️ {email} war bereits Super-Admin")
    
    client.close()

async def increase_user_limit(org_id, new_limit):
    """Erhöhe User-Limit einer Organization"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    
    if not org:
        print(f"❌ Organisation {org_id} nicht gefunden!")
        client.close()
        return
    
    result = await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"user_limit": new_limit}}
    )
    
    if result.modified_count > 0:
        print(f"✅ User-Limit für '{org['name']}' erhöht!")
        print(f"   Altes Limit: {org['user_limit']}")
        print(f"   Neues Limit: {new_limit}")
    
    client.close()

def main():
    parser = argparse.ArgumentParser(description='Onboarding-Automat Admin Tools')
    subparsers = parser.add_subparsers(dest='command', help='Verfügbare Befehle')
    
    # Generate licenses
    gen_parser = subparsers.add_parser('generate-licenses', help='Neue Lizenzschlüssel generieren')
    gen_parser.add_argument('--count', type=int, default=1, help='Anzahl der Lizenzen')
    gen_parser.add_argument('--users', type=int, default=10, help='User-Limit pro Lizenz')
    gen_parser.add_argument('--notes', type=str, default='', help='Notiz für Verwaltung')
    
    # List licenses
    subparsers.add_parser('list-licenses', help='Alle Lizenzschlüssel anzeigen')
    
    # List organizations
    subparsers.add_parser('list-organizations', help='Alle Organisationen anzeigen')
    
    # Create super admin
    super_parser = subparsers.add_parser('create-super-admin', help='Super-Admin erstellen')
    super_parser.add_argument('--email', type=str, required=True, help='E-Mail des Users')
    
    # Increase user limit
    limit_parser = subparsers.add_parser('increase-limit', help='User-Limit erhöhen')
    limit_parser.add_argument('--org-id', type=str, required=True, help='Organization ID')
    limit_parser.add_argument('--limit', type=int, required=True, help='Neues User-Limit')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'generate-licenses':
        generate_licenses(args.count, args.users, args.notes)
    elif args.command == 'list-licenses':
        asyncio.run(list_licenses())
    elif args.command == 'list-organizations':
        asyncio.run(list_organizations())
    elif args.command == 'create-super-admin':
        asyncio.run(create_super_admin(args.email))
    elif args.command == 'increase-limit':
        asyncio.run(increase_user_limit(args.org_id, args.limit))

if __name__ == '__main__':
    main()
