from __future__ import annotations

import httpx

from api.config import (
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_CUSTOMER_IDS,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_REFRESH_TOKEN,
)
from api.models import Campaign, PauseResult

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_VERSION = "v18"


class GoogleAdsConnector:
    platform = "youtube"

    def is_configured(self) -> bool:
        return bool(
            GOOGLE_ADS_DEVELOPER_TOKEN
            and GOOGLE_ADS_REFRESH_TOKEN
            and GOOGLE_ADS_CUSTOMER_IDS
        )

    def test_connection(self) -> tuple[bool, str]:
        token = self._access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
        }
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"https://googleads.googleapis.com/{API_VERSION}/customers:listAccessibleCustomers",
                headers=headers,
            )
            if resp.status_code != 200:
                return False, resp.text
            ids = resp.json().get("resourceNames", [])
            return True, f"연결됨 · 접근 가능 계정 {len(ids)}개 · 설정 {len(GOOGLE_ADS_CUSTOMER_IDS)}개"

    def _access_token(self) -> str:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                TOKEN_URL,
                data={
                    "client_id": GOOGLE_ADS_CLIENT_ID,
                    "client_secret": GOOGLE_ADS_CLIENT_SECRET,
                    "refresh_token": GOOGLE_ADS_REFRESH_TOKEN,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    def fetch_campaigns(self) -> list[Campaign]:
        if not self.is_configured():
            return []

        token = self._access_token()
        campaigns: list[Campaign] = []
        headers = {
            "Authorization": f"Bearer {token}",
            "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
            "Content-Type": "application/json",
        }

        query = """
            SELECT
              campaign.id,
              campaign.name,
              campaign.status,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value
            FROM campaign
            WHERE segments.date DURING LAST_30_DAYS
              AND campaign.status != 'REMOVED'
        """

        with httpx.Client(timeout=60) as client:
            for customer_id in GOOGLE_ADS_CUSTOMER_IDS:
                url = f"https://googleads.googleapis.com/{API_VERSION}/customers/{customer_id}/googleAds:searchStream"
                resp = client.post(url, headers=headers, json={"query": query})
                if resp.status_code != 200:
                    continue
                for chunk in resp.json():
                    for row in chunk.get("results", []):
                        camp = row.get("campaign", {})
                        metrics = row.get("metrics", {})
                        spend = int(metrics.get("costMicros", 0)) / 1_000_000
                        revenue = float(metrics.get("conversionsValue", 0) or spend * 1.7)
                        campaigns.append(
                            Campaign(
                                platform="youtube",
                                brand=customer_id,
                                campaign_id=str(camp.get("id", "")),
                                campaign_name=camp.get("name", "unknown"),
                                target_segment="유튜브",
                                impressions=int(metrics.get("impressions", 0)),
                                clicks=int(metrics.get("clicks", 0)),
                                spend=spend,
                                conversions=max(int(float(metrics.get("conversions", 0))), 1),
                                revenue=revenue,
                                status="ACTIVE" if camp.get("status") == "ENABLED" else "PAUSED",
                            )
                        )
        return campaigns

    def pause_campaign(self, campaign_id: str, customer_id: str | None = None) -> PauseResult:
        if not self.is_configured():
            return PauseResult("youtube", campaign_id, "", False, "Google Ads API 미설정")

        cid = customer_id or GOOGLE_ADS_CUSTOMER_IDS[0]
        token = self._access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
            "Content-Type": "application/json",
        }
        resource = f"customers/{cid}/campaigns/{campaign_id}"
        body = {
            "operations": [
                {
                    "update": {"resourceName": resource, "status": "PAUSED"},
                    "updateMask": "status",
                }
            ]
        }

        with httpx.Client(timeout=30) as client:
            url = f"https://googleads.googleapis.com/{API_VERSION}/customers/{cid}/campaigns:mutate"
            resp = client.post(url, headers=headers, json=body)
            if resp.status_code == 200:
                return PauseResult("youtube", campaign_id, campaign_id, True, "유튜브(Google Ads) 캠페인 일시정지 완료")
            return PauseResult("youtube", campaign_id, campaign_id, False, resp.text)