"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiService } from "@/lib/api";

interface TransactionDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tid: string | null;
}

export function TransactionDetailModal({ open, onOpenChange, tid }: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTid = async () => {
      if (!open || !tid) return;
      try {
        setLoading(true);
        setError(null);
        const res: any = await apiService.deals.searchByTID(tid);
        const payload = res?.data?.data || res?.data || null;
        setData(payload);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || "Failed to load transaction details");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchTid();
  }, [open, tid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transaction Detail View</DialogTitle>
          <DialogDescription>{tid ? `TID: ${tid}` : "No TID selected"}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No transaction details found.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4 space-y-2">
              <p className="text-sm font-semibold">Core Entities</p>
              <p className="text-sm">Lead: {data.lead?.name || "—"}</p>
              <p className="text-sm">Client: {data.client?.name || "—"}</p>
              <p className="text-sm">Deals: {data.deals?.length || 0}</p>
              <p className="text-sm">Properties: {data.properties?.length || 0}</p>
              <p className="text-sm">Dealers: {data.dealers?.length || 0}</p>
            </Card>
            <Card className="p-4 space-y-2">
              <p className="text-sm font-semibold">Financial Timeline</p>
              <p className="text-sm">Payments: {data.payments?.length || 0}</p>
              <p className="text-sm">Ledger Entries: {data.ledgerEntries?.length || 0}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(data.ledgerEntries || []).slice(0, 6).map((entry: any) => (
                  <Badge key={entry.id} variant="outline">
                    {entry.entryType}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

