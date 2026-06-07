from __future__ import annotations

from api.config import MOCK_MODE, platform_status
from api.connectors.google_ads import GoogleAdsConnector
from api.connectors.meta import MetaConnector
from api.connectors.mock_data import MockConnector
from api.connectors.tiktok import TikTokConnector
from api.models import AnalysisResult, Campaign, PauseResult
from api.rules import filter_waste, should_auto_pause


class Orchestrator:
    def __init__(self) -> None:
        self.mock = MockConnector()
        self.meta = MetaConnector()
        self.youtube = GoogleAdsConnector()
        self.tiktok = TikTokConnector()

    def fetch_all(self) -> list[Campaign]:
        if MOCK_MODE:
            return self.mock.fetch_campaigns()

        campaigns: list[Campaign] = []
        for connector in (self.meta, self.youtube, self.tiktok):
            try:
                if connector.is_configured():
                    campaigns.extend(connector.fetch_campaigns())
            except Exception:
                continue

        return campaigns if campaigns else self.mock.fetch_campaigns()

    def analyze(self, auto_pause: bool = True) -> AnalysisResult:
        campaigns = self.fetch_all()
        rows = [c.to_row() for c in campaigns]
        waste = [c.to_row() for c in filter_waste(campaigns)]

        paused_rows: list[dict] = []
        saved = 0.0
        if auto_pause:
            for campaign in filter_waste(campaigns):
                result = self._pause(campaign)
                if result.success:
                    campaign.status = "PAUSED"
                    saved += campaign.spend
                    paused_rows.append({**campaign.to_row(), "pause_message": result.message})

        active = [c for c in campaigns if c.status == "ACTIVE"]
        active_spend = sum(c.spend for c in active)
        active_revenue = sum(c.revenue for c in active)
        roas = (active_revenue / active_spend * 100) if active_spend else 0

        summary = (
            f"{'데모' if MOCK_MODE else '실연동'} · 캠페인 {len(campaigns)}건 · "
            f"운영 ROAS {roas:.1f}% · "
            f"{'자동 중단 ' + str(len(paused_rows)) + '건' if paused_rows else '자동 중단 대상 없음'}"
        )
        if saved:
            summary += f" · 절감 예상 {int(saved):,}원"

        return AnalysisResult(
            campaigns=rows,
            waste=waste,
            paused=paused_rows,
            summary=summary,
            saved_spend=saved,
            platform_status=platform_status(),
        )

    def pause_one(self, campaign: Campaign) -> PauseResult:
        return self._pause(campaign)

    def _pause(self, campaign: Campaign) -> PauseResult:
        if MOCK_MODE:
            return self.mock.pause_campaign(campaign.campaign_id)

        if campaign.platform == "meta":
            return self.meta.pause_campaign(campaign.campaign_id)
        if campaign.platform == "youtube":
            return self.youtube.pause_campaign(campaign.campaign_id, campaign.brand)
        if campaign.platform == "tiktok":
            return self.tiktok.pause_campaign(campaign.campaign_id, campaign.brand)

        return PauseResult(campaign.platform, campaign.campaign_id, campaign.campaign_name, False, "지원하지 않는 매체")