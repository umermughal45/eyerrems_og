"use client"

import { useState, useMemo } from "react"
import { 
  Search, ChevronDown, ChevronRight, Book, LayoutDashboard, 
  Building2, Users, DollarSign, Hammer, Mail, UserCircle, 
  Shield, Settings, Brain, Bell, Briefcase, FileText, Home
} from "lucide-react"
import type React from "react"

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface FAQ {
  question: string
  answer: React.ReactNode
}

interface SupportModule {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  faqs: FAQ[]
}

// ─── CONTENT (ACCURATE TO REMS SOFTWARE) ─────────────────────────────────────

const SUPPORT_MODULES: SupportModule[] = [
  {
    id: "dashboard",
    title: "Dashboard & Overview",
    icon: LayoutDashboard,
    description: "Learn how the main dashboard calculates and presents top-level company statistics.",
    faqs: [
      {
        question: "What does the Dashboard show?",
        answer: "The Dashboard provides a real-time overview of your real estate business. It aggregates data from all modules, showing Revenue, Expenses, active Properties, Occupancy Rates, and recent activity."
      },
      {
        question: "How are the top statistic cards calculated?",
        answer: "Data is pulled live from the Finance and Properties modules. Total Revenue sums all incoming transactions (rent + sales). Active Units counts available vs occupied units. Stats automatically update behind the scenes."
      },
      {
        question: "Can I customize the charts?",
        answer: "Currently, charts are auto-generated based on the last 12 months of financial and tenant activity. Custom date filtering is available directly on the specialized finance or properties pages."
      }
    ]
  },
  {
    id: "properties",
    title: "Properties & Units",
    icon: Building2,
    description: "Master the structure of your buildings, floors, and individual property units.",
    faqs: [
      {
        question: "How do I add a new property?",
        answer: "Navigate to the Properties module and click 'Add Property'. You must provide a Name, Type (Commercial, Residential), and location details. Once added, you can define the physical structure (Floors and Units)."
      },
      {
        question: "What is the difference between a Floor and a Unit?",
        answer: "Properties contain Floors (e.g., Ground Floor, Level 1). Floors contain Units (e.g., Shop 1, Apartment 101). Units are the tangible assets you lease or sell. A Unit cannot exist without being assigned to a Floor."
      },
      {
        question: "How does property listing and status work?",
        answer: "A Unit can be marked as 'Available', 'Occupied', or 'Under Maintenance'. Occupied units automatically link to active Tenant leases. Real-time status changes are instantly reflected in standard vacancy reports."
      }
    ]
  },
  {
    id: "tenants",
    title: "Tenant Portal (Leasing)",
    icon: Home, // We'll map this below since Home isn't in the top import, let's just use Building2 or Users
    description: "Manage tenant lifecycles, rent collections, and active leases.",
    faqs: [
      {
        question: "How are tenants added to the system?",
        answer: "Tenants are added in the Tenant Portal. You assign an active Tenant to an 'Available' Unit. This action locks the Unit status to 'Occupied' and initiates the rent ledger."
      },
      {
        question: "How is tenant data structurally stored?",
        answer: "Tenant profiles store contact details, lease start/end dates, security deposit amounts, and KYC documents. The system permanently links this data to their rent payment history."
      },
      {
        question: "How does lease expiry tracking work?",
        answer: "The system runs automated background checks against the 'Lease End Date'. When an expiry approaches within 30 days, the tenant is flagged in the 'Lease Expiry' report and a notification is dispatched."
      }
    ]
  },
  {
    id: "crm",
    title: "CRM & Leads",
    icon: UserCircle,
    description: "Track prospective buyers, renters, and sales pipeline metrics.",
    faqs: [
      {
        question: "How is lead data entered?",
        answer: "Leads can be added manually through the CRM module by clicking 'New Lead', specifying Name, Contact, Source (Walk-in, Social Media), and their budget."
      },
      {
        question: "How does the sales pipeline work?",
        answer: "The CRM uses a Kanban-style pipeline. Leads move through stages: New → Contacted → Qualified → Negotiation → Won/Lost. Drag and drop leads to update their status."
      },
      {
        question: "What happens when a lead is marked 'Won'?",
        answer: "A 'Won' lead is effectively converted into a Client or Tenant. You can then formally assign them a property or unit and begin generating invoices."
      }
    ]
  },
  {
    id: "finance",
    title: "Finance & Accounting",
    icon: DollarSign,
    description: "Deep dive into double-entry bookkeeping, trial balances, and transaction flows.",
    faqs: [
      {
        question: "How are finance entries created?",
        answer: "You can create manual journal entries, but most entries (like Rent Receipts or Payroll Payments) are automatically generated by the software when you perform operations in other modules."
      },
      {
        question: "How is Chart of Accounts connected to transactions?",
        answer: "Every transaction requires a 'Debit' account and a 'Credit' account from your Chart of Accounts. For example, receiving cash for rent debits 'Cash on Hand' and credits 'Rental Income'."
      },
      {
        question: "How are financial reports generated?",
        answer: "The system automatically calculates Trial Balances, P&L, and Balance Sheets in real-time by aggregating the running totals of all matched Debit and Credit transactions."
      }
    ]
  },
  {
    id: "construction",
    title: "Construction Management",
    icon: Hammer,
    description: "Track project costs, labor, and building materials for active sites.",
    faqs: [
      {
        question: "How are construction records managed?",
        answer: "Construction projects act as major Cost Centers. You log specific costs against a project, categorizing them as Material, Labor, or Equipment expenses."
      },
      {
        question: "How does project cost tracking work?",
        answer: "When a material purchase is logged in Construction, it automatically hits the Finance module, ensuring that your overall company expenses reflect ongoing building costs."
      }
    ]
  },
  {
    id: "hr",
    title: "HR & Payroll",
    icon: Users,
    description: "Manage your internal employees, salaries, and attendance records.",
    faqs: [
      {
        question: "How does the Attendance Portal work?",
        answer: "Employees can clock in/out through the system. Total hours are calculated and aggregated per month, mapping directly into the Pending Leaves and Output logs."
      },
      {
        question: "How is Payroll processed?",
        answer: "Payroll aggregates the base salary with any recorded commissions from the CRM, deducts unpaid leave fines, and generates a final payable salary slip affecting the Finance module."
      }
    ]
  },
  {
    id: "mail",
    title: "Internal Mail",
    icon: Mail,
    description: "Communicate securely with other system users and staff.",
    faqs: [
      {
        question: "How does sending and receiving work?",
        answer: "Internal Mail works globally within your company. You can compose a message selecting an internal recipient from the dropdown. The message routes instantly to their Inbox."
      },
      {
        question: "What differentiates the Inbox and Sent folders?",
        answer: "Inbox stores mail addressed to you, dynamically updating the unread badge in the top navigation bar. Sent stores historical records of communications you've dispatched."
      }
    ]
  },
  {
    id: "notifications",
    title: "Reminders & Notifications",
    icon: Bell,
    description: "Stay ahead of critical dates and system alerts.",
    faqs: [
      {
        question: "Where do notifications come from?",
        answer: "The system generates them automatically based on triggers (e.g., Lead assignments, lease expiries, internal messages, or direct mentions)."
      },
      {
        question: "Can I set manual reminders?",
        answer: "Yes, you can schedule custom timestamped alerts within the notification center to remind yourself to follow up on specific deals or tenant issues."
      }
    ]
  },
  {
    id: "roles",
    title: "Roles & Permissions",
    icon: Shield,
    description: "Secure your data by controlling who can see and do what.",
    faqs: [
      {
        question: "How do Roles work?",
        answer: "You can create custom roles (e.g., 'Junior Accountant', 'Sales Agent'). Each role has a strict checklist of Read/Write/Delete permissions for every individual module."
      },
      {
        question: "What happens if a user lacks permission?",
        answer: "The software dynamically hides non-permitted modules from their sidebar and forcefully rejects unauthorized API requests at the server level for ultimate security."
      }
    ]
  },
  {
    id: "settings",
    title: "System Settings",
    icon: Settings,
    description: "Configure global variables like branding, currency, and timezone.",
    faqs: [
      {
        question: "How does General Settings impact the software?",
        answer: "Currency symbols and timezones defined here automatically propagate across all invoices, ledgers, and timestamps. Changing the Invoice Prefix alters how future receipts are numbered."
      },
      {
        question: "How does Branding work?",
        answer: "Uploading a logo in Settings replaces the default logo on the sidebar and is dynamically embedded into printable documents like invoices and tenant agreements."
      }
    ]
  }
]

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaqs, setExpandedFaqs] = useState<Record<string, boolean>>({})

  // Filter logic
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORT_MODULES

    const query = searchQuery.toLowerCase()
    return SUPPORT_MODULES.map(module => {
      // If module title matches, keep all FAQs
      if (module.title.toLowerCase().includes(query) || module.description.toLowerCase().includes(query)) {
        return module
      }
      // Otherwise, filter FAQs
      const matchingFaqs = module.faqs.filter(faq => 
        faq.question.toLowerCase().includes(query) || 
        (typeof faq.answer === 'string' && faq.answer.toLowerCase().includes(query))
      )
      return { ...module, faqs: matchingFaqs }
    }).filter(module => module.faqs.length > 0)
  }, [searchQuery])

  const toggleFaq = (moduleId: string, faqIndex: number) => {
    const key = `${moduleId}-${faqIndex}`
    setExpandedFaqs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    const all: Record<string, boolean> = {}
    filteredModules.forEach(m => {
      m.faqs.forEach((_, i) => {
        all[`${m.id}-${i}`] = true
      })
    })
    setExpandedFaqs(all)
  }

  const collapseAll = () => setExpandedFaqs({})

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[200px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-6 py-16 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-violet-500/20 text-violet-400 rounded-xl">
              <Book className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Software Help Center</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl leading-relaxed mb-8">
            Complete, detailed documentation for navigating the REMS software platform. 
            Learn how modules connect, how data flows, and master every feature.
          </p>

          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text"
              placeholder="Search for answers, modules, or features..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-xl shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12 items-start">
        
        {/* Left Sidebar Table of Contents */}
        <div className="hidden md:block w-72 flex-shrink-0 sticky top-24">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-3">Documentation Topics</h3>
          <nav className="space-y-1">
            {SUPPORT_MODULES.map(module => (
              <a 
                key={module.id} 
                href={`#module-${module.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              >
                <module.icon className="w-4 h-4" />
                {module.title}
              </a>
            ))}
          </nav>

          <div className="mt-8 px-3">
            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-xl p-4">
              <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" /> Need more help?
              </h4>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                If you cannot find the answer to your question in this documentation, contact your system administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0 pb-20 w-full">
          {/* Controls */}
          {filteredModules.length > 0 && (
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/60">
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? `Showing results for "${searchQuery}"` : "All Documentation"}
              </p>
              <div className="flex gap-3">
                <button onClick={expandAll} className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">Expand All</button>
                <span className="text-slate-700">|</span>
                <button onClick={collapseAll} className="text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors">Collapse All</button>
              </div>
            </div>
          )}

          {filteredModules.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                We couldn't find any documentation matching "{searchQuery}". Try adjusting your search terms.
              </p>
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-16">
              {filteredModules.map(module => (
                <section key={module.id} id={`module-${module.id}`} className="scroll-mt-24">
                  {/* Module Header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <module.icon className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1.5">{module.title}</h2>
                      <p className="text-sm text-slate-400 leading-relaxed text-balance">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  {/* Module FAQs */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
                    {module.faqs.map((faq, index) => {
                      const isExpanded = !!expandedFaqs[`${module.id}-${index}`]
                      const isLast = index === module.faqs.length - 1

                      return (
                        <div key={index} className={`border-slate-800/80 ${!isLast ? 'border-b' : ''}`}>
                          <button
                            onClick={() => toggleFaq(module.id, index)}
                            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/40 transition-colors group"
                          >
                            <span className={`text-sm font-medium pr-8 transition-colors ${isExpanded ? 'text-violet-300' : 'text-slate-200 group-hover:text-white'}`}>
                              {faq.question}
                            </span>
                            <div className={`p-1 rounded-md transition-all ${isExpanded ? 'bg-violet-500/20 text-violet-400' : 'text-slate-500 group-hover:bg-slate-700/50 group-hover:text-slate-300'}`}>
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="px-5 pb-6 pt-1">
                              <div className="text-sm text-slate-400 leading-relaxed pl-4 border-l-2 border-slate-800/80">
                                {faq.answer}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
