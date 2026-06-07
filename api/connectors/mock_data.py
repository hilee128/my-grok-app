from __future__ import annotations

import random
from api.models import Campaign, PauseResult

BRANDS = ["브랜드A", "브랜드B", "브랜드C", "브랜드D"]
SEGMENTS = ["2030직장인", "장비덕후", "프리랜서", "대학생", "육아맘"]

PLATFORM_META = {
    "meta": {
        "label": "메타",
        "prefixes": ["메타_퍼포먼스", "메타_리타겟", "메타_브랜드"],
    },
    "youtube": {
        "label": "유튜브",
        "prefixes": ["유튜브_인스트림", "유튜브_디맨드젠", "유튜브_쇼츠"],
    },
    "tiktok": {
        "label": "틱톡",
        "prefixes": ["틱톡_인피드", "틱톡_스파크", "틱톡_전환"],
    },
}

_rng = random.Random(42)
_paused_ids: set[str] = set()


class MockConnector:
    platform = "mock"

    def fetch_campaigns(self) -> list[Campaign]:
        campaigns: list[Campaign] = []
        cid = 1000

        for platform, meta in PLATFORM_META.items():
            for brand in BRANDS:
                for prefix in meta["prefixes"]:
                    segment = _rng.choice(SEGMENTS)
                    impressions = _rng.randint(60_000, 900_000)
                    ctr = _rng.uniform(0.01, 0.05)
                    clicks = max(1, int(impressions * ctr))
                    spend = _rng.randint(150_000, 1_500_000)
                    cvr = _rng.uniform(0.02, 0.1)
                    conversions = max(1, int(clicks * cvr))

                    roas_target = _rng.uniform(1.0, 3.2)
                    if prefix.endswith("브랜드") or "브랜드" in prefix:
                        roas_target = _rng.uniform(0.8, 1.3)
                        spend = max(spend, 550_000)
                    revenue = spend * roas_target

                    campaign_id = f"{platform}_{cid}"
                    cid += 1
                    status = "PAUSED" if campaign_id in _paused_ids else "ACTIVE"

                    campaigns.append(
                        Campaign(
                            platform=platform,
                            brand=brand,
                            campaign_id=campaign_id,
                            campaign_name=f"{prefix}_{brand}",
                            target_segment=segment,
                            impressions=impressions,
                            clicks=clicks,
                            spend=spend,
                            conversions=conversions,
                            revenue=revenue,
                            status=status,
                        )
                    )
        return campaigns

    def pause_campaign(self, campaign_id: str) -> PauseResult:
        _paused_ids.add(campaign_id)
        return PauseResult(
            platform=campaign_id.split("_")[0],
            campaign_id=campaign_id,
            campaign_name=campaign_id,
            success=True,
            message="데모 모드: 예산 자동 중단 처리됨",
        )