// YouTube 영상 페이지인지 확인
function isVideoPage() {
    return window.location.pathname === '/watch';
}

// 서버를 통한 자막 추출
async function extractSubtitlesViaServer() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    console.log('자막 추출 시작, 비디오 ID:', videoId);

    try {
        // background script를 통해 요청
        const response = await chrome.runtime.sendMessage({
            action: 'fetchSubtitles',
            videoId: videoId
        });

        console.log('Background script 응답:', response);

        if (response && response.success) {
            console.log('자막 추출 성공! 길이:', response.text.length);
            return response.text;
        } else {
            console.error('자막 추출 실패:', response?.error || '알 수 없는 오류');
            return null;
        }
    } catch (error) {
        console.error('메시지 전송 오류:', error);
        return null;
    }
}

async function testDirectFetch() {
    try {
        console.log('직접 fetch 테스트 시작');
        const response = await fetch('https://pleasing-tahr-randomly.ngrok-free.app/health',{
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        // Content-Type 헤더를 확인하여 적절한 파싱 방법 선택
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log('직접 fetch 성공 (JSON):', data);
        } else {
            const text = await response.text();
            console.log('직접 fetch 성공 (Text):', text);
        }
    } catch (error) {
        console.error('직접 fetch 실패:', error);
    }
}

// Claude 버튼 생성
function createClaudeButton() {
    const button = document.createElement('button');
    button.id = 'claude-summary-btn';
    button.className = 'yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m';
    button.innerHTML = `
    <div class="yt-spec-button-shape-next__button-text-content">
      <span class="yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap" role="text">
       요약
      </span>
    </div>
  `;

    button.style.cssText = `
    margin-left: 8px;
    background-color: #7C3AED !important;
    color: white !important;
  `;

    button.addEventListener('click', handleButtonClick);

    return button;
}

// 버튼 클릭 처리
async function handleButtonClick() {
    // testDirectFetch 제거 - 매번 불필요한 health check 제거
    // await testDirectFetch();

    console.log('버튼 클릭됨');
    const button = document.getElementById('claude-summary-btn');
    const originalHTML = button.innerHTML;

    button.innerHTML = `
    <div class="yt-spec-button-shape-next__button-text-content">
      <span class="yt-core-attributed-string">⏳ 자막 추출 중...</span>
    </div>
  `;
    button.disabled = true;

    try {
        // 영상 정보 수집
        const videoTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() ||
            document.querySelector('#above-the-fold #title h1')?.textContent?.trim() || '';
        const videoUrl = window.location.href;

        console.log('영상 제목:', videoTitle);
        console.log('영상 URL:', videoUrl);

        // 서버를 통해 자막 추출
        const subtitles = await extractSubtitlesViaServer();
        console.log(subtitles);

        if (subtitles) {
            const prompt = `다음 YouTube 영상의 자막을 한국어로 요약해주세요.\n
            다음 형식으로 요약해주세요:\n
            1. 핵심 주제 (1-2문장)\n
            2. 주요 내용 정리 (포인트가 너무 적어서는 안돼. 10분에 최소 1개 이상)\n
            3. 결론 또는 시사점            \n
            
            제목: ${videoTitle}\n
            URL: ${videoUrl}\n
            
            자막 내용:\n
            ${subtitles}            
            `;

            chrome.runtime.sendMessage({
                action: 'openClaudeAndPaste',
                text: prompt
            });

            button.innerHTML = `
        <div class="yt-spec-button-shape-next__button-text-content">
          <span class="yt-core-attributed-string">✅ Claude 열기 중...</span>
        </div>
      `;
        } else {
            button.innerHTML = `
        <div class="yt-spec-button-shape-next__button-text-content">
          <span class="yt-core-attributed-string">⚠️ 자막 없음</span>
        </div>
      `;
        }
    } catch (error) {
        console.error('오류 발생:', error);
        button.innerHTML = `
      <div class="yt-spec-button-shape-next__button-text-content">
        <span class="yt-core-attributed-string">❌ 오류 발생</span>
      </div>
    `;
    }

    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
    }, 2000);
}

// 버튼을 YouTube 페이지에 삽입
function insertButton() {
    // wrapper 내부의 버튼도 체크
    if (document.getElementById('claude-summary-btn') ||
        document.querySelector('#claude-summary-btn')) {
        return; // 이미 버튼이 있으면 중단
    }

    // offer-module을 우선적으로 찾고, 없으면 기존 위치에 삽입
    const selectors = [
        '#offer-module',
        '.offer-module',
        'ytd-offer-module',
        '#top-level-buttons-computed',
        '#menu-container #flexible-item-buttons',
        'ytd-watch-metadata #actions #top-level-buttons-computed',
        '#top-level-buttons-computed',
        '#menu-container #top-level-buttons',
        '.ytd-watch-metadata #actions',
        'ytd-menu-renderer #top-level-buttons-computed'
    ];

    let container = null;
    for (const selector of selectors) {
        container = document.querySelector(selector);
        if (container) {
            console.log('버튼 컨테이너 찾음:', selector);
            break;
        }
    }

    if (container) {
        const button = createClaudeButton();
        // 버튼을 컨테이너 맨 앞에 추가
        if (container.firstChild) {
            container.insertBefore(button, container.firstChild);
            console.log('Claude 버튼이 맨 앞에 추가됨');
        } else {
            container.appendChild(button);
            console.log('Claude 버튼이 컨테이너에 추가됨');
        }
        return true; // 성공적으로 삽입됨
    } else {
        console.log('버튼 컨테이너를 찾을 수 없음');
        return false; // 삽입 실패
    }
}

// MutationObserver를 사용한 DOM 변경 감지
let observer = null;
let insertAttempts = 0;
const MAX_ATTEMPTS = 20;

function startObserving() {
    // 기존 observer가 있으면 제거
    if (observer) {
        observer.disconnect();
    }
    
    // 버튼이 없으면 즉시 시도
    if (!document.getElementById('claude-summary-btn')) {
        insertButton();
    }
    
    // MutationObserver 설정
    observer = new MutationObserver((mutations) => {
        // 버튼이 제거되었는지 확인
        if (!document.getElementById('claude-summary-btn')) {
            console.log('버튼이 사라짐, 재삽입 시도');
            insertButton();
        }
        
        // 컨테이너가 나타났는지 확인
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                for (const node of addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 버튼 컨테이너가 추가되었는지 확인
                        if (node.matches && (
                            node.matches('#top-level-buttons-computed') ||
                            node.matches('#menu-container') ||
                            node.matches('ytd-watch-metadata')
                        )) {
                            console.log('버튼 컨테이너 감지됨');
                            setTimeout(() => insertButton(), 100);
                        }
                    }
                }
            }
        }
    });
    
    // 전체 문서를 관찰
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 초기화
function init() {
    if (!isVideoPage()) {
        // 비디오 페이지가 아니면 observer 정리
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        return;
    }
    
    console.log('YouTube 비디오 페이지 감지됨');
    insertAttempts = 0;
    
    // 버튼 삽입 시도 (재귀적으로)
    const tryInsert = () => {
        if (insertAttempts >= MAX_ATTEMPTS) {
            console.log('버튼 삽입 최대 시도 횟수 초과');
            return;
        }
        
        insertAttempts++;
        
        if (!document.getElementById('claude-summary-btn')) {
            const success = insertButton();
            if (!success && insertAttempts < MAX_ATTEMPTS) {
                // 실패하면 점진적으로 대기 시간 증가
                const delay = Math.min(500 * insertAttempts, 3000);
                console.log(`버튼 삽입 재시도 예정 (${delay}ms 후)`);
                setTimeout(tryInsert, delay);
            }
        }
    };
    
    // 초기 삽입 시도
    setTimeout(tryInsert, 500);
    
    // DOM 변경 감지 시작
    setTimeout(() => startObserving(), 1000);
}

// URL 변경 감지 (YouTube SPA 네비게이션)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL 변경 감지:', url);
        if (isVideoPage()) {
            // 기존 버튼 제거 (깨끗한 상태로 시작)
            const existingBtn = document.getElementById('claude-summary-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            init();
        }
    }
}).observe(document, {subtree: true, childList: true});

// 페이지 로드 시 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// YouTube의 네비게이션 완료 이벤트 감지 (추가 안전장치)
window.addEventListener('yt-navigate-finish', () => {
    console.log('YouTube 네비게이션 완료 이벤트');
    if (isVideoPage()) {
        init();
    }
});

console.log('YouTube to Claude 확장 프로그램 로드됨');