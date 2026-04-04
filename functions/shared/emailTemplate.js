/**
 * Generates a responsive HTML email template.
 * 
 * @param {Object} options
 * @param {string} options.title - The main heading of the email.
 * @param {string} options.content - The HTML content of the email body.
 * @param {Object} [options.action] - Optional primary action button.
 * @param {string} options.action.text - Button text.
 * @param {string} options.action.url - Button URL.
 * @param {string} [options.previewText] - Hidden preview text shown in email clients.
 * @returns {string} The complete HTML email string.
 */
const generateEmailHtml = ({ title, content, action, previewText }) => {
    const primaryColor = '#1a6fa3';
    const backgroundColor = '#f3f4f6';
    const containerColor = '#ffffff';
    const textColor = '#1f2937';
    const mutedColor = '#6b7280';

    const buttonColor = (action && action.color) || primaryColor;
    const buttonRadius = (action && action.rounded) ? '999px' : '8px';
    const buttonHtml = action 
        ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; margin-bottom: 24px;">
            <tr>
                <td align="center" bgcolor="${buttonColor}" style="border-radius: ${buttonRadius};">
                    <a href="${action.url}" target="_blank" style="font-family: sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 28px; border: 1px solid ${buttonColor}; border-radius: ${buttonRadius};">
                        ${action.text}
                    </a>
                </td>
            </tr>
        </table>
        ` 
        : '';

    return `
<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: ${backgroundColor}; color: ${textColor}; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; background-color: ${containerColor}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
        .header { background-color: ${primaryColor}; padding: 0; text-align: center; }
        .header-hero { width: 100%; max-height: 200px; object-fit: cover; display: block; }
        .header-inner { padding: 20px 24px 18px; }
        .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .header-sub { margin: 4px 0 0; color: rgba(255,255,255,0.80); font-size: 13px; }
        .content { padding: 32px 28px; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: ${mutedColor}; border-top: 1px solid #e5e7eb; }
        .footer a { color: ${primaryColor}; text-decoration: none; }
        .info-list { list-style: none; padding: 0; margin: 16px 0; }
        .info-list li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; }
        .info-list li:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: ${mutedColor}; }
        .info-value { font-weight: 500; text-align: right; }
        @media only screen and (max-width: 600px) {
            .content { padding: 24px 16px; }
            .info-list li { flex-direction: column; align-items: flex-start; }
            .info-value { text-align: left; margin-top: 4px; }
        }
    </style>
</head>
<body>
    <div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${previewText || title}
    </div>
    <div style="padding: 24px 12px;">
        <div class="container">
            <div class="header">
                <img class="header-hero" src="https://xn--bjrkvang-64a.no/images/bjorkvang-sommer.png" alt="Bjørkvang forsamlingslokale" width="600">
                <div class="header-inner">
                    <h1>Bjørkvang forsamlingslokale</h1>
                    <p class="header-sub">Helgøens Vel &mdash; Helgøyvegen 219, Nes på Hedmarken</p>
                </div>
            </div>
            <div class="content">
                <h2 style="margin-top: 0; font-size: 20px; color: ${textColor};">${title}</h2>
                ${content}
                ${buttonHtml}
            </div>
            <div class="footer">
                <p style="margin: 0 0 4px;">Dette er en automatisk melding fra Helgøens Vel.</p>
                <p style="margin: 0 0 4px;">Org.nr: 995 519 240 &nbsp;|&nbsp; <a href="mailto:styret@bj%C3%B8rkvang.no">styret@bjørkvang.no</a> &nbsp;|&nbsp; <a href="https://xn--bjrkvang-64a.no">bjørkvang.no</a></p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
};

module.exports = { generateEmailHtml };
