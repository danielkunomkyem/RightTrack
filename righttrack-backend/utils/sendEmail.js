// Sends email via Brevo's HTTP API instead of raw SMTP. Render's free tier
// blocks outbound SMTP ports (25/465/587) to prevent spam abuse, so
// Nodemailer + Gmail SMTP doesn't work there. Brevo's API runs over normal
// HTTPS (port 443), which isn't blocked.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendOtpEmail(toEmail, otp) {
  const payload = {
    sender: {
      name: "RightTrack",
      email: process.env.BREVO_SENDER_EMAIL, // must be a verified sender in Brevo
    },
    to: [{ email: toEmail }],
    subject: "Your RightTrack verification code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0B2545;">RightTrack Verification</h2>
        <p>Use the code below to complete your login. This code expires in 5 minutes.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0B2545; background: #E8F6F1; padding: 16px; text-align: center; border-radius: 8px;">
          ${otp}
        </p>
        <p style="color: #667085; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo send error:", res.status, data);
    throw new Error(data.message || "Failed to send verification email.");
  }

  console.log(`OTP email sent to ${toEmail} via Brevo — messageId: ${data.messageId}`);
  return data;
}

async function sendSignupVerificationEmail(toEmail, otp, role = "applicant") {
  const accountLabel = role === "admin" ? "adjuster" : "policyholder";
  const payload = {
    sender: {
      name: "RightTrack",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: toEmail }],
    subject: `Verify your RightTrack ${accountLabel} account`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0B2545;">Verify your ${accountLabel} account</h2>
        <p>Enter this one-time code in RightTrack to confirm that you own this email address. It expires in 5 minutes.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0B2545; background: #E8F6F1; padding: 16px; text-align: center; border-radius: 8px;">
          ${otp}
        </p>
        <p style="color: #667085; font-size: 13px;">If you did not create a RightTrack account, you can ignore this email.</p>
      </div>
    `,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo send error (signup verification):", res.status, data);
    throw new Error(data.message || "Failed to send account verification email.");
  }

  console.log(`Signup verification email sent to ${toEmail} via Brevo — messageId: ${data.messageId}`);
  return data;
}

async function sendPasswordResetEmail(toEmail, otp) {
  const payload = {
    sender: {
      name: "RightTrack",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: toEmail }],
    subject: "Your RightTrack password reset code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0B2545;">Reset your RightTrack password</h2>
        <p>Use the code below to reset your password. This code expires in 5 minutes.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0B2545; background: #E8F6F1; padding: 16px; text-align: center; border-radius: 8px;">
          ${otp}
        </p>
        <p style="color: #667085; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
      </div>
    `,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo send error (password reset):", res.status, data);
    throw new Error(data.message || "Failed to send password reset email.");
  }

  console.log(`Password reset email sent to ${toEmail} via Brevo — messageId: ${data.messageId}`);
  return data;
}

async function sendPolicyAssignedEmail(toEmail, policyId, insurer, category) {
  const payload = {
    sender: {
      name: "RightTrack",
      email: process.env.BREVO_SENDER_EMAIL,
    },
    to: [{ email: toEmail }],
    subject: `Your ${insurer} policy number is ready`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0B2545;">Your policy is registered</h2>
        <p>${insurer} has assigned you a policy number for <strong>${category}</strong> claims. Use this when filing a claim on RightTrack:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #0B2545; background: #E8F6F1; padding: 16px; text-align: center; border-radius: 8px;">
          ${policyId}
        </p>
        <p style="color: #667085; font-size: 13px;">You can also find this number anytime under "My Policies" in your RightTrack account.</p>
      </div>
    `,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Brevo send error (policy assigned):", res.status, data);
    // Don't throw — the policy is already created either way; email is a nice-to-have.
    return null;
  }

  console.log(`Policy assigned email sent to ${toEmail} via Brevo — messageId: ${data.messageId}`);
  return data;
}

module.exports = { sendOtpEmail, sendSignupVerificationEmail, sendPasswordResetEmail, sendPolicyAssignedEmail };
