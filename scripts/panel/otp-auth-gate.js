/**
 * OTP Authentication Gate
 * Full-screen security splash before extension access
 * Works with both Supabase and local storage
 */

class OTPAuthGate {
  constructor() {
    this.isAuthenticated = false;
    this.otpSystem = null;
    this.failedAttempts = 0;
    this.maxAttempts = 5;
    this.lockoutTime = 30 * 60 * 1000; // 30 minutes
    this.currentTab = 'verify';
  }

  /**
   * Initialize authentication gate
   */
  async init(otpSystem) {
    try {
      console.log('🔐 Initializing OTP Authentication Gate...');
      
      this.otpSystem = otpSystem;

      // Wait for OTP system to initialize
      let retries = 0;
      while (!otpSystem.initialized && retries < 10) {
        await this.sleep(200);
        retries++;
      }

      if (!otpSystem.initialized) {
        console.error('❌ OTP system failed to initialize');
        this.showError('Failed to initialize authentication system');
        return;
      }

      console.log('✅ OTP system ready');

      // Check if already authenticated
      const isAuth = await this.checkAuthentication();
      if (isAuth) {
        console.log('✅ User already authenticated');
        this.hideGate();
        return;
      }

      // Setup event listeners
      this.setupEventListeners();
      this.showGate();

      console.log('✅ OTP Authentication Gate ready');
    } catch (error) {
      console.error('❌ Auth gate initialization error:', error);
      this.showError('Authentication system error: ' + error.message);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if user is already authenticated
   */
  async checkAuthentication() {
    try {
      // Check session
      const session = this.getSession();
      if (session && this.isSessionValid(session)) {
        console.log('✅ Valid session found');
        return true;
      }

      // Check lockout
      if (this.isLockedOut()) {
        console.log('🔒 Account locked due to too many attempts');
        this.showLockoutMessage();
        return false;
      }

      return false;
    } catch (error) {
      console.error('❌ Authentication check error:', error);
      return false;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    try {
      // Tab switching
      const tabs = document.querySelectorAll('.otp-auth-tab');
      tabs.forEach((tab) => {
        tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
      });

      // Verify OTP form
      const verifyForm = document.getElementById('otp-auth-form-verify');
      if (verifyForm) {
        verifyForm.addEventListener('submit', (e) => this.handleVerifyOTP(e));
      }

      // OTP input handling
      const otpInput = document.getElementById('otp-auth-input');
      if (otpInput) {
        otpInput.addEventListener('input', (e) => this.handleOTPInput(e));
        otpInput.addEventListener('paste', (e) => this.handleOTPPaste(e));
      }

      // Request OTP button
      const requestBtn = document.getElementById('otp-auth-request-btn');
      if (requestBtn) {
        requestBtn.addEventListener('click', () => this.handleRequestOTP());
      }

      console.log('✅ Event listeners set up');
    } catch (error) {
      console.error('❌ Event listener setup error:', error);
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    try {
      this.currentTab = tabName;

      // Update tab buttons
      document.querySelectorAll('.otp-auth-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });

      // Update tab content
      document.querySelectorAll('.otp-auth-tab-content').forEach((content) => {
        content.classList.toggle('active', content.dataset.tabContent === tabName);
      });

      console.log(`📑 Switched to ${tabName} tab`);
    } catch (error) {
      console.error('❌ Tab switch error:', error);
    }
  }

  /**
   * Handle OTP input
   */
  handleOTPInput(e) {
    try {
      let value = e.target.value.toUpperCase();

      // Remove non-alphanumeric
      value = value.replace(/[^A-Z0-9]/g, '');

      // Limit to 10 chars
      value = value.substring(0, 10);

      e.target.value = value;

      // Update character count
      const counter = document.querySelector('.otp-auth-char-count');
      if (counter) {
        counter.textContent = `${value.length}/10`;
      }

      // Auto-validate
      if (value.length === 10) {
        this.showMessage('✅ OTP code looks valid. Click Unlock.', 'info', 'verify');
      }
    } catch (error) {
      console.error('❌ OTP input error:', error);
    }
  }

  /**
   * Handle OTP paste
   */
  handleOTPPaste(e) {
    try {
      e.preventDefault();

      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (text) {
        const input = e.target;
        input.value = text.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
        input.dispatchEvent(new Event('input'));

        if (input.value.length === 10) {
          setTimeout(() => this.handleVerifyOTP(new Event('submit')), 300);
        }
      }
    } catch (error) {
      console.error('❌ OTP paste error:', error);
    }
  }

  /**
   * Handle OTP verification
   */
  async handleVerifyOTP(e) {
    e.preventDefault();

    try {
      const otpCode = document.getElementById('otp-auth-input')?.value.trim();

      if (!otpCode || otpCode.length !== 10) {
        this.showMessage('⚠️ Please enter a valid 10-character OTP', 'warning', 'verify');
        return;
      }

      // Disable button
      this.setSubmitButtonState(true);
      this.showMessage('🔍 Verifying OTP...', 'info', 'verify');

      // Verify with OTP system
      const result = await this.otpSystem.verifyOTP(otpCode);

      if (result.success) {
        this.showMessage('✅ OTP verified successfully! Unlocking...', 'success', 'verify');

        // Store session
        this.storeSession(result);
        this.isAuthenticated = true;
        this.failedAttempts = 0;

        // Hide gate after short delay
        setTimeout(() => {
          this.hideGate();
        }, 1500);
      } else {
        this.failedAttempts++;

        if (this.failedAttempts >= this.maxAttempts) {
          this.setLockout();
          this.showMessage('🔒 Too many failed attempts. Locked for 30 minutes.', 'error', 'verify');
          this.setSubmitButtonState(true);
        } else {
          const remaining = this.maxAttempts - this.failedAttempts;
          this.showMessage(
            `❌ Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
            'error',
            'verify'
          );
          this.setSubmitButtonState(false);
        }
      }
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      this.showMessage(`❌ Verification failed: ${error.message}`, 'error', 'verify');
      this.setSubmitButtonState(false);
    }
  }

  /**
   * Handle OTP request
   */
  async handleRequestOTP() {
    try {
      const email = document.getElementById('otp-auth-email')?.value.trim();

      if (!email || !this.isValidEmail(email)) {
        this.showMessage('⚠️ Please enter a valid email address', 'warning', 'request');
        return;
      }

      this.showMessage('📤 Request saved locally. Contact your admin for OTP code.', 'info', 'request');

      // Store request locally
      const requests = JSON.parse(localStorage.getItem('otp_requests') || '[]');
      requests.push({
        email: email,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('otp_requests', JSON.stringify(requests));

      // Clear input
      const input = document.getElementById('otp-auth-email');
      if (input) input.value = '';

      console.log('📧 OTP request stored:', email);
    } catch (error) {
      console.error('❌ OTP request error:', error);
      this.showMessage(`❌ Request failed: ${error.message}`, 'error', 'request');
    }
  }

  /**
   * Validate email
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Store session
   */
  storeSession(result) {
    try {
      const session = {
        sessionId: result.sessionId || 'session_' + Date.now(),
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      sessionStorage.setItem('otp_session', JSON.stringify(session));
      localStorage.setItem('last_otp_verified', new Date().toISOString());
      localStorage.removeItem('otp_failed_attempts');
      localStorage.removeItem('otp_lockout_time');

      console.log('✅ Session stored');
    } catch (error) {
      console.error('❌ Session storage error:', error);
    }
  }

  /**
   * Get session
   */
  getSession() {
    try {
      const session = sessionStorage.getItem('otp_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('❌ Get session error:', error);
      return null;
    }
  }

  /**
   * Check if session is valid
   */
  isSessionValid(session) {
    if (!session) return false;
    
    try {
      const expiryDate = new Date(session.expiresAt);
      if (expiryDate < new Date()) {
        sessionStorage.removeItem('otp_session');
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return false;
    }
  }

  /**
   * Set lockout
   */
  setLockout() {
    try {
      localStorage.setItem('otp_failed_attempts', this.maxAttempts);
      localStorage.setItem('otp_lockout_time', new Date().toISOString());
    } catch (error) {
      console.error('❌ Lockout set error:', error);
    }
  }

  /**
   * Check if locked out
   */
  isLockedOut() {
    try {
      const lockoutTime = localStorage.getItem('otp_lockout_time');
      if (!lockoutTime) return false;

      const elapsed = new Date() - new Date(lockoutTime);
      if (elapsed > this.lockoutTime) {
        localStorage.removeItem('otp_lockout_time');
        localStorage.removeItem('otp_failed_attempts');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Lockout check error:', error);
      return false;
    }
  }

  /**
   * Show lockout message
   */
  showLockoutMessage() {
    try {
      const lockoutTime = localStorage.getItem('otp_lockout_time');
      if (!lockoutTime) return;

      const elapsed = new Date() - new Date(lockoutTime);
      const remaining = Math.ceil((this.lockoutTime - elapsed) / 1000 / 60);

      this.showMessage(
        `🔒 Account locked. Please try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
        'error',
        'verify'
      );
    } catch (error) {
      console.error('❌ Lockout message error:', error);
    }
  }

  /**
   * Show message
   */
  showMessage(message, type = 'info', tab = null) {
    try {
      const selector = tab === 'request' ? '#otp-auth-message-request' : '#otp-auth-message';
      const messageEl = document.querySelector(selector);
      
      if (messageEl) {
        messageEl.textContent = message;
        messageEl.className = `otp-auth-message otp-auth-message-${type} show`;
        messageEl.style.display = 'block';
      }
    } catch (error) {
      console.error('❌ Show message error:', error);
    }
  }

  /**
   * Set submit button state
   */
  setSubmitButtonState(loading) {
    try {
      const btn = document.querySelector('#otp-auth-form-verify button[type="submit"]');
      if (btn) {
        btn.disabled = loading;
        btn.textContent = loading ? '⏳ Verifying...' : '🔐 Unlock Extension';
      }
    } catch (error) {
      console.error('❌ Button state error:', error);
    }
  }

  /**
   * Show gate
   */
  showGate() {
    try {
      const gate = document.getElementById('otp-auth-gate');
      if (gate) {
        gate.classList.remove('otp-auth-hidden');
        const body = document.getElementById('sp-body');
        if (body) body.style.display = 'none';
      }
    } catch (error) {
      console.error('❌ Show gate error:', error);
    }
  }

  /**
   * Hide gate
   */
  hideGate() {
    try {
      const gate = document.getElementById('otp-auth-gate');
      if (gate) {
        gate.classList.add('otp-auth-hidden');
        const body = document.getElementById('sp-body');
        if (body) body.style.display = 'flex';
      }
    } catch (error) {
      console.error('❌ Hide gate error:', error);
    }
  }

  /**
   * Show error
   */
  showError(message) {
    try {
      const messageEl = document.querySelector('#otp-auth-message');
      if (messageEl) {
        messageEl.textContent = '❌ ' + message;
        messageEl.className = 'otp-auth-message otp-auth-message-error show';
        messageEl.style.display = 'block';
      }
    } catch (error) {
      console.error('❌ Show error:', error);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OTPAuthGate;
}

console.log('✅ OTP Auth Gate loaded');

  /**
   * Hide gate and show main UI
   */
  hideGate() {
    try {
      const gate = document.getElementById('otp-auth-gate');
      const mainUI = document.getElementById('main-ui');
      
      if (gate) {
        gate.classList.add('hidden');
      }
      
      if (mainUI) {
        mainUI.classList.add('visible');
      }

      // Broadcast OTP verification to admin panel
      try {
        chrome.runtime.sendMessage({
          type: 'OTP_VERIFIED',
          data: {
            timestamp: new Date().toISOString(),
            verified: true
          }
        }, (response) => {
          // Admin panel might not be open, so ignore errors
          if (chrome.runtime.lastError) {
            console.log('💬 Admin panel not connected (normal if closed)');
          }
        });
      } catch (error) {
        console.log('Could not send message to admin panel');
      }

      console.log('✅ Auth gate hidden, main UI shown');
    } catch (error) {
      console.error('❌ Hide gate error:', error);
    }
  }
}

// Auto-initialize when window loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.otpAuthGateInstance = new OTPAuthGate();
  });
} else {
  window.otpAuthGateInstance = new OTPAuthGate();
}
