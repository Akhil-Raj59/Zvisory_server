import sendEmail from '../utils/sendEmail.js';

/**
 * Lead Email Notification Service
 * Sends marketing notification and user confirmation email.
 */

export async function sendLeadEmails(lead) {
  const marketingRecipient =
    process.env.MARKETING_TEAM_EMAIL ||
    process.env.CONTACT_US_EMAIL ||
    process.env.SMTP_FROM_EMAIL;

  const results = {
    marketingNotificationSent: false,
    userConfirmationSent: false,
    errors: [],
  };

  // 1. Marketing Team Notification
  if (marketingRecipient) {
    try {
      const subject = `🔥 New Lead [${lead.formType || 'Enquiry'}]: ${lead.fullName} (${lead.projectName || lead.city || 'General'})`;

      const marketingHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #124446; padding: 24px; color: #ffffff;">
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #D3A479;">Zvisory Lead Desk</span>
            <h1 style="margin: 6px 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">New Property Lead Captured</h1>
          </div>

          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b; width: 35%;">Full Name</td>
                <td style="padding: 10px 0; font-weight: 700; color: #0f172a;">${lead.fullName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Phone</td>
                <td style="padding: 10px 0; font-weight: 700; color: #124446;">
                  <a href="tel:${lead.countryCode}${lead.phone}" style="color: #124446; text-decoration: none;">${lead.countryCode} ${lead.phone}</a>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Email</td>
                <td style="padding: 10px 0; color: #0f172a;">${lead.email || '<span style="color: #94a3b8;">Not provided</span>'}</td>
              </tr>
              ${
                lead.projectName
                  ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Interested Project</td>
                <td style="padding: 10px 0; font-weight: 700; color: #0f172a;">${lead.projectName}</td>
              </tr>
              `
                  : ''
              }
              ${
                lead.city
                  ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">City / Region</td>
                <td style="padding: 10px 0; color: #0f172a;">${lead.city}</td>
              </tr>
              `
                  : ''
              }
              ${
                lead.developer
                  ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Developer</td>
                <td style="padding: 10px 0; color: #0f172a;">${lead.developer}</td>
              </tr>
              `
                  : ''
              }
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Form Context</td>
                <td style="padding: 10px 0; color: #0f172a;">${lead.formType} (${lead.formLocation})</td>
              </tr>
            </table>

            ${
              lead.message
                ? `
            <div style="background: #f8fafc; border-left: 4px solid #D3A479; padding: 14px; border-radius: 6px; margin-bottom: 24px;">
              <strong style="display: block; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Enquiry Message</strong>
              <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">${lead.message}</p>
            </div>
            `
                : ''
            }

            <!-- Marketing Attribution -->
            <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 12px; color: #475569; margin-top: 16px;">
              <strong style="display: block; font-size: 11px; text-transform: uppercase; color: #334155; margin-bottom: 8px;">Marketing Attribution</strong>
              <div><strong>UTM Source:</strong> ${lead.utmSource || 'direct'}</div>
              <div><strong>UTM Medium:</strong> ${lead.utmMedium || 'none'}</div>
              <div><strong>UTM Campaign:</strong> ${lead.utmCampaign || 'none'}</div>
              <div><strong>Referrer:</strong> ${lead.referrer || 'direct'}</div>
              <div><strong>Submission Page:</strong> ${lead.submissionPage || lead.projectUrl || 'homepage'}</div>
              <div><strong>Device:</strong> ${lead.deviceType || 'unknown'} | <strong>IP:</strong> ${lead.ipAddress || 'unknown'}</div>
            </div>
          </div>
        </div>
      `;

      await sendEmail(marketingRecipient, subject, marketingHtml);
      results.marketingNotificationSent = true;
    } catch (err) {
      console.error('❌ [LEAD_EMAIL_MARKETING_ERROR]', err.message);
      results.errors.push(`Marketing notification error: ${err.message}`);
    }
  }

  // 2. User Confirmation Email (if user provided a valid email)
  if (lead.email && lead.email.includes('@')) {
    try {
      const subject = lead.projectName
        ? `We Received Your Enquiry for ${lead.projectName} | Zvisory`
        : `Thank You for Contacting Zvisory Real Estate Advisory`;

      const userHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #124446; padding: 28px; text-align: center; color: #ffffff;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #D3A479;">ZVISORY</div>
            <p style="margin: 6px 0 0; font-size: 13px; color: #BDD4E7; text-transform: uppercase; letter-spacing: 1px;">Luxury Real Estate Advisory</p>
          </div>

          <div style="padding: 28px; font-size: 15px; line-height: 1.6; color: #334155;">
            <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Hello ${lead.fullName},</h2>
            <p>Thank you for expressing interest ${lead.projectName ? `in <strong>${lead.projectName}</strong>` : 'in our advisory services'}. We have received your enquiry.</p>
            
            <p>A Senior Real Estate Advisor from Zvisory will review your requirements and reach out to you shortly at <strong>${lead.countryCode} ${lead.phone}</strong>.</p>

            ${
              lead.projectName
                ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #D3A479;">Project Selected</span>
              <h3 style="margin: 4px 0 0; color: #124446; font-size: 16px;">${lead.projectName}</h3>
              <p style="margin: 2px 0 0; font-size: 13px; color: #64748b;">${lead.city ? `Location: ${lead.city}` : ''} ${lead.developer ? `| Developer: ${lead.developer}` : ''}</p>
            </div>
            `
                : ''
            }

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              If you have urgent questions, you can reply directly to this email or speak with our concierge desk at +91 98765 43210.
            </p>

            <div style="border-top: 1px solid #e2e8f0; margin-top: 28px; padding-top: 16px; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">Warm regards,<br><strong style="color: #124446;">The Zvisory Advisory Team</strong><br>New Delhi | Gurugram | Mumbai</p>
            </div>
          </div>
        </div>
      `;

      await sendEmail(lead.email, subject, userHtml);
      results.userConfirmationSent = true;
    } catch (err) {
      console.error('❌ [LEAD_EMAIL_USER_CONFIRMATION_ERROR]', err.message);
      results.errors.push(`User confirmation email error: ${err.message}`);
    }
  } else {
    results.userConfirmationSent = true; // No email provided to send confirmation to
  }

  if (results.errors.length > 0) {
    throw new Error(results.errors.join('; '));
  }

  return results;
}

