import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { VisualAspectType, VisualData } from '../types';

interface Props {
  type?: VisualAspectType;
  data?: VisualData;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const GRID_VALUES = [-10, -8, -6, -4, -2, 2, 4, 6, 8, 10];

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

  if (type === 'coordinate_grid' && (data.point || data.points?.length)) {
    const points = data.points?.length ? data.points : data.point ? [data.point] : [];

    return (
      <div className="flex justify-center mt-4 mb-6">
        <div className="relative w-80 h-80 border-2 border-slate-300 bg-white">
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)', backgroundSize: '10% 10%' }}></div>
          {/* Axes */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 -translate-x-1/2"></div>
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2"></div>
          {GRID_VALUES.map(value => (
            <React.Fragment key={`axis-${value}`}>
              <div
                className="absolute top-1/2 h-2 w-0.5 bg-slate-700 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${50 + value * 5}%` }}
              />
              <div
                className="absolute top-[51.5%] -translate-x-1/2 text-[10px] font-semibold text-slate-600"
                style={{ left: `${50 + value * 5}%` }}
              >
                {value}
              </div>
              <div
                className="absolute left-1/2 h-0.5 w-2 bg-slate-700 -translate-x-1/2 -translate-y-1/2"
                style={{ top: `${50 - value * 5}%` }}
              />
              <div
                className="absolute left-[52%] -translate-y-1/2 text-[10px] font-semibold text-slate-600"
                style={{ top: `${50 - value * 5}%` }}
              >
                {value}
              </div>
            </React.Fragment>
          ))}
          {/* Origin */}
          <div className="absolute left-1/2 top-1/2 text-[10px] -translate-x-full text-slate-500 font-bold pr-1">0</div>
          
          {/* Axis Labels */}
          {data.xAxisLabel && <div className="absolute bottom-2 right-2 text-xs font-bold text-slate-700">{data.xAxisLabel}</div>}
          {data.yAxisLabel && <div className="absolute top-2 left-1/2 ml-2 text-xs font-bold text-slate-700">{data.yAxisLabel}</div>}
          
          {/* Points - x/y range: -10 to 10 */}
          {points.filter(point => point.x >= -10 && point.x <= 10 && point.y >= -10 && point.y <= 10).map((point, index) => (
            <div 
              key={`${point.x}-${point.y}-${index}`}
              className="absolute w-3.5 h-3.5 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm border-2 border-white z-10"
              style={{
                left: `${50 + (point.x * 5)}%`,
                top: `${50 - (point.y * 5)}%`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'l_shape' && data.lShape) {
    const { totalWidth, totalHeight, cutoutWidth, cutoutHeight, unit = 'cm' } = data.lShape;
    const topWidth = totalWidth - cutoutWidth;
    const rightHeight = totalHeight - cutoutHeight;
    const viewWidth = 260;
    const viewHeight = 200;
    const padding = 28;
    const scale = Math.min((viewWidth - padding * 2) / totalWidth, (viewHeight - padding * 2) / totalHeight);
    const left = padding;
    const top = padding;
    const x = (value: number) => left + value * scale;
    const y = (value: number) => top + value * scale;
    const points = [
      [x(0), y(0)],
      [x(topWidth), y(0)],
      [x(topWidth), y(cutoutHeight)],
      [x(totalWidth), y(cutoutHeight)],
      [x(totalWidth), y(totalHeight)],
      [x(0), y(totalHeight)],
    ].map(point => point.join(',')).join(' ');

    return (
      <div className="flex justify-center mt-4 mb-6">
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="w-full max-w-md rounded-lg border border-slate-200 bg-white">
          <polygon points={points} fill="#dbeafe" stroke="#1d4ed8" strokeWidth="3" />
          <line x1={x(0)} y1={y(totalHeight) + 14} x2={x(totalWidth)} y2={y(totalHeight) + 14} stroke="#475569" strokeWidth="1.5" />
          <text x={(x(0) + x(totalWidth)) / 2} y={y(totalHeight) + 27} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">{totalWidth}{unit}</text>
          <line x1={x(0) - 14} y1={y(0)} x2={x(0) - 14} y2={y(totalHeight)} stroke="#475569" strokeWidth="1.5" />
          <text x={x(0) - 22} y={(y(0) + y(totalHeight)) / 2} textAnchor="middle" transform={`rotate(-90 ${x(0) - 22} ${(y(0) + y(totalHeight)) / 2})`} className="fill-slate-700 text-[10px] font-semibold">{totalHeight}{unit}</text>
          <line x1={x(0)} y1={y(0) - 12} x2={x(topWidth)} y2={y(0) - 12} stroke="#475569" strokeWidth="1.5" />
          <text x={(x(0) + x(topWidth)) / 2} y={y(0) - 16} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">{topWidth}{unit}</text>
          <line x1={x(topWidth)} y1={y(cutoutHeight) - 10} x2={x(totalWidth)} y2={y(cutoutHeight) - 10} stroke="#475569" strokeWidth="1.5" />
          <text x={(x(topWidth) + x(totalWidth)) / 2} y={y(cutoutHeight) - 14} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">{cutoutWidth}{unit}</text>
          <line x1={x(totalWidth) + 12} y1={y(cutoutHeight)} x2={x(totalWidth) + 12} y2={y(totalHeight)} stroke="#475569" strokeWidth="1.5" />
          <text x={x(totalWidth) + 22} y={(y(cutoutHeight) + y(totalHeight)) / 2} textAnchor="middle" transform={`rotate(90 ${x(totalWidth) + 22} ${(y(cutoutHeight) + y(totalHeight)) / 2})`} className="fill-slate-700 text-[10px] font-semibold">{rightHeight}{unit}</text>
        </svg>
      </div>
    );
  }

  return null;
}
