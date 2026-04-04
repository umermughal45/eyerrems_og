"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowDownRight, User, Building2, FileText, CreditCard, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TimelineEntry {
  id: string;
  tid: string;
  entityType: string;
  entityId: string;
  moduleName: string;
  createdAt: string;
  details: any;
  url: string;
}

export function TransactionTimeline({ tid }: { tid: string | null }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tid) return;
    
    const fetchTimeline = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/transactions/${tid}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const json = await res.json();
        if (json.success) {
          setEntries(json.data.timeline || []);
        }
      } catch (e) {
        console.error("Failed to fetch transaction timeline", e);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [tid]);

  if (!tid) return null;

  const getIcon = (type: string) => {
    switch(type) {
      case 'lead': return <User className="h-4 w-4 text-blue-500" />;
      case 'client': return <User className="h-4 w-4 text-green-500" />;
      case 'deal': return <Building2 className="h-4 w-4 text-purple-500" />;
      case 'invoice': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'payment': return <CreditCard className="h-4 w-4 text-indigo-500" />;
      default: return <Link2 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEntityTitle = (entry: TimelineEntry) => {
    if (!entry.details) return entry.entityType.toUpperCase();
    
    switch(entry.entityType) {
      case 'lead': 
      case 'client': 
        return entry.details.name || entry.entityType.toUpperCase();
      case 'deal': 
        return entry.details.title || entry.details.dealCode || 'Deal';
      case 'invoice': 
        return `Invoice #${entry.details.invoiceNumber}`;
      case 'payment': 
        return `Payment ${entry.details.paymentId || ''}`;
      default: 
        return entry.entityType.toUpperCase();
    }
  };

  return (
    <Card className="border-blue-100 shadow-sm overflow-hidden">
      <CardHeader className="py-3 bg-slate-50 border-b">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>Lifecycle Timeline</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[250px] w-full p-4">
          <div className="relative pl-6 space-y-6">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            
            {!loading && entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No lifecycle events recorded yet.</p>
            )}

            {entries.map((entry, idx) => (
              <div key={entry.id} className="relative">
                <div className="absolute -left-[30px] p-1 bg-background border rounded-full shrink-0 z-10 shadow-sm mt-0.5">
                  {getIcon(entry.entityType)}
                </div>
                
                <div className="flex flex-col gap-1.5 ml-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {getEntityTitle(entry)}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-[70px] text-right">
                      {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0 h-4">
                      {entry.moduleName}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0 h-4">
                      {entry.entityType}
                    </Badge>
                  </div>
                  
                  {idx < entries.length - 1 && (
                    <ArrowDownRight className="h-3 w-3 text-muted-foreground/30 absolute -left-5 -bottom-5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
