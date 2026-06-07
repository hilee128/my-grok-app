from __future__ import annotations

import logging

from api.config import MOCK_MODE, platform_status
from api.connectors.google_ads import GoogleAdsConnector
from api.connectors.meta import MetaConnector
from api.connectors.mock_data import MockConnector
from api.connectors.tiktok import TikTokConnector
from api.models import AnalysisResult, Campaign, PauseResult
from api.rules import filter_waste

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(self) -> None:
        self.mock = MockConnector()
        self.meta = MetaConnector()
        self.youtube = GoogleAdsConnector()
        self.tiktok = TikTokConnector()

    def fetch_all(self) -> tuple[list[Campaign], list[str]]:
        if MOCK_MODE:
            return self.mock.fetch_campaigns(), []

        campaigns: list[Campaign] = []
        errors: list[str] = []

        for name, connector in (
            ("메타", self.meta),
            ("유튜브", self.youtube),
            ("틱톡", self.tiktok),
        ):
            if not connector.is_configured():
                errors.append(f"{name}: API 키 미설정")
                continue
            try:
                rows = connector.fetch_campaigns()
                campaigns.extend(rows)
                logger.info("%s 캠페인 %d건 수집", name, len(rows))
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                logger.exception("%s 데이터 수집 실패", name)

        if not campaigns and errors:
            raise RuntimeError(" · ".join(errors))

        return campaigns, errors

    def analyze(self, auto_pause: bool = True) -> AnalysisResult:
        errors: list[str] = []
        try:
            campaigns, errors = self.fetch_all()
        except RuntimeError as exc:
            return AnalysisResult(
                campaigns=[],
                waste=[],
                paused=[],
                summary=f"실연동 실패: {exc}",
                platform_status=platform_status(),
            )

        rows = [c.to_row() for c in campaigns]
        waste = [c.to_row() for c in filter_waste(campaigns)]

        paused_rows: list[dict] = []
        pause_errors: list[str] = []
        saved = 0.0

        if auto_pause:
            for campaign in filter_waste(campaigns):
                if campaign.status == "PAUSED":
                    continue
                result = self._pause(campaign)
                if result.success:
                    campaign.status = "PAUSED"
                    saved += campaign.spend
                    paused_rows.append({**campaign.to_row(), "pause_message": result.message, "live": not MOCK_MODE})
                    logger.info("PAUSED %s %s", campaign.platform, campaign.campaign_id)
                else:
                    pause_errors.append(f"{campaign.campaign_name}: {result.message}")

        active = [c for c in campaigns if c.status != "PAUSED"]
        active_spend = sum(c.spend for c in active)
        active_revenue = sum(c.revenue for c in active)
        roas = (active_revenue / active_spend * 100) if active_spend else 0

        mode_label = "데모" if MOCK_MODE else "실연동"
        summary = f"{mode_label} · 캠페인 {len(campaigns)}건 · 운영 ROAS {roas:.1f}%"
        if paused_rows:
            verb = "실제 중단" if not MOCK_MODE else "시뮬레이션 중단"
            summary += f" · {verb} {len(paused_rows)}건"
            if saved:
                summary += f" · 절감 {int(saved):,}원"
        else:
            summary += " · 자동 중단 대상 없음"
        if pause_errors:
            summary += f" · 실패 {len(pause_errors)}건"
        if errors:
            summary += f" · 경고: {'; '.join(errors)}"

        return AnalysisResult(
            campaigns=rows,
            waste=waste,
            paused=paused_rows,
            summary=summary,
            saved_spend=saved,
            platform_status=platform_status(),
        )

    def pause_one(self, platform: str, campaign_id: str, account_id: str | None = None) -> PauseResult:
        campaign = Campaign(
            platform=platform,
            brand=account_id or "",
            campaign_id=campaign_id,
            campaign_name=campaign_id,
            target_segment="",
            impressions=0,
            clicks=0,
            spend=0,
            conversions=0,
            revenue=0,
        )
        return self._pause(campaign)

    def _pause(self, campaign: Campaign) -> PauseResult:
        if MOCK_MODE:
            return self.mock.pause_campaign(campaign.campaign_id)

        if campaign.platform == "meta":
            return self.meta.pause_campaign(campaign.campaign_id)
        if campaign.platform == "youtube":
            return self.youtube.pause_campaign(campaign.campaign_id, campaign.brand or None)
        if campaign.platform == "tiktok":
            return self.tiktok.pause_campaign(campaign.campaign_id, campaign.brand or None)

        return PauseResult(campaign.platform, campaign.campaign_id, campaign.campaign_name, False, "지원하지 않는 매체")