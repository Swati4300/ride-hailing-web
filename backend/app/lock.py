import time
import uuid
import threading
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger("lock_manager")

# In-memory fallback lock dictionary for standalone / local execution
_in_memory_locks: dict[str, str] = {}
_in_memory_expirations: dict[str, float] = {}
_local_thread_lock = threading.Lock()

try:
    import redis
    redis_client = redis.Redis(
        host=settings.REDIS_HOST, 
        port=settings.REDIS_PORT, 
        socket_connect_timeout=1,
        decode_responses=True
    )
    # Test connection
    redis_client.ping()
    HAS_REDIS = True
    logger.info("Connected to Redis for distributed locks.")
except Exception:
    HAS_REDIS = False
    redis_client = None
    logger.warning("Redis not available. Falling back to local process lock manager.")


# Lua script for atomic unlock in Redis
RELEASE_LOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class LockManager:
    """
    Distributed lock implementation using Redis SETNX with automatic TTL expiration,
    falling back to in-memory thread lock when Redis is unavailable.
    """

    @staticmethod
    def acquire_lock(lock_key: str, ttl_seconds: int = settings.LOCK_TIMEOUT_SECONDS) -> Optional[str]:
        """
        Attempts to acquire a lock for key.
        Returns a unique token (str) if lock acquired, or None if lock is held by another request.
        """
        token = str(uuid.uuid4())

        if HAS_REDIS and redis_client:
            try:
                # SET key token NX PX ttl_ms
                acquired = redis_client.set(lock_key, token, nx=True, ex=ttl_seconds)
                if acquired:
                    return token
                return None
            except Exception as e:
                logger.error(f"Redis error during acquire_lock: {e}")

        # Fallback to process-level thread-safe in-memory locking
        with _local_thread_lock:
            now = time.time()
            # Clean expired lock if any
            if lock_key in _in_memory_expirations and _in_memory_expirations[lock_key] < now:
                _in_memory_locks.pop(lock_key, None)
                _in_memory_expirations.pop(lock_key, None)

            if lock_key not in _in_memory_locks:
                _in_memory_locks[lock_key] = token
                _in_memory_expirations[lock_key] = now + ttl_seconds
                return token
            return None

    @staticmethod
    def release_lock(lock_key: str, token: str) -> bool:
        """
        Releases lock if the token matches the owner.
        Returns True if successfully released, False otherwise.
        """
        if not token:
            return False

        if HAS_REDIS and redis_client:
            try:
                result = redis_client.eval(RELEASE_LOCK_LUA, 1, lock_key, token)
                return result == 1
            except Exception as e:
                logger.error(f"Redis error during release_lock: {e}")

        # Fallback in-memory unlock
        with _local_thread_lock:
            if _in_memory_locks.get(lock_key) == token:
                _in_memory_locks.pop(lock_key, None)
                _in_memory_expirations.pop(lock_key, None)
                return True
            return False
