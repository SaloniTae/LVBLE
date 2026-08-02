/**
 * OTP Initializer
 * Loads pre-generated OTPs into local storage
 * This allows testing without Supabase
 */

class OTPInitializer {
  /**
   * Initialize OTP system with pre-generated codes
   */
  static initialize() {
    try {
      console.log('🔄 Initializing OTP system with pre-loaded codes...');

      // Check if already initialized
      const stored = localStorage.getItem('otp_system_data');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.otps && data.otps.length > 0) {
          console.log(`✅ OTP system already initialized with ${data.otps.length} codes`);
          return;
        }
      }

      // Initialize with pre-generated OTPs
      const otpData = {
        otps: this.getPreGeneratedOTPs(),
        sessions: {},
        lastInit: new Date().toISOString(),
      };

      localStorage.setItem('otp_system_data', JSON.stringify(otpData));
      console.log(`✅ OTP system initialized with ${otpData.otps.length} pre-generated codes`);
      console.log('📋 OTPs available for testing');
    } catch (error) {
      console.error('❌ OTP initialization error:', error);
    }
  }

  /**
   * Get all pre-generated OTPs
   * 50 unique OTP codes, each valid for 30 days
   */
  static getPreGeneratedOTPs() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days validity

    return [
      { code: 'ABC1DEF2GH', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'B2C3D4E5F6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'C4D5E6F7G8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'D6E7F8G9H0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'E8F9G0H1I2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'F0G1H2I3J4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'G2H3I4J5K6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'H4I5J6K7L8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'I6J7K8L9M0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'J8K9L0M1N2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },

      { code: 'K0L1M2N3O4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'L2M3N4O5P6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'M4N5O6P7Q8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'N6O7P8Q9R0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'O8P9Q0R1S2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'P0Q1R2S3T4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'Q2R3S4T5U6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'R4S5T6U7V8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'S6T7U8V9W0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'T8U9V0W1X2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },

      { code: 'U0V1W2X3Y4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'V2W3X4Y5Z6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'W4X5Y6Z7A8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'X6Y7Z8A9B0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'Y8Z9A0B1C2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'Z0A1B2C3D4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'A2B3C4D5E6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'B4C5D6E7F8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'C6D7E8F9G0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'D8E9F0G1H2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },

      { code: 'E0F1G2H3I4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'F2G3H4I5J6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'G4H5I6J7K8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'H6I7J8K9L0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'I8J9K0L1M2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'J0K1L2M3N4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'K2L3M4N5O6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'L4M5N6O7P8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'M6N7O8P9Q0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'N8O9P0Q1R2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },

      { code: 'O0P1Q2R3S4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'P2Q3R4S5T6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'Q4R5S6T7U8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'R6S7T8U9V0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'S8T9U0V1W2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'T0U1V2W3X4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'U2V3W4X5Y6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'V4W5X6Y7Z8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'W6X7Y8Z9A0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'X8Y9Z0A1B2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },

      { code: 'Y0Z1A2B3C4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'Z2A3B4C5D6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'A4B5C6D7E8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'B6C7D8E9F0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'C8D9E0F1G2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'D0E1F2G3H4', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'E2F3G4H5I6', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'F4G5H6I7J8', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'G6H7I8J9K0', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
      { code: 'H8I9J0K1L2', created: new Date().toISOString(), expires: expiryDate.toISOString(), used: false },
    ];
  }

  /**
   * Get list of available OTPs
   */
  static getAvailableOTPs() {
    try {
      const stored = localStorage.getItem('otp_system_data');
      if (!stored) return [];

      const data = JSON.parse(stored);
      return data.otps.filter(otp => !otp.used);
    } catch (error) {
      console.error('❌ Error getting available OTPs:', error);
      return [];
    }
  }

  /**
   * Reset OTP system (clear all data)
   */
  static reset() {
    try {
      localStorage.removeItem('otp_system_data');
      this.initialize();
      console.log('✅ OTP system reset');
    } catch (error) {
      console.error('❌ Reset error:', error);
    }
  }
}

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    OTPInitializer.initialize();
  });
} else {
  OTPInitializer.initialize();
}

console.log('✅ OTP Initializer loaded');
