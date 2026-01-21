import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import yfinance as yf
import requests  # CoinGecko API 호출용
from datetime import datetime
import os
import json

# 1. Firebase 초기화
cred_json = os.environ.get('FIREBASE_CREDENTIALS')
if cred_json:
    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
else:
    # 로컬 테스트용 (필요시 경로 수정)
    # cred = credentials.Certificate("serviceAccountKey.json")
    # firebase_admin.initialize_app(cred)
    print("Warning: FIREBASE_CREDENTIALS 환경변수가 없습니다. (로컬 테스트가 아니라면 에러)")
    # 실제 배포 시엔 exit(1) 처리 필요

db = firestore.client()

# 2. 수집할 데이터 티커 매핑 (Yahoo Finance)
tickers = {
    'us10y': '^TNX',       # 미 10년물 금리
    'vix': '^VIX',         # VIX 공포지수
    'dxy': 'DX-Y.NYB',     # 달러 인덱스
    'btc': 'BTC-USD',      # 비트코인
    'gold': 'GC=F',        # 금 선물
    'wti': 'CL=F',         # WTI 유가 선물
    'idx_spx': '^GSPC',    # S&P 500
    'idx_ndx': '^NDX',     # 나스닥 100
    'idx_dji': '^DJI',     # 다우 존스
    'idx_rut': '^RUT',     # 러셀 2000
    'idx_kospi': '^KS11',  # 코스피
    'idx_kosdaq': '^KQ11', # 코스닥
    'idx_nikkei': '^N225', # 닛케이 225
    'idx_euro': '^STOXX50E' # 유로 스톡스 50
}

def get_market_data():
    data = {}
    
    # ---------------------------------------------------------
    # A. Yahoo Finance 데이터 수집
    # ---------------------------------------------------------
    print("Fetching Yahoo Finance Data...")
    for key, ticker in tickers.items():
        try:
            ticker_obj = yf.Ticker(ticker)
            hist = ticker_obj.history(period="5d") 
            
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                # 어제 종가 (등락률 계산용, 데이터 부족 시 현재가로 대체)
                prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
                
                # 지수(idx_)는 등락률(%), 나머지는 현재가 저장
                if key.startswith('idx_'):
                    change_pct = ((current_price - prev_close) / prev_close) * 100
                    data[key] = round(change_pct, 2)
                else:
                    data[key] = round(current_price, 2)
            else:
                print(f"No data found for {key}")
                data[key] = 0.0
                
        except Exception as e:
            print(f"Error fetching {key}: {e}")
            data[key] = 0.0

    # ---------------------------------------------------------
    # B. 특수 데이터 처리
    # ---------------------------------------------------------
    
    # 1. 미 2년물 금리 (요청하신 대로 0.0 고정)
    data['us2y'] = 0.0

    # 2. 비트코인 도미넌스 (CoinGecko 무료 API 활용)
    print("Fetching CoinGecko Data...")
    try:
        url = "https://api.coingecko.com/api/v3/global"
        # 헤더가 없으면 가끔 차단될 수 있어 User-Agent 추가 권장
        headers = {'User-Agent': 'Mozilla/5.0'} 
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            global_data = response.json()
            # 데이터 구조: data -> market_cap_percentage -> btc
            btc_dom = global_data.get('data', {}).get('market_cap_percentage', {}).get('btc', 0.0)
            data['btcDom'] = round(btc_dom, 2)
            print(f"  > BTC Dominance: {data['btcDom']}%")
        else:
            print(f"CoinGecko API Error: {response.status_code}")
            data['btcDom'] = 0.0
            
    except Exception as e:
        print(f"Error fetching BTC Dominance: {e}")
        data['btcDom'] = 0.0

    return data

# 3. DB 저장
def save_to_firestore(data):
    doc_data = {
        'type': 'bot',
        'timestamp': firestore.SERVER_TIMESTAMP,
        'pos': None,     # 봇은 포지션 없음
        'outlook': None, # 봇은 전망 없음
        **data
    }
    
    # 'market_sentiment' 컬렉션에 추가
    db.collection('market_sentiment').add(doc_data)
    print(f"✅ Bot Data Saved Successfully: {datetime.now()}")

if __name__ == "__main__":
    try:
        market_data = get_market_data()
        print("Collected Data:", market_data)
        save_to_firestore(market_data)
    except Exception as e:
        print(f"Fatal Error: {e}")
        exit(1)