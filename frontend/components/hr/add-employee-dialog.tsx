"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiService } from "@/lib/api"
import { Loader2, Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// Helper function to convert file to base64
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("basic")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  const [formData, setFormData] = useState({
    // Basic Information
    trackingId: "",
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    bloodGroup: "",
    cnic: "",
    cnicDocument: null as File | null,
    profilePhoto: null as File | null,

    // Employment Details
    position: "",
    department: "",
    departmentCode: "",
    role: "",
    employeeType: "full-time",
    status: "active",
    joinDate: "",
    probationPeriod: "",
    workLocation: "",
    shiftTimings: "",

    // Salary Information
    salary: "",
    basicSalary: "",

    // Address
    address: "",
    city: "",
    country: "",
    postalCode: "",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",

    // Bank Details
    bankAccountNumber: "",
    bankName: "",
    bankBranch: "",
    iban: "",

    // Benefits
    insuranceEligible: false,
    benefitsEligible: true,

    // Education & Experience (JSON arrays)
    education: [] as any[],
    experience: [] as any[],
  })

  useEffect(() => {
    if (open) {
      fetchEmployees()
      fetchDepartments()
      // Reset form when dialog opens
      setFormData({
        trackingId: "",
        name: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        gender: "",
        maritalStatus: "",
        nationality: "",
        bloodGroup: "",
        cnic: "",
        cnicDocument: null,
        profilePhoto: null,
        position: "",
        department: "",
        departmentCode: "",
        role: "",
        employeeType: "full-time",
        status: "active",
        joinDate: "",
        probationPeriod: "",
        workLocation: "",
        shiftTimings: "",
        salary: "",
        basicSalary: "",
        address: "",
        city: "",
        country: "",
        postalCode: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelation: "",
        bankAccountNumber: "",
        bankName: "",
        bankBranch: "",
        iban: "",
        insuranceEligible: false,
        benefitsEligible: true,
        education: [],
        experience: [],
      })
      setActiveTab("basic")
      setError(null)
    }
  }, [open])

  const fetchEmployees = async () => {
    try {
      const response = await apiService.employees.getAll()
      const responseData = response.data as any
      const employeesData = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : []
      setEmployees(employeesData)
    } catch (err) {
      console.error("Failed to fetch employees:", err)
    }
  }

  const fetchDepartments = async () => {
    try {
      // Fetch departments from Advanced Options
      const response = await apiService.advanced.getDropdownByKey('employee.hr.department')
      const responseData = response.data as any
      const options = responseData?.options || responseData?.data?.options || []

      if (options.length === 0) {
        // Fallback: Show warning if no departments configured
        console.warn('No departments found in Advanced Options. Please configure departments in Admin > Advanced Options.')
        setDepartments([])
        return
      }

      // Map Advanced Options format to department format
      const deptList = options
        .filter((opt: any) => opt.isActive !== false)
        .map((opt: any) => ({
          code: opt.value || opt.id,
          name: opt.label || opt.value,
        }))
      setDepartments(deptList)
    } catch (error) {
      console.error('Failed to fetch departments from Advanced Options:', error)
      // Show warning but don't block form
      setDepartments([])
    }
  }

  const handleFileUpload = async (file: File, type: "cnic" | "profile") => {
    try {
      const base64 = await toBase64(file)
      const response: any = await apiService.upload.file({ file: base64, filename: file.name })
      const responseData = response.data as any
      const uploaded = responseData?.data || responseData
      return uploaded?.url || uploaded?.path
    } catch (error) {
      console.error("File upload error:", error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate required fields
      if (!formData.trackingId || !formData.name || !formData.email || !formData.position || !formData.department || !formData.salary || !formData.joinDate) {
        setError("Please fill in all required fields")
        setLoading(false)
        return
      }

      // Upload files if provided
      let cnicDocumentUrl = null
      let profilePhotoUrl = null

      if (formData.cnicDocument) {
        cnicDocumentUrl = await handleFileUpload(formData.cnicDocument, "cnic")
      }

      if (formData.profilePhoto) {
        profilePhotoUrl = await handleFileUpload(formData.profilePhoto, "profile")
      }

      // Prepare employee data
      const employeeData: any = {
        trackingId: formData.trackingId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        maritalStatus: formData.maritalStatus || null,
        nationality: formData.nationality || null,
        bloodGroup: formData.bloodGroup || null,
        cnic: formData.cnic || null,
        cnicDocumentUrl,
        profilePhotoUrl,
        position: formData.position,
        department: formData.department,
        departmentCode: formData.departmentCode && formData.departmentCode.trim() ? formData.departmentCode.trim() : null,
        role: formData.role || null,
        employeeType: formData.employeeType,
        status: formData.status,
        joinDate: formData.joinDate,
        probationPeriod: formData.probationPeriod ? parseInt(formData.probationPeriod) : null,
        workLocation: formData.workLocation || null,
        shiftTimings: formData.shiftTimings || null,
        salary: parseFloat(formData.salary),
        basicSalary: formData.basicSalary ? parseFloat(formData.basicSalary) : null,
        address: formData.address || null,
        city: formData.city || null,
        country: formData.country || null,
        postalCode: formData.postalCode || null,
        emergencyContactName: formData.emergencyContactName || null,
        emergencyContactPhone: formData.emergencyContactPhone || null,
        emergencyContactRelation: formData.emergencyContactRelation || null,
        bankAccountNumber: formData.bankAccountNumber || null,
        bankName: formData.bankName || null,
        bankBranch: formData.bankBranch || null,
        iban: formData.iban || null,
        insuranceEligible: formData.insuranceEligible,
        benefitsEligible: formData.benefitsEligible,
        education: formData.education.length > 0 ? formData.education : null,
        experience: formData.experience.length > 0 ? formData.experience : null,
      }

      await apiService.employees.create(employeeData)

      toast({
        title: "Success",
        description: "Employee added successfully",
        variant: "success",
      })

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to create employee"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Enter comprehensive employee details</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="address">Address & Contact</TabsTrigger>
            <TabsTrigger value="bank">Bank Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="trackingId">Tracking ID <span className="text-destructive">*</span></Label>
                  <Input
                    id="trackingId"
                    placeholder="EMP-001"
                    value={formData.trackingId}
                    onChange={(e) => setFormData({ ...formData, trackingId: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 234-567-8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maritalStatus">Marital Status</Label>
                  <Select value={formData.maritalStatus} onValueChange={(value) => setFormData({ ...formData, maritalStatus: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    placeholder="e.g., Pakistani"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Select value={formData.bloodGroup} onValueChange={(value) => setFormData({ ...formData, bloodGroup: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnic">CNIC Number</Label>
                  <Input
                    id="cnic"
                    placeholder="12345-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="position">Position <span className="text-destructive">*</span></Label>
                  <Input
                    id="position"
                    placeholder="Property Manager"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department <span className="text-destructive">*</span></Label>
                  {departments.length === 0 ? (
                    <div className="space-y-2">
                      <Input
                        id="department"
                        placeholder="No departments configured"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-destructive">
                        ⚠️ No departments found. Please configure departments in Admin &gt; Advanced Options &gt; employee.hr.department
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={formData.departmentCode}
                      onValueChange={(value) => {
                        const dept = departments.find((d) => d.code === value)
                        if (!dept) {
                          toast({
                            title: "Invalid Department",
                            description: "Selected department is not valid. Please select from the list.",
                            variant: "destructive",
                          })
                          return
                        }
                        setFormData({
                          ...formData,
                          department: dept.name,
                          departmentCode: value,
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.code} value={dept.code}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    placeholder="e.g., Senior Manager"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employeeType">Employee Type</Label>
                  <Select
                    value={formData.employeeType}
                    onValueChange={(value) => setFormData({ ...formData, employeeType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on-leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="joinDate">Join Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="joinDate"
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="probationPeriod">Probation Period (Days)</Label>
                  <Input
                    id="probationPeriod"
                    type="number"
                    placeholder="90"
                    value={formData.probationPeriod}
                    onChange={(e) => setFormData({ ...formData, probationPeriod: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="workLocation">Work Location</Label>
                  <Input
                    id="workLocation"
                    placeholder="e.g., Main Office, Branch A"
                    value={formData.workLocation}
                    onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shiftTimings">Shift Timings</Label>
                  <Input
                    id="shiftTimings"
                    placeholder="09:00-18:00"
                    value={formData.shiftTimings}
                    onChange={(e) => setFormData({ ...formData, shiftTimings: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="salary">Monthly Salary <span className="text-destructive">*</span></Label>
                  <Input
                    id="salary"
                    type="number"
                    placeholder="5000"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="basicSalary">Basic Salary</Label>
                  <Input
                    id="basicSalary"
                    type="number"
                    placeholder="3000"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="insuranceEligible"
                    checked={formData.insuranceEligible}
                    onChange={(e) => setFormData({ ...formData, insuranceEligible: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="insuranceEligible">Insurance Eligible</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="benefitsEligible"
                    checked={formData.benefitsEligible}
                    onChange={(e) => setFormData({ ...formData, benefitsEligible: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="benefitsEligible">Benefits Eligible</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City name"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="Country name"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    placeholder="12345"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Emergency Contact</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="emergencyContactName">Contact Name</Label>
                    <Input
                      id="emergencyContactName"
                      placeholder="John Doe"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="+1 234-567-8900"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emergencyContactRelation">Relation</Label>
                    <Input
                      id="emergencyContactRelation"
                      placeholder="e.g., Spouse, Parent"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    placeholder="Account number"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    placeholder="Bank name"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bankBranch">Bank Branch</Label>
                  <Input
                    id="bankBranch"
                    placeholder="Branch name"
                    value={formData.bankBranch}
                    onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    placeholder="IBAN number"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cnicDocument">CNIC Document</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="cnicDocument"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setFormData({ ...formData, cnicDocument: file })
                        }
                      }}
                      className="flex-1"
                    />
                    {formData.cnicDocument && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, cnicDocument: null })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.cnicDocument && (
                    <p className="text-sm text-muted-foreground">Selected: {formData.cnicDocument.name}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profilePhoto">Profile Photo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="profilePhoto"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setFormData({ ...formData, profilePhoto: file })
                        }
                      }}
                      className="flex-1"
                    />
                    {formData.profilePhoto && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, profilePhoto: null })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {formData.profilePhoto && (
                    <p className="text-sm text-muted-foreground">Selected: {formData.profilePhoto.name}</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
