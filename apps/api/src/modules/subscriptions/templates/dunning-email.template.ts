import { DunningStage } from "@vetralink/shared-types";

export interface DunningEmailTemplateParams {
  stage: DunningStage;
  recipientName: string;
  recipientEmail: string;
  farmName?: string | null;
  planName: string;
  billingInterval?: string;
  amountDueFormatted?: string;
  portalUrl: string;
  gracePeriodEndDate?: string;
  failedDate?: string;
}

export function generateDunningEmail(params: DunningEmailTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    stage,
    recipientName,
    recipientEmail,
    farmName,
    planName,
    billingInterval = "MONTHLY",
    amountDueFormatted = "your subscription renewal",
    portalUrl,
    gracePeriodEndDate,
    failedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  } = params;

  let subject: string;
  let headerColor: string;
  let badgeText: string;
  let badgeBg: string;
  let badgeColor: string;
  let headline: string;
  let mainMessage: string;
  let urgencyBoxHtml: string;
  let buttonText: string;

  switch (stage) {
    case DunningStage.DAY_1:
      subject = `Action Required: Payment failed for your VetraLink Pro subscription`;
      headerColor = "#0284c7"; // Sky Blue
      badgeText = "NOTICE — 3-DAY GRACE PERIOD ACTIVE";
      badgeBg = "#e0f2fe";
      badgeColor = "#0369a1";
      headline = "Payment Unsuccessful — Grace Period Active";
      mainMessage = `We were unable to process your automatic renewal payment of <strong>${amountDueFormatted}</strong> for your <strong>${planName}</strong> plan (${billingInterval}).<br><br>
        Don't worry: your <strong>3-day grace period is now active</strong>. Your livestock records, milk logs, and farm management features remain fully accessible.`;
      urgencyBoxHtml = `
        <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #0369a1; line-height: 1.5;">
            <strong>Grace Period Active:</strong> You have until <strong>${gracePeriodEndDate ?? "3 days from today"}</strong> to update your billing information before your account experiences any operational restrictions.
          </p>
        </div>`;
      buttonText = "Update Payment Method & Settle Invoice";
      break;

    case DunningStage.DAY_3:
      subject = `Urgent: Your VetraLink Pro grace period expires today`;
      headerColor = "#d97706"; // Amber
      badgeText = "URGENT — GRACE PERIOD EXPIRING TODAY";
      badgeBg = "#fef3c7";
      badgeColor = "#92400e";
      headline = "Urgent: Final Day of Grace Period";
      mainMessage = `This is an urgent notice regarding your VetraLink Pro subscription for <strong>${planName}</strong> (${amountDueFormatted}).<br><br>
        Today is the <strong>final day of your 3-day grace period</strong>. If payment details are not updated within the next 24 hours, your account will be placed into <strong>restricted read-only mode</strong>, preventing new animal entries, milk production logs, and telehealth consultations.`;
      urgencyBoxHtml = `
        <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
            <strong>Account Restriction Warning:</strong> Service access will be restricted tomorrow unless payment is confirmed. Please update your card immediately to avoid disruption to your farm operations.
          </p>
        </div>`;
      buttonText = "Prevent Account Restriction & Pay Now";
      break;

    case DunningStage.DAY_7:
    default:
      subject = `Final Notice: Your VetraLink Pro subscription is suspended / pending termination`;
      headerColor = "#dc2626"; // Red
      badgeText = "FINAL NOTICE — IMMEDIATE ACTION REQUIRED";
      badgeBg = "#fee2e2";
      badgeColor = "#991b1b";
      headline = "Final Notice: Subscription Suspended";
      mainMessage = `Your VetraLink Pro subscription for <strong>${planName}</strong> is now <strong>7 days past due</strong>.<br><br>
        Your account services have been suspended or scheduled for permanent termination. To restore full access to your herd records, farm analytics, and veterinary consultations, please update your billing details and settle the outstanding balance immediately.`;
      urgencyBoxHtml = `
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
            <strong>Pending Cancellation:</strong> Failure to settle your balance today will result in cancellation of your subscription plan and revocation of advanced AgTech ERP modules.
          </p>
        </div>`;
      buttonText = "Reactivate Subscription Immediately";
      break;
  }

  const farmDetailHtml = farmName
    ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;"><strong>Farm:</strong> ${farmName}</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background-color: ${headerColor}; text-align: left;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                VETRALINK PRO
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.9);">
                Subscription Billing & Account Management
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <span style="display: inline-block; padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 4px; background-color: ${badgeBg}; color: ${badgeColor}; margin-bottom: 16px;">
                ${badgeText}
              </span>

              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                ${headline}
              </h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hello ${recipientName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${mainMessage}
              </p>

              ${farmDetailHtml}

              ${urgencyBoxHtml}

              <!-- Subscription Info Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 28px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #475569;">
                  <tr>
                    <td style="padding: 4px 0;"><strong>Subscription Plan:</strong></td>
                    <td style="padding: 4px 0; text-align: right;">${planName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;"><strong>Billing Interval:</strong></td>
                    <td style="padding: 4px 0; text-align: right;">${billingInterval}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;"><strong>Attempt Date:</strong></td>
                    <td style="padding: 4px 0; text-align: right;">${failedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0;"><strong>Amount Due:</strong></td>
                    <td style="padding: 4px 0; text-align: right; color: #0f172a; font-weight: 700;">${amountDueFormatted}</td>
                  </tr>
                </table>
              </div>

              <!-- Action Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; background-color: ${headerColor}; color: #ffffff; text-align: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                      ${buttonText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you recently updated your payment method or believe this notification was sent in error, you may safely verify your status on the Customer Portal or reach out to support.
              </p>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Need assistance? Contact VetraLink Pro Support at <a href="mailto:support@vetralink.pro" style="color: #0f766e; text-decoration: none;">support@vetralink.pro</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f1f5f9; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                &copy; ${new Date().getFullYear()} VETRALINK PRO. All rights reserved.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                This billing notification was sent to ${recipientEmail}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
VETRALINK PRO — ${subject}

Hello ${recipientName},

${mainMessage.replace(/<[^>]*>/g, "")}

Plan: ${planName} (${billingInterval})
Amount Due: ${amountDueFormatted}
Date: ${failedDate}

Update your payment details here:
${portalUrl}

If you need help, contact us at support@vetralink.pro.

(c) ${new Date().getFullYear()} VetraLink Pro.
`;

  return { subject, html, text };
}
