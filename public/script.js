import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { generateInsights } from "./logic.js"; 

// 1. FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "quant-compass.firebaseapp.com",
  projectId: "quant-compass",
  storageBucket: "quant-compass.firebasestorage.app",
  messagingSenderId: "314501935087",
  appId: "1:314501935087:web:3d37288536671ca2c0d01a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. MAIN LOGIC
const formIds = ['us10y', 'us2y', 'vix', 'dxy', 'btc', 'btcDom', 'gold', 'wti', 
                 'idx_spx', 'idx_ndx', 'idx_dji', 'idx_rut',
                 'idx_kospi', 'idx_kosdaq', 'idx_nikkei', 'idx_euro',
                 'myPosition', 'myOutlook'];

let myPersonaType = "";

// Load Data
window.addEventListener('load', async () => {
    // 1. 로컬 스토리지 데이터 먼저 로드
    formIds.forEach(id => {
        const val = localStorage.getItem(id);
        // [수정] us2y가 0이면 로드하지 않음 (Placeholder 유지를 위해)
        if (id === 'us2y' && (val === '0' || val === 0)) return;
        
        if(val) document.getElementById(id).value = val;
    });

    // 2. 봇이 수집한 최신 시장 데이터 가져오기
    console.log("🤖 봇 데이터 조회 시작...");
    try {
        const q = query(
            collection(db, "market_sentiment"), 
            where("type", "==", "bot"), 
            orderBy("timestamp", "desc"), 
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const botData = snapshot.docs[0].data();
            console.log("✅ 봇 데이터 로드 성공:", botData);

            let updatedCount = 0;
            formIds.forEach(id => {
                // [수정] us2y는 봇 데이터가 0일 경우 입력하지 않고 패스 (Placeholder 보이게)
                if (id === 'us2y' && botData[id] === 0) return;

                if (botData[id] !== undefined && botData[id] !== null) {
                    document.getElementById(id).value = botData[id];
                    localStorage.setItem(id, botData[id]);
                    updatedCount++;
                }
            });
            console.log(`ℹ️ ${updatedCount}개의 필드가 최신 데이터로 업데이트되었습니다.`);
        } else {
            console.warn("⚠️ 봇 데이터가 없습니다.");
        }
    } catch (e) {
        console.error("❌ 봇 데이터 로드 실패:", e);
    }

    loadNews();
    await fetchCrowdAndDrawChart();
});

document.getElementById('quantForm').addEventListener('input', (e) => {
    if(e.target.id) localStorage.setItem(e.target.id, e.target.value);
});

function checkDailyLimit() {
    const today = new Date().toDateString();
    let record = JSON.parse(localStorage.getItem('daily_submit_log'));

    if (!record || record.date !== today) {
        record = { date: today, count: 0 };
        localStorage.setItem('daily_submit_log', JSON.stringify(record));
    }
    return record;
}

// Main Execution
window.runAnalysisAndSubmit = async function() {
    const btn = document.querySelector('button[onclick="runAnalysisAndSubmit()"]');
    const originalText = btn.innerText;

    // 1. 일일 제한 체크
    const usage = checkDailyLimit();
    if (usage.count >= 5) {
        alert("⛔ 하루 5회 입력 한도를 초과했습니다.\n\n불필요한 DB 비용을 막기 위해 횟수를 제한하고 있습니다.\n내일 다시 참여해 주세요!");
        return; 
    }

    // 2. 유효성 검사 (Validation) - 여기서 빈 값을 1차로 막아줍니다.
    let missing = [];
    const fieldLabels = {
        'us10y': '미 10년물 금리', 'vix': 'VIX 공포지수', 'dxy': '달러 인덱스', 'btc': '비트코인 가격',
        'btcDom': 'BTC 도미넌스', 'gold': '금 선물', 'wti': 'WTI 유가',
        'idx_spx': 'S&P 500', 'idx_ndx': '나스닥', 'idx_dji': '다우존스', 'idx_rut': '러셀 2000',
        'idx_kospi': '코스피', 'idx_kosdaq': '코스닥', 'idx_nikkei': '닛케이', 'idx_euro': '유로스톡스'
    };

    formIds.forEach(id => {
        // [검사 제외] us2y는 비워도 되므로 검사하지 않음
        if (id === 'us2y' || id === 'myPosition' || id === 'myOutlook') return;

        const val = document.getElementById(id).value;
        if (!val || val.trim() === "") {
            missing.push(fieldLabels[id] || id);
        }
    });

    if (missing.length > 0) {
        alert(`⚠️ 다음 데이터가 입력되지 않았습니다:\n\n[ ${missing.join(', ')} ]\n\n정확한 분석을 위해 빈칸을 모두 채워주세요.\n(미 2년물은 제외 가능)`);
        return; 
    }
    
    // ---------------------------------------------------------
    btn.innerText = "⏳ 50+ 시나리오 분석 중...";
    btn.disabled = true;
    document.getElementById('reportSection').style.display = 'block';
    document.getElementById('crowdComment').innerText = "군중 데이터를 불러오는 중입니다...";

    try {
        // 3. 데이터 수집 (Data Collection) - [수정된 부분]
        const d = {};
        formIds.forEach(id => {
            const val = document.getElementById(id).value;

            if (id === 'us2y') {
                // [예외 적용] us2y만 비어있으면 0으로 처리
                d[id] = val ? parseFloat(val) : 0.0;
            } else {
                // [나머지] 입력된 값 그대로 변환 (위의 유효성 검사를 통과했으므로 값은 무조건 있음)
                d[id] = parseFloat(val);
            }
        });
        
        d.myPosition = parseInt(document.getElementById('myPosition').value);
        d.myOutlook = parseInt(document.getElementById('myOutlook').value);

        // 4. DB 저장
        await saveUserData(d);

        // 5. 어제 데이터 가져오기 및 등락률 계산
        const yesterdayData = await fetchYesterdayAverage();
        renderChangeTable(d, yesterdayData);

        // 6. 로직 실행 (logic.js)
        const analysisResult = generateInsights(d, yesterdayData);
        
        // 결과 렌더링
        const listEl = document.getElementById('quantList');
        listEl.innerHTML = analysisResult.insights.map(i => 
            `<li class="list-group-item list-group-item-${i.type} d-flex align-items-start">
                <span class="me-2">${getIcon(i.type)}</span>
                <span style="font-size:0.9rem; line-height:1.5;">${i.msg}</span>
            </li>`
        ).join('');
        document.getElementById('insightCount').innerText = analysisResult.insights.length + " Signals";

        // 페르소나 렌더링
        document.getElementById('personaIcon').innerText = analysisResult.personaIcon;
        document.getElementById('personaTitle').innerText = analysisResult.personaTitle;
        document.getElementById('riskScoreDisp').innerText = analysisResult.riskScore + "/100";
        document.getElementById('aiActionText').innerHTML = `<strong>[${analysisResult.personaTitle}]</strong> ${analysisResult.aiMessage}`;
        
        myPersonaType = analysisResult.personaTitle;

        // 차트 그리기
        drawCharts(d, analysisResult.riskScore);

        // 7. 군중 데이터 가져오기
        await fetchCrowdAndDrawChart();

        // 8. 성공 시 카운트 증가
        usage.count++;
        localStorage.setItem('daily_submit_log', JSON.stringify(usage));
        console.log(`✅ 오늘의 입력 횟수: ${usage.count}/5`);

    } catch (error) {
        console.error("Error:", error);
        alert("분석 중 오류 발생: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        document.getElementById('reportSection').scrollIntoView({behavior:'smooth'});
    }
};

// --- Firestore Logic ---

async function saveUserData(data) {
    try {
        await addDoc(collection(db, "market_sentiment"), {
            ...data, 
            type: 'human', 
            timestamp: serverTimestamp()
        });
        console.log("✅ User Data Saved (Type: Human)");
    } catch (e) { 
        console.error("Save Error:", e); 
    }
}

async function fetchYesterdayAverage() {
    try {
        const now = new Date();
        const yesterdayStart = new Date(now);
        yesterdayStart.setDate(now.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0); 
        
        const yesterdayEnd = new Date(now);
        yesterdayEnd.setDate(now.getDate() - 1);
        yesterdayEnd.setHours(23, 59, 59, 999); 

        const q = query(
            collection(db, "market_sentiment"),
            where("timestamp", ">=", Timestamp.fromDate(yesterdayStart)),
            where("timestamp", "<=", Timestamp.fromDate(yesterdayEnd))
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const targets = ['btc', 'gold', 'wti', 'us10y', 'dxy', 'vix']; 
        let sums = {};
        let counts = {};
        targets.forEach(t => { sums[t] = 0; counts[t] = 0; });

        snapshot.forEach(doc => {
            const data = doc.data();
            targets.forEach(t => {
                if (data[t] && data[t] > 0) {
                    sums[t] += data[t];
                    counts[t]++;
                }
            });
        });

        const averages = {};
        targets.forEach(t => {
            averages[t] = counts[t] > 0 ? (sums[t] / counts[t]) : 0;
        });
        return averages;

    } catch (e) { 
        console.error("Yesterday Fetch Error:", e); 
        if(e.message.includes("index")) alert("⚠️ Firebase Index 필요: 콘솔 링크 클릭");
        return null; 
    }
}

function renderChangeTable(current, prev) {
    const tbody = document.getElementById('changeTableBody');
    if (!prev) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted py-3">📉 어제 데이터가 충분하지 않아 등락률을 계산할 수 없습니다.<br>(오늘 데이터가 쌓이면 내일부터 보입니다)</td></tr>`;
        return;
    }

    const items = [
        { label: "🪙 비트코인", key: "btc", unit: "$" },
        { label: "🥇 금(Gold)", key: "gold", unit: "$" },
        { label: "🛢 오일(WTI)", key: "wti", unit: "$" },
        { label: "🇺🇸 국채 10년", key: "us10y", unit: "%" },
        { label: "💵 달러(DXY)", key: "dxy", unit: "" },
        { label: "😨 공포(VIX)", key: "vix", unit: "" }
    ];

    let html = "";
    items.forEach(item => {
        const curVal = current[item.key];
        const prevVal = prev[item.key];
        
        if (curVal && prevVal) {
            const change = ((curVal - prevVal) / prevVal) * 100;
            const colorClass = change > 0 ? "text-up" : (change < 0 ? "text-down" : "");
            const sign = change > 0 ? "+" : "";
            
            html += `
            <tr>
                <td class="fw-bold">${item.label}</td>
                <td>${curVal.toLocaleString()} ${item.unit}</td>
                <td class="text-muted small">${prevVal.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                <td class="${colorClass}">${sign}${change.toFixed(2)}%</td>
            </tr>`;
        }
    });
    tbody.innerHTML = html;
}

// [핵심] 군중 분석 & 도넛 차트
async function fetchCrowdAndDrawChart() {
    try {
        const q = query(collection(db, "market_sentiment"), orderBy("timestamp", "desc"), limit(300));
        const snapshot = await getDocs(q);
        
        let totalPos = 0, bullCount = 0, bearCount = 0;
        const typeCounts = {
            "🔥 야생마": 0, "🚀 탑승객": 0, "💎 존버러": 0, 
            "🧊 스나이퍼": 0, "🦌 사슴": 0, "🐇 토끼": 0, 
            "🦁 역발상": 0, "⚖️ 수호자": 0
        };
        
        let humanCount = 0; 

        snapshot.forEach(doc => {
            const data = doc.data();

            // [수정 포인트 1] 필드명 수정 (pos -> myPosition)
            // 봇이거나, 사람 데이터인데 투자비중(myPosition)이 없으면 건너뜀
            if (data.type === 'bot' || data.myPosition === undefined || data.myPosition === null) {
                return; 
            }

            humanCount++; 

            // [수정 포인트 2] 데이터를 읽어오는 변수명 일치시키기
            const pos = data.myPosition; // data.pos (X) -> data.myPosition (O)
            const out = data.myOutlook || 3; // data.outlook (X) -> data.myOutlook (O)
            
            totalPos += pos;
            if(out >= 4) bullCount++;
            else if(out <= 2) bearCount++;

            // 페르소나 분류 로직
            let type = "⚖️ 수호자"; 
            if(pos > 70 && out >= 4) type = "🔥 야생마";
            else if(pos > 70 && out <= 2) type = "💎 존버러";
            else if(pos > 70) type = "🚀 탑승객";
            else if(pos < 30 && out <= 2) type = "🧊 스나이퍼";
            else if(pos < 30 && out >= 4) type = "🐇 토끼";
            else if(pos < 30) type = "🦌 사슴";
            else if(out >= 4) type = "🦁 역발상";
            
            if(typeCounts[type] !== undefined) typeCounts[type]++;
            else typeCounts["⚖️ 수호자"]++;
        });

        if (humanCount === 0) {
            document.getElementById('crowdComment').innerText = "아직 참여한 투자자가 없습니다.";
            // 차트나 그래프를 0으로 초기화하는 로직이 필요하다면 여기에 추가
            return;
        }

        const avgPos = Math.round(totalPos / humanCount);
        const bullPct = Math.round((bullCount / humanCount) * 100);
        const bearPct = Math.round((bearCount / humanCount) * 100);

        document.getElementById('totalParticipants').innerText = humanCount + "명 (실시간)";
        document.getElementById('avgPosDisplay').innerText = avgPos + "%";
        document.getElementById('bullBar').style.width = bullPct + "%";
        document.getElementById('bullBar').innerText = `Bull ${bullPct}%`;
        document.getElementById('bearBar').style.width = bearPct + "%";
        document.getElementById('bearBar').innerText = `Bear ${bearPct}%`;

        let myCount = 0;
        for (const [key, value] of Object.entries(typeCounts)) {
            if (myPersonaType.includes(key.split(' ')[1])) {
                myCount = value;
                break;
            }
        }
        
        const myTypePct = Math.round((myCount / humanCount) * 100);
        document.getElementById('crowdComment').innerHTML = `
            당신은 <strong>${myPersonaType}</strong> 유형입니다.<br>
            전체 참여자의 <strong>${myTypePct}%</strong>가 당신과 유사한 성향입니다.
        `;

        drawCrowdDoughnut(typeCounts);

    } catch (e) { console.error("Crowd Error:", e); }
}

let crowdChart = null;
function drawCrowdDoughnut(counts) {
    const ctx = document.getElementById('crowdTypeChart').getContext('2d');
    if (crowdChart) crowdChart.destroy();

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const bgColors = labels.map(label => myPersonaType.includes(label.split(' ')[1]) ? '#dc3545' : '#e9ecef');

    crowdChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff6b6b', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf', '#20c997'],
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}명` } }
            },
            cutout: '60%'
        }
    });
}

function getIcon(type) { 
    if(type==='danger') return '🚨'; 
    if(type==='warning') return '⚠️'; 
    if(type==='success') return '💎'; 
    if(type==='info') return '💡'; 
    if(type==='dark') return '📉'; 
    if(type==='secondary') return '🔍'; 
    return '✅'; 
}

function drawCharts(d, riskScore) {
    // [수정 완료] myPosBar 업데이트 코드는 삭제됨 (도넛 차트로 대체되었으므로) -> 에러 해결
    
    const ctx = document.getElementById('radarChart').getContext('2d');
    if(window.myRadar) window.myRadar.destroy();
    
    window.myRadar = new Chart(ctx, {
        type: 'radar',
        data: { 
            labels: ['공포', '달러', '금리', '시장위험', '비관론'], 
            datasets: [{ 
                label: 'Risk Profile', 
                data: [d.vix*3, (d.dxy-90)*5, d.us10y*20, riskScore, (6-d.myOutlook)*20], 
                backgroundColor: 'rgba(13,110,253,0.2)', 
                borderColor: '#0d6efd', 
                pointRadius: 0 
            }] 
        },
        options: { scales: { r: { suggestedMin:0, suggestedMax:100, ticks:{display:false} } } }
    });
    document.getElementById('reportSection').scrollIntoView({behavior:'smooth'});
}

window.loadNews = async function() {
    try {
        const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.investing.com/rss/news_25.rss');
        const data = await res.json();
        const container = document.getElementById('newsContainer');
        if(data.items.length > 0) {
            container.innerHTML = data.items.slice(0, 8).map(item => {
                let imgUrl = item.thumbnail || (item.enclosure ? item.enclosure.link : `https://placehold.co/60x60/eee/999?text=News`);
                return `<a href="${item.link}" target="_blank" class="news-card"><img src="${imgUrl}" class="news-thumb"><div class="news-content"><span class="news-title">${item.title}</span><span class="news-date">${item.pubDate.split(' ')[1]}</span></div></a>`;
            }).join('');
        }
    } catch(e) { /* Ignore */ }
};