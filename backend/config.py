from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from fastapi.security import HTTPBearer
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File upload settings
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'onboarding-automat-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

# Master Admin Key for license generation
MASTER_ADMIN_KEY = os.environ.get('MASTER_ADMIN_KEY', 'change-this-master-key-in-production')

# Resend Email
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Super Admin
SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL')
SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD')
SUPER_ADMIN_NAME = os.environ.get('SUPER_ADMIN_NAME', 'Super Admin')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
