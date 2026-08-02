/**
 * Modern UI Handlers
 * Manages all button clicks, tab switching, and UI interactions
 */

class ModernUIHandlers {
  constructor() {
    this.mainUI = document.getElementById('main-ui');
    this.authGate = document.getElementById('otp-auth-gate');
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // OTP Tab Switching
    document.querySelectorAll('.otp-auth-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e));
    });

    // OTP Form Submit
    const verifyForm = document.getElementById('otp-auth-form-verify');
    if (verifyForm) {
      verifyForm.addEventListener('submit', (e) => this.handleOTPSubmit(e));
    }

    // OTP Input Character Count
    const otpInput = document.getElementById('otp-auth-input');
    if (otpInput) {
      otpInput.addEventListener('input', (e) => this.updateCharCount(e));
    }

    // Request OTP Button
    const requestBtn = document.getElementById('otp-auth-request-btn');
    if (requestBtn) {
      requestBtn.addEventListener('click', () => this.handleRequestOTP());
    }

    // Main UI Buttons
    document.getElementById('btn-new')?.addEventListener('click', () => this.handleNew());
    document.getElementById('btn-recent')?.addEventListener('click', () => this.handleRecent());
    document.getElementById('btn-templates')?.addEventListener('click', () => this.handleTemplates());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.handleSettings());
    document.getElementById('btn-admin')?.addEventListener('click', () => this.handleAdmin());
    document.getElementById('btn-discord')?.addEventListener('click', () => this.handleDiscord());
    document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogout());
  }

  // ========== OTP HANDLERS ==========
  switchTab(e) {
    const tabName = e.target.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.otp-auth-tab').forEach(t => {
      t.classList.remove('active');
    });
    e.target.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.otp-auth-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.querySelector(`[data-tab-content="${tabName}"]`).classList.add('active');
  }

  updateCharCount(e) {
    const count = e.target.value.length;
    const counter = e.target.parentElement.querySelector('.otp-auth-char-count');
    if (counter) {
      counter.textContent = `${count}/10`;
    }
  }

  async handleOTPSubmit(e) {
    e.preventDefault();
    
    const otpInput = document.getElementById('otp-auth-input');
    const otp = otpInput.value.trim().toUpperCase();
    const messageDiv = document.getElementById('otp-auth-message');

    if (!otp || otp.length !== 10) {
      this.showMessage(messageDiv, '❌ Please enter a 10-character OTP', 'error');
      return;
    }

    try {
      messageDiv.style.display = 'flex';
      messageDiv.className = 'otp-auth-message warning';
      messageDiv.innerHTML = '⏳ Verifying OTP...';

      // Verify with OTP system
      const result = await window.otpSystem.verifyOTP(otp);

      if (result.success) {
        this.showMessage(messageDiv, '✅ ' + result.message, 'success');
        
        // Hide auth gate and show main UI
        setTimeout(() => {
          this.hideAuthGate();
          this.showMainUI();
          this.showToast('🔓 Extension unlocked! Welcome back.');
        }, 1000);
      } else {
        this.showMessage(messageDiv, '❌ ' + result.message, 'error');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      this.showMessage(messageDiv, '❌ Verification failed. Try again.', 'error');
    }
  }

  async handleRequestOTP() {
    const email = document.getElementById('otp-auth-email').value.trim();
    const messageDiv = document.getElementById('otp-auth-message-request');

    if (!email || !this.isValidEmail(email)) {
      this.showMessage(messageDiv, '❌ Please enter a valid email', 'error');
      return;
    }

    try {
      messageDiv.style.display = 'flex';
      messageDiv.className = 'otp-auth-message warning';
      messageDiv.innerHTML = '⏳ Sending request...';

      // Simulate sending request (integrate with Supabase later)
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.showMessage(messageDiv, '✅ Request sent! Admin will respond within 1 hour.', 'success');
      document.getElementById('otp-auth-email').value = '';

      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 5000);
    } catch (error) {
      console.error('Request OTP error:', error);
      this.showMessage(messageDiv, '❌ Failed to send request', 'error');
    }
  }

  showMessage(element, message, type) {
    element.innerHTML = message;
    element.className = `otp-auth-message ${type}`;
    element.style.display = 'flex';
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  hideAuthGate() {
    this.authGate.classList.add('hidden');
  }

  showMainUI() {
    this.mainUI.classList.add('visible');
  }

  // ========== MAIN UI HANDLERS ==========
  handleNew() {
    this.showToast('📝 Creating new project...');
    console.log('New project clicked');
  }

  handleRecent() {
    this.showToast('📂 Loading recent projects...');
    console.log('Recent clicked');
  }

  handleTemplates() {
    this.showToast('🎨 Loading templates...');
    console.log('Templates clicked');
  }

  handleSettings() {
    this.showToast('⚙️ Opening settings...');
    console.log('Settings clicked');
  }

  handleAdmin() {
    this.showToast('🛠️ Opening admin panel...');
    // Open admin panel in new window
    const adminPath = chrome.runtime.getURL('admin/admin-panel.html');
    console.log('Opening admin panel from:', adminPath);
    chrome.windows.create({
      url: adminPath,
      type: 'popup',
      width: 1400,
      height: 900,
      left: 100,
      top: 100
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error('Error opening admin panel:', chrome.runtime.lastError);
        this.showToast('❌ Failed to open admin panel');
      }
    });
  }

  handleDiscord() {
    window.open('https://discord.gg/SvxytM8Y2p', '_blank');
  }

  handleLogout() {
    this.showToast('👋 Logging out...');
    
    setTimeout(() => {
      // Clear session
      localStorage.removeItem('otp_session');
      window.location.reload();
    }, 800);
  }

  // ========== TOAST NOTIFICATIONS ==========
  showToast(message) {
    const toast = document.getElementById('sp-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.uiHandlers = new ModernUIHandlers();
  });
} else {
  window.uiHandlers = new ModernUIHandlers();
}
