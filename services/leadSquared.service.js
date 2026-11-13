/**
 * LeadSquared CRM Integration Service
 * Dedicated service to capture or sync leads into LeadSquared CRM.
 */

export function isLeadSquaredConfigured() {
  const url = process.env.LEADSQUARED_API_URL;
  const key = process.env.LEADSQUARED_API_KEY;
  const secret = process.env.LEADSQUARED_API_SECRET;

  if (!url || !key || !secret) return false;
  if (
    key === 'your_leadsquared_api_key' ||
    secret === 'your_leadsquared_api_secret' ||
    url.includes('your-leadsquared') ||
    key.startsWith('your_')
  ) {
    return false;
  }
  return true;
}

/**
 * Splits full name into first and last name.
 */
function splitName(fullName = '') {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const firstName = parts.slice(0, -1).join(' ');
  const lastName = parts[parts.length - 1]; // Fixed syntax error here
  return { firstName, lastName };
}

/**
 * Sync lead data to LeadSquared CRM.
 * @param {Object} lead Lead document or snapshot
 * @returns {Promise<{ status: string, externalId?: string, message?: string }>}
 */
export async function syncLeadToLeadSquared(lead) {
  if (!isLeadSquaredConfigured()) {
    console.warn(
      '⚠️ [LEADSQUARED_PENDING] Credentials are not configured or are placeholders. CRM sync marked as configuration_required.'
    );
    return {
      status: 'configuration_required',
      message:
        'LeadSquared credentials (LEADSQUARED_API_KEY, LEADSQUARED_API_SECRET, LEADSQUARED_API_URL) are placeholders or missing.',
    };
  }

  // Clean and normalize API URL to prevent double /v2/ or missing slashes
  let apiUrl = (process.env.LEADSQUARED_API_URL || '').replace(/\/+$/, '');
  if (apiUrl.endsWith('/v2')) {
    apiUrl = apiUrl.slice(0, -3);
  }
  const apiKey = process.env.LEADSQUARED_API_KEY;
  const apiSecret = process.env.LEADSQUARED_API_SECRET;

  const { firstName, lastName } = splitName(lead.fullName);

  // Standard LeadSquared Attribute List
  const attributes = [
    { Attribute: 'FirstName', Value: firstName },
    { Attribute: 'LastName', Value: lastName || '-' },
    { Attribute: 'EmailAddress', Value: lead.email || '' },
    { Attribute: 'Phone', Value: `${lead.countryCode || '+91'}${lead.phone}` },
    { Attribute: 'Source', Value: lead.utmSource || 'Website Organic' },
    { Attribute: 'mx_Country_Code', Value: lead.countryCode || '+91' },
    { Attribute: 'mx_Form_Type', Value: lead.formType || 'general_enquiry' },
    { Attribute: 'mx_Form_Location', Value: lead.formLocation || 'website' },
    { Attribute: 'Notes', Value: lead.message || '' },
  ];

  if (lead.projectName) {
    attributes.push({ Attribute: 'mx_Project_Name', Value: lead.projectName });
  }
  if (lead.projectSlug) {
    attributes.push({ Attribute: 'mx_Project_Slug', Value: lead.projectSlug });
  }
  if (lead.city) {
    attributes.push({ Attribute: 'mx_City', Value: lead.city });
  }
  if (lead.developer) {
    attributes.push({ Attribute: 'mx_Developer', Value: lead.developer });
  }
  if (lead.projectUrl) {
    attributes.push({ Attribute: 'mx_Project_URL', Value: lead.projectUrl });
  }
  if (lead.utmMedium) {
    attributes.push({ Attribute: 'mx_UTM_Medium', Value: lead.utmMedium });
  }
  if (lead.utmCampaign) {
    attributes.push({ Attribute: 'mx_UTM_Campaign', Value: lead.utmCampaign });
  }
  if (lead.utmTerm) {
    attributes.push({ Attribute: 'mx_UTM_Term', Value: lead.utmTerm });
  }
  if (lead.utmContent) {
    attributes.push({ Attribute: 'mx_UTM_Content', Value: lead.utmContent });
  }
  if (lead.referrer) {
    attributes.push({ Attribute: 'mx_Referrer', Value: lead.referrer });
  }
  if (lead.landingPage) {
    attributes.push({ Attribute: 'mx_Landing_Page', Value: lead.landingPage });
  }
  if (lead.submissionPage) {
    attributes.push({ Attribute: 'mx_Submission_Page', Value: lead.submissionPage });
  }

  // Lead.Capture API endpoint
  const endpoint = `${apiUrl}/v2/LeadManagement.svc/Lead.Capture?accessKey=${encodeURIComponent(
    apiKey
  )}&secretKey=${encodeURIComponent(apiSecret)}`;

  // 🧪 Testing Console Logs
  console.log('🔍 [LEADSQUARED_REQUEST] Target Endpoint:', endpoint);
  console.log('📦 [LEADSQUARED_PAYLOAD]:', JSON.stringify(attributes, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attributes),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    console.log(`📡 [LEADSQUARED_RESPONSE] Status: ${response.status} ${response.statusText}`);

    // Read response as text first to prevent empty body JSON parsing crashes
    const responseText = await response.text();
    console.log('📥 [LEADSQUARED_RAW_RESPONSE]:', responseText || '[Empty Body]');

    let data = {};
    if (responseText && responseText.trim().length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('❌ [LEADSQUARED_PARSE_ERROR] Failed to parse response as JSON:', parseErr);
        throw new Error(`Invalid JSON response from LeadSquared: ${responseText}`);
      }
    }

    if (!response.ok || data.Status === 'Error') {
      const errorMsg =
        data.ExceptionMessage || data.Message || responseText || `HTTP error ${response.status}`;
      
      // Gracefully handle duplicate leads so the outbox queue doesn't keep retrying
      if (data.ExceptionType === 'MXDuplicateEntryException') {
        console.warn('⚠️ [LEADSQUARED_DUPLICATE] Lead already exists in CRM. Treating as synced.');
        return {
          status: 'synced',
          externalId: 'duplicate_existing_lead',
          rawResponse: data,
        };
      }

      console.error('❌ [LEADSQUARED_ERROR]', errorMsg);
      throw new Error(`LeadSquared API Error: ${errorMsg}`);
    }

    const externalId =
      data.Message?.Id || data.Message?.LeadId || data.LeadId || 'synced';

    console.log(`✅ [LEADSQUARED_SYNCED] Lead ${lead._id || lead.phone} successfully synced with ID: ${externalId}`);

    return {
      status: 'synced',
      externalId,
      rawResponse: data,
    };
  } catch (err) {
    console.error('❌ [LEADSQUARED_EXCEPTION]', err.message);
    throw err; // Rethrow for outbox retry handling
  }
}