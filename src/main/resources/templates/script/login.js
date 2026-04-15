async function login() {
  const userID = document.getElementById("userID").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userID, password }),
      credentials: "include" // ✅ 쿠키 포함
    });

    const data = await response.json();

    if (response.ok) {
      // 스토리지에 토큰 저장 제거
      message.style.color = "green";
      message.textContent = "로그인 성공!";
      window.location.href = "/";
    } else {
      message.style.color = "red";
      message.textContent = data.message;
    }
  } catch (err) {
    message.style.color = "red";
    message.textContent = "서버와 연결할 수 없습니다.";
  }
}