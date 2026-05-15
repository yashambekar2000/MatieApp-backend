const nodemailer = require('nodemailer');
const logger = require('../configs/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (process.env.NODE_ENV === 'production') {
      // Production email configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true,
        maxConnections: 5,
        rateLimit: 5,
      });
    } else {
      // Development - use ethereal.email for testing
      this.createTestAccount();
    }
  }

  async createTestAccount() {
    try {
      // Generate test SMTP service account from ethereal.email
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      logger.info(`Test email account created: ${testAccount.user}`);
      logger.info(`Preview URL: https://ethereal.email/login`);
    } catch (error) {
      logger.error(`Failed to create test email account: ${error.message}`);
      // Fallback to a simple transporter that logs emails
      this.createFallbackTransporter();
    }
  }

  createFallbackTransporter() {
    // Fallback transporter that just logs emails (for development)
    this.transporter = {
      sendMail: (mailOptions) => {
        logger.info('📧 EMAIL (FALLBACK MODE):');
        logger.info(`To: ${mailOptions.to}`);
        logger.info(`Subject: ${mailOptions.subject}`);
        logger.info(`HTML: ${mailOptions.html?.substring(0, 200)}...`);
        return Promise.resolve({ messageId: 'fallback-' + Date.now() });
      },
    };
  }

  async sendMail(mailOptions) {
    if (!this.transporter) {
      this.initializeTransporter();
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
        ...mailOptions,
      });

      // Log email sending
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Email sent: ${info.messageId}`);
        if (info.previewURL) {
          logger.info(`Preview URL: ${info.previewURL}`);
        }
      }

      return info;
    } catch (error) {
      logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  async sendVerificationEmail(to, verificationToken) {
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Email Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Our App!</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for registering! Please click the button below to verify your email address:</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; 2024 Your Company. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail({
      to,
      subject: 'Verify Your Email Address',
      html,
    });
  }

  async sendPasswordResetEmail(to, resetToken) {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #ff9800;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #ff9800;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <p>This link will expire in 10 minutes. If you didn't request a password reset, please ignore this email or contact support.</p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; 2024 Your Company. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail({
      to,
      subject: 'Password Reset Request',
      html,
    });
  }

  async sendWelcomeEmail(to, name) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Welcome!</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #2196F3;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome ${name}!</h1>
        </div>
        <div class="content">
          <h2>Thanks for joining us!</h2>
          <p>We're excited to have you on board. You've successfully created an account with us.</p>
          <p>Here are some things you can do:</p>
          <ul>
            <li>Complete your profile</li>
            <li>Explore our features</li>
            <li>Connect with other users</li>
          </ul>
          <p>If you have any questions, feel free to reach out to our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; 2024 Your Company. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail({
      to,
      subject: 'Welcome to Our App!',
      html,
    });
  }

  async sendEmailChangeNotification(to, oldEmail, newEmail) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Email Changed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #f44336;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .warning {
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Email Address Changed</h1>
        </div>
        <div class="content">
          <h2>Security Notification</h2>
          <p>Your account email address has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
          <div class="warning">
            <strong>⚠️ Didn't make this change?</strong>
            <p>Please contact our support team immediately to secure your account.</p>
          </div>
          <p>If you made this change, no further action is required.</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>&copy; 2024 Your Company. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail({
      to,
      subject: 'Security Alert: Email Address Changed',
      html,
    });
  }
}

// Export singleton instance
module.exports = new EmailService();