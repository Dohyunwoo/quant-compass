// 1. 설정값 (JSON 객체로 정의)
const tickerConfig = {
    "symbols": [
        // 1. 미 증시 대표 지수
        {"proName": "FOREXCOM:SPXUSD", "title": "S&P 500"},
        {"proName": "FOREXCOM:NSXUSD", "title": "Nasdaq 100"},
        
        // 3. 환율
        {"proName": "FX_IDC:USDKRW", "title": "USD/KRW"},
        
        // 4. 원자재 (인플레이션/안전자산)
        {"proName": "TVC:GOLD", "title": "Gold"},
        {"proName": "TVC:USOIL", "title": "WTI Oil"},
        
        // 5. 코인 (비트 & 이더)
        {"proName": "BINANCE:BTCUSDT", "title": "Bitcoin"},
        {"proName": "BINANCE:ETHUSDT", "title": "Ethereum"},
        
        // 6. 시장 주도주 (관심도 최상위 종목)
        {"proName": "NASDAQ:NVDA", "title": "NVIDIA"},
        {"proName": "NASDAQ:TSLA", "title": "Tesla"}
    ],
    "showSymbolLogo": true,
    "colorTheme": "dark",
    "isTransparent": false,
    "displayMode": "adaptive",
    "locale": "kr"
};

// 2. 스크립트 태그 동적 생성 및 주입 함수
function loadTickerWidget() {
    const container = document.getElementById('tradingview-ticker-target');
    
    if (container) {
        // 기존에 생성된 위젯이 있다면 중복 방지를 위해 비움 (선택사항)
        container.innerHTML = ''; 

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.async = true;
        
        // 설정 객체를 문자열로 변환하여 스크립트 내부에 삽입
        script.innerHTML = JSON.stringify(tickerConfig);
        
        container.appendChild(script);
    }
}

// 3. 실행
loadTickerWidget();