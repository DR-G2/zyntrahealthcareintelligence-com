import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface PsychographData {
  cognitive_stability: number;
  emotional_reactivity: number;
  time_compression_vulnerability: number;
  silence_tolerance: number;
  delegation_confidence: number;
  structure_integrity: number;
}

interface PsychographRadarProps {
  data: PsychographData;
  className?: string;
}

const dimensionLabels: Record<string, string> = {
  cognitive_stability: 'Cognitive Stability',
  emotional_reactivity: 'Emotional Reactivity',
  time_compression_vulnerability: 'Time Pressure',
  silence_tolerance: 'Silence Tolerance',
  delegation_confidence: 'Delegation',
  structure_integrity: 'Structure',
};

export function PsychographRadar({ data, className }: PsychographRadarProps) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    dimension: dimensionLabels[key] || key,
    value: Math.round(value),
    fullMark: 100,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Radar
            name="Psychograph"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
