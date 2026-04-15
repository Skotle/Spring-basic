// request.js - 로그인 API 요청 로직

/**
 * 로그인 API를 호출합니다.
 * @param {string} userID
 * @param {string} password
 * @returns {Promise<Object>} API 응답 데이터
 */

export async function loginRequest(userID, password) {
  const response = await apiFetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userID: userID.trim(),
      password: password
    })
  });

  return response;
}