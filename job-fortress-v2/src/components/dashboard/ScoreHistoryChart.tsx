import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface ScoreHistoryChartProps {
  data: Array<{
    date: string;        // ISO date string
    score: number;       // determinism_index
    scanId: string;
    deltaText?: string;  // from delta_summary.summary_text
  }>;
  onSelectScan?: (scanId: string) => void;
}

export default function ScoreHistoryChart({ data, onSelectScan }: ScoreHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
        No score history data available
      </div>
    );
  }

  // Format dates as "Jan 15", "Mar 23" format
  const formattedData = data.map((point) => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Determine trend color from last 2 data points
  let trendColor = 'var(--primary)'; // fallback
  if (formattedData.length >= 2) {
    const last = formattedData[formattedData.length - 1].score;
    const secondLast = formattedData[formattedData.length - 2].score;
    const diff = last - secondLast;
    if (diff > 3) {
      trendColor = '#22c55e'; // green
    } else if (Math.abs(diff) <= 3) {
      trendColor = '#f59e0b'; // amber
    } else if (diff < -3) {
      trendColor = '#ef4444'; // red
    }
  }

  // Custom dot component
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={trendColor}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectScan?.(payload.scanId)}
      />
    );
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-background border border-border rounded-lg p-2 text-sm shadow-lg">
        <p className="text-foreground font-semibold">{data.displayDate}</p>
        <p className="text-primary">Score: {data.score}</p>
        {data.deltaText && (
          <p className="text-muted-foreground text-xs mt-1">{data.deltaText}</p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
        <XAxis
          dataKey="displayDate"
          stroke="currentColor"
          style={{ fontSize: '12px' }}
          angle={formattedData.length > 20 ? -45 : 0}
          textAnchor={formattedData.length > 20 ? 'end' : 'middle'}
          height={formattedData.length > 20 ? 60 : 30}
          interval={formattedData.length > 20 ? 'preserveStartEnd' : undefined}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          stroke="currentColor"
          style={{ fontSize: '12px' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={trendColor}
          strokeWidth={2}
          dot={<CustomDot />}
          isAnimationActive={false}
        />
        {/* Show future reference line for single data point */}
        {formattedData.length === 1 && (
          <ReferenceLine
            y={formattedData[0].score}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4 4"
            label={{ value: 'Current', position: 'right', fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
