import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: March 4, 2026</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using JobBachao ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>JobBachao provides AI-powered career risk analysis and skill assessment tools. All scores, projections, and recommendations are generated algorithmically and are for <strong>informational purposes only</strong>. They do not constitute career, financial, or legal advice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Acceptable Use</h2>
            <p>You agree not to: (a) reverse-engineer, scrape, or abuse the Service; (b) submit false, misleading, or harmful data; (c) attempt to bypass rate limits, invite codes, or security measures; (d) use the Service for any unlawful purpose.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Intellectual Property</h2>
            <p>All content, algorithms, branding, and design elements are the intellectual property of JobBachao. You retain ownership of your personal data submitted to the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data Retention</h2>
            <p>Your scan data is retained for a maximum of 90 days and is then automatically deleted. You may request immediate deletion of all your data at any time via the dashboard.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. JobBachao shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to career decisions made based on our analysis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Modifications</h2>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>For questions about these Terms, contact us at <span className="text-primary">support@jobbachao.com</span>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
