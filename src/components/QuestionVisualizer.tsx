import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { VisualAspectType, VisualData } from '../types';

interface Props {
  type?: VisualAspectType;
  data?: VisualData;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function QuestionVisualizer({ type, data }: Props) {
  if (!type || type === 'none' || !data) return null;

  if (type === 'bar_chart' && data.data) {
    return (
      <div className="h-64 w-full mt-4 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" label={data.xAxisLabel ? { value: data.xAxisLabel, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis label={data.yAxisLabel ? { value: data.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'pie_chart' && data.data) {
    return (
      <div className="h-64 w-full mt-4 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'coordinate_grid' && data.point) {
    return (
      <div className="flex justify-center mt-4 mb-6">
        <div className="relative w-64 h-64 border-2 border-slate-300 bg-white">
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)', backgroundSize: '10% 10%' }}></div>
          {/* Axes */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2"></div>
          {/* Origin */}
          <div className="absolute left-1/2 top-1/2 text-[10px] -translate-x-full text-slate-500 font-bold pr-1">0</div>
          
          {/* Axis Labels */}
          {data.xAxisLabel && <div className="absolute bottom-2 right-2 text-xs font-bold text-slate-700">{data.xAxisLabel}</div>}
          {data.yAxisLabel && <div className="absolute top-2 left-1/2 ml-2 text-xs font-bold text-slate-700">{data.yAxisLabel}</div>}
          
          {/* The Point - x Range: -10 to 10. y Range: -10 to 10 */}
          {data.point.x >= -10 && data.point.x <= 10 && data.point.y >= -10 && data.point.y <= 10 && (
            <div 
              className="absolute w-3 h-3 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm border-2 border-white z-10"
              style={{
                left: `${50 + (data.point.x * 5)}%`,
                top: `${50 - (data.point.y * 5)}%`
              }}
            ></div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
