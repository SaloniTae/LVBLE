/**
 * Lovable Tool - Button Handlers with OTP Integration
 * Trivis Edition | Discord: https://discord.gg/SvxytM8Y2p
 * 
 * This file handles all button functionality with OTP security
 */

// Initialize services
let otpModal = null;
let otpService = null;
let supabaseClient = null;
const CONFIG = {
  LOVABLE_URL: 'https://lovable.dev',
  LOVABLE_WORKSPACE: 'https://lovable.dev/workspace',
  LOVABLE_HOME: 'https://lovable.dev/home',
  LOVABLE_PROFILE: 'https://lovable.dev/profile',
  DISCORD_URL: 'https://discord.gg/SvxytM8Y2p',
};

// Toast notification utility
class Toast {
  static show(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('sp-toast');
    if (!toast) return;

    // Clear previous content
    toast.innerHTML = '';
    toast.className = 'sp-toast sp-toast-show';

    // Create toast content
    const toastContent = document.createElement('div');
    toastContent.className = `sp-toast-content sp-toast-${type}`;

    const emoji = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    }[type] || 'ℹ️';

    toastContent.innerHTML = `
      <span class="sp-toast-emoji">${emoji}</span>
      <span class="sp-toast-message">${message}</span>
    `;

    toast.appendChild(toastContent);

    // Auto hide
    setTimeout(() => {
      toast.classList.remove('sp-toast-show');
    }, duration);
  }
}

// Modal utility
class Modal {
  static open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('sp-modal-hidden');
      modal.classList.add('sp-modal-show');
    }
  }

  static close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('sp-modal-show');
      modal.classList.add('sp-modal-hidden');
    }
  }

  static closeAll() {
    document.querySelectorAll('.sp-modal').forEach(modal => {
      modal.classList.remove('sp-modal-show');
      modal.classList.add('sp-modal-hidden');
    });
  }
}

// Check if Lovable website is open
async function isLovableOpen() {
  try {
    const tabs = await chrome.tabs.query({
      url: '*://lovable.dev/*',
    });
    return tabs.length > 0;
  } catch (error) {
    console.error('Error checking tabs:', error);
    return false;
  }
}

// Get active Lovable tab
async function getActiveLovableTab() {
  try {
    const tabs = await chrome.tabs.query({
      url: '*://lovable.dev/*',
      active: false,
    });
    return tabs.length > 0 ? tabs[0] : null;
  } catch (error) {
    console.error('Error getting Lovable tab:', error);
    return null;
  }
}

// Button Handlers

/**
 * NEW Button Handler
 * Creates a new workspace in Lovable
 */
async function handleNewWorkspace() {
  const lovableOpen = await isLovableOpen();

  if (!lovableOpen) {
    Toast.show('❌ Open Lovable Website First', 'error', 4000);
    return;
  }

  try {
    // Open new workspace tab
    chrome.tabs.create({
      url: CONFIG.LOVABLE_WORKSPACE,
      active: true,
    });

    Toast.show('✅ Creating new workspace...', 'success');
  } catch (error) {
    console.error('Error creating workspace:', error);
    Toast.show('❌ Failed to create workspace', 'error');
  }
}

/**
 * RECENT Button Handler
 * Redirects to Lovable home page in existing workspace tab
 */
async function handleRecent() {
  const lovableTab = await getActiveLovableTab();

  if (!lovableTab) {
    Toast.show('❌ Open Lovable Website First', 'error', 4000);
    // Optionally open Lovable in a new tab
    setTimeout(() => {
      chrome.tabs.create({
        url: CONFIG.LOVABLE_HOME,
        active: true,
      });
    }, 500);
    return;
  }

  try {
    // Update existing tab to home page
    chrome.tabs.update(lovableTab.id, {
      url: CONFIG.LOVABLE_HOME,
      active: true,
    });

    // Switch to that tab
    chrome.windows.update(lovableTab.windowId, { focused: true });

    Toast.show('✅ Navigating to recent projects...', 'success');
  } catch (error) {
    console.error('Error navigating to recent:', error);
    Toast.show('❌ Failed to navigate', 'error');
  }
}

/**
 * SETTINGS Button Handler
 * Shows user profile and settings in a modal
 */
async function handleSettings() {
  Modal.open('sp-modal-settings');

  try {
    // Fetch user profile from Lovable API
    const userProfile = await fetchUserProfile();

    if (userProfile) {
      displayUserProfile(userProfile);
    } else {
      displaySettingsError();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    displaySettingsError();
  }
}

/**
 * Fetch user profile from Lovable
 */
async function fetchUserProfile() {
  try {
    // Check if there's an active Lovable tab
    const tabs = await chrome.tabs.query({
      url: '*://lovable.dev/*',
    });

    if (tabs.length === 0) {
      return null;
    }

    // Try to get profile data via content script
    return await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'getProfile' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response?.profile || null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

/**
 * Display user profile in modal
 */
function displayUserProfile(profile) {
  const body = document.getElementById('sp-settings-body');
  if (!body) return;

  const userName = profile.name || 'User';
  const userEmail = profile.email || 'Not available';
  const userPlan = profile.plan || 'Free';

  body.innerHTML = `
    <div class="sp-profile-section">
      <div class="sp-profile-header">
        <div class="sp-profile-avatar">👤</div>
        <div class="sp-profile-info">
          <h3>👨‍💼 ${userName}</h3>
          <p>📧 ${userEmail}</p>
        </div>
      </div>

      <div class="sp-profile-stats">
        <div class="sp-stat-item">
          <span class="sp-stat-label">📌 Plan</span>
          <span class="sp-stat-value">💎 ${userPlan}</span>
        </div>
        <div class="sp-stat-item">
          <span class="sp-stat-label">🎯 Status</span>
          <span class="sp-stat-value">✅ Active</span>
        </div>
      </div>

      <div class="sp-profile-actions">
        <button class="sp-settings-action-btn sp-primary" id="btn-edit-profile">
          <span>✏️</span> Edit Profile
        </button>
        <button class="sp-settings-action-btn" id="btn-workspace-settings">
          <span>⚙️</span> Workspace Settings
        </button>
      </div>

      <div class="sp-profile-divider"></div>

      <div class="sp-profile-features">
        <h4>🚀 Available Features</h4>
        <ul class="sp-features-list">
          <li><span>🎨</span> Design Studio</li>
          <li><span>⚡</span> Fast Development</li>
          <li><span>📱</span> Responsive Design</li>
          <li><span>🔧</span> Custom Components</li>
          <li><span>🚀</span> One-Click Deploy</li>
          <li><span>🌐</span> Multi-Platform Export</li>
        </ul>
      </div>

      <div class="sp-profile-actions">
        <a href="${CONFIG.LOVABLE_PROFILE}" target="_blank" class="sp-settings-action-btn sp-secondary">
          <span>🔗</span> Open Full Profile
        </a>
      </div>
    </div>
  `;

  // Add event listeners
  const editBtn = document.getElementById('btn-edit-profile');
  const wsBtn = document.getElementById('btn-workspace-settings');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: CONFIG.LOVABLE_PROFILE,
        active: true,
      });
      Modal.close('sp-modal-settings');
      Toast.show('✏️ Opening profile editor...', 'info', 2000);
    });
  }

  if (wsBtn) {
    wsBtn.addEventListener('click', () => {
      Toast.show('⚙️ Opening workspace settings...', 'info');
      setTimeout(() => {
        chrome.tabs.create({
          url: `${CONFIG.LOVABLE_WORKSPACE}/settings`,
          active: true,
        });
        Modal.close('sp-modal-settings');
      }, 500);
    });
  }
}

/**
 * Display settings error
 */
function displaySettingsError() {
  const body = document.getElementById('sp-settings-body');
  if (!body) return;

  body.innerHTML = `
    <div class="sp-settings-error">
      <span class="sp-error-emoji">⚠️</span>
      <h3>⛔ Settings Unavailable</h3>
      <p>🌐 Open Lovable website to view your profile and settings.</p>
      <button class="sp-settings-action-btn sp-primary" id="btn-open-lovable">
        <span>🌐</span> Open Lovable
      </button>
    </div>
  `;

  const btn = document.getElementById('btn-open-lovable');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.tabs.create({
        url: CONFIG.LOVABLE_URL,
        active: true,
      });
      Modal.close('sp-modal-settings');
      Toast.show('🌐 Opening Lovable website...', 'info', 2000);
    });
  }
}

/**
 * HELP Button Handler
 * Redirects to Discord server
 */
function handleHelp() {
  try {
    chrome.tabs.create({
      url: CONFIG.DISCORD_URL,
      active: true,
    });
    Toast.show('✅ Opening Discord server...', 'success', 2000);
  } catch (error) {
    console.error('Error opening Discord:', error);
    Toast.show('❌ Failed to open Discord', 'error');
  }
}

// Initialize Event Listeners
function initializeHandlers() {
  const newBtn = document.getElementById('btn-new');
  const recentBtn = document.getElementById('btn-recent');
  const settingsBtn = document.getElementById('btn-settings');
  const helpBtn = document.getElementById('btn-help');

  // Wrap handlers with OTP verification
  if (newBtn) {
    newBtn.addEventListener('click', withOTPVerification(handleNewWorkspace, 'New Workspace'));
  }

  if (recentBtn) {
    recentBtn.addEventListener('click', withOTPVerification(handleRecent, 'Recent Projects'));
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', withOTPVerification(handleSettings, 'Settings'));
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', withOTPVerification(handleHelp, 'Help'));
  }

  // Modal close handlers
  const closeSettingsBtn = document.getElementById('close-settings');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      Modal.close('sp-modal-settings');
    });
  }

  // Modal backdrop click to close
  document.querySelectorAll('.sp-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        Modal.closeAll();
      }
    });
  });

  console.log('✅ Event listeners initialized with OTP verification');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await initializeOTPSystem();
    initializeHandlers();
  });
} else {
  initializeOTPSystem().then(() => initializeHandlers());
}

// Expose functions for testing
window.LovableToolHandlers = {
  handleNewWorkspace,
  handleRecent,
  handleSettings,
  handleHelp,
  Toast,
  Modal,
  CONFIG,
  checkOTPRequired,
  initializeOTPSystem,
};

/**
 * Check if OTP verification is required
 */
async function checkOTPRequired() {
  try {
    // Check if OTP session exists and is valid
    if (!otpModal) {
      return true; // OTP required if modal not initialized
    }

    const isValid = await otpModal.isSessionValid();
    return !isValid; // Return true if OTP is required (session invalid)
  } catch (error) {
    console.error('❌ OTP check error:', error);
    return true; // Fail secure - require OTP
  }
}

/**
 * Show OTP modal with callback
 */
function showOTPModal(onVerified) {
  if (!otpModal) {
    console.error('❌ OTP Modal not initialized');
    Toast.show('❌ Security system not ready', 'error');
    return;
  }

  otpModal.open(onVerified);
}

/**
 * Initialize OTP system
 */
async function initializeOTPSystem() {
  try {
    // Wait for Supabase to be ready
    let attempts = 0;
    while (!window.supabase && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.supabase) {
      console.warn('⚠️ Supabase not available - OTP system disabled');
      return;
    }

    // Get Supabase client
    supabaseClient = supabase.getClient();

    // Initialize OTP Service
    otpService = new OTPService(SUPABASE_CONFIG);
    otpService.setSupabaseClient(supabaseClient);

    // Initialize OTP Modal
    otpModal = new OTPModal();
    otpModal.setServices(supabaseClient, otpService);

    console.log('✅ OTP system initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ OTP initialization error:', error);
    return false;
  }
}

/**
 * Wrap button handlers with OTP verification
 */
async function withOTPVerification(handlerFunction, buttonName) {
  return async function() {
    try {
      // Check if OTP is required
      const requiresOTP = await checkOTPRequired();

      if (requiresOTP) {
        Toast.show(`🔐 OTP verification required for ${buttonName}`, 'info');
        
        showOTPModal(async (result) => {
          if (result && result.success) {
            Toast.show(`✅ ${buttonName} access granted`, 'success');
            
            // Execute the actual handler
            await handlerFunction.apply(this, arguments);
          }
        });
        return;
      }

      // OTP already verified, execute handler directly
      await handlerFunction.apply(this, arguments);
    } catch (error) {
      console.error(`❌ Error in ${buttonName}:`, error);
      Toast.show(`❌ ${buttonName} failed: ${error.message}`, 'error');
    }
  };
}

