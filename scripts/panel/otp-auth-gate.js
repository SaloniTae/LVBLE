/**
 * Authentication gate shim
 *
 * OTP access is intentionally bypassed for this build: initializing the gate
 * immediately creates a long-lived local session and shows the dashboard.
 */
class OTPAuthGate {
  constructor() {
    this.isAuthenticated = false;
    this.otpSystem = null;
  }

  /**
   * Initialize authentication gate as already authenticated.
   */
  async init(otpSystem = null) {
    this.otpSystem = otpSystem;
    this.authenticate();
    console.log('✅ Authentication gate bypassed; dashboard unlocked');
    return true;
  }

  /**
   * Mark the user authenticated and show the dashboard.
   */
  authenticate() {
    this.isAuthenticated = true;
    this.storeSession();
    this.hideGate();
  }

  /**
   * Keep a long-lived session so reloads continue to open the dashboard.
   */
  storeSession() {
    const session = {
      sessionId: 'always_active_session',
      createdAt: new Date().toISOString(),
      expiresAt: new Date('2099-12-31T23:59:59.999Z').toISOString(),
      bypassed: true,
    };

    sessionStorage.setItem('otp_session', JSON.stringify(session));
    localStorage.setItem('otp_session', JSON.stringify(session));
    localStorage.setItem('last_otp_verified', new Date().toISOString());
    localStorage.removeItem('otp_failed_attempts');
    localStorage.removeItem('otp_lockout_time');
  }

  /**
   * Always report the current session as valid.
   */
  async checkAuthentication() {
    this.authenticate();
    return true;
  }

  getSession() {
    const storedSession = sessionStorage.getItem('otp_session') || localStorage.getItem('otp_session');
    return storedSession ? JSON.parse(storedSession) : null;
  }

  isSessionValid() {
    return true;
  }

  /**
   * Hide any OTP gate markup and reveal the main dashboard.
   */
  hideGate() {
    const gate = document.getElementById('otp-auth-gate');
    const mainUI = document.getElementById('main-ui');
    const body = document.getElementById('sp-body');

    if (gate) {
      gate.classList.add('hidden', 'otp-auth-hidden');
      gate.style.display = 'none';
    }

    if (mainUI) {
      mainUI.classList.add('visible');
      mainUI.style.display = 'flex';
    }

    if (body) {
      body.style.display = 'flex';
    }
  }

  showGate() {
    this.hideGate();
  }

  setupEventListeners() {}
  showMessage() {}
  showError() {}
  isLockedOut() { return false; }
  setLockout() {}
  showLockoutMessage() {}
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OTPAuthGate;
}

window.OTPAuthGate = OTPAuthGate;

console.log('✅ OTP Auth Gate bypass loaded');
