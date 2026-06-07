from __future__ import annotations

from api.config import ROAS_MAX, SPEND_MIN
from api.models import Campaign


def should_auto_pause(campaign: Campaign, auto_enabled: bool = True) -> bool:
    if not auto_enabled or campaign.status == "PAUSED":
        return False
    roas = (campaign.revenue / campaign.spend * 100) if campaign.spend else 0
    return campaign.spend >= SPEND_MIN and roas < ROAS_MAX


def filter_waste(campaigns: list[Campaign]) -> list[Campaign]:
    return [c for c in campaigns if should_auto_pause(c)]