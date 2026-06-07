import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SPEND_MIN = int(os.getenv("AUTO_PAUSE_SPEND_MIN", "500000"))
ROAS_MAX = float(os.getenv("AUTO_PAUSE_ROAS_MAX", "150"))

META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")
META_AD_ACCOUNT_IDS = [
    x.strip() for x in os.getenv("META_AD_ACCOUNT_IDS", "").split(",") if x.strip()
]

TIKTOK_ACCESS_TOKEN = os.getenv("TIKTOK_ACCESS_TOKEN", "")
TIKTOK_ADVERTISER_IDS = [
    x.strip() for x in os.getenv("TIKTOK_ADVERTISER_IDS", "").split(",") if x.strip()
]

GOOGLE_ADS_DEVELOPER_TOKEN = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "")
GOOGLE_ADS_CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID", "")
GOOGLE_ADS_CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET", "")
GOOGLE_ADS_REFRESH_TOKEN = os.getenv("GOOGLE_ADS_REFRESH_TOKEN", "")
GOOGLE_ADS_CUSTOMER_IDS = [
    x.strip().replace("-", "") for x in os.getenv("GOOGLE_ADS_CUSTOMER_IDS", "").split(",") if x.strip()
]

MOCK_MODE = os.getenv("API_MODE", "mock").lower() != "live"

def platform_status() -> dict:
    return {
        "mode": "mock" if MOCK_MODE else "live",
        "meta": {
            "configured": bool(META_ACCESS_TOKEN and META_AD_ACCOUNT_IDS),
            "accounts": len(META_AD_ACCOUNT_IDS),
        },
        "youtube": {
            "configured": bool(
                GOOGLE_ADS_DEVELOPER_TOKEN
                and GOOGLE_ADS_REFRESH_TOKEN
                and GOOGLE_ADS_CUSTOMER_IDS
            ),
            "accounts": len(GOOGLE_ADS_CUSTOMER_IDS),
        },
        "tiktok": {
            "configured": bool(TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_IDS),
            "accounts": len(TIKTOK_ADVERTISER_IDS),
        },
    }