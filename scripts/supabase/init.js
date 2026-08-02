/**
 * Extension Initialization Script
 * Loads after all other scripts and initializes the OTP system
 * Replaces inline script to comply with CSP policy
 */

(async () => {
  try {
    console.log('🚀 Extension initializing...');

    // Wait for OTP system to be ready
    let retries = 0;
    while (!window.otpSystem && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!window.otpSystem) {
      console.error('❌ OTP system failed to load');
      alert('❌ Extension failed to initialize. Please reload.');
      return;
    }

    console.log('✅ OTP system ready');

    // Initialize Auth Gate
    const authGate = new OTPAuthGate();
    await authGate.init(window.otpSystem);
    window.otpAuthGate = authGate;

    console.log('✅ Extension fully initialized');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    console.error('Stack:', error.stack);
    alert('❌ Error: ' + error.message);
  }
})();
