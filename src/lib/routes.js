const PUBLIC_ROUTES = {
  "/": "landing",
  "/developers": "developers",
  "/faq": "faq",
  "/blog": "blog",
  "/privacy": "privacy",
  "/terms": "terms",
  "/signup": "signup",
  "/signup/adjuster": "signup",
  "/verify-email": "signup-verify",
  "/login": "login",
  "/login/verify": "login-verify",
  "/forgot-password": "forgot-password",
  "/super-admin/login": "superadmin-login",
};

export const SCREEN_PATHS = {
  landing: "/",
  developers: "/developers",
  faq: "/faq",
  blog: "/blog",
  privacy: "/privacy",
  terms: "/terms",
  signup: "/signup",
  "signup-verify": "/verify-email",
  login: "/login",
  "login-verify": "/login/verify",
  "forgot-password": "/forgot-password",
  "superadmin-login": "/super-admin/login",
};

function decodeSegment(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export function roleHomePath(role) {
  if (role === "admin") return "/adjuster/dashboard";
  if (role === "superadmin") return "/super-admin/dashboard";
  return "/policyholder/dashboard";
}

export function appPath(role, view, claimId = "") {
  if (role === "admin") {
    const paths = {
      dashboard: "/adjuster/dashboard",
      queue: "/adjuster/claims",
      policies: "/adjuster/policies",
      api: "/adjuster/developers",
      billing: "/adjuster/billing",
      settings: "/adjuster/settings",
    };
    return view === "detail"
      ? `/adjuster/claims/${encodeURIComponent(claimId)}`
      : paths[view] || paths.dashboard;
  }

  if (role === "superadmin") {
    const paths = {
      "sa-dashboard": "/super-admin/dashboard",
      "sa-claims": "/super-admin/claims",
      "sa-adjusters": "/super-admin/verification",
      "sa-policyholders": "/super-admin/policyholders",
      settings: "/super-admin/settings",
    };
    return view === "detail"
      ? `/super-admin/claims/${encodeURIComponent(claimId)}`
      : paths[view] || paths["sa-dashboard"];
  }

  const paths = {
    dashboard: "/policyholder/dashboard",
    new: "/policyholder/claims/new",
    claims: "/policyholder/claims",
    policies: "/policyholder/policies",
    settings: "/policyholder/settings",
  };
  return view === "detail"
    ? `/policyholder/claims/${encodeURIComponent(claimId)}`
    : paths[view] || paths.dashboard;
}

export function resolveRoute(pathname) {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  const publicScreen = PUBLIC_ROUTES[normalized];
  if (publicScreen) {
    return {
      screen: publicScreen,
      signupRole: normalized === "/signup/adjuster" ? "admin" : "applicant",
    };
  }

  const parts = normalized.split("/").filter(Boolean);
  const [area, section, item] = parts;

  if (area === "policyholder") {
    if (section === "dashboard" && !item) return { screen: "app", requiredRole: "applicant", view: "dashboard" };
    if (section === "claims" && item === "new") return { screen: "app", requiredRole: "applicant", view: "new" };
    if (section === "claims" && item) return { screen: "app", requiredRole: "applicant", view: "detail", claimId: decodeSegment(item) };
    if (section === "claims" && !item) return { screen: "app", requiredRole: "applicant", view: "claims" };
    if (section === "policies" && !item) return { screen: "app", requiredRole: "applicant", view: "policies" };
    if (section === "settings" && !item) return { screen: "app", requiredRole: "applicant", view: "settings" };
  }

  if (area === "adjuster") {
    if (section === "dashboard" && !item) return { screen: "app", requiredRole: "admin", view: "dashboard" };
    if (section === "claims" && item) return { screen: "app", requiredRole: "admin", view: "detail", claimId: decodeSegment(item) };
    if (section === "claims" && !item) return { screen: "app", requiredRole: "admin", view: "queue" };
    if (section === "policies" && !item) return { screen: "app", requiredRole: "admin", view: "policies" };
    if (section === "developers" && !item) return { screen: "app", requiredRole: "admin", view: "api" };
    if (section === "billing" && !item) return { screen: "app", requiredRole: "admin", view: "billing" };
    if (section === "settings" && !item) return { screen: "app", requiredRole: "admin", view: "settings" };
  }

  if (area === "super-admin") {
    if (section === "dashboard" && !item) return { screen: "app", requiredRole: "superadmin", view: "sa-dashboard" };
    if (section === "claims" && item) return { screen: "app", requiredRole: "superadmin", view: "detail", claimId: decodeSegment(item) };
    if (section === "claims" && !item) return { screen: "app", requiredRole: "superadmin", view: "sa-claims" };
    if (["verification", "organizations", "adjusters"].includes(section) && !item) {
      return { screen: "app", requiredRole: "superadmin", view: "sa-adjusters" };
    }
    if (section === "policyholders" && !item) return { screen: "app", requiredRole: "superadmin", view: "sa-policyholders" };
    if (section === "settings" && !item) return { screen: "app", requiredRole: "superadmin", view: "settings" };
  }

  return { screen: "not-found" };
}
