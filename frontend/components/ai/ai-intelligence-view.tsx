"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  Send,
  Shield,
  Users,
  Building2,
  Wrench,
  DollarSign,
  BarChart3,
  ChevronDown,
  Info,
  Database,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react"
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { apiService } from "@/lib/api"

// Permission types for module access
type Permission = "finance" | "properties" | "construction" | "hr" | "crm" | "tenants"

// Mock permission check - replace with actual permission system
const hasPermission = (permission: Permission): boolean => {
  // In production, this would check actual user permissions
  // For now, return true for all (can be configured)
  const mockPermissions: Record<Permission, boolean> = {
    finance: true,
    properties: true,
    construction: true,
    hr: true,
    crm: true,
    tenants: true,
  }
  return mockPermissions[permission] ?? false
}

// Backend API Types (matching server/src/services/ai-intelligence/types.ts)
interface DataSource {
  module: string
  table?: string
  fields?: string[]
  time_range?: {
    start: string | Date
    end: string | Date
  }
  filters?: Record<string, any>
}

type InsightType = 'actual' | 'derived' | 'predicted'
type InsightStatus = 'success' | 'insufficient_data' | 'error' | 'degraded'

interface AIInsight {
  value: string | number | boolean | null
  type: InsightType
  confidence: number
  confidence_reason: string
  explanation: string
  data_sources: DataSource[]
  time_range?: {
    start: string | Date
    end: string | Date
  }
  last_computed_at: string | Date
  status: InsightStatus
  metadata?: {
    method?: 'ml' | 'rule_based' | 'insufficient_data'
    confidence_interval?: {
      lower: number
      upper: number
    }
    data_quality_score?: number
    factors?: Array<{ factor: string; impact: number; weight: number }>
    trend?: 'improving' | 'declining' | 'stable'
    indicators?: Record<string, number>
    [key: string]: any
  }
}

interface EngineResult {
  insights: AIInsight[]
  engine_name: string
  computed_at: string | Date
  status: InsightStatus
  errors?: string[]
}

// Frontend AI Insight Component
interface AIInsightCardProps {
  insight: AIInsight
  label: string
}

function AIInsightCard({ insight, label }: AIInsightCardProps) {
  const isPredicted = insight.type === 'predicted'
  const trend = insight.metadata?.trend
  const formatValue = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return "N/A"
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
      return value.toString()
    }
    return String(value)
  }

  const formatDataSources = (sources: DataSource[]): string => {
    return sources.map(s => `${s.module}${s.table ? ` - ${s.table}` : ''}`).join(', ')
  }

  return (
    <Card className={`${isPredicted ? "border-dashed border-primary/40 bg-primary/5" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {label}
            {isPredicted && (
              <Badge variant="outline" className="text-xs">
                Predicted
              </Badge>
            )}
            {insight.status === 'degraded' && (
              <Badge variant="outline" className="text-xs text-orange-500">
                Degraded
              </Badge>
            )}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-medium">{insight.explanation}</p>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1 mb-1">
                      <Database className="h-3 w-3" />
                      <span className="font-medium">Data Source:</span>
                    </div>
                    <p>{formatDataSources(insight.data_sources)}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="font-medium">Confidence:</span>
                      <span>{insight.confidence}%</span>
                    </div>
                    {insight.confidence_reason && (
                      <div className="mt-2">
                        <span className="font-medium">Reason:</span>
                        <p className="mt-1">{insight.confidence_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isPredicted ? "text-primary" : "text-foreground"}`}>
          {formatValue(insight.value)}
        </div>
        {trend && (
          <div
            className={`flex items-center text-xs mt-1 ${
              trend === "improving"
                ? "text-green-600 dark:text-green-400"
                : trend === "declining"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
            }`}
          >
            {trend === "improving" ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : trend === "declining" ? (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            ) : null}
            <span>{trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable'}</span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={insight.status === 'degraded' ? 'outline' : 'secondary'} className="text-xs">
            {insight.confidence}% Confidence
          </Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs cursor-help">
                  <Database className="h-3 w-3 mr-1" />
                  Source
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatDataSources(insight.data_sources)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  )
}

// Empty State Component
function EmptyState({ message, icon: Icon = Brain }: { message: string; icon?: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground text-center">{message}</p>
      </CardContent>
    </Card>
  )
}

// Loading State Component
function LoadingState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Loading AI insights...</p>
      </CardContent>
    </Card>
  )
}

// Permission-gated section wrapper
interface PermissionGateProps {
  permission: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
}

function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  if (!hasPermission(permission)) {
    return (
      fallback || (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <EyeOff className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              You don't have permission to view this section
            </p>
          </CardContent>
        </Card>
      )
    )
  }
  return <>{children}</>
}

// Filter insights: only show those with confidence >= 60% and status success/degraded
function filterValidInsights(insights: AIInsight[]): AIInsight[] {
  return insights.filter(
    (insight) =>
      insight.confidence >= 60 &&
      (insight.status === 'success' || insight.status === 'degraded')
  )
}

// Chat message type for AI Assistant
interface ChatMessageType {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isLoading?: boolean
  error?: string
}

// AI Chat Assistant Component - Ollama Powered
function AIChatAssistant() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I am the AI Assistant for this Real Estate ERP system. I can help you understand the software features and modules. Ask me any questions about the system.",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [serviceStatus, setServiceStatus] = useState<{
    available: boolean
    model: string
    modelAvailable: boolean
    checked: boolean
  }>({
    available: false,
    model: "phi3",
    modelAvailable: false,
    checked: false,
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check AI service status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await apiService.aiChat.getStatus()
        const data = (response.data as any)?.data || response.data
        setServiceStatus({
          available: data.available || false,
          model: data.model || "phi3",
          modelAvailable: data.modelAvailable || false,
          checked: true,
        })
      } catch (error) {
        setServiceStatus((prev) => ({ ...prev, checked: true }))
      }
    }
    checkStatus()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Send message to AI
  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim()
    if (!trimmedMessage || isLoading) return

    // Create user message
    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    }

    // Add user message and loading indicator
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: `loading-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      },
    ])
    setInputMessage("")
    setIsLoading(true)

    try {
      // Build conversation history for context (exclude welcome and loading messages)
      const history = messages
        .filter((m) => m.id !== "welcome" && !m.isLoading && !m.error)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const response = await apiService.aiChat.sendMessage(trimmedMessage, history)
      const data = (response.data as any)?.data || response.data
      
      // Replace loading message with actual response
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isLoading)
        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: data.response || "This information is not available in the system.",
            timestamp: new Date(),
          },
        ]
      })
    } catch (error: any) {
      // Replace loading message with error
      const errorMessage = error.response?.data?.message || error.message || "An error occurred"
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isLoading)
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "I apologize, but I could not process your request. Please try again.",
            timestamp: new Date(),
            error: errorMessage,
          },
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Clear chat history
  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Hello. I am the AI Assistant for this Real Estate ERP system. I can help you understand the software features and modules. Ask me any questions about the system.",
        timestamp: new Date(),
      },
    ])
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              AI Assistant
            </CardTitle>
            <CardDescription>
              Ask questions about the software features and modules
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {serviceStatus.checked && (
              <Badge
                variant={serviceStatus.available && serviceStatus.modelAvailable ? "default" : "destructive"}
                className="text-xs"
              >
                {serviceStatus.available && serviceStatus.modelAvailable
                  ? `${serviceStatus.model} Ready`
                  : "AI Offline"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={messages.length <= 1}
            >
              Clear Chat
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Service Warning */}
          {serviceStatus.checked && !serviceStatus.available && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">AI Service Unavailable</p>
                  <p className="text-muted-foreground mt-1">
                    Ollama is not running. Start it with: <code className="bg-muted px-1 rounded">ollama serve</code>
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {serviceStatus.checked && serviceStatus.available && !serviceStatus.modelAvailable && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-600 dark:text-orange-400">Model Not Installed</p>
                  <p className="text-muted-foreground mt-1">
                    Install the model with: <code className="bg-muted px-1 rounded">ollama pull {serviceStatus.model}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="h-[400px] overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.error && (
                        <div className="mt-2 pt-2 border-t border-destructive/20">
                          <p className="text-xs text-destructive">{message.error}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask about software features, modules, or how to use the system..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !serviceStatus.available || !serviceStatus.modelAvailable}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim() || !serviceStatus.available || !serviceStatus.modelAvailable}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Info Footer */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              This assistant provides information about the software only. It does not access or modify your data.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AIIntelligenceView() {
  const [activeTab, setActiveTab] = useState("overview")
  
  // Engine data states
  const [loading, setLoading] = useState(true)
  const [engineData, setEngineData] = useState<Record<string, EngineResult>>({})
  const [overviewInsights, setOverviewInsights] = useState<AIInsight[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch all engine insights
  const fetchAllInsights = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [enginesResponse, overviewResponse] = await Promise.all([
        apiService.aiIntelligence.getAllEngines().catch((err) => {
          console.error("Failed to fetch engine insights:", err)
          return { data: { engines: {} } }
        }),
        apiService.aiIntelligence.getOverview().catch((err) => {
          console.error("Failed to fetch overview insights:", err)
          return { data: { insights: [] } }
        }),
      ])

      // Extract data from responses
      const enginesData = (enginesResponse.data as any)?.engines || (enginesResponse.data as any)?.data?.engines || {}
      const overviewData = (overviewResponse.data as any)?.insights || (overviewResponse.data as any)?.data?.insights || []

      setEngineData(enginesData)
      setOverviewInsights(filterValidInsights(overviewData))
    } catch (err: any) {
      console.error("Error fetching AI insights:", err)
      setError(err.message || "Failed to load AI insights")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllInsights()
  }, [fetchAllInsights])

  // Get filtered insights for a specific engine
  const getEngineInsights = (engineName: string): AIInsight[] => {
    const engine = engineData[engineName]
    if (!engine) return []
    return filterValidInsights(engine.insights || [])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Smart insights and predictive analytics powered by AI
          </p>
        </div>
      </div>

      {/* Main Content Tabs - Exactly 9 sections as required */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial Intelligence</TabsTrigger>
          <TabsTrigger value="asset-property">Asset & Property</TabsTrigger>
          <TabsTrigger value="construction">Construction</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="crm-revenue">CRM & Revenue</TabsTrigger>
          <TabsTrigger value="tenant">Tenant Intelligence</TabsTrigger>
          <TabsTrigger value="risk">Risk & Anomaly</TabsTrigger>
          <TabsTrigger value="assistant">AI Assistant</TabsTrigger>
        </TabsList>

        {/* 1. Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm text-muted-foreground text-center">{error}</p>
                <Button onClick={fetchAllInsights} className="mt-4">
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : overviewInsights.length === 0 ? (
            <EmptyState message="No insights available at this time. The AI Intelligence module requires sufficient validated data before generating insights." />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {overviewInsights.slice(0, 4).map((insight, idx) => (
                  <AIInsightCard
                    key={idx}
                    insight={insight}
                    label={insight.explanation.split('.')[0] || `Insight ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Additional Insights */}
              {overviewInsights.length > 4 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Additional Insights
                      </CardTitle>
                      <CardDescription>Key findings from data analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {overviewInsights.slice(4).map((insight, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-lg border ${
                              insight.type === 'predicted'
                                ? 'bg-primary/10 border-primary/20'
                                : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {insight.metadata?.trend === 'improving' ? (
                                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                              ) : insight.metadata?.trend === 'declining' ? (
                                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                              ) : (
                                <Info className="h-5 w-5 text-primary mt-0.5" />
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-foreground">
                                  {insight.value !== null && insight.value !== undefined
                                    ? `${insight.value}`
                                    : 'Insight'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {insight.explanation}
                                </p>
                                <div className="flex items-center gap-2 mt-3">
                                  <Badge variant={insight.type === 'predicted' ? 'default' : 'secondary'}>
                                    {insight.type === 'predicted' ? 'Predicted' : insight.type}
                                  </Badge>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="cursor-help">
                                          <Info className="h-3 w-3 mr-1" />
                                          {insight.confidence}% Confidence
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {insight.data_sources.map(s => s.module).join(', ')}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* 2. Financial Intelligence Tab */}
        <TabsContent value="financial" className="space-y-4">
          <PermissionGate permission="finance">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('financial')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient financial data available. The Financial Intelligence engine requires validated transaction data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `Financial Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 3. Asset & Property Intelligence Tab */}
        <TabsContent value="asset-property" className="space-y-4">
          <PermissionGate permission="properties">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('asset')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient property data available. The Asset & Property Intelligence engine requires validated property and financial data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `Property Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 4. Construction Intelligence Tab */}
        <TabsContent value="construction" className="space-y-4">
          <PermissionGate permission="construction">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('construction')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient construction data available. The Construction Intelligence engine requires validated project data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `Construction Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 5. Workforce Intelligence Tab */}
        <TabsContent value="workforce" className="space-y-4">
          <PermissionGate permission="hr">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('workforce')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient workforce data available. The Workforce Intelligence engine requires validated HR and performance data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `Workforce Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 6. CRM & Revenue Intelligence Tab */}
        <TabsContent value="crm-revenue" className="space-y-4">
          <PermissionGate permission="crm">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('crmRevenue')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient CRM data available. The CRM & Revenue Intelligence engine requires validated lead, client, and conversion data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `CRM Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 7. Tenant Intelligence Tab (Internal Only) */}
        <TabsContent value="tenant" className="space-y-4">
          <PermissionGate permission="tenants">
            {loading ? (
              <LoadingState />
            ) : (() => {
              const insights = getEngineInsights('tenant')
              return insights.length === 0 ? (
                <EmptyState message="Insufficient tenant data available. The Tenant Intelligence engine requires validated tenant, payment, and lease data before generating insights." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {insights.map((insight, idx) => (
                    <AIInsightCard
                      key={idx}
                      insight={insight}
                      label={insight.explanation.split('.')[0] || `Tenant Insight ${idx + 1}`}
                    />
                  ))}
                </div>
              )
            })()}
          </PermissionGate>
        </TabsContent>

        {/* 8. Risk & Anomaly Detection Tab */}
        <TabsContent value="risk" className="space-y-4">
          {loading ? (
            <LoadingState />
          ) : (() => {
            const insights = getEngineInsights('operationalAnomaly')
            return insights.length === 0 ? (
              <EmptyState message="Insufficient data for anomaly detection. The Risk & Anomaly engine requires sufficient transaction history before identifying patterns." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight, idx) => (
                  <AIInsightCard
                    key={idx}
                    insight={insight}
                    label={insight.explanation.split('.')[0] || `Risk Insight ${idx + 1}`}
                  />
                ))}
              </div>
            )
          })()}
        </TabsContent>

        {/* 9. AI Assistant Tab - Ollama Powered */}
        <TabsContent value="assistant" className="space-y-4">
          <AIChatAssistant />
        </TabsContent>
      </Tabs>
    </div>
  )
}
