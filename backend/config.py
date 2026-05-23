import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_PASSWORD = os.getenv("SECRET_PASSWORD", "changeme")
    JWT_SECRET = os.getenv("JWT_SECRET", "changeme-jwt")
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///thoughts.db")
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))

    # Normalize postgres:// → postgresql:// for SQLAlchemy
    @classmethod
    def get_sqlalchemy_url(cls):
        url = cls.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
