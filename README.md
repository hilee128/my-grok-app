# my-grok-app

Grok으로 만든 다양한 데모 프로젝트 모음입니다.

## 🚀 주요 하이라이트: 광고 성과 자동 분석 데모 (정적)

**라이브 데모**: https://hilee128.github.io/my-grok-app/

**직접 광고 데모 페이지**: https://hilee128.github.io/my-grok-app/ads.html

### 데모 기능 (원래 요구사항 완벽 구현)

- **4대 핵심 지표 자동 계산**
  - CTR (클릭률)
  - CVR (전환율)
  - CPA (전환 단가)
  - ROAS (광고 수익률)

- **타겟 세그먼트 분석**
  - ROAS 기준 효율 Top 3 자동 추출
  - CPA TOP 3, ROAS TOP 3 별도 표시

- **예산 낭비 경고 (⚠️)**
  - 광고비 **50만 원 이상** + ROAS **150% 미만** 캠페인 자동 감지
  - 최상단에 경고 패널로 표시
  - 자동 예산 중단 시뮬레이션 토글 지원

- **기타 편의 기능**
  - CSV 직접 업로드 (자신의 데이터로 테스트 가능)
  - 플랫폼 필터 (메타 / 유튜브 / 틱톡 / 전체)
  - 세그먼트별 상세 테이블
  - 데이터 소스 및 생성 시각 표시
  - 데모 모드 / 실제 데이터 모드

### 사용 방법 (정적 데모)

1. https://hilee128.github.io/my-grok-app/ 접속
2. 상단 네비게이션에서 **"광고 데모 (정적)"** 클릭 또는 메인 페이지의 큰 버튼 클릭
3. ads.html 페이지에서 바로 사용 가능 (별도 설치/빌드 불필요)

로컬에서 보려면:
```bash
git clone https://github.com/hilee128/my-grok-app.git
cd my-grok-app
# 브라우저에서 ads.html 열기
open ads.html   # macOS
# 또는 ads.html 파일 더블클릭
```

## 📁 프로젝트 구성

- `index.html` — 메인 랜딩 페이지 (광고 데모 중심으로 구성)
- `ads.html` + `ads.css` + `ads.js` — **광고 성과 대시보드 (정적 데모)**
- `ad_performance_raw.csv` + `data/campaigns.json` — 데모 데이터
- `connect.html` — 연동 설정 예시 페이지
- `api/` — FastAPI 기반 백엔드 (Google Ads, Meta, TikTok 커넥터 등)
- `analyze_ad_performance.py` — Python 버전 분석 스크립트
- 기타: Railway / Render 배포 설정, Docker 등

## 🛠️ 전체 앱 체험

- **정적 데모** (이 GitHub Pages): https://hilee128.github.io/my-grok-app/
- **팀 대시보드 (실제 백엔드 연동)**: https://my-grok-app-production.up.railway.app/login.html

## 원래 목적

이 프로젝트는 스마트스토어/퍼포먼스 마케터를 위한 **광고 성과 자동 분석 도구**의 데모입니다.

비개발자도 쉽게 CSV만 올리면 전문적인 인사이트(지표 계산 + 세그먼트 분석 + 예산 낭비 경고)를 바로 얻을 수 있도록 만들었습니다.

Grok으로 프론트엔드(정적 데모)와 백엔드까지 함께 개발한 결과물입니다.

---

**라이선스**: 개인/학습/데모 용도 자유롭게 사용하세요.

문의나 개선 제안은 언제든 이슈로 남겨주세요!