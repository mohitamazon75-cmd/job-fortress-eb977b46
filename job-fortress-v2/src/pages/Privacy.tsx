import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: March 4, 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Overview</h2>
            <p>JobBachao is committed to protecting your privacy and complying with the Digital Personal Data Protection (DPDP) Act, 2023. This policy describes how we collect, use, and protect your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> Email address and display name</li>
              <li><strong>Career data:</strong> Industry, skills, experience level, metro tier, LinkedIn URL (if provided), and resume content (if uploaded)</li>
              <li><strong>Usage data:</strong> Scan results, feedback ratings, and interaction events</li>
              <li><strong>Technical data:</strong> IP address (for rate limiting only, not stored long-term), user agent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To generate your AI career risk analysis and personalized recommendations</li>
              <li>To improve our algorithms through aggregate, anonymized analysis</li>
              <li>To prevent abuse and enforce rate limits</li>
              <li>We do <strong>not</strong> sell, rent, or share your personal data with third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Data Retention</h2>
            <p>All scan data is automatically deleted after <strong>90 days</strong>. You may request immediate and permanent deletion of all your data at any time using the "Delete My Data" feature in the dashboard. This performs a cascading deletion of your scans, feedback, profile, and authentication data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Security</h2>
            <p>We use industry-standard encryption (TLS 1.3) for all data in transit. Data at rest is encrypted in our database. Access to personal data is restricted through row-level security policies and authenticated API calls.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Third-Party Services</h2>
            <p>We use the following third-party services to deliver functionality:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>AI/LLM Providers:</strong> For generating analysis (your data is not stored by these providers beyond the request)</li>
              <li><strong>Tavily:</strong> For real-time market and company research (queries only, no personal data sent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Your Rights (DPDP Act Compliance)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right to Access:</strong> View all your data through the dashboard</li>
              <li><strong>Right to Correction:</strong> Re-run scans with corrected information</li>
              <li><strong>Right to Erasure:</strong> Delete all your data instantly via the dashboard</li>
              <li><strong>Right to Grievance Redressal:</strong> Contact us at the email below</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Cookies</h2>
            <p>We use essential session cookies for authentication. We do not use tracking cookies or third-party analytics cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>For privacy concerns or data requests, contact our Data Protection Officer at <span className="text-primary">privacy@jobbachao.com</span>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
