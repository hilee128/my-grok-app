from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Campaign:
    platform: str
    brand: str
    campaign_id: str
    campaign_name: str
    target_segment: str
    impressions: int
    clicks: int
    spend: float
    conversions: int
    revenue: float
    status: str = "ACTIVE"

    def to_row(self) -> dict[str, Any]:
        ctr = (self.clicks / self.impressions * 100) if self.impressions else 0
        cvr = (self.conversions / self.clicks * 100) if self.clicks else 0
        cpa = (self.spend / self.conversions) if self.conversions else 0
        roas = (self.revenue / self.spend * 100) if self.spend else 0
        return {
            "Platform": self.platform,
            "Brand": self.brand,
            "Campaign_ID": self.campaign_id,
            "Campaign_Name": self.campaign_name,
            "Target_Segment": self.target_segment,
            "Impressions": self.impressions,
            "Clicks": self.clicks,
            "Spend": round(self.spend),
            "Conversions": self.conversions,
            "Revenue": round(self.revenue),
            "Status": self.status,
            "CTR": round(ctr, 2),
            "CVR": round(cvr, 2),
            "CPA": round(cpa),
            "ROAS": round(roas, 1),
        }


@dataclass
class PauseResult:
    platform: str
    campaign_id: str
    campaign_name: str
    success: bool
    message: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AnalysisResult:
    campaigns: list[dict[str, Any]] = field(default_factory=list)
    waste: list[dict[str, Any]] = field(default_factory=list)
    paused: list[dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    saved_spend: float = 0
    platform_status: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)