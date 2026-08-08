import { useState, useEffect } from 'react'
import { useGetSettingsQuery, useUpdateSettingsMutation } from '../../store/api/workforceApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { Settings, Save, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export function AdminSettingsPage() {
  const { data, isLoading, isError, refetch } = useGetSettingsQuery()
  const [updateSettings, { isLoading: isUpdating }] = useUpdateSettingsMutation()

  const [otpProvider, setOtpProvider] = useState('mock')
  const [paymentGateway, setPaymentGateway] = useState('razorpay')
  const [enableVendorAutoAssignment, setEnableVendorAutoAssignment] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [supportEmail, setSupportEmail] = useState('support@staffivaa.com')
  
  // Dynamic Enterprise Payment Configuration
  const [minimumEnterpriseSecurityBalance, setMinimumEnterpriseSecurityBalance] = useState(0)
  const [isEnterpriseSecurityBalanceEnabled, setIsEnterpriseSecurityBalanceEnabled] = useState(false)
  const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState(50)
  const [remainingPaymentPercentage, setRemainingPaymentPercentage] = useState(50)
  const [platformFeeType, setPlatformFeeType] = useState('percentage')
  const [platformFeeValue, setPlatformFeeValue] = useState(10)
  const [isGstEnabled, setIsGstEnabled] = useState(true)
  const [gstPercentage, setGstPercentage] = useState(18)
  const [paymentDueRule, setPaymentDueRule] = useState('before_joining')
  const [advanceInvoiceDueDays, setAdvanceInvoiceDueDays] = useState(7)
  const [remainingInvoiceDueDays, setRemainingInvoiceDueDays] = useState(15)
  const [enterpriseInvoiceDueDays, setEnterpriseInvoiceDueDays] = useState(15)
  const [enterpriseInvoiceGracePeriodDays, setEnterpriseInvoiceGracePeriodDays] = useState(3)
  const [reminderFrequencyHours, setReminderFrequencyHours] = useState(24)
  const [enableEnterpriseOverdueRestrictions, setEnableEnterpriseOverdueRestrictions] = useState(true)
  const [restrictJobCreationOnOverdue, setRestrictJobCreationOnOverdue] = useState(true)
  const [restrictOfferSendOnOverdue, setRestrictOfferSendOnOverdue] = useState(true)
  const [freezeAccountOnOverdue, setFreezeAccountOnOverdue] = useState(false)
  const [blockAttendanceOnOverdue, setBlockAttendanceOnOverdue] = useState(false)
  const [requireManualApprovalOnOverdue, setRequireManualApprovalOnOverdue] = useState(true)

  // Enterprise Job Timeline Config
  const [defaultApplicationWindowDays, setDefaultApplicationWindowDays] = useState(10)
  const [defaultInterviewGapDays, setDefaultInterviewGapDays] = useState(2)
  const [defaultJoiningGapDays, setDefaultJoiningGapDays] = useState(5)
  const [defaultProjectDurationDays, setDefaultProjectDurationDays] = useState(90)
  const [advancePaymentDueBufferHours, setAdvancePaymentDueBufferHours] = useState(48)

  // Enterprise Real-Time Job Notification Settings
  const [enableJobPushNotifications, setEnableJobPushNotifications] = useState(true)
  const [enableJobInAppNotifications, setEnableJobInAppNotifications] = useState(true)
  const [defaultNotificationRadiusKm, setDefaultNotificationRadiusKm] = useState(50)
  const [maxNotificationsPerWorkerPerDay, setMaxNotificationsPerWorkerPerDay] = useState(20)
  const [requireKycApprovedForJobNotifications, setRequireKycApprovedForJobNotifications] = useState(true)  // Commission settings
  const [revenueModel, setRevenueModel] = useState('platform_fee_plus_commission')
  const [commissionEnabled, setCommissionEnabled] = useState(true)
  const [commissionType, setCommissionType] = useState('percentage')
  const [commissionValue, setCommissionValue] = useState(5)
  const [commissionTrigger, setCommissionTrigger] = useState('after_quotation_accepted')
  const [commissionDueDays, setCommissionDueDays] = useState(7)

  // Radius Module Config
  const [defaultVendorRadius, setDefaultVendorRadius] = useState(15)
  const [minVendorRadius, setMinVendorRadius] = useState(5)
  const [maxVendorRadius, setMaxVendorRadius] = useState(100)
  const [defaultCorporateSearchRadius, setDefaultCorporateSearchRadius] = useState(25)
  const [allowUnlimitedRadius, setAllowUnlimitedRadius] = useState(true)
  const [enableRadiusMatching, setEnableRadiusMatching] = useState(true)

  useEffect(() => {
    if (data?.settings) {
      setOtpProvider(data.settings.otpProvider || 'mock')
      setPaymentGateway(data.settings.paymentGateway || 'razorpay')
      setEnableVendorAutoAssignment(Boolean(data.settings.enableVendorAutoAssignment))
      setMaintenanceMode(Boolean(data.settings.maintenanceMode))
      setSupportEmail(data.settings.supportEmail || 'support@staffivaa.com')
      
      setMinimumEnterpriseSecurityBalance(data.settings.minimumEnterpriseSecurityBalance ?? 0)
      setIsEnterpriseSecurityBalanceEnabled(data.settings.isEnterpriseSecurityBalanceEnabled ?? false)
      setAdvancePaymentPercentage(data.settings.advancePaymentPercentage ?? 50)
      setRemainingPaymentPercentage(data.settings.remainingPaymentPercentage ?? 50)
      setPlatformFeeType(data.settings.platformFeeType || 'percentage')
      setPlatformFeeValue(data.settings.platformFeeValue ?? 10)
      setIsGstEnabled(data.settings.isGstEnabled ?? true)
      setGstPercentage(data.settings.gstPercentage ?? 18)
      setPaymentDueRule(data.settings.paymentDueRule || 'before_joining')
      setAdvanceInvoiceDueDays(data.settings.advanceInvoiceDueDays ?? 7)
      setRemainingInvoiceDueDays(data.settings.remainingInvoiceDueDays ?? 15)
      setEnterpriseInvoiceDueDays(data.settings.enterpriseInvoiceDueDays ?? 15)
      setEnterpriseInvoiceGracePeriodDays(data.settings.enterpriseInvoiceGracePeriodDays ?? 3)
      setReminderFrequencyHours(data.settings.reminderFrequencyHours ?? 24)
      setEnableEnterpriseOverdueRestrictions(data.settings.enableEnterpriseOverdueRestrictions ?? true)
      setRestrictJobCreationOnOverdue(data.settings.restrictJobCreationOnOverdue ?? true)
      setRestrictOfferSendOnOverdue(data.settings.restrictOfferSendOnOverdue ?? true)
      setFreezeAccountOnOverdue(data.settings.freezeAccountOnOverdue ?? false)
      setBlockAttendanceOnOverdue(data.settings.blockAttendanceOnOverdue ?? false)
      setRequireManualApprovalOnOverdue(data.settings.requireManualApprovalOnOverdue ?? true)

      if (data.settings.timelineConfig) {
        setDefaultApplicationWindowDays(data.settings.timelineConfig.defaultApplicationWindowDays ?? 10)
        setDefaultInterviewGapDays(data.settings.timelineConfig.defaultInterviewGapDays ?? 2)
        setDefaultJoiningGapDays(data.settings.timelineConfig.defaultJoiningGapDays ?? 5)
        setDefaultProjectDurationDays(data.settings.timelineConfig.defaultProjectDurationDays ?? 90)
        setAdvancePaymentDueBufferHours(data.settings.timelineConfig.advancePaymentDueBufferHours ?? 48)
      }

      if (data.settings.jobNotificationConfig) {
        setEnableJobPushNotifications(data.settings.jobNotificationConfig.enablePushNotifications ?? true)
        setEnableJobInAppNotifications(data.settings.jobNotificationConfig.enableInAppNotifications ?? true)
        setDefaultNotificationRadiusKm(data.settings.jobNotificationConfig.defaultNotificationRadiusKm ?? 50)
        setMaxNotificationsPerWorkerPerDay(data.settings.jobNotificationConfig.maxNotificationsPerWorkerPerDay ?? 20)
        setRequireKycApprovedForJobNotifications(data.settings.jobNotificationConfig.requireKycApprovedForJobNotifications ?? true)
      }      setRevenueModel(data.settings.revenueModel || 'platform_fee_plus_commission')
      setCommissionEnabled(data.settings.commissionEnabled ?? true)
      setCommissionType(data.settings.commissionType || 'percentage')
      setCommissionValue(data.settings.commissionValue ?? 5)
      setCommissionTrigger(data.settings.commissionTrigger || 'after_quotation_accepted')
      setCommissionDueDays(data.settings.commissionDueDays ?? 7)

      if (data.settings.radiusConfig) {
        setDefaultVendorRadius(data.settings.radiusConfig.defaultVendorRadius ?? 15)
        setMinVendorRadius(data.settings.radiusConfig.minVendorRadius ?? 5)
        setMaxVendorRadius(data.settings.radiusConfig.maxVendorRadius ?? 100)
        setDefaultCorporateSearchRadius(data.settings.radiusConfig.defaultCorporateSearchRadius ?? 25)
        setAllowUnlimitedRadius(data.settings.radiusConfig.allowUnlimitedRadius ?? true)
        setEnableRadiusMatching(data.settings.radiusConfig.enableRadiusMatching ?? true)
      }
    }
  }, [data])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateSettings({
        otpProvider,
        paymentGateway,
        enableVendorAutoAssignment,
        maintenanceMode,
        supportEmail,
        minimumEnterpriseSecurityBalance,
        isEnterpriseSecurityBalanceEnabled,
        advancePaymentPercentage,
        remainingPaymentPercentage,
        platformFeeType,
        platformFeeValue,
        isGstEnabled,
        gstPercentage,
        paymentDueRule,
        advanceInvoiceDueDays,
        remainingInvoiceDueDays,
        enterpriseInvoiceDueDays,
        enterpriseInvoiceGracePeriodDays,
        reminderFrequencyHours,
        enableEnterpriseOverdueRestrictions,
        restrictJobCreationOnOverdue,
        restrictOfferSendOnOverdue,
        freezeAccountOnOverdue,
        blockAttendanceOnOverdue,
        requireManualApprovalOnOverdue,
        commissionEnabled,
        commissionType,
        commissionValue,
        commissionTrigger,
        commissionDueDays,
        radiusConfig: {
          defaultVendorRadius,
          minVendorRadius,
          maxVendorRadius,
          defaultCorporateSearchRadius,
          allowUnlimitedRadius,
          enableRadiusMatching
        },
        timelineConfig: {
          defaultApplicationWindowDays,
          defaultInterviewGapDays,
          defaultJoiningGapDays,
          defaultProjectDurationDays,
          advancePaymentDueBufferHours
        },
        jobNotificationConfig: {
          enablePushNotifications: enableJobPushNotifications,
          enableInAppNotifications: enableJobInAppNotifications,
          defaultNotificationRadiusKm,
          maxNotificationsPerWorkerPerDay,
          requireKycApprovedForJobNotifications
        }
      }).unwrap()
      toast.success('System configuration settings updated successfully!')
    } catch (err) {
      console.error(err)
      toast.error(err?.data?.message || 'Failed to update settings')
    }
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 pb-8 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
        <div className="h-4 w-96 bg-slate-200 rounded-lg mt-3"></div>
        <div className="h-96 bg-slate-200 rounded-2xl mt-8"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center p-6">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Failed to load platform settings</h3>
        <button
          onClick={refetch}
          className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-brand-dark transition"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Platform Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure platform integrations, SMS verification gateways, payment methods, and automated operational flags.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900">Core Platform Configuration</h3>
            <p className="text-xs text-slate-500">Essential settings for platform operations</p>
          </div>
          

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Platform Support Email</label>
            <p className="text-xs text-slate-500">Destination address printed on system invoices and billing PDF summaries.</p>
            <input
              type="email"
              required
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
            />
          </div>

        </GlassPanel>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h3 className="text-lg font-bold text-slate-900">Revenue & Commission Config</h3>
            <p className="text-xs text-slate-500">Settings applied to newly created workforce requests.</p>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700 block">Enable Vendor Commission</label>
                <span className="text-xs text-slate-500">Master toggle to turn off success commission completely.</span>
              </div>
              <button
                type="button"
                onClick={() => setCommissionEnabled(!commissionEnabled)}
                className="text-slate-600 focus:outline-none"
              >
                {commissionEnabled ? (
                  <ToggleRight className="h-10 w-10 text-brand" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>

            {commissionEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Commission Type</label>
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Commission Value</label>
                  <input
                    type="number"
                    min="0"
                    step={commissionType === 'percentage' ? "0.1" : "1"}
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700">Commission Trigger</label>
                  <select
                    value={commissionTrigger}
                    onChange={(e) => setCommissionTrigger(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                  >
                    <option value="after_quotation_accepted">After Quotation Accepted (Advance)</option>
                    <option value="after_project_completed">After Project Completed (Settlement)</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700">Due Days</label>
                  <p className="text-[10px] text-slate-500">Days allowed for vendor to pay before it becomes overdue.</p>
                  <input
                    type="number"
                    min="0"
                    value={commissionDueDays}
                    onChange={(e) => setCommissionDueDays(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </GlassPanel>

        {/* Enterprise Payment & Security Deposit Settings Card */}
        <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Enterprise Advance Payment & Milestone Settings
            </h3>
            <p className="text-xs text-slate-500">
              Configure Advance Payment rules (0% - 100%), Milestone due dates, and hiring restriction triggers.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700 block">
                  Enable Job Creation Security Balance Validation
                </label>
                <span className="text-xs text-slate-500">
                  When enabled, enterprise accounts must maintain the minimum wallet balance to post new jobs.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEnterpriseSecurityBalanceEnabled(!isEnterpriseSecurityBalanceEnabled)}
                className="text-slate-600 focus:outline-none cursor-pointer"
              >
                {isEnterpriseSecurityBalanceEnabled ? (
                  <ToggleRight className="h-10 w-10 text-brand" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>

            {isEnterpriseSecurityBalanceEnabled && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700">
                  Minimum Enterprise Security Wallet Balance (₹)
                </label>
                <p className="text-xs text-slate-500">
                  Custom minimum refundable security balance required in Enterprise Wallet to create a job requirement.
                </p>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={minimumEnterpriseSecurityBalance}
                  onChange={(e) => setMinimumEnterpriseSecurityBalance(Number(e.target.value))}
                  className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                  placeholder="e.g. 20000"
                />
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Invoice Payment Due Days & Recovery Configuration
              </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Advance Payment Percentage (%)</label>
                <select
                  value={advancePaymentPercentage}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setAdvancePaymentPercentage(val)
                    setRemainingPaymentPercentage(100 - val)
                  }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                >
                  {[0, 10, 20, 30, 40, 50, 60, 75, 100].map((pct) => (
                    <option key={pct} value={pct}>{pct}% Advance</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Remaining Milestone Percentage (%)</label>
                <input
                  type="number"
                  disabled
                  value={remainingPaymentPercentage}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 bg-slate-50"
                />
              </div>

              {/* Platform Fee Config */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Platform Fee Calculation Model</label>
                <select
                  value={platformFeeType}
                  onChange={(e) => setPlatformFeeType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                >
                  <option value="percentage">Percentage (%) of Project Value</option>
                  <option value="fixed">Fixed Flat Amount (₹)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Platform Fee Value ({platformFeeType === 'fixed' ? '₹' : '%'})</label>
                <input
                  type="number"
                  min="0"
                  value={platformFeeValue}
                  onChange={(e) => setPlatformFeeValue(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                />
              </div>

              {/* GST Config */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 flex items-center justify-between">
                  <span>Enable GST on Invoices</span>
                  <input
                    type="checkbox"
                    checked={isGstEnabled}
                    onChange={(e) => setIsGstEnabled(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                </label>
                <select
                  disabled={!isGstEnabled}
                  value={gstPercentage}
                  onChange={(e) => setGstPercentage(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white disabled:opacity-50"
                >
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <option key={rate} value={rate}>{rate}% GST Rate</option>
                  ))}
                </select>
              </div>

              {/* Payment Due Rule */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Payment Due Rule</label>
                <select
                  value={paymentDueRule}
                  onChange={(e) => setPaymentDueRule(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                >
                  <option value="before_joining">Due Before Worker Joining</option>
                  <option value="after_x_days">Due After X Days from Accept</option>
                  <option value="after_x_attendance_days">Due After X Days of Attendance</option>
                  <option value="project_midpoint">Due at Project Midpoint</option>
                  <option value="project_completion">Due Upon Project Completion</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Grace Period (Days)</label>
                <select
                  value={enterpriseInvoiceGracePeriodDays}
                  onChange={(e) => setEnterpriseInvoiceGracePeriodDays(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                >
                  {[1, 3, 5, 7, 15].map((d) => (
                    <option key={d} value={d}>{d} Days Grace Period</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Reminder Frequency</label>
                <select
                  value={reminderFrequencyHours}
                  onChange={(e) => setReminderFrequencyHours(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                >
                  <option value={24}>Every 24 Hours (Daily)</option>
                  <option value={48}>Every 48 Hours</option>
                  <option value={72}>Every 72 Hours</option>
                  <option value={168}>Weekly (Every 7 Days)</option>
                </select>
              </div>
            </div>

            {/* Overdue Restriction Toggles */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Overdue Payment Restriction Toggles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={restrictJobCreationOnOverdue} onChange={(e) => setRestrictJobCreationOnOverdue(e.target.checked)} className="rounded text-indigo-600" />
                  Disable New Job Posting
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={restrictOfferSendOnOverdue} onChange={(e) => setRestrictOfferSendOnOverdue(e.target.checked)} className="rounded text-indigo-600" />
                  Disable Sending Offers
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={freezeAccountOnOverdue} onChange={(e) => setFreezeAccountOnOverdue(e.target.checked)} className="rounded text-indigo-600" />
                  Freeze Enterprise Account
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={blockAttendanceOnOverdue} onChange={(e) => setBlockAttendanceOnOverdue(e.target.checked)} className="rounded text-indigo-600" />
                  Block Worker Attendance
                </label>
              </div>
            </div>
          </div>
        </div>
        </GlassPanel>

        {/* Enterprise Job Timeline Default Settings */}
        <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900">Enterprise Job Timeline Defaults</h3>
            <p className="text-xs text-slate-500">Configure default gap durations for automated timeline calculation.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Application Window (Days)</label>
              <input
                type="number"
                min="1"
                value={defaultApplicationWindowDays}
                onChange={(e) => setDefaultApplicationWindowDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Interview Gap (Days)</label>
              <input
                type="number"
                min="0"
                value={defaultInterviewGapDays}
                onChange={(e) => setDefaultInterviewGapDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Joining Gap (Days)</label>
              <input
                type="number"
                min="0"
                value={defaultJoiningGapDays}
                onChange={(e) => setDefaultJoiningGapDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Project Duration (Days)</label>
              <input
                type="number"
                min="1"
                value={defaultProjectDurationDays}
                onChange={(e) => setDefaultProjectDurationDays(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700">Advance Payment Due Buffer (Hours)</label>
              <p className="text-xs text-slate-500 mb-2">Hours before Expected Joining Date when the invoice becomes due.</p>
              <input
                type="number"
                min="0"
                value={advancePaymentDueBufferHours}
                onChange={(e) => setAdvancePaymentDueBufferHours(Number(e.target.value))}
                className="w-full md:w-1/2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>
          </div>
        </GlassPanel>

        {/* Enterprise Real-time Job Notification Controls */}
        <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900">Real-Time Job Notification Controls</h3>
            <p className="text-xs text-slate-500">Configure parameters for broadcasting job alerts to matched workers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center justify-between">
                <span>Enable FCM Push Notifications</span>
                <input
                  type="checkbox"
                  checked={enableJobPushNotifications}
                  onChange={(e) => setEnableJobPushNotifications(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
              </label>
              <p className="text-xs text-slate-500">Send instant Firebase push alerts to mobile & web browsers.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center justify-between">
                <span>Enable Real-time In-App Notifications</span>
                <input
                  type="checkbox"
                  checked={enableJobInAppNotifications}
                  onChange={(e) => setEnableJobInAppNotifications(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
              </label>
              <p className="text-xs text-slate-500">Emit live Socket.IO events to update in-app bell counters instantly.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Notification Service Radius (KM)</label>
              <input
                type="number"
                min="5"
                max="500"
                value={defaultNotificationRadiusKm}
                onChange={(e) => setDefaultNotificationRadiusKm(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700">Max Notifications / Worker / Day</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxNotificationsPerWorkerPerDay}
                onChange={(e) => setMaxNotificationsPerWorkerPerDay(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand/20 bg-white"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireKycApprovedForJobNotifications}
                  onChange={(e) => setRequireKycApprovedForJobNotifications(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <span>Require KYC Approved Status for Workers to Receive Alerts</span>
              </label>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 md:p-8 border border-slate-200/60 shadow-sm space-y-6 bg-white/85">
          <div className="border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-lg font-bold text-slate-900">Geographic Radius Config</h3>
            <p className="text-xs text-slate-500">Settings for vendor dispatching based on location distance.</p>
          </div>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700 block">Enable Radius Matching</label>
                <span className="text-xs text-slate-500">If disabled, requests are sent to all vendors regardless of distance.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableRadiusMatching(!enableRadiusMatching)}
                className="text-slate-600 focus:outline-none"
              >
                {enableRadiusMatching ? (
                  <ToggleRight className="h-10 w-10 text-brand" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block">Allow Unlimited Radius</label>
                <span className="text-xs text-slate-500">Allow vendors to select 'Unlimited' for their service area.</span>
              </div>
              <button
                type="button"
                onClick={() => setAllowUnlimitedRadius(!allowUnlimitedRadius)}
                className="text-slate-600 focus:outline-none"
              >
                {allowUnlimitedRadius ? (
                  <ToggleRight className="h-10 w-10 text-brand" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Default Corporate Search Radius (KM)</label>
                <input
                  type="number"
                  min="1"
                  value={defaultCorporateSearchRadius}
                  onChange={(e) => setDefaultCorporateSearchRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Default Vendor Service Radius (KM)</label>
                <input
                  type="number"
                  min="1"
                  value={defaultVendorRadius}
                  onChange={(e) => setDefaultVendorRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
                />
              </div>
            </div>
            </div>
          </GlassPanel>
        </div>
      </div>

      <div className="pt-8 pb-10">
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full xl:w-auto xl:px-12 xl:mx-auto flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {isUpdating ? 'Saving System configurations...' : 'Save Configuration Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
