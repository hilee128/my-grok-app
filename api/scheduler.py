from __future__ import annotations

import asyncio
import logging
import os

from api.services.orchestrator import Orchestrator

logger = logging.getLogger(__name__)

AUTO_PAUSE_SCHEDULE = os.getenv("AUTO_PAUSE_SCHEDULE", "false").lower() == "true"
INTERVAL_MINUTES = int(os.getenv("AUTO_PAUSE_INTERVAL_MINUTES", "60"))


async def run_scheduled_pause() -> None:
    orchestrator = Orchestrator()
    try:
        while True:
            if AUTO_PAUSE_SCHEDULE:
                try:
                    result = orchestrator.analyze(auto_pause=True)
                    logger.info(
                        "Scheduled auto-pause: %d campaigns, saved %.0f",
                        len(result.paused),
                        result.saved_spend,
                    )
                except Exception:
                    logger.exception("Scheduled auto-pause failed")
            await asyncio.sleep(INTERVAL_MINUTES * 60)
    except asyncio.CancelledError:
        logger.info("Scheduler stopped")