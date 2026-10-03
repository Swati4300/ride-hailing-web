import os
import time
import json
import base64
import hmac
import hashlib
import logging
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db

logger = logging.getLogger("auth")

SECRET_KEY = os.getenv("JWT_SECRET", "ride-dispatch-engine-secret-key-2026")
ACCESS_TOKEN_EXPIRE_SECONDS = 86400 * 7  # 7 days

security = HTTPBearer(auto_error=False)

# Check if PyJWT is installed, otherwise use lightweight HMAC fallback
try:
    import jwt
    HAS_PYJWT = True
except ImportError:
    HAS_PYJWT = False
    logger.warning("PyJWT module not found. Using fallback HMAC token generator.")


def hash_password(password: str) -> str:
    """Hash password using SHA256 with salt."""
    salt = "ride_dispatch_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return hash_password(plain_password) == hashed_password


def create_access_token(data: dict) -> str:
    """Create JWT token with payload data."""
    payload = data.copy()
    payload["exp"] = int(time.time()) + ACCESS_TOKEN_EXPIRE_SECONDS

    if HAS_PYJWT:
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    # Pure Python HMAC-SHA256 Token Fallback
    header_b64 = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(SECRET_KEY.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token."""
    if not token:
        return None

    if HAS_PYJWT:
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except Exception:
            return None

    # Fallback HMAC decode
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        
        # Verify signature
        expected_sig = hmac.new(SECRET_KEY.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
        expected_b64 = base64.urlsafe_b64encode(expected_sig).decode().rstrip("=")
        
        if not hmac.compare_digest(sig_b64, expected_b64):
            return None

        padding = "=" * (4 - len(payload_b64) % 4)
        payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode()
        payload = json.loads(payload_json)

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception as e:
        logger.error(f"Fallback token decode error: {e}")
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    """FastAPI dependency to retrieve the current authenticated user."""
    from app.models import User

    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "user_id" not in payload:
        return None

    user = db.query(User).filter(User.id == payload["user_id"]).first()
    return user


def require_roles(allowed_roles: List[str]):
    """Role-based authorization dependency factory."""
    def role_checker(current_user=Depends(get_current_user)):
        if not current_user or current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}.",
            )
        return current_user
    return role_checker
