// Operational descriptions for review. The nursery must approve final legal terms before launch.
const draft = (id, title, content) => ({
  id,
  title,
  subtitle: "Business policy draft — awaiting nursery approval",
  lastUpdated: "Pending business review",
  content,
});
export const policies = {
  privacy: draft(
    "privacy",
    "Privacy information",
    "Accounts store the name, sign-in details and contact information you provide. Saved addresses, carts, wishlists, orders, service requests and uploaded files are stored on the backend.\n\nSession cookies keep you signed in. Browser storage holds guest shopping preferences and the selected city.\n\nBooking contact details and files are restricted to your account, nursery administrators and the assigned professional. Payment card entry takes place in the configured payment provider’s checkout.\n\nThe nursery must publish approved privacy terms, retention periods and a verified contact for privacy requests before public launch.",
  ),
  terms: draft(
    "terms",
    "Terms of use",
    "The nursery sells its own products and manages service professionals. Product stock, package availability and final order amounts are checked by the server.\n\nA product order reserves stock for 15 minutes while payment is completed. A service request does not guarantee a professional is available; assignment and subsequent status appear in your account. Service payment becomes available after assignment.\n\nThe nursery must approve its legal business identity, tax treatment, service scope and final terms before accepting public orders. Native Android applications and courier integrations are separate deliverables.",
  ),
  refund: draft(
    "refund",
    "Cancellations and refunds",
    "Eligible product orders can be cancelled from your account before dispatch. The server releases reserved stock. A captured payment for a cancelled eligible order is queued for a full refund through the original provider.\n\nService requests can be cancelled before work starts. For a service already in progress, contact the nursery. Refund status is recorded separately from booking or delivery progress.\n\nThe nursery must publish approved return, replacement and refund terms. Bank credit times and any exceptions require confirmation from the payment provider and the nursery.",
  ),
  shipping: draft(
    "shipping",
    "Delivery information",
    "The current checkout charges ₹99 delivery below a ₹1,000 product subtotal and ₹0 at or above ₹1,000. Final amounts are shown with the saved order.\n\nYour account shows nursery fulfilment states from order placed through delivered. The nursery must confirm serviceable locations, delivery estimates and any courier arrangements.\n\nAutomated courier tracking links, tax invoices and delivery guarantees are not currently offered by this application.",
  ),
  contact: draft(
    "contact",
    "Contact the nursery",
    "Verified nursery support details have not yet been published. Administrators can set the business name, support email, phone and address in Business details.",
  ),
};
