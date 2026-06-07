from __future__ import annotations

from dataclasses import asdict, dataclass

from api.config import MOCK_MODE, platform_status
from api.connectors.google_ads import GoogleAdsConnector
from api.connectors.meta import MetaConnector
from api.connectors.tiktok import TikTokConnector


@dataclass
class PlatformTestResult:
    platform: str
    label: str
    configured: bool
    connected: bool
    message: str
    campaign_count: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def test_all_platforms() -> dict:
    results = [
        _test_meta(),
        _test_youtube(),
        _test_tiktok(),
    ]
    any_live = any(r.connected for r in results)
    return {
        "mode": "mock" if MOCK_MODE else "live",
        "ready_for_live_pause": (not MOCK_MODE) and any_live,
        "platforms": [r.to_dict() for r in results],
        **platform_status(),
    }


def _test_meta() -> PlatformTestResult:
    conn = MetaConnector()
    if MOCK_MODE:
        return PlatformTestResult("meta", "메타", conn.is_configured(), False, "API_MODE=live 로 변경 후 테스트하세요")
    if not conn.is_configured():
        return PlatformTestResult("meta", "메타", False, False, "META_ACCESS_TOKEN, META_AD_ACCOUNT_IDS 설정 필요")
    try:
        ok, msg = conn.test_connection()
        count = len(conn.fetch_campaigns()) if ok else 0
        return PlatformTestResult("meta", "메타", True, ok, msg, count)
    except Exception as exc:
        return PlatformTestResult("meta", "메타", True, False, str(exc))


def _test_youtube() -> PlatformTestResult:
    conn = GoogleAdsConnector()
    if MOCK_MODE:
        return PlatformTestResult("youtube", "유튜브", conn.is_configured(), False, "API_MODE=live 로 변경 후 테스트하세요")
    if not conn.is_configured():
        return PlatformTestResult(
            "youtube",
            "유튜브",
            False,
            False,
            "GOOGLE_ADS_DEVELOPER_TOKEN, REFRESH_TOKEN, CUSTOMER_IDS 설정 필요",
        )
    try:
        ok, msg = conn.test_connection()
        count = len(conn.fetch_campaigns()) if ok else 0
        return PlatformTestResult("youtube", "유튜브", True, ok, msg, count)
    except Exception as exc:
        return PlatformTestResult("youtube", "유튜브", True, False, str(exc))


def _test_tiktok() -> PlatformTestResult:
    conn = TikTokConnector()
    if MOCK_MODE:
        return PlatformTestResult("tiktok", "틱톡", conn.is_configured(), False, "API_MODE=live 로 변경 후 테스트하세요")
    if not conn.is_configured():
        return PlatformTestResult("tiktok", "틱톡", False, False, "TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_IDS 설정 필요")
    try:
        ok, msg = conn.test_connection()
        count = len(conn.fetch_campaigns()) if ok else 0
        return PlatformTestResult("tiktok", "틱톡", True, ok, msg, count)
    except Exception as exc:
        return PlatformTestResult("tiktok", "틱톡", True, False, str(exc))