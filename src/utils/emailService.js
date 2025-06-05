const sgMail = require("@sendgrid/mail");

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  static async sendVerificationEmail(email, token, fullName) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: "Verify your Peakality account",
      html: `
        <div
          style="
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
          "
        >
          <!-- Logo -->
          <div style="padding: 32px 0 0 0; text-align: center">
            <img
              src="https://res.cloudinary.com/dr2mdfufx/image/upload/v1748632979/Logo_iwwne6.png"
              alt="Peakality"
              style="height: 32px; margin-bottom: 16px"
            />
          </div>
          <!-- Hero Image -->
          <div
            style="
              width: 100%;
              background: #f6f8fa;
              display: flex;
              align-items: center;
              justify-content: center;
            "
          >
            <img
              src="https://res.cloudinary.com/dr2mdfufx/image/upload/v1748633011/32_qmreej.png"
              alt="People collaborating"
              style="width: 100%"
            />
          </div>
          <!-- Main Content -->
          <div style="padding: 32px 32px 0 32px; text-align: center">
            <div
              style="
                color: #1a2028;
                font-size: 36px;
                font-weight: 700;
                margin-bottom: 1.5rem;
                font-weight: 700;       
              "
            >
              Hi ${fullName}
              <div>Don't forget to verify your email address.</div>
            </div>
            <p
              style="
                color: #000000;
                font-size: 18px;
                line-height: 28px;
                margin-bottom: 2rem;
              "
            >
              For security reasons, please help us by verifying your email address.
              Verify within 28 days of first signing up to avoid the deactivation of
              your account.
            </p>
            <a
              href="${verificationUrl}"
              style="
                background-color: #47aea9;
                color: #fff;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 6px;
                font-size: 1rem;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 34px;
              "
            >
              Verify your account
            </a>
          </div>
          <!-- Footer -->
          <div style="padding: 24px 0 0 0; text-align: center; background: #dde1e6">
            <div style="margin-bottom: 8px">
              <a
                href="https://facebook.com/peakality"
                style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634804/Twitter_wfwmj2.png" />
                </a
              >
              <a
                href="https://instagram.com/peakality"
                style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634849/Facebook_qlpunz.png" /></a
              >
              <a
                href="https://linkedin.com/company/peakality"
                style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634803/Instagram_bpuar6.png" /></a
              >
            </div>
            <div style="color: #262626; font-size: 14px; padding-bottom: 8px">
              peakality.com
            </div>
            <div style="color: #262626; font-size: 10px; padding-bottom: 18px">
              © 2025 Peakality
            </div>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error("SendGrid Error:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return false;
    }
  }

  static async sendPasswordResetEmail(email, resetToken, fullName) {
    const resetUrl = `${process.env.FRONTEND_URL}/forgot-password/new?token=${resetToken}`;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: "Reset Your Peakality Password",
      html: `
        <div
          style="
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
          "
        >
          <!-- Logo -->
          <div style="padding: 32px 0 0 0; text-align: center">
            <img
              src="https://res.cloudinary.com/dr2mdfufx/image/upload/v1748632979/Logo_iwwne6.png"
              alt="Peakality"
              style="height: 32px; margin-bottom: 16px"
            />
          </div>
          <!-- Hero Image -->
          <div
            style="
              width: 100%;
              background: #f6f8fa;
              display: flex;
              align-items: center;
              justify-content: center;
            "
          >
            <img
              src="https://res.cloudinary.com/dr2mdfufx/image/upload/v1748633040/89_xf3z3s.png"
              alt="People collaborating"
              style="width: 100%"
            />
          </div>
          <!-- Main Content -->
          <div style="padding: 32px 32px 0 32px; text-align: center">
            <div
              style="
                color: #1a2028;
                font-size: 36px;
                margin-bottom: 1.5rem;
                font-weight: 700;                
                line-height: 120%;
              "
            >
              Hi ${fullName}
              <div>Forgot your password? It happens to the best of us.</div>
            </div>
            <p
              style="
                color: #000000;
                font-size: 18px;
                line-height: 28px;
                margin-bottom: 2rem;
              "
            >
              To reset your password, click the button below. The link will self-destruct after three days.
            </p>
            <a
              href="${resetUrl}"
              style="
                background-color: #47aea9;
                color: #fff;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 6px;
                font-size: 1rem;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 26px;
              "
            >
              Reset your password
            </a>
            <div style = "font-size: 14px; color: #000000; line-height: 28px; margin-bottom: 16px;">If you do not want to change your password or didn't request a reset, you can ignore and delete this email.</div>
          </div>
          <!-- Footer -->
          <div style="padding: 24px 0 0 0; text-align: center; background: #dde1e6">
            <div style="margin-bottom: 8px">
              <a
              href="https://facebook.com/peakality"
              style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634804/Twitter_wfwmj2.png" />
                </a
              >
              <a
                href="https://instagram.com/peakality"
                style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634849/Facebook_qlpunz.png" /></a
              >
              <a
                href="https://linkedin.com/company/peakality"
                style="margin: 0 8px; color: #222"
                >
                  <img src = "https://res.cloudinary.com/dr2mdfufx/image/upload/v1748634803/Instagram_bpuar6.png" /></a
              >
            </div>
            <div style="color: #262626; font-size: 14px; padding-bottom: 8px">
              peakality.com
            </div>
            <div style="color: #262626; font-size: 10px; padding-bottom: 18px">
              © 2025 Peakality
            </div>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
      return true;
    } catch (error) {
      console.error("SendGrid Error:", error);
      if (error.response) {
        console.error(error.response.body);
      }
      return false;
    }
  }
}

module.exports = EmailService;
