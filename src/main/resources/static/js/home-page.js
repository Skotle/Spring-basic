async function initHomePage() {
  await loadRecommendedPosts();
  const loginState = await fetchLoginState();
  renderState(loginState);
}
