from __future__ import annotations

import httpx

from api.config import META_ACCESS_TOKEN, META_AD_ACCOUNT_IDS
from api.models import Campaign, PauseResult

GRAPH = "https://graph.facebook.com/v21.0"


class MetaConnector:
    platform = "meta"

    def is_configured(self) -> bool:
        return bool(META_ACCESS_TOKEN and META_AD_ACCOUNT_IDS)

    def test_connection(self) -> tuple[bool, str]:
        with httpx.Client(timeout=20) as client:
            resp = client.get(
                f"{GRAPH}/me",
                params={"access_token": META_ACCESS_TOKEN, "fields": "id,name"},
            )
            if resp.status_code != 200:
                return False, resp.text
            user = resp.json()
            return True, f"연결됨 · {user.get('name', user.get('id'))} · 광고계정 {len(META_AD_ACCOUNT_IDS)}개"

    def fetch_campaigns(self) -> list[Campaign]:
        if not self.is_configured():
            return []

        campaigns: list[Campaign] = []
        with httpx.Client(timeout=30) as client:
            for account_id in META_AD_ACCOUNT_IDS:
                act_id = account_id if account_id.startswith("act_") else f"act_{account_id}"
                params = {
                    "access_token": META_ACCESS_TOKEN,
                    "level": "campaign",
                    "fields": "campaign_id,campaign_name,impressions,clicks,spend,actions,action_values",
                    "date_preset": "last_30d",
                    "limit": 100,
                }
                resp = client.get(f"{GRAPH}/{act_id}/insights", params=params)
                resp.raise_for_status()
                for row in resp.json().get("data", []):
                    conversions = _extract_action(row.get("actions"), "purchase")
                    revenue = _extract_value(row.get("action_values"), "purchase")
                    spend = float(row.get("spend", 0))
                    campaigns.append(
                        Campaign(
                            platform="meta",
                            brand=act_id,
                            campaign_id=str(row.get("campaign_id", "")),
                            campaign_name=row.get("campaign_name", "unknown"),
                            target_segment="메타",
                            impressions=int(row.get("impressions", 0)),
                            clicks=int(row.get("clicks", 0)),
                            spend=spend,
                            conversions=max(conversions, 1),
                            revenue=revenue or spend * 1.5,
                            status="ACTIVE",
                        )
                    )
        return campaigns

    def pause_campaign(self, campaign_id: str) -> PauseResult:
        if not META_ACCESS_TOKEN:
            return PauseResult("meta", campaign_id, "", False, "META_ACCESS_TOKEN 미설정")

        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{GRAPH}/{campaign_id}",
                data={"status": "PAUSED", "access_token": META_ACCESS_TOKEN},
            )
            if resp.status_code == 200:
                return PauseResult("meta", campaign_id, campaign_id, True, "메타 캠페인 일시정지 완료")
            return PauseResult("meta", campaign_id, campaign_id, False, resp.text)


def _extract_action(actions: list | None, action_type: str) -> int:
    if not actions:
        return 0
    for item in actions:
        if item.get("action_type") == action_type:
            return int(float(item.get("value", 0)))
    return 0


def _extract_value(values: list | None, action_type: str) -> float:
    if not values:
        return 0.0
    for item in values:
        if item.get("action_type") == action_type:
            return float(item.get("value", 0))
    return 0.0