/**
 * OTP Configuration & Initialization
 * Works with or without Supabase
 * Includes fallback local storage OTP system
 */

// ============================================================
// 🔑 CONFIGURATION - UPDATE THESE!
// ============================================================

const OTP_CONFIG = {
  // Mode: Set to 'supabase' or 'local'
  // 'local' = uses localStorage (works immediately, no Supabase needed!)
  // 'supabase' = uses Supabase backend (requires valid keys)
  MODE: 'local',  // ← CHANGE THIS TO 'supabase' if you have keys
  
  // Supabase Configuration (only needed if MODE is 'supabase')
  SUPABASE: {
    URL: 'https://YOUR-PROJECT.supabase.co',  // ← Replace with real URL
    ANON_KEY: 'sb_anon_YOUR_KEY_HERE',        // ← Replace with real key
  },

  // OTP Settings
  LENGTH: 10,                           // 10-character OTP
  CHARACTER_SET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  EXPIRY_DAYS: 30,                      // OTP valid for 30 days (was 1 month)
  MAX_ATTEMPTS: 5,                      // Max failed attempts
  LOCKOUT_MINUTES: 30,                  // 30-minute lockout
  SESSION_EXPIRY_DAYS: 30,              // Session valid 30 days
  AUTO_LOGOUT_MINUTES: 30,              // Auto-logout after inactivity
};

// ============================================================
// 🛠️ OTP MANAGER (Local Fallback System)
// ============================================================

class LocalOTPManager {
  constructor(config) {
    this.config = config;
    this.storageKey = 'otp_system_data';
    this.initializeStorage();
  }

  /**
   * Initialize storage with OTPs
   */
  initializeStorage() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      const data = {
        otps: [],
        sessions: {},
        lastInit: new Date().toISOString(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log('✅ Local OTP storage initialized');
    }
  }

  /**
   * Generate single OTP
   */
  generateOTP() {
    const { LENGTH, CHARACTER_SET } = this.config;
    let otp = '';
    
    // Must have at least one letter and one digit
    const hasLetter = () => /[A-Z]/.test(otp);
    const hasDigit = () => /[0-9]/.test(otp);
    
    do {
      otp = '';
      for (let i = 0; i < LENGTH; i++) {
        otp += CHARACTER_SET.charAt(Math.floor(Math.random() * CHARACTER_SET.length));
      }
    } while (!hasLetter() || !hasDigit());
    
    return otp;
  }

  /**
   * Add OTP to storage
   */
  addOTP(otp) {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.config.EXPIRY_DAYS);
    
    data.otps.push({
      code: otp,
      created: new Date().toISOString(),
      expires: expiryDate.toISOString(),
      used: false,
      usedBy: null,
      usedAt: null,
    });
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    console.log(`✅ OTP added: ${otp}`);
    return otp;
  }

  /**
   * Verify OTP
   */
  verifyOTP(otp) {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    
    // Find OTP
    const otpRecord = data.otps.find(o => o.code === otp);
    
    if (!otpRecord) {
      return { success: false, error: 'OTP_NOT_FOUND' };
    }
    
    if (otpRecord.used) {
      return { success: false, error: 'OTP_ALREADY_USED' };
    }
    
    if (new Date(otpRecord.expires) < new Date()) {
      return { success: false, error: 'OTP_EXPIRED' };
    }
    
    // Mark as used
    otpRecord.used = true;
    otpRecord.usedAt = new Date().toISOString();
    
    // Create session
    const sessionId = 'session_' + Math.random().toString(36).substring(7);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.config.SESSION_EXPIRY_DAYS);
    
    data.sessions[sessionId] = {
      created: new Date().toISOString(),
      expires: expiryDate.toISOString(),
      otpCode: otp,
    };
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    
    console.log(`✅ OTP verified: ${otp}`);
    return { 
      success: true, 
      sessionId: sessionId,
      expiresAt: expiryDate.toISOString(),
    };
  }

  /**
   * Check if session is valid
   */
  isSessionValid(sessionId) {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    const session = data.sessions[sessionId];
    
    if (!session) return false;
    if (new Date(session.expires) < new Date()) {
      delete data.sessions[sessionId];
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return false;
    }
    
    return true;
  }

  /**
   * Get all OTPs (for admin)
   */
  getAllOTPs() {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    return data.otps;
  }

  /**
   * Clear all data
   */
  clearAll() {
    localStorage.removeItem(this.storageKey);
    console.log('⚠️ All OTP data cleared');
    this.initializeStorage();
  }
}

// ============================================================
// 🌐 SUPABASE CLIENT (Optional)
// ============================================================

class SupabaseOTPManager {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  /**
   * Initialize Supabase
   */
  async initialize() {
    try {
      const { createClient } = window.supabase;
      if (!createClient) {
        throw new Error('Supabase not loaded');
      }

      this.client = createClient(this.config.SUPABASE.URL, this.config.SUPABASE.ANON_KEY);
      
      // Test connection
      const { data, error } = await this.client.from('otp_codes').select('count()').limit(1);
      if (error) throw error;
      
      console.log('✅ Supabase connected');
      return true;
    } catch (error) {
      console.error('❌ Supabase error:', error.message);
      return false;
    }
  }

  async verifyOTP(otp) {
    try {
      const { data, error } = await this.client
        .from('otp_codes')
        .select('*')
        .eq('otp_code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return { success: false, error: 'INVALID_OTP' };
      }

      // Mark as used
      await this.client
        .from('otp_codes')
        .update({ used: true })
        .eq('id', data.id);

      // Create session
      const { data: session } = await this.client
        .from('otp_sessions')
        .insert({
          otp_id: data.id,
          session_token: 'token_' + Math.random().toString(36).substring(7),
          expires_at: new Date(Date.now() + this.config.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      return { success: true, session };
    } catch (error) {
      console.error('❌ Supabase verify error:', error);
      return { success: false, error: error.message };
    }
  }

  async generateOTP() {
    const chars = this.config.CHARACTER_SET;
    let otp = '';
    do {
      otp = '';
      for (let i = 0; i < this.config.LENGTH; i++) {
        otp += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (!/[A-Z]/.test(otp) || !/[0-9]/.test(otp));
    return otp;
  }

  async addOTP(otp) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + this.config.EXPIRY_DAYS);

      const { data } = await this.client
        .from('otp_codes')
        .insert({
          otp_code: otp,
          otp_format: 'alphanumeric',
          otp_length: this.config.LENGTH,
          expires_at: expiryDate.toISOString(),
          used: false,
        })
        .select()
        .single();

      return data;
    } catch (error) {
      console.error('❌ Error adding OTP:', error);
      return null;
    }
  }
}

// ============================================================
// 🎯 OTP SYSTEM (Main Manager)
// ============================================================

class OTPSystem {
  constructor(config) {
    this.config = config;
    this.manager = null;
    this.initialized = false;
  }

  /**
   * Initialize OTP system
   */
  async initialize() {
    try {
      console.log(`🔄 Initializing OTP system in ${this.config.MODE} mode...`);

      if (this.config.MODE === 'supabase') {
        this.manager = new SupabaseOTPManager(this.config);
        const success = await this.manager.initialize();
        if (!success) {
          console.warn('⚠️ Supabase failed, falling back to local');
          this.config.MODE = 'local';
          this.manager = new LocalOTPManager(this.config);
        }
      } else {
        this.manager = new LocalOTPManager(this.config);
      }

      this.initialized = true;
      console.log(`✅ OTP system ready in ${this.config.MODE} mode`);
      return true;
    } catch (error) {
      console.error('❌ OTP system initialization error:', error);
      return false;
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(otp) {
    if (!this.initialized) {
      console.error('❌ OTP system not initialized');
      return { success: false, error: 'NOT_INITIALIZED' };
    }
    return await this.manager.verifyOTP(otp);
  }

  /**
   * Generate OTP
   */
  async generateOTP() {
    if (!this.initialized) {
      console.error('❌ OTP system not initialized');
      return null;
    }
    return await this.manager.generateOTP();
  }

  /**
   * Add OTP
   */
  async addOTP(otp) {
    if (!this.initialized) {
      console.error('❌ OTP system not initialized');
      return null;
    }
    return await this.manager.addOTP(otp);
  }

  /**
   * Get all OTPs (local mode only)
   */
  getAllOTPs() {
    if (this.manager instanceof LocalOTPManager) {
      return this.manager.getAllOTPs();
    }
    return [];
  }
}

// ============================================================
// 🚀 GLOBAL INITIALIZATION
// ============================================================

window.otpSystem = new OTPSystem(OTP_CONFIG);

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.otpSystem.initialize().catch(console.error);
  });
} else {
  window.otpSystem.initialize().catch(console.error);
}

console.log('✅ OTP config loaded');
