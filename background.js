// Service Worker 생명주기 관리
let isServiceWorkerReady = true;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background: 메시지 받음', request);

    if (!isServiceWorkerReady) {
        sendResponse({
            success: false,
            error: 'Service Worker not ready'
        });
        return;
    }

    if (request.action === 'fetchSubtitles') {
        console.log('Background: 자막 요청 시작', request.videoId);
        
        handleFetchSubtitles(request.videoId)
            .then(data => sendResponse(data))
            .catch(error => {
                console.error('Fetch 오류:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        return true; // 비동기 응답을 위해 true 반환
    }

    if (request.action === 'openClaudeAndPaste') {
        handleOpenClaudeAndPaste(request.text);
        sendResponse({ success: true });
    }
    
    if (request.action === 'ping') {
        sendResponse({ success: true, ready: isServiceWorkerReady });
    }
});

// 자막 가져오기 처리
async function handleFetchSubtitles(videoId) {
    const url = `https://pleasing-tahr-randomly.ngrok-free.app/transcript/${videoId}`;
    console.log('Background: 요청 URL', url);

    try {
        const response = await fetch(url, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });

        const data = await response.json();
        console.log('자막 데이터:', data);
        return data;
    } catch (error) {
        console.error('Fetch 오류:', error);
        throw error;
    }
}

// Claude 열기 처리
async function handleOpenClaudeAndPaste(text) {
    try {
        // 1. Claude.ai 새 탭 열기
        const tab = await chrome.tabs.create({
            //url: 'https://claude.ai/new',
            url: 'https://claude.ai/project/0197bae1-b732-7430-ae41-6efbfa93a8ce',
            active: true
        });

        // 2. 페이지 완전 로드 대기
        await waitForTabLoad(tab.id);

        // 3. 추가 대기 (Claude UI 로드)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 4. 텍스트 입력 스크립트 실행
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillClaudeInput,
            args: [text]
        });

        console.log('Claude.ai에 텍스트 입력 시도 완료');
    } catch (error) {
        console.error('Claude 열기 오류:', error);
    }
}

// Service Worker 상태 관리
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    isServiceWorkerReady = true;
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup');
    isServiceWorkerReady = true;
});

// 주기적으로 Service Worker 활성 상태 유지 (선택사항)
setInterval(() => {
    console.log('Service Worker heartbeat');
}, 25000); // 25초마다

// 탭 로드 대기
function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(id, info, tab) {
            if (id === tabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve(tab);
            }
        });
    });
}

// Claude 입력창에 텍스트 입력
function fillClaudeInput(text) {
    let attempts = 0;
    const maxAttempts = 20;

    const tryFill = () => {
        const selectors = [
            'div[contenteditable="true"][tabindex="0"]',
            '[tabindex="0"][contenteditable="true"]',
            'div[contenteditable="true"]',
            'div.ProseMirror[contenteditable="true"]',
            '.ProseMirror[tabindex="0"]',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('입력창 찾음:', selector);
                element.focus();
                element.click();

                // ProseMirror 에디터 처리
                if (element.classList.contains('ProseMirror') || element.contentEditable === 'true') {
                    // 먼저 기존 내용 지우기
                    element.innerHTML = '';
                    
                    // 텍스트를 단락으로 나누어 입력
                    const paragraphs = text.split('\n');
                    paragraphs.forEach((para, index) => {
                        const p = document.createElement('p');
                        p.textContent = para || '\u200B'; // 빈 줄 처리
                        element.appendChild(p);
                    });

                    // 다양한 이벤트 발생시켜 Claude가 인식하도록 함
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text
                    }));
                    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                    
                    // 포커스 이벤트
                    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    
                } else if (element.tagName === 'TEXTAREA') {
                    element.value = text;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }

                console.log('텍스트 입력 성공!');
                
                // 전송 버튼 클릭
                setTimeout(() => {
                    const sendButton = document.querySelector('button[aria-label="Send message"]');
                    if (sendButton) {
                        sendButton.click();
                        console.log('전송 버튼 클릭 완료!');
                    } else {
                        // 다른 선택자로 시도
                        const buttons = document.querySelectorAll('button[type="button"]');
                        for (const btn of buttons) {
                            // SVG path를 포함한 버튼 찾기
                            if (btn.innerHTML.includes('M208.49,120.49')) {
                                btn.click();
                                console.log('전송 버튼 클릭 완료! (SVG로 찾음)');
                                break;
                            }
                        }
                    }
                }, 500); // 입력 후 잠시 대기
                
                return true;
            }
        }

        attempts++;
        if (attempts < maxAttempts) {
            console.log(`입력창 찾기 시도 중... (${attempts}/${maxAttempts})`);
            setTimeout(tryFill, 500);
        } else {
            console.error('입력창을 찾을 수 없습니다.');
            // 클립보드에 복사 시도
            navigator.clipboard.writeText(text).then(() => {
                console.log('텍스트를 클립보드에 복사했습니다. Ctrl+V로 붙여넣으세요.');
                alert('텍스트가 클립보드에 복사되었습니다.\nClaude 입력창에서 Ctrl+V (Mac: Cmd+V)로 붙여넣으세요.');
            });
        }
    };

    setTimeout(tryFill, 1000);
}