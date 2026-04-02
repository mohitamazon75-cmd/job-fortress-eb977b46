import { motion } from 'framer-motion';
import { TrendingUp, MapPin } from 'lucide-react';
import { type GeoArbitrage, type Tier2Alternative, formatCurrency } from '@/lib/scan-engine';

interface GeoArbitrageWidgetProps {
  geoArbitrage: GeoArbitrage;
  tier2?: Tier2Alternative | null;
  pivotRole: string;
  country?: string | null;
}

export default function GeoArbitrageWidget({ geoArbitrage, tier2, pivotRole, country }: GeoArbitrageWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="mb-6"
    >
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Better-Paying Markets
      </h2>
      <p className="text-xs text-muted-foreground mb-4 ml-6">
        Earn more by working remotely for companies in higher-paying markets. 
        "Delta" = how much extra you could earn. "Risk-adjusted" = realistic estimate after accounting for the chance of actually landing the role.
      </p>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-prophet-green/20 bg-prophet-green/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-prophet-green" />
            <span className="text-xs font-bold text-prophet-green uppercase">{geoArbitrage.target_market}</span>
          </div>
          
          <p className="text-xs text-muted-foreground mb-1">As: <span className="font-bold text-foreground">{pivotRole}</span></p>
          
          <div className="space-y-2 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Extra you could earn/mo</span>
              <span className="text-sm font-black text-prophet-green">+{formatCurrency(geoArbitrage.raw_delta_inr_monthly, country)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Realistic estimate/mo</span>
              <span className="text-sm font-bold text-foreground">+{formatCurrency(geoArbitrage.probability_adjusted_delta_inr, country)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Chance of landing role</span>
              <span className="text-xs font-bold text-foreground">{geoArbitrage.geo_probability_pct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Potential gain in 1 year</span>
              <span className="text-sm font-black text-prophet-green">{formatCurrency(geoArbitrage.expected_value_12mo_inr, country)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Time to get there</span>
              <span className="text-xs font-bold text-foreground">{geoArbitrage.fastest_path_weeks} weeks</span>
            </div>
          </div>
        </div>

        {tier2 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase">Tier-2 City Alternative</span>
            </div>

            <p className="text-xs text-muted-foreground mb-1">City: <span className="font-bold text-foreground">{tier2.recommended_city}</span></p>

            <div className="space-y-2 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Salary estimate</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(tier2.salary_estimate_inr, country)}/mo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Chance of transition</span>
                <span className="text-xs font-bold text-foreground">{Math.round(tier2.probability * 100)}%</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 italic">Lower cost of living + high probability = safer fallback path</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
