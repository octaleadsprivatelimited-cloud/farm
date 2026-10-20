/**
 * Kaushik Nursery Policies & Razorpay Compliance Documents
 * Includes:
 * 1. Privacy Policy
 * 2. Terms & Conditions
 * 3. Refund & Cancellation Policy
 * 4. Shipping & Delivery Policy
 * 5. Contact Us / Grievance Redressal
 */

export const policies = {
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How we collect, use, and protect your information",
    lastUpdated: "October 20, 2026",
    content: `
      <h3>1. Information We Collect</h3>
      <p>When you visit Kaushik Nursery, place an order, or request gardening services, we collect personal information you provide to us, including your full name, contact mobile number, email address, shipping and billing address, and service space dimensions.</p>
      
      <h3>2. How We Use Your Information</h3>
      <p>We use the collected information for the following business purposes:</p>
      <ul>
        <li>Processing and fulfilling plant and garden essentials orders.</li>
        <li>Coordinating on-site garden inspections, maintenance, and landscaping appointments.</li>
        <li>Communicating shipment tracking updates, order confirmations, and service schedules.</li>
        <li>Processing payments securely through our authorized payment partner (Razorpay).</li>
        <li>Improving our botanical catalog, service matching algorithms, and customer support.</li>
      </ul>

      <h3>3. Payment Data Security</h3>
      <p>We do not store your credit/debit card numbers, CVVs, or NetBanking passwords on our servers. All financial transactions are securely handled by Razorpay Payment Gateway, which adheres to stringent PCI-DSS Level 1 compliance standards.</p>

      <h3>4. Sharing & Disclosure</h3>
      <p>We never sell, rent, or trade your personal data. We only share essential details (such as address and phone number) with verified delivery logistics partners or assigned nursery gardening specialists exclusively for fulfilling your confirmed orders or service requests.</p>

      <h3>5. Cookies & Local Storage</h3>
      <p>We use local browser storage and standard session cookies to remember your shopping cart items, saved favorites, and session preferences.</p>

      <h3>6. Your Rights & Contact</h3>
      <p>You can request to view, correct, or delete your personal details at any time by writing to our privacy team at <strong>privacy@kaushiknursery.com</strong>.</p>
    `
  },

  terms: {
    id: "terms",
    title: "Terms & Conditions",
    subtitle: "Terms of service governing our products, plant delivery, and gardening visits",
    lastUpdated: "October 20, 2026",
    content: `
      <h3>1. Agreement to Terms</h3>
      <p>By accessing or using the Kaushik Nursery website, purchasing botanicals, or booking gardening services, you agree to be bound by these Terms and Conditions and all applicable laws and regulations of India.</p>

      <h3>2. Plant Product Availability & Natural Variations</h3>
      <p>All live plants, saplings, and botanical products are subject to natural variations in size, foliage density, branching structure, and coloration compared to promotional photographs. We guarantee healthy, well-rooted, and pest-free plants upon dispatch.</p>

      <h3>3. Pricing & Orders</h3>
      <p>All prices listed on the platform are in Indian Rupees (₹ INR) inclusive of applicable taxes unless specified otherwise. We reserve the right to correct pricing errors and cancel orders resulting from inadvertent typographical or system errors.</p>

      <h3>4. Garden Services & On-Site Visits</h3>
      <p>For gardening services (landscaping, maintenance, terrace setup):</p>
      <ul>
        <li>Customers must ensure safe access to the premises, adequate water supply, and electrical connections if required.</li>
        <li>Visits can be rescheduled up to 12 hours prior to the booked slot without penalty.</li>
        <li>Service professionals follow certified horticultural safety practices.</li>
      </ul>

      <h3>5. Payments & Invoicing</h3>
      <p>Payments for orders and initial service deposits are processed via Razorpay. Digital receipts and tax invoices are issued electronically for every completed order.</p>

      <h3>6. Governing Law & Jurisdiction</h3>
      <p>These terms are governed by and construed in accordance with the laws of India. Any disputes arising shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana, India.</p>
    `
  },

  refund: {
    id: "refund",
    title: "Cancellation & Refund Policy",
    subtitle: "Clear, transparent return and refund terms for live plants and services",
    lastUpdated: "October 20, 2026",
    content: `
      <h3>1. Cancellation Policy</h3>
      <p><strong>Product Orders:</strong> You may cancel a plant or garden supply order before it has been dispatched from our nursery. Once an order is handed over to our courier or local delivery partners, dispatch cancellations cannot be accommodated.</p>
      <p><strong>Service Appointments:</strong> You may reschedule or cancel scheduled garden service visits up to 12 hours before the scheduled time slot for a full refund or free rescheduling.</p>

      <h3>2. Transit Damage & Plant Health Guarantee</h3>
      <p>Live plants are delicate living organisms. In the unlikely event that your plant arrives in a damaged condition, severely wilted, or with a broken pot:</p>
      <ul>
        <li>Please take unboxing photos or a short video within <strong>24 hours of delivery</strong>.</li>
        <li>Send the images along with your Order ID to <strong>care@kaushiknursery.com</strong> or WhatsApp support at <strong>+91 98765 43210</strong>.</li>
        <li>Our horticulturist will inspect the issue and approve either an immediate free replacement plant or a 100% refund.</li>
      </ul>

      <h3>3. Refund Processing Timelines</h3>
      <p>Approved refunds are credited back to the original payment source (UPI, Credit/Debit Card, NetBanking) via Razorpay within <strong>5 to 7 working days</strong> according to standard banking clearing cycles.</p>
    `
  },

  shipping: {
    id: "shipping",
    title: "Shipping & Delivery Policy",
    subtitle: "How we carefully package and dispatch plants to your doorstep",
    lastUpdated: "October 20, 2026",
    content: `
      <h3>1. Serviceable Locations</h3>
      <p>We currently provide express nursery delivery across major metropolitan zones including Hyderabad, Bengaluru, Chennai, and Vijayawada, with nationwide courier dispatch for select hardier plants, seeds, and garden essentials.</p>

      <h3>2. Shipping Charges</h3>
      <ul>
        <li><strong>Free Delivery:</strong> All orders with a subtotal of <strong>₹1,000 or above</strong> qualify for complimentary delivery.</li>
        <li><strong>Standard Shipping:</strong> A flat rate of <strong>₹99</strong> applies to orders below ₹1,000.</li>
      </ul>

      <h3>3. Delivery Timelines</h3>
      <ul>
        <li><strong>Local Metropolitan Areas (Hyderabad):</strong> Same-day or Next-day delivery using dedicated nursery temperature-controlled transport.</li>
        <li><strong>Other Cities:</strong> 2 to 4 business days via specialized botanical express logistics partners.</li>
      </ul>

      <h3>4. Botanical Packaging</h3>
      <p>Every plant is thoroughly watered, stabilized with breathable protective mesh, rooted with coco-peat moisture retainers, and packed inside reinforced ventilated corrugation boxes to ensure fresh arrival.</p>

      <h3>5. Shipment Tracking</h3>
      <p>Once dispatched, you will receive real-time SMS / email notifications and tracking links directly viewable in your "My bookings & orders" section.</p>
    `
  },

  contact: {
    id: "contact",
    title: "Contact Us & Grievance Redressal",
    subtitle: "Reach out to our botanical experts, customer care, or nursery headquarters",
    lastUpdated: "October 20, 2026",
    content: `
      <div class="contact-card-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:16px;">
        <div style="background:var(--sand-50,#f8f7f2);padding:20px;border-radius:12px;border:1px solid #e2ded5;">
          <h4 style="margin:0 0 8px;font-size:16px;color:#153e2e;">📍 Nursery Headquarters</h4>
          <p style="margin:0;font-size:14px;color:#49564c;line-height:1.6;">
            <strong>Kaushik Nursery & Botanical Gardens Pvt Ltd</strong><br>
            Plot 42, Botanical Garden Road, Kondapur,<br>
            Hyderabad, Telangana 500084, India
          </p>
        </div>

        <div style="background:var(--sand-50,#f8f7f2);padding:20px;border-radius:12px;border:1px solid #e2ded5;">
          <h4 style="margin:0 0 8px;font-size:16px;color:#153e2e;">📞 Customer Care</h4>
          <p style="margin:0;font-size:14px;color:#49564c;line-height:1.6;">
            <strong>Phone / WhatsApp:</strong> +91 98765 43210<br>
            <strong>Hours:</strong> Mon – Sat: 8:00 AM – 7:30 PM IST<br>
            <strong>General Email:</strong> hello@kaushiknursery.com
          </p>
        </div>

        <div style="background:var(--sand-50,#f8f7f2);padding:20px;border-radius:12px;border:1px solid #e2ded5;">
          <h4 style="margin:0 0 8px;font-size:16px;color:#153e2e;">🛡️ Grievance & Nodal Officer</h4>
          <p style="margin:0;font-size:14px;color:#49564c;line-height:1.6;">
            <strong>Name:</strong> Rajesh Kaushik<br>
            <strong>Email:</strong> grievance@kaushiknursery.com<br>
            <strong>Escalation:</strong> Replies within 24–48 business hours.
          </p>
        </div>
      </div>
    `
  }
};
