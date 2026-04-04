"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocationTree } from "@/hooks/use-location-tree";
import { useSubtree } from "@/hooks/use-subtree";
import { LocationTreeNode, LOCATION_LEVELS, formatLevelLabel } from "@/lib/location";
import { apiService } from "@/lib/api";

type LocationTreePanelProps = {
  selectedId?: string | null;
  onSelect?: (node: LocationTreeNode) => void;
  onNodeAdded?: (node: LocationTreeNode) => void;
  className?: string;
};

const findNodeById = (nodes: LocationTreeNode[], id?: string | null): LocationTreeNode | null => {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const child = findNodeById(node.children, id);
    if (child) {
      return child;
    }
  }
  return null;
};

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

const gatherMatches = (
  nodes: LocationTreeNode[],
  query: string,
  matchIds: Set<string>,
  expandIds: Set<string>,
): boolean => {
  let found = false;
  nodes.forEach((node) => {
    const isMatch = node.name.toLowerCase().includes(query);
    const childMatch = gatherMatches(node.children, query, matchIds, expandIds);
    if (isMatch || childMatch) {
      matchIds.add(node.id);
      if (childMatch) {
        expandIds.add(node.id);
      }
      found = true;
    }
  });
  return found;
};

export function LocationTreePanel({
  selectedId,
  onSelect,
  onNodeAdded,
  className,
}: LocationTreePanelProps) {
  const { tree, isLoading, refresh } = useLocationTree();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebouncedValue(searchTerm.trim().toLowerCase(), 320);
  const toastInstance = useToast();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<typeof LOCATION_LEVELS[number]>(LOCATION_LEVELS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const selectedNode = useMemo(() => findNodeById(tree, selectedId), [tree, selectedId]);
  const subtree = useSubtree(selectedId);

  const matchIds = useMemo(() => {
    const ids = new Set<string>();
    const expandIds = new Set<string>();
    if (debouncedSearch.length > 0) {
      gatherMatches(tree, debouncedSearch, ids, expandIds);
    }
    return { ids, expandIds };
  }, [tree, debouncedSearch]);

  useEffect(() => {
    if (!debouncedSearch || matchIds.expandIds.size === 0) {
      return;
    }
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      matchIds.expandIds.forEach((id) => next.add(id));
      return next;
    });
  }, [debouncedSearch, matchIds.expandIds]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const renderTree = (nodes: LocationTreeNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = node.children.length > 0;
      const isMatch = matchIds.ids.has(node.id) && debouncedSearch.length > 0;
      const isSelected = selectedId === node.id;

      return (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => {
              toggleNode(node.id);
              onSelect?.(node);
            }}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-left transition ${
              isSelected ? "bg-slate-900/5 font-semibold" : "hover:bg-slate-900/5"
            }`}
          >
            <span className="pl-2 text-xs text-muted-foreground">{level > 0 ? Array(level).fill("·").join("") : ""}</span>
            <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              ) : (
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              )}
            </span>
            <span className={`flex-1 text-sm ${isMatch ? "text-amber-600" : ""}`}>{node.name}</span>
            {node.propertyCount !== undefined && (
              <Badge variant="outline" className="text-[10px]">
                {node.propertyCount} properties
              </Badge>
            )}
          </button>
          {hasChildren && isExpanded && (
            <div className="ml-6 border-l border-border/40 pl-2">
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const getNextType = useMemo(() => {
    if (!selectedNode) {
      return LOCATION_LEVELS[0];
    }
    const currentIndex = LOCATION_LEVELS.indexOf(
      selectedNode.type.toLowerCase() as typeof LOCATION_LEVELS[number],
    );
    if (currentIndex === -1 || currentIndex >= LOCATION_LEVELS.length - 1) {
      return LOCATION_LEVELS[LOCATION_LEVELS.length - 1];
    }
    return LOCATION_LEVELS[currentIndex + 1];
  }, [selectedNode]);

  useEffect(() => {
    setNewType(getNextType);
  }, [getNextType]);

  const handleAddLocation = async () => {
    if (!newName.trim()) {
      toastInstance.toast({
        title: "Location name is required",
        variant: "destructive",
      });
      return;
    }
    setIsCreating(true);
    try {
      const response = await apiService.locations.create({
        name: newName.trim(),
        type: newType,
        parentId: selectedNode?.id ?? null,
      });
      const responseData = response.data as any;
      const created = responseData?.data ?? responseData;
      toastInstance.toast({
        title: "Location added",
        description: `${created.name} was created successfully.`,
      });
      setNewName("");
      refresh();
      onNodeAdded?.(created);
    } catch (error) {
      toastInstance.toast({
        title: "Failed to create location",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-10 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      );
    }

    if (tree.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No locations have been created yet. Add a city to get started.
        </p>
      );
    }

    return <div className="space-y-1">{renderTree(tree)}</div>;
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Location hierarchy</h2>
          <p className="text-sm text-muted-foreground">
            Navigate cities, areas, and all derived blocks/plots.
          </p>
        </div>
        {!!selectedNode && (
          <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
            <span>Selected:</span>
            <span className="font-semibold text-foreground">{selectedNode.name}</span>
            <span>{formatLevelLabel(selectedNode.type)}</span>
            <span>
              Subtree properties: {subtree.propertyCount.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 border-b pb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            id="location-search-input"
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(event) => {
              event.stopPropagation();
              setSearchTerm(event.target.value);
            }}
            autoComplete="off"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setExpandedNodes(new Set());
            }}
          >
            Reset
          </Button>
        </div>

        <ScrollArea className="max-h-[380px] space-y-1">{renderContent()}</ScrollArea>
      </div>

      <div className="mt-6 space-y-2 border-t pt-4">
        <Label className="text-sm font-semibold">Add new node</Label>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            id="location-name-input"
            type="text"
            placeholder="Location name (e.g. Phase 6)"
            value={newName}
            onChange={(e) => {
              e.stopPropagation();
              setNewName(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLocation();
              }
            }}
            autoComplete="off"
            disabled={isCreating}
          />
          <Select
            value={newType}
            onValueChange={(value) => {
              setNewType(value as typeof LOCATION_LEVELS[number]);
            }}
            disabled={isCreating}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {formatLevelLabel(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="mt-2 w-full"
          onClick={handleAddLocation}
          disabled={isCreating || !newName.trim()}
        >
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add under {selectedNode ? selectedNode.name : "root"}
        </Button>
      </div>
    </Card>
  );
}

