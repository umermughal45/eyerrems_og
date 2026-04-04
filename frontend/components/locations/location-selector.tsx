"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { LOCATION_LEVELS, LocationTreeNode, formatLevelLabel } from "@/lib/location";
import { useLocationTree } from "@/hooks/use-location-tree";

type LocationSelectorProps = {
  value?: string | null;
  onChange: (node: LocationTreeNode | null) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
};

const CLEAR_SELECTION_VALUE = "__clear__";

const findPath = (nodes: LocationTreeNode[], targetId?: string | null): LocationTreeNode[] => {
  if (!targetId) return [];

  for (const node of nodes) {
    if (node.id === targetId) {
      return [node];
    }

    const childPath = findPath(node.children, targetId);
    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
};

export function LocationSelector({
  value,
  onChange,
  label,
  helperText,
  disabled,
}: LocationSelectorProps) {
  const { tree, isLoading, refresh } = useLocationTree();
  const [childrenCache, setChildrenCache] = useState<Record<string, LocationTreeNode[]>>({});
  const [childrenLoading, setChildrenLoading] = useState<Record<string, boolean>>({});
  const loadingRef = useRef<Set<string>>(new Set());
  const [manualInputs, setManualInputs] = useState<Record<number, string>>({});
  const [creatingLocation, setCreatingLocation] = useState<Record<number, boolean>>({});
  const toast = useToast();

  const path = useMemo(() => findPath(tree, value), [tree, value]);

  useEffect(() => {
    if (path.length === 0) {
      return;
    }

    // Load children for each parent in the path that aren't already cached or loading
    path.forEach(async (node) => {
      const parentId = node.id;
      
      // Skip if already cached or currently loading
      if (childrenCache[parentId] || loadingRef.current.has(parentId)) {
        return;
      }

      // Mark as loading
      loadingRef.current.add(parentId);
      setChildrenLoading((prev) => ({ ...prev, [parentId]: true }));
      
      // Fetch children
      try {
        const response = await apiService.locations.getChildren(parentId);
        const responseData = response.data as any;
        const data = responseData?.data ?? responseData;
        setChildrenCache((prev) => ({ ...prev, [parentId]: data }));
      } catch {
        // Swallow errors silently for UI resilience
      } finally {
        loadingRef.current.delete(parentId);
        setChildrenLoading((prev) => {
          const next = { ...prev };
          delete next[parentId];
          return next;
        });
      }
    });
  }, [path, childrenCache]);

  const getOptionsForLevel = (index: number): LocationTreeNode[] => {
    if (index === 0) {
      // Root level: return top-level nodes (no parent)
      return tree.filter(node => !node.parentId);
    }

    const parent = path[index - 1];
    if (!parent) {
      return [];
    }

    // Prefer cached children, fallback to parent.children if available
    const cached = childrenCache[parent.id];
    if (cached && cached.length > 0) {
      return cached;
    }
    
    // If loading, return empty array to show loading state
    if (childrenLoading[parent.id]) {
      return [];
    }
    
    // Fallback to parent.children from tree structure
    return parent.children || [];
  };

  const handleSelection = async (level: number, selectedId: string) => {
    if (selectedId === CLEAR_SELECTION_VALUE) {
      onChange(null);
      // Clear all subsequent levels
      setChildrenCache({});
      setManualInputs({});
      return;
    }

    if (!selectedId) {
      onChange(null);
      return;
    }

    const options = getOptionsForLevel(level);
    const selectedNode = options.find((option) => option.id === selectedId);

    if (selectedNode) {
      onChange(selectedNode);
      
      // Clear manual input for this level
      setManualInputs((prev) => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
      
      // Clear children cache for subsequent levels when a new parent is selected
      const newCache: Record<string, LocationTreeNode[]> = {};
      for (let i = 0; i <= level; i++) {
        const pathNode = path[i];
        if (pathNode) {
          newCache[pathNode.id] = childrenCache[pathNode.id] || [];
        }
      }
      setChildrenCache(newCache);
      
      // Fetch children for the selected node if not already cached
      if (!childrenCache[selectedId] && !childrenLoading[selectedId]) {
        setChildrenLoading((prev) => ({ ...prev, [selectedId]: true }));
        try {
          const response = await apiService.locations.getChildren(selectedId);
          const responseData = response.data as any;
          const data = responseData?.data ?? responseData;
          setChildrenCache((prev) => ({ ...prev, [selectedId]: data }));
        } catch (error) {
          // Swallow errors silently for UI resilience
        } finally {
          setChildrenLoading((prev) => ({ ...prev, [selectedId]: false }));
        }
      }
    }
  };

  const handleCreateLocation = async (level: number, locationName: string) => {
    if (!locationName.trim()) {
      toast.toast({
        title: "Location name required",
        description: "Please enter a location name",
        variant: "destructive",
      });
      return;
    }

    const levelType = LOCATION_LEVELS[level];
    const parentId = level > 0 ? path[level - 1]?.id ?? null : null;

    setCreatingLocation((prev) => ({ ...prev, [level]: true }));
    try {
      const response = await apiService.locations.create({
        name: locationName.trim(),
        type: levelType,
        parentId: parentId,
      });
      
      const responseData = response.data as any;
      const created = responseData?.data ?? responseData;
      
      // Refresh the tree
      await refresh();
      
      // Update cache
      if (parentId) {
        setChildrenCache((prev) => ({
          ...prev,
          [parentId]: [...(prev[parentId] || []), created],
        }));
      }
      
      // Select the newly created location
      onChange(created);
      
      // Clear manual input
      setManualInputs((prev) => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
      
      toast.toast({
        title: "Location created",
        description: `${created.name} has been added successfully.`,
      });
    } catch (error: any) {
      toast.toast({
        title: "Failed to create location",
        description: error?.response?.data?.message || error?.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setCreatingLocation((prev) => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-sm font-semibold">{label}</Label>}
      <div className="space-y-3">
        {LOCATION_LEVELS.map((level, index) => {
          const options = getOptionsForLevel(index);
          const isDisabled = disabled || (index > 0 && !path[index - 1]);
          const selectedValue = path[index]?.id ?? "";
          const loadingChildren = path[index - 1] ? childrenLoading[path[index - 1].id] : false;
          const manualInput = manualInputs[index] || "";
          const isCreating = creatingLocation[index] || false;

          return (
            <div key={level} className="space-y-2">
              <Label className="text-xs text-muted-foreground">{formatLevelLabel(level)}</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    key={`${level}-${selectedValue}`}
                    value={selectedValue}
                    onValueChange={(value) => handleSelection(index, value)}
                    disabled={isDisabled || isLoading || isCreating}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue
                        placeholder={`Select ${formatLevelLabel(level)}`}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CLEAR_SELECTION_VALUE}>Clear selection</SelectItem>
                      {isLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading locations...
                        </SelectItem>
                      ) : loadingChildren ? (
                        <SelectItem value="loading" disabled>
                          Loading children...
                        </SelectItem>
                      ) : options.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          No options available
                        </SelectItem>
                      ) : (
                        options.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Input
                    type="text"
                    placeholder={`Type ${formatLevelLabel(level)} name`}
                    value={manualInput}
                    onChange={(e) => {
                      setManualInputs((prev) => ({ ...prev, [index]: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && manualInput.trim() && !isCreating) {
                        e.preventDefault();
                        handleCreateLocation(index, manualInput);
                      }
                    }}
                    disabled={isDisabled || isLoading || isCreating || !!selectedValue}
                    className="w-40 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateLocation(index, manualInput)}
                    disabled={!manualInput.trim() || isDisabled || isLoading || isCreating || !!selectedValue}
                    className="px-3"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

