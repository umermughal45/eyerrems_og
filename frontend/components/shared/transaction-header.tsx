import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";

interface TransactionHeaderProps {
  tid: string | null;
  className?: string;
}

export function TransactionHeader({ tid, className = '' }: TransactionHeaderProps) {
  if (!tid) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-md shadow-sm ${className}`}>
      <Link2 className="h-4 w-4 text-blue-600" />
      <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Global T-ID:</span>
      <Badge variant="outline" className="font-mono text-[11px] bg-white text-blue-700 border-blue-200">
        {tid}
      </Badge>
    </div>
  );
}
