// Links handed to tenants (No-App invoice) must open outside this machine. Set
// VITE_PUBLIC_APP_URL to the public address (dev tunnel / production domain) in FE/.env;
// without it the address the app is currently opened on is used.
export function publicAppUrl() {
  const base = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
  return base.replace(/\/+$/, "");
}

export const publicInvoiceUrl = (token) => `${publicAppUrl()}/i/${token}`;

// The backend only serves issued invoices publicly (a draft can still change): 404 otherwise.
export const canSharePublicInvoice = (status) => !["DRAFT", "CANCELLED"].includes(status);
