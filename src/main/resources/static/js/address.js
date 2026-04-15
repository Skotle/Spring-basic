async function sendIpToServer() {
    try {
        // 1. 외부 API를 이용해 클라이언트의 공인 IP 가져오기
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const clientIp = ipData.ip;

        // 2. 우리 서버의 API로 IP 전송하기
        // common.js에 있는 apiFetch를 사용하거나 기본 fetch를 사용합니다.
        const response = await fetch('/api/log-ip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: clientIp,
                userAgent: navigator.userAgent, // 브라우저 정보도 함께 보내면 유용합니다.
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