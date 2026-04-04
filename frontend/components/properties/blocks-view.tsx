"use client"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building, Users, Home, Plus, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { AddBlockDialog } from "./add-block-dialog"

interface BlocksViewProps {
  onBlockSelect?: (blockId: string) => void
  onBlockCreated?: (block: any) => void
}

export function BlocksView({ onBlockSelect, onBlockCreated }: BlocksViewProps) {
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  useEffect(() => {
    fetchBlocks()
  }, [])

  const fetchBlocks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.blocks.getAll()
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const blocksData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setBlocks(Array.isArray(blocksData) ? blocksData : [])
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch blocks")
      setBlocks([])
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Property Blocks</h3>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Block
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : !blocks || blocks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No blocks found</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(blocks || []).map((block) => (
          <Card
            key={block.id}
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onBlockSelect?.(block.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <Badge variant="secondary">
                {block._count?.units || block.units?.length || 0} Units
              </Badge>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-lg">{block.name || "N/A"}</h3>
              <p className="text-sm text-muted-foreground">
                {block.property?.name || block.property || "N/A"}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Home className="h-3 w-3" />
                    <span className="text-xs">Units</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {block._count?.units || block.units?.length || 0}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    <span className="text-xs">Occupied</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {block.units?.filter((u: any) => u.status === "Occupied").length || 0}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Building className="h-3 w-3" />
                    <span className="text-xs">Vacant</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {block.units?.filter((u: any) => u.status === "Vacant").length || 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>
          ))}
        </div>
      )}

      <AddBlockDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={(block) => {
          fetchBlocks()
          if (block?.id) {
            onBlockCreated?.(block)
            onBlockSelect?.(block.id)
          }
        }}
      />
    </div>
  )
}
