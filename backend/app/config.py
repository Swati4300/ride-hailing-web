import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Ride Matching Engine"
    VERSION: str = "1.0.0"
    
    # Database: Default to SQLite for easy local runs, or PostgreSQL if DATABASE_URL is set
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./ride_engine.db"
    )
    
    # Redis configuration
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    # Engine Settings
    LOCK_TIMEOUT_SECONDS: int = 30
    STALE_RIDE_TIMEOUT_SECONDS: int = 120  # 2 minutes
    DRIVER_OFFLINE_TIMEOUT_SECONDS: int = 300  # 5 minutes
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
