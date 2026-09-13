const nodemailer = require("nodemailer");

const createTransporter = async () => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (EMAIL_USER && EMAIL_PASS) {
    const cleanPass = EMAIL_PASS.replace(/\s+/g, "");
    const cleanUser = EMAIL_USER.trim();
    const isGmail = (EMAIL_HOST && EMAIL_HOST.includes("gmail")) || cleanUser.endsWith("@gmail.com");

    return nodemailer.createTransport(
      isGmail
        ? {
            service: "gmail",
            auth: {
              user: cleanUser,
              pass: cleanPass,
            },
          }
        : {
            host: EMAIL_HOST,
            port: Number(EMAIL_PORT) || 587,
            secure: Number(EMAIL_PORT) === 465,
            auth: {
              user: cleanUser,
              pass: cleanPass,
            },
          }
    );
  }

  console.warn("[EmailService] Chưa cấu hình EMAIL_USER và EMAIL_PASS trong .env");
  return null;
};

const sendVerificationEmail = async ({ to, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const verifyUrl = `${clientUrl}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 35px 30px; color: #334155; line-height: 1.6; }
          .btn-container { text-align: center; margin: 35px 0; }
          .btn { background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px; box-shadow: 0 4px 10px rgba(37,99,235,0.3); }
          .fallback-link { word-break: break-all; color: #2563eb; font-size: 13px; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Xác Thực Tài Khoản WDP301 SaaS</h1>
          </div>
          <div class="content">
            <p>Xin chào <strong>${name}</strong>,</p>
            <p>Cảm ơn bạn đã đăng ký dịch vụ quản lý chuỗi trọ thông minh trên nền tảng <strong>WDP301 SaaS</strong>. Để kích hoạt tài khoản Chủ trọ và bắt đầu sử dụng, vui lòng xác thực địa chỉ email của bạn.</p>
            
            <div class="btn-container">
              <a href="${verifyUrl}" class="btn" target="_blank">Kích Hoạt Tài Khoản Ngay</a>
            </div>

            <p style="font-size: 13px; color: #64748b;">Liên kết xác thực này có hiệu lực trong vòng <strong>24 giờ</strong>. Nếu bạn không thực hiện yêu cầu này, xin vui lòng bỏ qua email.</p>
            <p style="font-size: 13px; color: #64748b;">Nếu không bấm được vào nút trên, hãy sao chép đường dẫn sau vào trình duyệt:</p>
            <p><a href="${verifyUrl}" class="fallback-link">${verifyUrl}</a></p>
          </div>
          <div class="footer">
            <p>© 2026 WDP301 SaaS Management. Nền tảng quản lý & tự động hóa hóa đơn chuỗi trọ.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Xin chào ${name},

Cảm ơn bạn đã đăng ký tài khoản Chủ trọ trên WDP301 SaaS.
Vui lòng truy cập liên kết sau để kích hoạt tài khoản của bạn (liên kết có hiệu lực trong 24 giờ):

${verifyUrl}

Nếu bạn không thực hiện đăng ký này, xin vui lòng bỏ qua email.
Trân trọng,
Đội ngũ WDP301 SaaS
  `.trim();

  try {
    const mailer = await createTransporter();
    if (mailer) {
      const fromAddress = process.env.EMAIL_FROM || `"WDP301 SaaS Trọ" <${process.env.EMAIL_USER || "noreply@wdp301.vn"}>`;
      await mailer.sendMail({
        from: fromAddress,
        to,
        subject: "Xác thực tài khoản Chủ trọ - WDP301 SaaS",
        text: textContent,
        html,
      });
    }
  } catch (err) {
    console.error(`[EmailService Error] Không thể gửi email đến ${to}:`, err.message);
  }

  return verifyUrl;
};

module.exports = {
  sendVerificationEmail,
};
