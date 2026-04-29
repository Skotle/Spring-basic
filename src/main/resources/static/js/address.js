async function sendIpToServer() {
    try {
        const response = await fetch('/api/log-ip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            })
        });

        const result = await response.json();
        console.log("IP 전송 결과:", result);

    } catch (error) {
        console.error("IP 전송 중 오류 발생:", error);
    }
}

// 페이지 로드 시 실행
window.addEventListener('load', sendIpToServer);
