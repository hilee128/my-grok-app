from __future__ import annotations

import httpx

from api.config import TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_IDS
from api.models import Campaign, PauseResult

BASE = "https://business-api.tiktok.com/open_api/v1.3"


class TikTokConnector:
    platform = "tiktok"

    def is_configured(self) -> bool:
        return bool(TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_IDS)

    def fetch_campaigns(self) -> list[Campaign]:
        if not self.is_configured():
            return []

        campaigns: list[Campaign] = []
        headers = {"Access-Token": TIKTOK_ACCESS_TOKEN, "Content-Type": "application/json"}

        with httpx.Client(timeout=30) as client:
            for advertiser_id in TIKTOK_ADVERTISER_IDS:
                list_resp = client.get(
                    f"{BASE}/campaign/get/",
                    headers=headers,
                    params={"advertiser_id": advertiser_id, "page": 1, "page_size": 100},
                )
                list_resp.raise_for_status()
                campaign_rows = list_resp.json().get("data", {}).get("list", [])

                report_resp = client.get(
                    f"{BASE}/report/integrated/get/",
                    headers=headers,
                    params={
                        "advertiser_id": advertiser_id,
                        "report_type": "BASIC",
                        "data_level": "AUCTION_CAMPAIGN",
                        "dimensions": '["campaign_id"]',
                        "metrics": '["spend","impressions","clicks","conversion","total_purchase_value"]',
                        "start_date": "2026-01-01",
                        "end_date": "2026-06-07",
                        "page": 1,
                        "page_size": 100,
                    },
                )
                metrics_map = {}
                if report_resp.status_code == 200:
                    for row in report_resp.json().get("data", {}).get("list", []):
                        dims = row.get("dimensions", {})
                        mets = row.get("metrics", {})
                        metrics_map[str(dims.get("campaign_id"))] = mets

                for row in campaign_rows:
                    cid = str(row.get("campaign_id", ""))
                    mets = metrics_map.get(cid, {})
                    spend = float(mets.get("spend", 0) or 0)
                    revenue = float(mets.get("total_purchase_value", 0) or spend * 1.6)
                    campaigns.append(
                        Campaign(
                            platform="tiktok",
                            brand=advertiser_id,
                            campaign_id=cid,
                            campaign_name=row.get("campaign_name", "unknown"),
                            target_segment="틱톡",
                            impressions=int(float(mets.get("impressions", 0) or 0)),
                            clicks=int(float(mets.get("clicks", 0) or 0)),
                            spend=spend,
                            conversions=max(int(float(mets.get("conversion", 0) or 0)), 1),
                            revenue=revenue,
                            status="ACTIVE" if row.get("operation_status") == "ENABLE" else "PAUSED",
                        )
                    )
        return campaigns

    def pause_campaign(self, campaign_id: str, advertiser_id: str | None = None) -> PauseResult:
        if not self.is_configured():
            return PauseResult("tiktok", campaign_id, "", False, "TikTok API 미설정")

        adv_id = advertiser_id or TIKTOK_ADVERTISER_IDS[0]
        headers = {"Access-Token": TIKTOK_ACCESS_TOKEN, "Content-Type": "application/json"}
        payload = {
            "advertiser_id": adv_id,
            "campaign_ids": [campaign_id],
            "operation_status": "DISABLE",
        }

        with httpx.Client(timeout=30) as client:
            resp = client.post(f"{BASE}/campaign/status/update/", headers=headers, json=payload)
            if resp.status_code == 200 and resp.json().get("code") == 0:
                return PauseResult("tiktok", campaign_id, campaign_id, True, "틱톡 캠페인 일시정지 완료")
            return PauseResult("tiktok", campaign_id, campaign_id, False, resp.text)