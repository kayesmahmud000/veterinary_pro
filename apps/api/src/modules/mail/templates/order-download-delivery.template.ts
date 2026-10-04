export interface OrderDeliveryTemplateItem {
  itemId: string;
  productTitle: string;
  productType: string;
  downloadUrl: string;
  maxDownloads: number;
  remainingDownloads: number;
}

export interface OrderDeliveryTemplateParams {
  orderId: string;
  orderTotalFormatted: string;
  recipientName: string;
  recipientEmail: string;
  items: OrderDeliveryTemplateItem[];
  orderDate?: string;
}

export function generateOrderDownloadDeliveryEmail(
  params: OrderDeliveryTemplateParams
): { subject: string; html: string; text: string } {
  const {
    orderId,
    orderTotalFormatted,
    recipientName,
    recipientEmail,
    items,
    orderDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  } = params;

  const subject = `Your VetraLink Pro Digital Delivery & Download Links [Order #${orderId.slice(0, 8)}]`;

  // HTML Template with clean inline styling
  const itemsHtml = items
    .map(
      (item) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px; background-color: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <span style="display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-radius: 4px; background-color: #ecfdf5; color: #047857; margin-bottom: 6px;">
              ${item.productType.replace(/_/g, " ")}
            </span>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">
              ${item.productTitle}
            </h3>
          </div>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
          Download quota: <strong>${item.remainingDownloads} of ${item.maxDownloads} downloads remaining</strong>.
        </p>
        <a href="${item.downloadUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; background-color: #0f766e; color: #ffffff; text-align: center;">
          Download Digital Asset &rarr;
        </a>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">
          Link generates a 15-minute secure download session. You may click this button up to ${item.remainingDownloads} more times.
        </p>
      </div>`
    )
    .join("");

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
            <td style="padding: 32px 32px 24px 32px; background-color: #0f766e; text-align: left;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                VETRALINK PRO
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #ccfbf1;">
                Clinical AgTech & Digital Veterinary Platform
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                Thank you for your purchase, ${recipientName}!
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Your payment of <strong>${orderTotalFormatted}</strong> has been confirmed. Below are the secure download links for your purchased clinical protocols, eBooks, and digital tools.
              </p>

              <!-- Order Summary Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 8px; color: #64748b;">Order ID:</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #1e293b; text-align: right; font-family: monospace;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748b;">Date:</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #1e293b; text-align: right;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 8px; color: #64748b;">Licensed To:</td>
                  <td style="padding: 4px 8px; font-weight: 600; color: #1e293b; text-align: right;">${recipientEmail}</td>
                </tr>
              </table>

              <!-- Digital Line Items -->
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                Your Digital Assets
              </h3>
              ${itemsHtml}

              <!-- Anti-Piracy Notice -->
              <div style="border-left: 4px solid #0f766e; background-color: #f0fdfa; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 24px;">
                <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0f766e;">
                  Dynamic Anti-Piracy Watermarking Notice
                </h4>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #334155;">
                  All eBooks and PDF protocols are dynamically watermarked with your identity, order ID, and cryptographic verification QR code. Unauthorized distribution, sharing, or public hosting is strictly prohibited.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 8px 0;">
                Questions or issues with your downloads? Contact our veterinary support team at <a href="mailto:support@vetralink.pro" style="color: #0f766e; text-decoration: none;">support@vetralink.pro</a>.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} VetraLink Pro. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plaintext fallback
  const itemsText = items
    .map(
      (item) => `
- ${item.productTitle} (${item.productType.replace(/_/g, " ")})
  Quota: ${item.remainingDownloads} of ${item.maxDownloads} downloads remaining
  Download Link: ${item.downloadUrl}
`
    )
    .join("");

  const text = `VETRALINK PRO — DIGITAL ORDER CONFIRMATION & DOWNLOADS
=====================================================

Thank you for your purchase, ${recipientName}!
Your payment of ${orderTotalFormatted} has been confirmed.

ORDER DETAILS:
- Order ID: ${orderId}
- Date: ${orderDate}
- Licensed To: ${recipientEmail}

YOUR DIGITAL ASSETS:
${itemsText}
ANTI-PIRACY WATERMARKING NOTICE:
All eBooks and PDF protocols are dynamically watermarked with your identity,
order ID, and cryptographic verification QR code. Unauthorized distribution
or sharing is strictly prohibited.

Need help? Contact support@vetralink.pro.
(c) ${new Date().getFullYear()} VetraLink Pro. All rights reserved.`;

  return { subject, html, text };
}
