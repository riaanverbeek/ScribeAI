import { LegalLayout } from "./LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="1 March 2026">
      <h2>1. Introduction</h2>
      <p>
        ScribeAI ("we", "us", "our") is committed to protecting the privacy and security of your personal information.
        This Privacy Policy describes how we collect, use, store, share, and protect the information you provide
        when using our session transcription and analysis platform ("the Service"), accessible at fant-app.com.
      </p>
      <p>
        By using our Service, you consent to the data practices described in this policy. If you do not agree
        with the terms set out below, please do not use our Service.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>2.1 Information you provide directly</h3>
      <ul>
        <li><strong>Account information:</strong> When you register, we collect your name, email address, and password (stored in hashed form).</li>
        <li><strong>Organisation information:</strong> If you create or join an organisation (tenant), we collect the organisation name, domain, and branding preferences.</li>
        <li><strong>Audio recordings:</strong> Audio files you upload or record through the Service for transcription and analysis.</li>
        <li><strong>Session data:</strong> Transcripts, summaries, action items, topics, client information, and other data generated through the Service.</li>
        <li><strong>Payment information:</strong> When you subscribe, payment processing is handled by PayFast and/or Stripe. We do not store your full payment card details.</li>
        <li><strong>Communications:</strong> Any correspondence you send to us, including support requests.</li>
      </ul>

      <h3>2.2 Information collected automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> Pages visited, features used, session durations, and interaction patterns.</li>
        <li><strong>Device information:</strong> Browser type, operating system, device type, and screen resolution.</li>
        <li><strong>Log data:</strong> IP address, access times, and referring URLs.</li>
        <li><strong>Cookies and local storage:</strong> We use cookies for session management and local storage (including IndexedDB) for offline recording functionality.</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve the Service.</li>
        <li>Process audio recordings through AI-powered transcription and analysis.</li>
        <li>Generate transcripts, summaries, action items, and topic analyses.</li>
        <li>Manage your account, subscriptions, and payment processing.</li>
        <li>Send transactional emails (verification, password reset, subscription updates).</li>
        <li>Ensure data isolation between organisations in our multi-tenant architecture.</li>
        <li>Monitor, detect, and prevent fraud, abuse, or security incidents.</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>4. AI Processing</h2>
      <p>
        Your audio recordings and session data are processed using third-party AI services (OpenAI) for
        transcription, summarisation, action item extraction, and topic analysis. By using these features,
        you acknowledge that your audio and text data will be transmitted to these AI service providers
        for processing. We select AI providers that maintain appropriate data handling practices.
      </p>

      <h2>5. Data Sharing</h2>
      <p>We do not sell your personal information. We may share information with:</p>
      <ul>
        <li><strong>AI service providers:</strong> For transcription and analysis processing (OpenAI).</li>
        <li><strong>Payment processors:</strong> PayFast and Stripe for subscription payment handling.</li>
        <li><strong>Email service providers:</strong> Resend for transactional email delivery.</li>
        <li><strong>Cloud infrastructure:</strong> For secure data storage and service hosting.</li>
        <li><strong>Legal authorities:</strong> When required by law, court order, or governmental regulation.</li>
      </ul>

      <h2>6. Data Security</h2>
      <p>
        We implement appropriate technical and organisational measures to protect your personal information,
        including:
      </p>
      <ul>
        <li>Encryption of data in transit (TLS/SSL) and at rest.</li>
        <li>Secure password hashing using bcrypt.</li>
        <li>Multi-tenant data isolation with strict access controls.</li>
        <li>Role-based access control within organisations.</li>
        <li>Regular security assessments and monitoring.</li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>
        We retain your personal information for as long as your account is active or as needed to provide
        the Service. Audio recordings, transcripts, and session data are retained until you delete them or
        close your account. After account deletion, data may be retained in backups for up to 90 days.
      </p>

      <h2>8. Your Rights</h2>
      <p>Subject to applicable law (including the Protection of Personal Information Act 4 of 2013 — POPIA), you have the right to:</p>
      <ul>
        <li>Access your personal information.</li>
        <li>Correct inaccurate or incomplete information.</li>
        <li>Request deletion of your personal information.</li>
        <li>Object to or restrict certain processing activities.</li>
        <li>Export your data in a portable format.</li>
        <li>Withdraw consent where processing is based on consent.</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:privacy@fant-app.com">privacy@fant-app.com</a>.</p>

      <h2>9. Cookies</h2>
      <p>
        We use essential cookies for session management and authentication. We also use local storage
        technologies (including IndexedDB) to enable offline recording functionality. These are necessary
        for the core operation of the Service.
      </p>

      <h2>10. Children's Privacy</h2>
      <p>
        The Service is not intended for use by anyone under the age of 18. We do not knowingly collect
        personal information from children. If you become aware that a child has provided us with personal
        information, please contact us.
      </p>

      <h2>11. International Data Transfers</h2>
      <p>
        Your information may be transferred to and processed in countries other than South Africa,
        including where our AI processing and cloud infrastructure providers operate. We ensure appropriate
        safeguards are in place for such transfers.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by
        posting the updated policy on our website and updating the "Last updated" date. Your continued use
        of the Service after changes constitutes acceptance of the updated policy.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy or our data practices, contact us at:
      </p>
      <ul>
        <li>Email: <a href="mailto:privacy@fant-app.com">privacy@fant-app.com</a></li>
        <li>Website: <a href="https://fant-app.com">fant-app.com</a></li>
      </ul>

      <h2>14. Information Officer</h2>
      <p>
        In terms of POPIA, our Information Officer can be contacted at{" "}
        <a href="mailto:privacy@fant-app.com">privacy@fant-app.com</a> for any requests
        related to the processing of personal information.
      </p>
    </LegalLayout>
  );
}
