import {
  createEmailAccount,
  resendVerification,
  signInWithEmail,
  signInWithGoogle,
  waitForAuthState
} from "./auth.js";

const form = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const createAccountBtn = document.getElementById("createAccountBtn");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const resendVerificationBtn = document.getElementById("resendVerificationBtn");
const errorEl = document.getElementById("loginError");
const userIdInput = document.getElementById("userId");
const passwordInput = document.getElementById("password");

async function init() {
  const user = await waitForAuthState();
  if (user?.emailVerified) {
    window.location.replace("index.html");
    return;
  }
  if (user) {
    resendVerificationBtn.classList.remove("is-hidden");
    showMessage("Verify your email before opening the planner.", false);
  }
  form.addEventListener("submit", signIn);
  createAccountBtn.addEventListener("click", createAccount);
  googleSignInBtn.addEventListener("click", googleSignIn);
  resendVerificationBtn.addEventListener("click", resend);
}

function credentials() {
  return { email: userIdInput.value.trim(), password: passwordInput.value };
}

function validate() {
  const { email, password } = credentials();
  if (!email || !password) {
    showMessage("Enter an email address and password.");
    return null;
  }
  return { email, password };
}

async function signIn(event) {
  event.preventDefault();
  const values = validate();
  if (!values) return;
  setLoading(true, "Signing in...");
  try {
    await signInWithEmail(values.email, values.password);
    window.location.replace("index.html");
  } catch (error) {
    showMessage(friendlyAuthError(error));
  } finally {
    setLoading(false);
  }
}

async function createAccount() {
  const values = validate();
  if (!values) return;
  setLoading(true, "Creating account...");
  try {
    await createEmailAccount(values.email, values.password);
    resendVerificationBtn.classList.remove("is-hidden");
    showMessage("Account created. Verify your email, then sign in to request planner access.", false);
  } catch (error) {
    showMessage(friendlyAuthError(error));
  } finally {
    setLoading(false);
  }
}

async function googleSignIn() {
  setLoading(true, "Opening Google...");
  try {
    await signInWithGoogle();
    window.location.replace("index.html");
  } catch (error) {
    showMessage(friendlyAuthError(error));
  } finally {
    setLoading(false);
  }
}

async function resend() {
  try {
    await resendVerification();
    showMessage("Verification email sent. Check your inbox before signing in.", false);
  } catch (error) {
    showMessage(friendlyAuthError(error));
  }
}

function setLoading(isLoading, label = "Sign In") {
  [loginBtn, createAccountBtn, googleSignInBtn].forEach((button) => {
    button.disabled = isLoading;
  });
  loginBtn.textContent = isLoading ? label : "Sign In";
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email or password.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email. Sign in instead.";
  if (code.includes("weak-password")) return "Use a stronger password with at least 8 characters.";
  if (code.includes("popup-closed")) return "Google sign-in was cancelled.";
  return "We could not complete that request. Please try again.";
}

function showMessage(message, isError = true) {
  errorEl.textContent = message;
  errorEl.classList.toggle("is-success", !isError);
}

init();
