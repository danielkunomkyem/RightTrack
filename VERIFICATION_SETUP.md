# Organization and Adjuster Verification

RightTrack now treats an organization and its adjusters as separate verified records.

## Policyholder sign-up verification

1. A policyholder submits the sign-up form.
2. The backend creates an unverified account and emails a six-digit sign-up OTP.
3. The OTP expires after five minutes and is limited to five failed attempts.
4. A correct OTP marks the email as verified, returns a signed session, and opens the policyholder dashboard.
5. An unverified policyholder cannot use the normal login flow. They are sent back to the verification screen, where they can request a new code.

Sign-up, login, and password-reset OTPs have separate purposes. A code created for one flow cannot be accepted by another flow.

## Configure the Super Admin

Add the following values to `righttrack-backend/.env` before starting the backend:

```env
SUPERADMIN_NAME=System Administrator
SUPERADMIN_EMAIL=your-admin-email@example.com
SUPERADMIN_PASSWORD=use-a-unique-password-with-at-least-12-characters
```

On startup, the backend creates the Super Admin only when that email does not already exist. The password is hashed with bcrypt and is never included in frontend code. Keep `.env` private and do not commit it.

## Verification sequence

1. An adjuster submits their name, work email, staff/adjuster ID, organization name, CAC number, organization regulatory licence, and supported claim categories.
2. RightTrack creates or matches a permanent `Organization` record using the normalized name, CAC number, and regulatory licence.
3. The organization enters `pending` status. The adjuster also enters `pending` status.
4. A Super Admin logs in with password plus email OTP and opens **Adjusters → Verification Queue**.
5. The Super Admin approves or rejects the organization first.
6. Only after the organization is approved can the Super Admin approve an adjuster linked to it.
7. Every decision records the reviewer, timestamp, status, and reason in an audit trail.
8. Pending, rejected, or suspended adjusters and organizations are blocked by the backend, including when an old token is presented.

## Important routes

All review routes require a valid Super Admin bearer token.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/pending-organizations` | List organization applications |
| `PATCH` | `/api/admin/organizations/:id/approve` | Approve an organization |
| `PATCH` | `/api/admin/organizations/:id/reject` | Reject with a required reason |
| `GET` | `/api/admin/pending-adjusters` | List adjuster applications and organization status |
| `PATCH` | `/api/admin/adjusters/:id/approve` | Approve an adjuster after organization approval |
| `PATCH` | `/api/admin/adjusters/:id/reject` | Reject with a required reason |

## Run and verify

```bash
cd righttrack-backend
npm install
npm test
npm run dev
```

In a second terminal:

```bash
npm install
npm run dev
```

Use the Adjuster sign-up form to submit a sample application. Then use the separate Super Admin login, complete the emailed OTP, approve the organization, and approve the adjuster.
