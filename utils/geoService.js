/**
 * Resolve an IP address to approximate geographic location.
 * Uses the free ip-api.com service (no API key needed).
 *
 * @param {string} ip – IPv4 / IPv6 address
 * @returns {Promise<{ country: string, state: string, city: string }>}
 */
export const getGeoFromIP = async (ip) => {
  const fallback = { country: '', state: '', city: '' };

  // Skip private / loopback addresses
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3-second timeout

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return fallback;

    const data = await response.json();

    if (data.status !== 'success') return fallback;

    return {
      country: data.country || '',
      state: data.regionName || '',
      city: data.city || '',
    };
  } catch (error) {
    // Swallow – geo is best-effort
    console.warn('⚠️  IP geo lookup failed:', error.message);
    return fallback;
  }
};

/**
 * Extract the real client IP from an Express request.
 * Handles proxied environments (Vercel, Cloudflare, etc.).
 */
export const extractClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
};

export default getGeoFromIP;
