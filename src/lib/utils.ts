import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLevelColor(level: string) {
  if (level.includes('GCSE')) return 'bg-indigo-100 text-indigo-700';
  if (level.includes('Year')) return 'bg-emerald-100 text-emerald-700';
  if (level.includes('11+')) return 'bg-orange-100 text-orange-700';
  return 'bg-blue-100 text-blue-700';
}
