/**
 * Cloudflare Turnstile Verification Utility
 * Verifies Turnstile tokens server-side using Cloudflare's verification API.
 */

const CLOUDFLARE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token, clientIp = '') {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const isPlaceholderKey =
    !secretKey ||
    secretKey === 'your_cloudflare_secret_key' ||
    secretKey === 'dummy_secret_key' ||
    secretKey.startsWith('your_');

  const isProduction = process.env.NODE_ENV === 'production';

  // In production, placeholder key is a critical configuration error
  if (isProduction && isPlaceholderKey) {
    console.error('❌ [TURNSTILE_ERROR] Production environment requires a valid TURNSTILE_SECRET_KEY.');
    return {
      success: false,
      message: 'Server security configuration error. Please contact administrator.',
      isConfigError: true,
    };
  }

  // Development/testing mode fallback handling
  if (isPlaceholderKey) {
    console.warn(
      '⚠️ [TURNSTILE_DEV_MODE] TURNSTILE_SECRET_KEY is unconfigured or a placeholder. Bypassing in development mode.'
    );
    return {
      success: true,
      mode: 'development_bypass',
      warning: 'Turnstile verification bypassed due to placeholder secret key in non-production environment.',
    };
  }

  // If secret key is provided, token is strictly required
  if (!token) {
    return {
      success: false,
      message: 'Turnstile verification token is missing.',
    };
  }

  // Test token bypass for automated CI/test environments
  if (token === 'bypass-dev-token' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
    if (!isProduction) {
      return { success: true, mode: 'test_token' };
    }
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch(CLOUDFLARE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(6000), // 6s timeout
    });

    if (!response.ok) {
      console.error(`❌ [TURNSTILE] HTTP ${response.status} from Cloudflare API`);
      return {
        success: false,
        message: 'Could not communicate with verification service.',
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.warn('⚠️ [TURNSTILE_FAILED] Verification rejected by Cloudflare:', data['error-codes']);
      return {
        success: false,
        message: 'Captcha verification failed. Please refresh and try again.',
        errorCodes: data['error-codes'],
      };
    }

    return {
      success: true,
      hostname: data.hostname,
      challengeTs: data.challenge_ts,
    };
  } catch (err) {
    console.error('❌ [TURNSTILE_EXCEPTION] Failed to verify token:', err);
    return {
      success: false,
      message: 'Verification service error. Please try again later.',
    };
  }
}

