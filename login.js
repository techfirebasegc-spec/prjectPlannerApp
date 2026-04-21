(() => {
  "use strict";

  const form = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const errorEl = document.getElementById("loginError");
  const userIdInput = document.getElementById("userId");
  const passwordInput = document.getElementById("password");

  function init() {
    if (window.AuthGate && window.AuthGate.isAuthenticated()) {
      window.location.replace("index.html");
      return;
    }

    form.addEventListener("submit", onSubmit);
  }

  async function onSubmit(event) {
    event.preventDefault();
    clearError();

    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    if (!userId || !password) {
      showError("Enter login ID and password.");
      return;
    }

    setLoading(true);
    try {
      const ok = await window.AuthGate.verifyCredentials(userId, password);
      if (!ok) {
        showError("Invalid login credentials.");
        return;
      }

      window.AuthGate.setSession(userId);
      window.location.replace("index.html");
    } catch (error) {
      showError("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Signing in..." : "Sign In";
  }

  function showError(message) {
    errorEl.textContent = message;
  }

  function clearError() {
    errorEl.textContent = "";
  }

  init();
})();
