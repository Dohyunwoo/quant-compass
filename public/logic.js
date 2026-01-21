export function generateInsights(d, prev) {
    const ins = [];
    
    // 메시지 추가 헬퍼 함수 (중복 제거 기능 포함)
    const add = (msg, type = 'light') => {
        if (!ins.some(i => i.msg === msg)) ins.push({ msg, type });
    };

    // =================================================================
    // 1. 🌍 MACRO & RATES (거시경제 및 금리)
    // =================================================================
    
    // 장단기 금리차 (경기 침체 선행 지표)
    if (d.us2y > d.us10y) {
        const spread = (d.us2y - d.us10y).toFixed(2);
        add(`🚨 [Recession Warning] 장단기 금리 역전폭이 ${spread}%p입니다. 과거 데이터상 12~18개월 내 경기 침체 확률이 90% 이상입니다.`, "danger");
    } else if ((d.us10y - d.us2y) < 0.2) {
        add("⚠️ [금리차 축소] 장단기 금리차가 0.2%p 미만으로 좁혀졌습니다. 시장의 방향성이 곧 결정될 변곡점입니다.", "warning");
    }

    // 10년물 국채 금리 (주식 밸류에이션의 중력)
    if (d.us10y > 4.5) {
        if (d.idx_ndx < -1.0) add("📉 [고금리 발작] 미 10년물 금리 4.5% 돌파가 기술주(나스닥)의 밸류에이션을 강하게 압박하고 있습니다.", "danger");
        else add("⚠️ [Yield Alert] 10년물 금리가 4.5%를 넘었습니다. 주식 시장 전반에 부담스러운 레벨입니다. 부채가 많은 기업을 피하세요.", "warning");
    } else if (d.us10y < 3.5) {
        add("🌊 [Goldilocks] 금리가 3.5% 아래로 안정화되었습니다. 성장주와 비트코인에 매우 우호적인 유동성 환경입니다.", "success");
    }

    // 달러 인덱스 (DXY)
    if (d.dxy > 106) add("💵 [King Dollar] 달러 인덱스 106 돌파. 신흥국(한국 포함) 시장에서 외국인 자금 이탈이 우려됩니다.", "danger");
    else if (d.dxy < 101 && d.gold > 0) add("📉 [달러 약세] 달러 약세로 인해 금(Gold)과 비트코인 등 대체 자산의 매력이 높아지고 있습니다.", "success");

    // =================================================================
    // 2. 😨 SENTIMENT & VOLATILITY (심리 및 변동성)
    // =================================================================

    // VIX (공포지수) - 역발상 투자
    if (d.vix > 40) add("💎 [Historic Opportunity] VIX 40 돌파. 금융위기급 패닉입니다. 역사적으로 이 구간은 '인생 매수 기회'였습니다.", "success");
    else if (d.vix > 30) add("😨 [Extreme Fear] 시장이 극도의 공포에 질려 있습니다. 투매에 동참하기보다 분할 매수로 대응할 구간입니다.", "warning");
    else if (d.vix < 11.5) add("🎈 [Complacency] VIX 11.5 미만. 시장이 너무 안일합니다(탐욕). 기습적인 폭락에 대비해 풋옵션이나 현금 비중을 늘리세요.", "danger");

    // VIX와 주가의 다이버전스 (이상 징후)
    if (d.idx_spx > 0.5 && d.vix > 5) {
        add("🚩 [Smart Money Exit?] 주가는 오르는데 공포지수(VIX)도 함께 오르고 있습니다. 세력들이 상승장에 하락 베팅(Hedging)을 구축 중일 수 있습니다.", "danger");
    }

    // =================================================================
    // 3. 🪙 CRYPTO & ASSETS (가상자산 및 원자재)
    // =================================================================

    // 비트코인 도미넌스 (알트장 판별기)
    if (d.btcDom > 58) add("🪙 [BTC Dictatorship] 비트코인 도미넌스 58% 상회. 유동성이 비트코인으로만 쏠리고 있습니다. 알트코인 매수는 자제하세요.", "info");
    else if (d.btcDom < 40 && d.btc > 0) add("🎉 [Alt-Season Open] 비트코인이 횡보/상승하는 동안 도미넌스가 급락 중입니다. 본격적인 알트코인 불장 신호입니다.", "success");

    // 디커플링 (나스닥 vs 비트코인)
    if (d.idx_ndx < -1.5 && d.btc > 1.0) {
        add("🔗 [Decoupling] 나스닥 급락에도 비트코인은 상승 중입니다. 비트코인이 '위험 자산'이 아닌 '디지털 골드'로 재평가받고 있습니다.", "success");
    }

    // 유가 (WTI) - 인플레이션
    if (d.wti > 90) {
        if (d.idx_spx < -0.5) add("🛢 [Stagflation Fear] 유가 급등($90↑)과 주가 하락이 겹쳤습니다. 물가는 오르고 성장은 멈추는 최악의 시나리오를 경계하세요.", "danger");
        else add("⚠️ [Oil Shock] 유가가 $90를 넘었습니다. 에너지 섹터 외에는 비용 부담이 커집니다.", "warning");
    }

    // 금 (Gold) - 안전자산 선호
    if (d.gold > 1.5 && d.us10y > 4.2) {
        add("🏦 [System Risk] 실질 금리가 오르는데도(원래 금 악재) 금값이 폭등합니다. 중앙은행들이 달러 시스템을 불신하고 있다는 강력한 신호입니다.", "info");
    }

    // =================================================================
    // 4. 📉 MARKET & SECTOR (주식 시장)
    // =================================================================

    // 폭락장 감지
    if (d.idx_ndx < -3.0) add("🩸 [Tech Crash] 나스닥 3% 이상 폭락. 알고리즘에 의한 투매가 나오고 있습니다. 떨어지는 칼날을 잡지 마세요.", "danger");
    if (d.idx_kosdaq < -4.0) add("🇰🇷 [KOSDAQ Panic] 코스닥 4% 이상 폭락. 신용 융자 반대매매(Margin Call)가 쏟아지며 지수를 왜곡하고 있습니다.", "danger");

    // 순환매 (Sector Rotation)
    if (d.idx_ndx < -1.0 && d.idx_dji > 0.5) add("🔄 [Rotation] 성장주(나스닥)를 팔고 가치주(다우)로 자금이 이동하고 있습니다. 방어적인 포트폴리오가 유리합니다.", "info");
    if (d.idx_rut > 1.5 && d.us10y < 4.0) add("📈 [Small Cap Rally] 금리 안정에 힘입어 중소형주(러셀2000)가 시장을 주도하고 있습니다.", "success");

    // 한국 시장 디커플링
    if (d.idx_spx > 1.0 && d.idx_kospi < -0.5) add("💔 [Korea Discount] 미국장은 불타는데 한국장만 차갑게 식었습니다. 환율이나 반도체 업황에 악재가 있는지 확인하세요.", "dark");

    // =================================================================
    // 5. ⏱️ DELTA ANALYSIS (어제 대비 변동폭 심층 분석)
    // =================================================================
    
    if (prev) {
        // VIX 급변동
        const vixDelta = ((d.vix - prev.vix) / prev.vix) * 100;
        if (vixDelta > 20) add(`🚨 [Fear Spike] 어제 대비 공포지수(VIX)가 ${vixDelta.toFixed(0)}% 폭등했습니다. 풋옵션 수요가 폭발하고 있습니다.`, "danger");
        else if (vixDelta < -15) add(`😌 [Relief Rally] 어제 대비 공포지수가 급격히 진정(-${Math.abs(vixDelta).toFixed(0)}%)되었습니다. 단기 기술적 반등이 유효합니다.`, "success");

        // 금리 쇼크
        const rateDelta = d.us10y - prev.us10y;
        if (rateDelta > 0.15) add(`📈 [Rate Shock] 국채 금리가 하루 만에 +${rateDelta.toFixed(2)}%p 급등했습니다. 주식 시장에 발작적인 매도가 나올 수 있습니다.`, "danger");

        // 비트코인 모멘텀
        if (d.btc > prev.btc * 1.05 && d.btcDom > prev.btcDom) {
            add("🚀 [BTC Momentum] 어제보다 가격(+5%↑)과 도미넌스가 동시에 상승했습니다. 비트코인 주도의 강력한 상승장 초입입니다.", "success");
        }

        // 유가 급락 (디플레이션 우려?)
        if (d.wti < prev.wti * 0.95) add("📉 [Oil Crash] 유가가 하루 만에 5% 이상 급락했습니다. 경기 침체 우려로 인한 수요 감소일 수 있습니다.", "warning");
    } else {
        add("ℹ️ [Info] 어제 데이터가 충분하지 않아 등락률(Delta) 분석은 생략되었습니다. (내일부터 활성화)", "secondary");
    }

    // =================================================================
    // 6. 🧘 PERSONAL DIAGNOSIS (나의 포지션 점검)
    // =================================================================

    // 위험 관리 (Risk Management)
    if (d.myPosition > 80) {
        if (d.vix > 30 || d.idx_spx < -2.0) {
            add("🛑 [DANGER] 시장은 폭락 중인데 '풀매수' 상태입니다. 지금은 용기가 아니라 만용일 수 있습니다. 리스크 관리가 시급합니다.", "danger");
        } else if (d.us2y > d.us10y && d.dxy > 105) {
            add("⚠️ [Macro Warning] 거시경제 지표가 좋지 않은데 포지션이 너무 큽니다. 현금 비중을 조금 늘리는 건 어떨까요?", "warning");
        }
    }

    // FOMO 방지
    if (d.myPosition < 20) {
        if (d.idx_spx > 1.5 && d.vix < 20) {
            add("🐇 [FOMO Alert] 시장은 축제 분위기인데 현금만 들고 계십니다. 너무 완벽한 타이밍만 재다가 기회를 놓칠 수 있습니다.", "secondary");
        } else if (d.idx_spx < -2.0) {
            add("🛡️ [Cash is King] 폭락장을 완벽하게 피하셨군요! 이제 저점 매수 리스트를 작성할 시간입니다.", "success");
        }
    }

    // 인지 부조화 (Cognitive Dissonance)
    if (d.myOutlook <= 2 && d.myPosition > 70) {
        add("⚖️ [Cognitive Dissonance] 머리로는 '하락'을 예상하면서 몸(계좌)은 '매수' 포지션입니다. 손절 타이밍을 놓쳐 비자발적 장기투자가 된 건 아닌지 점검하세요.", "warning");
    } else if (d.myOutlook >= 4 && d.myPosition < 30) {
        add("⚖️ [Hesitation] 시장을 긍정적으로 보면서도 매수하지 못하고 있습니다. 확신이 부족하다면 분할 매수로 접근해보세요.", "warning");
    }

    // 야수의 심장
    if (d.myOutlook >= 4 && d.vix > 40) {
        add("🦁 [Lion's Heart] 남들이 공포에 떨 때 매수를 외치는 당신, 진정한 역발상 투자자입니다.", "success");
    }

    // 결과 정렬 (위험 -> 경고 -> 성공 -> 정보 순)
    const priority = { "danger": 0, "warning": 1, "success": 2, "info": 3, "dark": 4, "secondary": 5, "light": 6 };
    ins.sort((a, b) => priority[a.type] - priority[b.type]);

    if (ins.length === 0) add("✅ 특이 신호 없음. 현재 시장은 정석적인 흐름을 보이고 있습니다.", "light");

    // 페르소나 및 리스크 스코어 계산 후 리턴
    return {
        insights: ins,
        ...calculatePersona(d)
    };
}

// ---------------------------------------------------------
// Helper: Persona & Risk Calculation
// ---------------------------------------------------------
function calculatePersona(d) {
    // 1. Risk Score 계산 (0~100)
    let risk = 50; 
    if (d.vix > 20) risk += 10;
    if (d.vix > 30) risk += 10;
    if (d.idx_spx < -1.0) risk += 10;
    if (d.idx_spx < -2.5) risk += 10;
    if (d.dxy > 105) risk += 10;
    if (d.us10y > 4.5) risk += 10;
    if (d.us2y > d.us10y) risk += 10; // 역전
    
    // 호재가 있으면 리스크 감소
    if (d.idx_spx > 1.0 && d.vix < 20) risk -= 10;
    if (d.us10y < 3.8) risk -= 10;

    risk = Math.max(0, Math.min(risk, 100)); // 0~100 클램핑

    // 2. Persona Logic (8 Types)
    let pIcon = "⚖️", pTitle = "균형의 수호자", aiMsg = "적절한 현금 비중과 중립적인 시각을 유지하고 계십니다.";

    if (d.myPosition > 80) {
        if (d.myOutlook >= 4) {
            pIcon = "🔥"; pTitle = "불타는 야생마";
            aiMsg = "확신에 찬 풀매수! 상승장엔 최고의 수익을 내지만, 하락 전환 시 브레이크가 필요합니다.";
        } else if (risk > 70) {
            pIcon = "🚀"; pTitle = "무지성 탑승객";
            aiMsg = "시장이 매우 위험한데 풀매수 중입니다. 용기가 아니라 만용일 수 있습니다. 비중 축소를 고려하세요.";
        } else if (d.myOutlook <= 2) {
            pIcon = "💎"; pTitle = "강철의 존버러";
            aiMsg = "하락을 예상하면서도 매도하지 못하고 있습니다. '비자발적 장기투자' 상태인지 냉정히 판단하세요.";
        }
    } else if (d.myPosition < 20) {
        if (d.myOutlook <= 2) {
            if (risk > 60) {
                pIcon = "🧊"; pTitle = "냉철한 스나이퍼";
                aiMsg = "폭락을 예견하고 현금을 확보한 당신. 시장이 패닉(VIX 40↑)에 빠질 때가 당신의 사냥 시간입니다.";
            } else {
                pIcon = "🦌"; pTitle = "겁 많은 사슴";
                aiMsg = "시장은 안정적인데 너무 움츠러들어 있습니다. 우량주 위주로 정찰병을 보내보는 건 어떨까요?";
            }
        } else if (d.myOutlook >= 4) {
            pIcon = "🐇"; pTitle = "간 보는 토끼";
            aiMsg = "오를 것 같다고 생각하면서도 구경만 하고 계시네요. 조정이 올 때마다 분할 매수로 진입하세요.";
        }
    } else {
        // 중간 포지션 (20~80%)
        if (risk > 70 && d.myOutlook >= 4) {
            pIcon = "🦁"; pTitle = "용기 있는 역발상";
            aiMsg = "남들이 공포에 떨 때 기회를 보고 계십니다. 당신의 판단이 맞다면 큰 부를 얻을 것입니다.";
        }
    }

    return {
        riskScore: risk,
        personaIcon: pIcon,
        personaTitle: pTitle,
        aiMessage: aiMsg
    };
}