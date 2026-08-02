/**
 * Extension Initialization Script
 * Loads after all other scripts and initializes the OTP system
 * Replaces inline script to comply with CSP policy
 */

(async () => {
  try {
    console.log('🚀 Extension initializing...');

    // OTP is bypassed for this build, so the dashboard unlocks immediately.
    const authGate = new OTPAuthGate();
    await authGate.init(window.otpSystem || null);
    window.otpAuthGate = authGate;

    console.log('✅ Extension fully initialized');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    console.error('Stack:', error.stack);
    alert('❌ Error: ' + error.message);
  }
})();
