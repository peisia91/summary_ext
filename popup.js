// popup.js
async function summarizeVideo(transcript) {
    // Option 1: 클라이언트 사이드 요약 (간단한 알고리즘)
    const summary = extractKeyPoints(transcript);

    // Option 2: AI API 호출 (OpenAI, Claude API 등)
    const response = await fetch('your-api-endpoint', {
        method: 'POST',
        body: JSON.stringify({ text: transcript })
    });

    return response.json();
}