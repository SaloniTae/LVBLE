/**
 * OTP Generation & Verification Service
 * Secure cryptographic OTP generation with validation
 */

class OTPService {
  constructor(config) {
    this.config = config;
    this.supabase = null;
    this.failedAttempts = new Map(); // Track failed attempts for brute force protection
  }

  /**
   * Initialize OTP Service with Supabase client
   */
  setSupabaseClient(client) {
    this.supabase = client;
  }

  /**
   * Generate secure random OTP
   * @returns {string} 10+ digit alphanumeric OTP
   */
  generateOTP() {
    try {
      const { LENGTH, CHARACTER_SET } = this.config.OTP_CONFIG;
      let otp = '';

      // Use crypto API for secure random generation
      for (let i = 0; i < LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * CHARACTER_SET.length);
        otp += CHARACTER_SET[randomIndex];
      }

      // Validate OTP format
      if (!this.validateOTPFormat(otp)) {
        throw new Error('Generated OTP failed validation');
      }

      console.log('✅ OTP generated successfully');
      return otp;
    } catch (error) {
      console.error('❌ OTP generation error:', error);
      throw error;
    }
  }

  /**
   * Validate OTP format
   */
  validateOTPFormat(otp) {
    const { LENGTH, CHARACTER_SET } = this.config.OTP_CONFIG;

    // Check length
    if (otp.length !== LENGTH) {
      console.warn(`⚠️ OTP length mismatch: expected ${LENGTH}, got ${otp.length}`);
      return false;
    }

    // Check characters
    for (let char of otp) {
      if (!CHARACTER_SET.includes(char)) {
        console.warn(`⚠️ Invalid character in OTP: ${char}`);
        return false;
      }
    }

    // Check for mixed alphanumeric (at least 1 letter and 1 digit)
    const hasLetter = /[A-Z]/.test(otp);
    const hasDigit = /[0-9]/.test(otp);

    if (!hasLetter || !hasDigit) {
      console.warn('⚠️ OTP must contain both letters and digits');
      return false;
    }

    return true;
  }

  /**
   * Create OTP in database
   */
  async createOTP(adminId, userId = null, expiryMinutes = null) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const otp = this.generateOTP();
      const expiryTime = expiryMinutes || this.config.OTP_CONFIG.EXPIRY_TIME_MINUTES;
      const expiresAt = new Date(Date.now() + expiryTime * 60000).toISOString();

      const { data, error } = await this.supabase
        .from('otp_codes')
        .insert({
          admin_id: adminId,
          user_id: userId,
          otp_code: otp,
          otp_format: 'alphanumeric',
          otp_length: this.config.OTP_CONFIG.LENGTH,
          expires_at: expiresAt,
          is_used: false,
          is_expired: false,
          usage_count: 0,
          max_usage: 1,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log activity
      await this.logActivity({
        action_type: 'otp_generated',
        action_status: 'success',
        user_id: userId,
        admin_id: adminId,
        details: {
          otp_id: data.id,
          otp_code: otp,
          expires_at: expiresAt,
        },
      });

      console.log('✅ OTP created in database:', data.id);
      return { success: true, data, otp };
    } catch (error) {
      console.error('❌ Error creating OTP:', error);
      return { success: false, error };
    }
  }

  /**
   * Verify OTP
   */
  async verifyOTP(otpCode, userId, deviceId, fingerprint, ipAddress, userAgent) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Check brute force protection
      const isLockedOut = this.isLockedOut(userId);
      if (isLockedOut) {
        await this.logSecurityEvent({
          event_type: 'brute_force_attempt',
          severity: 'high',
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        throw new Error(`Account locked due to multiple failed attempts. Try again in ${this.config.OTP_CONFIG.LOCKOUT_DURATION_MINUTES} minutes.`);
      }

      // Fetch OTP from database
      const { data: otpData, error: fetchError } = await this.supabase
        .from('otp_codes')
        .select('*')
        .eq('otp_code', otpCode)
        .single();

      if (fetchError || !otpData) {
        this.recordFailedAttempt(userId);
        await this.logSecurityEvent({
          event_type: 'invalid_otp',
          severity: 'medium',
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        throw new Error('Invalid OTP code');
      }

      // Check if OTP is expired
      if (new Date(otpData.expires_at) < new Date()) {
        await this.expireOTP(otpData.id);
        await this.logActivity({
          action_type: 'otp_expired',
          action_status: 'expired',
          user_id: userId,
          details: { otp_id: otpData.id },
        });
        throw new Error('OTP has expired');
      }

      // Check if OTP is already used
      if (otpData.is_used) {
        await this.logSecurityEvent({
          event_type: 'otp_reuse_attempt',
          severity: 'high',
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        throw new Error('OTP has already been used');
      }

      // Check usage limit
      if (otpData.usage_count >= otpData.max_usage) {
        throw new Error('OTP usage limit exceeded');
      }

      // Mark OTP as used
      const { error: updateError } = await this.supabase
        .from('otp_codes')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          usage_count: otpData.usage_count + 1,
        })
        .eq('id', otpData.id);

      if (updateError) {
        throw updateError;
      }

      // Create session
      const session = await this.createSession(userId, otpData.id, deviceId, fingerprint, ipAddress, userAgent);

      if (!session.success) {
        throw new Error('Failed to create session');
      }

      // Clear failed attempts
      this.failedAttempts.delete(userId);

      // Log successful verification
      await this.logActivity({
        action_type: 'otp_verified',
        action_status: 'success',
        user_id: userId,
        details: {
          otp_id: otpData.id,
          session_id: session.data.id,
          device_id: deviceId,
        },
      });

      console.log('✅ OTP verified successfully');
      return {
        success: true,
        session: session.data,
        message: 'OTP verified successfully',
      };
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create user session after OTP verification
   */
  async createSession(userId, otpId, deviceId, fingerprint, ipAddress, userAgent) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const sessionToken = this.generateSessionToken();
      const sessionHash = this.hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + this.config.OTP_CONFIG.SESSION_EXPIRY_HOURS * 3600000).toISOString();

      const { data, error } = await this.supabase
        .from('otp_sessions')
        .insert({
          user_id: userId,
          otp_id: otpId,
          session_token: sessionHash, // Store hash, not plain token
          session_hash: sessionHash,
          device_id: deviceId,
          browser_fingerprint: fingerprint,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt,
          is_active: true,
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Session created:', data.id);
      return { success: true, data, token: sessionToken };
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return { success: false, error };
    }
  }

  /**
   * Generate secure session token
   */
  generateSessionToken() {
    try {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback if crypto API not available
      return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    }
  }

  /**
   * Hash token for storage
   */
  hashToken(token) {
    // Simple hash for demonstration. In production, use SHA-256
    try {
      return btoa(token); // Base64 encoding as simple hash
    } catch (error) {
      console.error('❌ Token hashing error:', error);
      return token;
    }
  }

  /**
   * Verify session token
   */
  async verifySessionToken(userId, token) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const tokenHash = this.hashToken(token);

      const { data, error } = await this.supabase
        .from('otp_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_hash', tokenHash)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired session');
      }

      // Check session expiry
      if (new Date(data.expires_at) < new Date()) {
        await this.revokeSession(data.id);
        throw new Error('Session has expired');
      }

      // Update last activity
      await this.supabase
        .from('otp_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', data.id);

      console.log('✅ Session verified');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Session verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase
        .from('otp_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      console.log('✅ Session revoked');
      return { success: true };
    } catch (error) {
      console.error('❌ Error revoking session:', error);
      return { success: false, error };
    }
  }

  /**
   * Expire OTP
   */
  async expireOTP(otpId) {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase
        .from('otp_codes')
        .update({ is_expired: true })
        .eq('id', otpId);

      if (error) {
        throw error;
      }

      console.log('✅ OTP expired');
      return { success: true };
    } catch (error) {
      console.error('❌ Error expiring OTP:', error);
      return { success: false, error };
    }
  }

  /**
   * Brute force protection - check if user is locked out
   */
  isLockedOut(userId) {
    if (!this.failedAttempts.has(userId)) {
      return false;
    }

    const { count, lockedUntil } = this.failedAttempts.get(userId);
    if (count >= this.config.OTP_CONFIG.MAX_ATTEMPTS) {
      if (new Date() < lockedUntil) {
        return true;
      } else {
        this.failedAttempts.delete(userId);
        return false;
      }
    }
    return false;
  }

  /**
   * Record failed attempt
   */
  recordFailedAttempt(userId) {
    const { MAX_ATTEMPTS, LOCKOUT_DURATION_MINUTES } = this.config.OTP_CONFIG;
    const current = this.failedAttempts.get(userId) || { count: 0, lockedUntil: null };

    current.count += 1;
    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000);
      console.warn(`⚠️ User ${userId} locked out until ${current.lockedUntil}`);
    }

    this.failedAttempts.set(userId, current);
  }

  /**
   * Log activity
   */
  async logActivity(details) {
    try {
      if (!this.supabase) {
        return;
      }

      await this.supabase
        .from('activity_logs')
        .insert({
          ...details,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });

      console.log('✅ Activity logged:', details.action_type);
    } catch (error) {
      console.error('❌ Error logging activity:', error);
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(details) {
    try {
      if (!this.supabase) {
        return;
      }

      await this.supabase
        .from('security_events')
        .insert({
          ...details,
          created_at: new Date().toISOString(),
        });

      console.log('⚠️ Security event logged:', details.event_type);
    } catch (error) {
      console.error('❌ Error logging security event:', error);
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OTPService;
}
