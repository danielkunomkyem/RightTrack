const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/auth";

async function request(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

export function loginRequest(email, password) {
  return request("/login", { email, password });
}

export function verifyOtpRequest(email, otp, remember = false) {
  return request("/verify-otp", { email, otp, remember });
}

export function resendOtpRequest(email) {
  return request("/resend-otp", { email });
}

export function signupRequest(payload) {
  return request("/signup", payload);
}

export function googleAuthRequest(credential, role, remember) {
  return request("/google", { credential, role, remember });
}

export function forgotPasswordRequest(email) {
  return request("/forgot-password", { email });
}

export function verifyResetOtpRequest(email, otp) {
  return request("/verify-reset-otp", { email, otp });
}

export function resetPasswordRequest(email, otp, newPassword) {
  return request("/reset-password", { email, otp, newPassword });
}

export async function meRequest(token) {
  const res = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Session expired.");
  }
  return data;
}

const ADMIN_BASE_URL = BASE_URL.replace(/\/auth$/, "/admin");

export async function listPendingAdjustersRequest() {
  const res = await fetch(`${ADMIN_BASE_URL}/pending-adjusters`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Couldn't load pending adjusters.");
  return data;
}

export async function approveAdjusterRequest(id) {
  const res = await fetch(`${ADMIN_BASE_URL}/adjusters/${id}/approve`, { method: "PATCH" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Couldn't approve adjuster.");
  return data;
}

export async function rejectAdjusterRequest(id, note) {
  const res = await fetch(`${ADMIN_BASE_URL}/adjusters/${id}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Couldn't reject adjuster.");
  return data;
}

const CLAIMS_BASE_URL = BASE_URL.replace(/\/auth$/, "/claims");

function getToken() {
  return localStorage.getItem("rt_token");
}

async function claimsRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${CLAIMS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

// Applicant, admin, or superadmin — scoped automatically by the backend based on role.
export function listClaimsRequest() {
  return claimsRequest("/");
}

// Applicant: submit a new claim.
export function createClaimRequest(payload) {
  return claimsRequest("/", { method: "POST", body: payload });
}

// Applicant: respond to an action_required flag.
export function reuploadRequest(claimId, documents) {
  return claimsRequest(`/${claimId}/reupload`, { method: "PATCH", body: { documents } });
}

// Applicant: rate a resolved claim.
export function rateClaimRequest(claimId, stars, review) {
  return claimsRequest(`/${claimId}/rate`, { method: "PATCH", body: { stars, review } });
}

// Adjuster: open a submitted claim.
export function startReviewRequest(claimId) {
  return claimsRequest(`/${claimId}/start-review`, { method: "PATCH" });
}

// Adjuster: flag a claim for more information.
export function requestInfoRequest(claimId, notes) {
  return claimsRequest(`/${claimId}/request-info`, { method: "PATCH", body: { notes } });
}

// Adjuster or superadmin: final decision.
export function decideClaimRequest(claimId, status, rejectionCode, notes) {
  return claimsRequest(`/${claimId}/decide`, { method: "PATCH", body: { status, rejectionCode, notes } });
}

// Get the message thread for a claim (policyholder <-> insurer).
export function listClaimMessagesRequest(claimId) {
  return claimsRequest(`/${claimId}/messages`);
}

// Send a message on a claim's thread.
export function sendClaimMessageRequest(claimId, body) {
  return claimsRequest(`/${claimId}/messages`, { method: "POST", body: { body } });
}

// Live list of insurer organizations that have at least one approved adjuster.
export function listInsurersRequest() {
  return claimsRequest("/insurers");
}


const POLICIES_BASE_URL = BASE_URL.replace(/\/auth$/, "/policies");

async function policiesRequest(path = "", { method = "GET", body } = {}) {
  const res = await fetch(`${POLICIES_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

// Adjuster: register a valid policy number for their organization.
export function registerPolicyRequest(policyholderEmail, category) {
  return policiesRequest("", { method: "POST", body: { policyholderEmail, category } });
}

// Adjuster: list all policies registered for their organization.
export function listPoliciesRequest() {
  return policiesRequest("");
}

// Adjuster: deactivate a policy so it can no longer be used for new claims.
export function deactivatePolicyRequest(id) {
  return policiesRequest(`/${id}/deactivate`, { method: "PATCH" });
}

// Any logged-in user: see the policy numbers assigned to their own email.
export function listMyPoliciesRequest() {
  return policiesRequest("/mine");
}
