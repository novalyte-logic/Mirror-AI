
import React from 'react';
import {
  Radar, RadarChart as RechartsRadar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import { PersonalityTrait } from '../types';

interface Props {
  traits: PersonalityTrait[];
}

export const TraitRadar: React.FC<Props> = ({ traits }) => {
  const data = traits.map(t => ({
    subject: t.name,
    A: t.score,
    fullMark: 100,
  }));

  return (
    <div className="w-full h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#333" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Mirror Profile"
            dataKey="A"
            stroke="#a78bfa"
            fill="#a78bfa"
            fillOpacity={0.4}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
};
