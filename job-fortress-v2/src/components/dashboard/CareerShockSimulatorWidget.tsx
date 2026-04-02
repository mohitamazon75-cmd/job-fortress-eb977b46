import { motion } from 'framer-motion';
import { Bomb, Clock, AlertTriangle, Shield, TrendingDown, Sparkles } from 'lucide-react';

export interface CareerShockSimulation {
  expected_time_to_rehire_months: number;
  worst_case_scenario_months: number;
  financial_runway_needed_in_months: number;
  salary_drop_percentage: number;
  most_probable_role_offered?: string;
  highest_probability_hiring_industries?: string[];
}

interface Props {
  data: CareerShockSimulation;
}

export default function CareerShockSimulatorWidget({ data }: Props) {
  const salaryDropSevere = data.salary_drop_percentage >= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border-2 border-prophet-red/20 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--prophet-red) / 0.03), hsl(var(--background)), hsl(var(--prophet-red) / 0.02))',
      }}
    >
      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-prophet-red/10 flex items-center justify-center flex-shrink-0">
            <Bomb className="w-5 h-5 text-prophet-red" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                1,000 Futures Simulated
              </h3>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Monte Carlo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              We simulated 1,000 possible career paths for someone in your exact position
            </p>
          </div>
        </div>

        {/* Expected Rehire Time — Hero metric */}
        <div className="rounded-xl border-2 border-prophet-gold/20 bg-prophet-gold/[0.04] p-5 mb-4 text-center">
          <p className="text-[10px] font-black text-prophet-gold uppercase tracking-widest mb-2">Expected Rehire Time</p>
          <p className="text-4xl md:text-5xl font-black text-foreground leading-none">
            {data.expected_time_to_rehire_months}
            <span className="text-lg ml-1">months</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">Out of 1,000 possible futures, this is where most land</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Worst Case */}
          <div className="rounded-xl border border-prophet-red/20 bg-prophet-red/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-prophet-red" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Worst Case</span>
            </div>
            <p className="text-2xl font-black text-prophet-red">
              {data.worst_case_scenario_months}<span className="text-sm">mo</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">95th percentile scenario</p>
          </div>

          {/* Financial Runway */}
          <div className="rounded-xl border border-prophet-gold/20 bg-prophet-gold/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-prophet-gold" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Save For</span>
            </div>
            <p className="text-2xl font-black text-prophet-gold">
              {data.financial_runway_needed_in_months}<span className="text-sm">mo</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Recommended emergency fund</p>
          </div>

          {/* Salary Drop */}
          <div className={`rounded-xl border p-4 ${salaryDropSevere ? 'border-prophet-red/20 bg-prophet-red/[0.04]' : 'border-border bg-background'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className={`w-3.5 h-3.5 ${salaryDropSevere ? 'text-prophet-red' : 'text-muted-foreground'}`} />
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Salary Adj.</span>
            </div>
            <p className={`text-2xl font-black ${salaryDropSevere ? 'text-prophet-red' : 'text-foreground'}`}>
              −{data.salary_drop_percentage}<span className="text-sm">%</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">But AI-augmented roles pay more</p>
          </div>
        </div>

        {/* Most Probable Role & Industries */}
        {(data.most_probable_role_offered || data.highest_probability_hiring_industries?.length) && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {data.most_probable_role_offered && (
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Most Probable Role Offered</p>
                <p className="text-sm font-bold text-foreground">{data.most_probable_role_offered}</p>
              </div>
            )}
            {data.highest_probability_hiring_industries && data.highest_probability_hiring_industries.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Highest Probability Hiring Industries</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.highest_probability_hiring_industries.map((ind, i) => (
                    <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-foreground">{ind}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
