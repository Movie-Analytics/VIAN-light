import os
from pathlib import Path

# directories
ACCESS_TOKEN_EXPIRE_MINUTES = 60
DATA_DIR = Path(os.environ.get('VIAN_DATA_DIR', '.'))
VIDEO_UPLOAD_DIR = Path('uploads/videos')
SUBTITLE_UPLOAD_DIR = Path('uploads/subtitles')
SCREENSHOT_UPLOAD_DIR = Path('uploads/screenshots')
EXPORT_DIR = Path('uploads/exports')

# connections
DATABASE_URL = os.environ.get('VIAN_DATABASE_URL', 'sqlite:///database.db')
REDIS_URL = os.environ.get('VIAN_REDIS_URL', 'redis://localhost:6379/0')

# resources
ONNXMODEL = '../resources/transnetv2.onnx'

# page path
API_PREFIX = os.environ.get('VIAN_API_PREFIX', '/api/')

# auth
SECRET_KEY = os.environ.get('VIAN_SECRET_KEY', 'your-secret')
ORIGINS = os.environ.get('VIAN_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
MIN_KEY_LENGTH = 20

def get_path(path: str|Path) -> Path:
    return DATA_DIR / path
