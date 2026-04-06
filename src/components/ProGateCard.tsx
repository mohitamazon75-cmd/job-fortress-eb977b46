import { Lock, Sparkles } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import ProUpgradeModal from './ProUpgradeModal';

interface ProGateCardProps {
  featureName: string;
  featureDescription: string;
  icon: LucideIcon;
}

// Generate realistic blurred content based on feature type
function getPlaceholderContent(featureName: string): string[] {
  const lowerName = featureName.toLowerCase();

  if (lowerName.includes('resume')) {
    return [
      '• Added 12 ATS keywords · Rewrote 3 bullet points',
      '• Grammar: 8 issues fixed · Passive voice: 4 improvements',
      '• 78% match score with target role',
      '• Top missing keywords: Python, AWS, Project Management',
      '• Recommendations: Expand achievements, quantify impact',
    ];
  }

  if (lowerName.includes('skill')) {
    return [
      '• Week 1-2: Learn Python basics · Week 3-4: Build portfolio',
      '• Resources: 12 curated tutorials · Difficulty: Intermediate',
      '• Time commitment: 40 hours over 8 weeks',
      '• Projects: Build 3 real-world applications',
      '• Certifications aligned: AWS Associate Developer',
      '• Job relevance: 94% match for Target Roles',
    ];
  }

  if (lowerName.includes('salary')) {
    return [
      '• Market gap: ₹2.4L above your current offer',
      '• Benchmark: Senior role at your experience level',
      '• Negotiation script: "Based on industry data..."',
      '• Comparable companies: Amazon, Flipkart, Swiggy',
      '• Salary trend: +12% YoY in your location',
    ];
  }

  if (lowerName.includes('interview')) {
    return [
      '• 47 questions tailored to your target role',
      '• Behavioral: STAR method guide · Technical: Code walkthroughs',
      '• Mock interview video: Get feedback on your delivery',
      '• Top areas to prepare: System Design, Problem Solving',
      '• Practice time: ~2 hours to master key patterns',
    ];
  }

  if (lowerName.includes('analysis')) {
    return [
      '• Profile strength: 7.8/10 · Competitive index: Top 32%',
      '• Weaknesses identified: 4 gaps in your profile',
      '• Improvement plan: 15 actionable steps',
      '• Expected salary increase: +₹3-5L after improvements',
      '• Timeline to goal role: 3-4 months',
    ];
  }

  // Default generic content
  return [
    '• Complete analysis of your professional profile',
    '• Personalized recommendations and insights',
    '• Data-driven strategies to advance your career',
    '• Expert guidance tailored to your situation',
    '• Unlock detailed analytics and actionable steps',
  ];
}

export default function ProGateCard({ featureName, featureDescription, icon: Icon }: ProGateCardProps) {
  const [showModal, setShowModal] = useState(false);
  const placeholderLines = getPlaceholderContent(featureName);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6">
        {/* Header: Icon + Name + Pro Badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">{featureName}</h3>
              <p className="text-xs text-muted-foreground">{featureDescription}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-wider">Pro</span>
          </div>
        </div>

        {/* Blurred Content Preview with Overlay CTA */}
        <div className="relative rounded-xl overflow-hidden bg-muted/30 min-h-[180px] mb-4">
          {/* Blurred Content */}
          <div className="p-4 space-y-2.5 blur-sm opacity-70 select-none pointer-events-none">
            {placeholderLines.map((line, idx) => (
              <div
                key={idx}
                className="h-4 bg-muted rounded animate-pulse"
                style={{
                  width: `${75 + Math.random() * 25}%`,
                  animationDelay: `${idx * 100}ms`,
                }}
              />
            ))}
          </div>

          {/* Overlay CTA */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <Lock className="w-5 h-5 text-primary mb-2.5" />
            <p className="text-sm font-semibold text-foreground mb-3.5 text-center px-4">
              Unlock to see your personalized {featureName.toLowerCase()}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black transition-colors"
            >
              Unlock Pro →
            </button>
          </div>
        </div>

        {/* Pricing Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>₹300/month · Both reports</span>
          </div>
          <span className="font-bold text-primary">Save 44% yearly</span>
        </div>
      </div>

      <ProUpgradeModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
