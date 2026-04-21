(() => {
  "use strict";

  const SESSION_KEY = "cliniqPlanner.auth.session.v1";
  const AUTH_SALT = "cliniq-static-salt-v1";
  const EXPECTED_USER_HASH = "a3220c5b0caed1529f1e1b5e73109d61c3930e95ebf9b5ae4c4d90cf8aba7d26";
  const EXPECTED_PASS_HASH = "9dd7075a0f14663cbfd31acc345ed978189359619f9a4bbb04ace5b2d2e88fb7";

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function verifyCredentials(userId, password) {
    const normalizedUser = String(userId || "").trim();
    const normalizedPass = String(password || "");

    const [userHash, passHash] = await Promise.all([
      sha256Hex(`${AUTH_SALT}|${normalizedUser}`),
      sha256Hex(`${AUTH_SALT}|${normalizedPass}`)
    ]);

    return userHash === EXPECTED_USER_HASH && passHash === EXPECTED_PASS_HASH;
  }

  function setSession(userId) {
    const payload = {
      userId: String(userId || "").trim(),
      at: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isAuthenticated() {
    const session = getSession();
    return Boolean(session && session.userId);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  window.AuthGate = {
    verifyCredentials,
    setSession,
    getSession,
    isAuthenticated,
    clearSession
  };
})();
