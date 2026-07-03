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

  useEffect(() => {
    if (data?.settings) {
      setOtpProvider(data.settings.otpProvider || 'mock')
      setPaymentGateway(data.settings.paymentGateway || 'razorpay')
      setEnableVendorAutoAssignment(Boolean(data.settings.enableVendorAutoAssignment))
      setMaintenanceMode(Boolean(data.settings.maintenanceMode))
      setSupportEmail(data.settings.supportEmail || 'support@staffivaa.com')
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
        supportEmail
      }).unwrap()
      toast.success('Settings updated successfully!')
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

      <GlassPanel className="p-8 max-w-2xl border border-slate-200/60 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">SMS OTP Provider</label>
            <p className="text-xs text-slate-500">Choose the gateway to transmit validation messages & roster OTP codes.</p>
            <select
              value={otpProvider}
              onChange={(e) => setOtpProvider(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
            >
              <option value="twilio">Twilio SMS Gateway</option>
              <option value="msg91">MSG91 India Provider</option>
              <option value="mock">Sandbox Simulator (Mock)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">Payment Gateway Integration</label>
            <p className="text-xs text-slate-500">Active processor to capture advance settlements and invoice completions.</p>
            <select
              value={paymentGateway}
              onChange={(e) => setPaymentGateway(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-slate-50/50"
            >
              <option value="razorpay">Razorpay Checkout & Payouts</option>
              <option value="stripe">Stripe Payments Int.</option>
              <option value="mock">Mock Offline Payments</option>
            </select>
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

          {/* Toggle Flags */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700 block">Automated Vendor Job Assignment</label>
                <span className="text-xs text-slate-500">Auto assign jobs matching skill categories directly.</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableVendorAutoAssignment(!enableVendorAutoAssignment)}
                className="text-slate-600 focus:outline-none"
              >
                {enableVendorAutoAssignment ? (
                  <ToggleRight className="h-10 w-10 text-brand" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700 block">System Maintenance Mode</label>
                <span className="text-xs text-slate-500">Restrict access to client panels while executing server migrations.</span>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className="text-slate-600 focus:outline-none"
              >
                {maintenanceMode ? (
                  <ToggleRight className="h-10 w-10 text-rose-500" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-300" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button
              type="submit"
              disabled={isUpdating}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md hover:bg-brand-dark transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isUpdating ? 'Saving System configurations...' : 'Save Configuration settings'}
            </button>
          </div>
        </form>
      </GlassPanel>
    </div>
  )
}
