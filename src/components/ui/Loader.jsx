import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader = ({ size = 20, className = "" }) => {
  return <Loader2 className={`animate-spin ${className}`} size={size} />;
};