import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Flask settings
    SECRET_KEY = os.getenv("SECRET_KEY", "capcut-srt-translator-secret-key-2026")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB max file size
    
    # Gemini AI Configuration
    DEFAULT_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-3.1-flash-lite")
    
    # Subtitle Processing Defaults
    DEFAULT_TARGET_LANGUAGE = "Tiếng Việt"
    DEFAULT_FPS = 30

os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
