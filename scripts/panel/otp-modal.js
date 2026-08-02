/**
 * OTP Verification Modal
 * Extension popup modal for OTP verification with real-time validation
 */

class OTPModal {
  constructor() {
    this.isOpen = false;
    this.otpService = null;
    this.supabase = null;
    this.currentUser = null;
    this.onVerifyCallback = null;
    this.failedAttempts = 0;
    this.maxAttempts = 5;
  }

  /**
   * Initialize OTP Modal
   */
  setServices(supabase, otpService) {
    this.supabase = supabase;
    this.otpService = otpService;
    this.setupEventListeners();
    console.log('✅ OTP Modal initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const form = document.getElementById('otp-verification-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleVerifyOTP(e));
    }

    const input = document.getElementById('otp-input');
    if (input) {
      input.addEventListener('input', (e) => this.handleOTPInput(e));
      input.addEventListener('paste', (e) => this.handleOTPPaste(e));
    }

    const closeBtn = document.getElementById('otp-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Close on background click
    const overlay = document.querySelector('#otp-modal .otp-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }
  }

  /**
   * Open OTP modal
   */
  open(onVerify) {
    this.onVerifyCallback = onVerify;
    this.failedAttempts = 0;

    const modal = document.getElementById('otp-modal');
    if (!modal) {
      console.error('❌ OTP modal not found in DOM');
      return;
    }

    modal.classList.add('otp-modal-show');
    this.isOpen = true;

    // Focus on input
    const input = document.getElementById('otp-input');
    if (input) {
      input.focus();
      input.value = '';
    }

    // Clear previous messages
    this.clearMessages();

    console.log('📋 OTP Modal opened');
  }

  /**
   * Close OTP modal
   */
  close() {
    const modal = document.getElementById('otp-modal');
    if (modal) {
      modal.classList.remove('otp-modal-show');
    }
    this.isOpen = false;
    console.log('📋 OTP Modal closed');
  }

  /**
   * Handle OTP input
   */
  handleOTPInput(e) {
    let value = e.target.value.toUpperCase();

    // Remove non-alphanumeric characters
    value = value.replace(/[^A-Z0-9]/g, '');

    // Limit to 10 characters
    value = value.substring(0, 10);

    e.target.value = value;

    // Update character count
    const counter = document.querySelector('.otp-char-count');
    if (counter) {
      counter.textContent = `${value.length}/10`;
    }

    // Auto-validate if exactly 10 characters
    if (value.length === 10) {
      this.showMessage('✅ OTP code looks valid. Click Verify or press Enter.', 'info');
    }
  }

  /**
   * Handle OTP paste
   */
  handleOTPPaste(e) {
    e.preventDefault();

    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text) {
      const input = e.target;
      input.value = text.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);

      // Trigger input event to update UI
      input.dispatchEvent(new Event('input'));

      // Auto-verify if exactly 10 characters
      if (input.value.length === 10) {
        setTimeout(() => this.handleVerifyOTP(new Event('submit')), 500);
      }
    }
  }

  /**
   * Handle verify OTP
   */
  async handleVerifyOTP(e) {
    e.preventDefault();

    try {
      const otpCode = document.getElementById('otp-input')?.value.trim();

      if (!otpCode || otpCode.length !== 10) {
        this.showMessage('⚠️ Please enter a valid 10-character OTP code', 'warning');
        return;
      }

      // Disable submit button
      this.setSubmitButtonState(true);
      this.showMessage('🔍 Verifying OTP...', 'info');

      // Get device info
      const deviceId = this.getDeviceId();
      const fingerprint = this.getFingerprint();
      const ipAddress = await this.getIPAddress();
      const userAgent = navigator.userAgent;

      // Get or create user
      let userId = await this.getOrCreateUser();
      if (!userId) {
        throw new Error('Failed to create user account');
      }

      // Verify OTP
      const result = await this.otpService.verifyOTP(
        otpCode,
        userId,
        deviceId,
        fingerprint,
        ipAddress,
        userAgent
      );

      if (result.success) {
        this.showMessage('✅ OTP verified successfully!', 'success');

        // Store session
        this.storeSession(result.session, userId);

        // Wait for user to see the success message
        setTimeout(() => {
          this.close();

          // Call callback
          if (this.onVerifyCallback) {
            this.onVerifyCallback(result);
          }
        }, 1500);
      } else {
        this.failedAttempts++;

        if (this.failedAttempts >= this.maxAttempts) {
          this.showMessage(
            '🔒 Too many failed attempts. Please try again later.',
            'error'
          );
          this.setSubmitButtonState(true);
          setTimeout(() => this.close(), 2000);
        } else {
          const remaining = this.maxAttempts - this.failedAttempts;
          this.showMessage(
            `❌ Invalid OTP. ${remaining} attempts remaining.`,
            'error'
          );
          this.setSubmitButtonState(false);
        }
      }
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      this.showMessage(`❌ Verification failed: ${error.message}`, 'error');
      this.setSubmitButtonState(false);
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser() {
    try {
      const username = this.generateUsername();
      const email = `${username}@lovable-tool.local`;

      // Check if user exists
      let { data: existingUser } = await this.supabase
        .from('user_accounts')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        return existingUser.id;
      }

      // Create new user
      const { data: newUser, error } = await this.supabase
        .from('user_accounts')
        .insert({
          username,
          email,
          full_name: username,
          device_id: this.getDeviceId(),
          browser_fingerprint: this.getFingerprint(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return newUser.id;
    } catch (error) {
      console.error('❌ User creation error:', error);
      return null;
    }
  }

  /**
   * Generate unique username
   */
  generateUsername() {
    return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get device ID
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get browser fingerprint
   */
  getFingerprint() {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
    };

    return JSON.stringify(fingerprint);
  }

  /**
   * Get IP address
   */
  async getIPAddress() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('⚠️ Could not fetch IP address:', error);
      return 'unknown';
    }
  }

  /**
   * Store session
   */
  storeSession(sessionData, userId) {
    const session = {
      userId,
      sessionId: sessionData.id,
      createdAt: new Date().toISOString(),
      expiresAt: sessionData.expires_at,
    };

    sessionStorage.setItem('otp_session', JSON.stringify(session));
    localStorage.setItem('last_otp_verified', new Date().toISOString());

    console.log('✅ Session stored');
  }

  /**
   * Show message
   */
  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('otp-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `otp-message otp-message-${type}`;
      messageEl.style.display = 'block';
    }
  }

  /**
   * Clear messages
   */
  clearMessages() {
    const messageEl = document.getElementById('otp-message');
    if (messageEl) {
      messageEl.style.display = 'none';
      messageEl.textContent = '';
    }
  }

  /**
   * Set submit button state
   */
  setSubmitButtonState(loading) {
    const btn = document.querySelector('#otp-verification-form button[type="submit"]');
    if (btn) {
      if (loading) {
        btn.disabled = true;
        btn.textContent = '⏳ Verifying...';
      } else {
        btn.disabled = false;
        btn.textContent = '🔐 Verify OTP';
      }
    }
  }

  /**
   * Check if session is valid
   */
  async isSessionValid() {
    try {
      const session = sessionStorage.getItem('otp_session');
      if (!session) {
        return false;
      }

      const parsedSession = JSON.parse(session);

      // Check if session is expired
      if (new Date(parsedSession.expiresAt) < new Date()) {
        sessionStorage.removeItem('otp_session');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Session check error:', error);
      return false;
    }
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    try {
      const session = sessionStorage.getItem('otp_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('❌ Get session error:', error);
      return null;
    }
  }

  /**
   * Logout
   */
  logout() {
    sessionStorage.removeItem('otp_session');
    localStorage.removeItem('device_id');
    console.log('✅ Session cleared');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OTPModal;
}
