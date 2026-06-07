#!/usr/bin/env python3
"""광고 로우 데이터 분석 → 인사이트 리포트 자동 생성."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

RAW_CSV = Path("ad_performance_raw.csv")
REPORT_PATH = Path("marketing_insight_report.txt")

BUDGET_WASTE_SPEND_MIN = 500_000
BUDGET_WASTE_ROAS_MAX = 150  # %


def generate_mock_data(path: Path) -> pd.DataFrame:
    """가상 광고 성과 데이터 생성."""
    rng = np.random.default_rng(42)

    campaigns = [
        ("브랜드인지_봄시즌", "2030직장인"),
        ("브랜드인지_봄시즌", "프리랜서"),
        ("퍼포먼스_앱설치", "2030직장인"),
        ("퍼포먼스_앱설치", "장비덕후"),
        ("퍼포먼스_앱설치", "대학생"),
        ("리타겟팅_장바구니", "2030직장인"),
        ("리타겟팅_장바구니", "프리랜서"),
        ("신제품런칭_영상", "장비덕후"),
        ("신제품런칭_영상", "2030직장인"),
        ("신제품런칭_영상", "육아맘"),
        ("검색광고_브랜드키워드", "2030직장인"),
        ("검색광고_브랜드키워드", "프리랜서"),
        ("디스플레이_관심사", "장비덕후"),
        ("디스플레이_관심사", "대학생"),
        ("인플루언서_협찬", "2030직장인"),
        ("인플루언서_협찬", "육아맘"),
        ("CRM_이메일연동", "프리랜서"),
        ("CRM_이메일연동", "2030직장인"),
        ("유튜브_인스트림", "장비덕후"),
        ("유튜브_인스트림", "대학생"),
        ("카카오모먼트_전환", "2030직장인"),
        ("카카오모먼트_전환", "육아맘"),
        ("틱톡_바이럴", "대학생"),
        ("틱톡_바이럴", "2030직장인"),
        ("네이버GFA_리치미디어", "프리랜서"),
        ("네이버GFA_리치미디어", "장비덕후"),
        ("오프라인연동_QR", "2030직장인"),
        ("오프라인연동_QR", "프리랜서"),
        ("시즌세일_프로모션", "육아맘"),
        ("시즌세일_프로모션", "2030직장인"),
        ("브랜드검색_경쟁사대응", "장비덕후"),
        ("브랜드검색_경쟁사대응", "2030직장인"),
    ]

    segment_roas_profile = {
        "장비덕후": (2.6, 3.4),
        "2030직장인": (1.8, 2.5),
        "프리랜서": (1.5, 2.1),
        "육아맘": (2.0, 2.8),
        "대학생": (1.2, 1.9),
    }

    rows = []
    for campaign, segment in campaigns:
        impressions = int(rng.integers(80_000, 1_200_000))
        ctr_base = rng.uniform(0.008, 0.045)
        if segment == "장비덕후":
            ctr_base *= rng.uniform(1.1, 1.4)
        if segment == "대학생":
            ctr_base *= rng.uniform(0.7, 0.95)

        clicks = max(1, int(impressions * ctr_base))
        spend = int(rng.integers(120_000, 1_800_000))

        cvr_base = rng.uniform(0.01, 0.12)
        if "리타겟팅" in campaign:
            cvr_base *= rng.uniform(1.5, 2.2)
        if "브랜드인지" in campaign:
            cvr_base *= rng.uniform(0.3, 0.6)
            spend = int(rng.integers(550_000, 1_200_000))

        conversions = max(1, int(clicks * cvr_base))

        roas_low, roas_high = segment_roas_profile[segment]
        if "리타겟팅" in campaign:
            roas_low += 0.4
            roas_high += 0.6
        if "브랜드인지" in campaign:
            roas_low = 0.7
            roas_high = 1.1

        target_roas = rng.uniform(roas_low, roas_high)
        revenue = int(spend * target_roas)

        if campaign == "브랜드인지_봄시즌" and segment == "2030직장인":
            spend = 820_000
            revenue = int(spend * 1.05)
        if campaign == "유튜브_인스트림" and segment == "대학생":
            spend = 640_000
            revenue = int(spend * 1.12)
        if campaign == "디스플레이_관심사" and segment == "대학생":
            spend = 710_000
            revenue = int(spend * 1.25)

        rows.append(
            {
                "Campaign_Name": campaign,
                "Target_Segment": segment,
                "Impressions": impressions,
                "Clicks": clicks,
                "Spend": spend,
                "Conversions": conversions,
                "Revenue": revenue,
            }
        )

    df = pd.DataFrame(rows)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    return df


def load_raw_data(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"[INFO] '{path}' 없음 → 가상 데이터 생성 중...")
        return generate_mock_data(path)
    return pd.read_csv(path, encoding="utf-8-sig")


def add_metrics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["CTR"] = (out["Clicks"] / out["Impressions"] * 100).round(2)
    out["CVR"] = (out["Conversions"] / out["Clicks"] * 100).round(2)
    out["CPA"] = (out["Spend"] / out["Conversions"]).round(0)
    out["ROAS"] = (out["Revenue"] / out["Spend"] * 100).round(1)
    return out


def segment_summary(df: pd.DataFrame) -> pd.DataFrame:
    agg = (
        df.groupby("Target_Segment", as_index=False)
        .agg(
            캠페인수=("Campaign_Name", "count"),
            총_노출=("Impressions", "sum"),
            총_클릭=("Clicks", "sum"),
            총_광고비=("Spend", "sum"),
            총_전환=("Conversions", "sum"),
            총_매출=("Revenue", "sum"),
        )
    )
    agg["CTR"] = (agg["총_클릭"] / agg["총_노출"] * 100).round(2)
    agg["CVR"] = (agg["총_전환"] / agg["총_클릭"] * 100).round(2)
    agg["CPA"] = (agg["총_광고비"] / agg["총_전환"]).round(0)
    agg["ROAS"] = (agg["총_매출"] / agg["총_광고비"] * 100).round(1)
    return agg


def budget_waste_campaigns(df: pd.DataFrame) -> pd.DataFrame:
    mask = (df["Spend"] >= BUDGET_WASTE_SPEND_MIN) & (df["ROAS"] < BUDGET_WASTE_ROAS_MAX)
    return (
        df.loc[mask, ["Campaign_Name", "Target_Segment", "Spend", "Revenue", "ROAS", "CPA"]]
        .sort_values("ROAS")
        .reset_index(drop=True)
    )


def format_currency(value: float) -> str:
    return f"{int(value):,}원"


def build_one_line_summary(
    waste: pd.DataFrame,
    top_cpa: pd.DataFrame,
    top_roas: pd.DataFrame,
    total_spend: float,
    total_roas: float,
) -> str:
    best_roas_seg = top_roas.iloc[0]["Target_Segment"]
    best_cpa_seg = top_cpa.iloc[0]["Target_Segment"]
    waste_count = len(waste)

    if waste_count:
        waste_note = (
            f"예산 낭비 의심 캠페인 {waste_count}건 즉시 예산 축소·소재 교체 검토,"
        )
    else:
        waste_note = "예산 낭비 캠페인 없음,"

    return (
        f"결론: 전체 ROAS {total_roas:.1f}% 기준, "
        f"'{best_roas_seg}' 세그먼트 예산 확대·'{best_cpa_seg}' 세그먼트 전환 효율 벤치마킹 권장, "
        f"{waste_note} "
        f"총 광고비 {format_currency(total_spend)} 대비 수익 극대화 액션 우선."
    )


def dataframe_to_text(df: pd.DataFrame, title: str) -> str:
    if df.empty:
        return f"\n{title}\n(해당 없음)\n"
    display = df.copy()
    for col in display.select_dtypes(include="number").columns:
        if col in ("CTR", "CVR", "ROAS"):
            display[col] = display[col].map(lambda x: f"{x:.1f}%" if col == "ROAS" else f"{x:.2f}%")
        elif col in ("Spend", "Revenue", "CPA", "총_광고비", "총_매출"):
            display[col] = display[col].map(format_currency)
    return f"\n{title}\n{display.to_string(index=False)}\n"


def build_report(
    df: pd.DataFrame,
    segment_df: pd.DataFrame,
    waste_df: pd.DataFrame,
    top_cpa: pd.DataFrame,
    top_roas: pd.DataFrame,
    summary_line: str,
) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_spend = df["Spend"].sum()
    total_revenue = df["Revenue"].sum()
    total_roas = total_revenue / total_spend * 100

    lines = [
        "=" * 72,
        "  마케팅 인사이트 리포트 | Ad Performance Analysis",
        f"  생성 시각: {now}",
        "=" * 72,
        "",
        "■ 전체 요약",
        f"  - 분석 캠페인: {len(df)}건",
        f"  - 총 광고비: {format_currency(total_spend)}",
        f"  - 총 매출: {format_currency(total_revenue)}",
        f"  - 전체 ROAS: {total_roas:.1f}%",
        f"  - 평균 CPA: {format_currency(df['CPA'].mean())}",
        "",
        "■ 결론 한 줄 요약",
        f"  {summary_line}",
    ]

    if waste_df.empty:
        lines.extend(["", "■ ⚠️ 예산 낭비 경고", "  (해당 없음 — 고지출·저ROAS 캠페인 없음)"])
    else:
        lines.append("")
        lines.append(
            f"■ ⚠️ 예산 낭비 경고 "
            f"(광고비 ≥ {format_currency(BUDGET_WASTE_SPEND_MIN)}, ROAS < {BUDGET_WASTE_ROAS_MAX}%)"
        )
        for _, row in waste_df.iterrows():
            lines.append(
                f"  • {row['Campaign_Name']} / {row['Target_Segment']} — "
                f"광고비 {format_currency(row['Spend'])}, ROAS {row['ROAS']:.1f}%, "
                f"CPA {format_currency(row['CPA'])}"
            )

    lines.append(dataframe_to_text(top_cpa, "■ 타겟 세그먼트 TOP 3 — 가장 낮은 CPA (전환 효율 우수)"))
    lines.append(dataframe_to_text(top_roas, "■ 타겟 세그먼트 TOP 3 — 가장 높은 ROAS (수익 효율 우수)"))
    lines.append(dataframe_to_text(segment_df, "■ 타겟 세그먼트 전체 요약"))
    lines.append(dataframe_to_text(
        df.sort_values("ROAS", ascending=False)[
            ["Campaign_Name", "Target_Segment", "Spend", "Revenue", "CTR", "CVR", "CPA", "ROAS"]
        ],
        "■ 캠페인별 상세 (ROAS 내림차순)",
    ))
    lines.append("=" * 72)
    return "\n".join(lines)


def main() -> int:
    raw = load_raw_data(RAW_CSV)
    df = add_metrics(raw)

    segment_df = segment_summary(df)
    top_cpa = segment_df.nsmallest(3, "CPA")[
        ["Target_Segment", "CPA", "ROAS", "총_광고비", "총_전환", "총_매출"]
    ].reset_index(drop=True)
    top_roas = segment_df.nlargest(3, "ROAS")[
        ["Target_Segment", "ROAS", "CPA", "총_광고비", "총_전환", "총_매출"]
    ].reset_index(drop=True)

    waste_df = budget_waste_campaigns(df)
    summary_line = build_one_line_summary(
        waste_df,
        top_cpa,
        top_roas,
        df["Spend"].sum(),
        df["Revenue"].sum() / df["Spend"].sum() * 100,
    )

    report = build_report(df, segment_df, waste_df, top_cpa, top_roas, summary_line)
    REPORT_PATH.write_text(report, encoding="utf-8")

    print("\n" + "=" * 72)
    print("  📊 광고 성과 분석 요약")
    print("=" * 72)

    if waste_df.empty:
        print("\n⚠️ 예산 낭비 경고: 해당 없음\n")
    else:
        print(f"\n⚠️ 예산 낭비 경고 ({len(waste_df)}건)\n")
        print(waste_df.to_string(index=False))
        print()

    print("🏆 타겟 세그먼트 TOP 3 — 최저 CPA\n")
    print(top_cpa.to_string(index=False))
    print("\n🏆 타겟 세그먼트 TOP 3 — 최고 ROAS\n")
    print(top_roas.to_string(index=False))
    print("\n📋 타겟 세그먼트 전체 요약\n")
    print(segment_df.to_string(index=False))
    print("\n💡 결론 한 줄 요약")
    print(f"   {summary_line}")
    print(f"\n✅ 리포트 저장 완료: {REPORT_PATH.resolve()}")
    print("=" * 72 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())