from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    MONGODB_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "agile_pm"
    JWT_SECRET: str = "dev_secret_change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DUPLICATE_THRESHOLD: float = 0.45
    CORS_ORIGINS: str = "http://localhost:3000"
    # Optional OpenAI layer (bug triage, duplicate narrative). Leave empty to disable.
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    # Sentence-BERT for bug embeddings. Empty = bundled backend/sbert-bug-duplicates (fine-tuned for dupes).
    # Override with absolute path or path relative to the backend directory.
    SBERT_MODEL_PATH: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True


settings = Settings()
