import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Banknote, Building2, Calendar, Users } from 'lucide-react'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetRequestQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation } from '../../../store/api/workforceApi.js'
import { loadRazorpayScript } from '../../../lib/razorpay.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CorporatePaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const { data, isLoading, isError } = useGetRequestQuery(id, { skip: !id })
  const [createOrder, { isLoading: isCreatingOrder }] = useCreateRazorpayOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyRazorpayPaymentMutation()

  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const request = data?.request
  const allocation = data?.allocation
  const assignments = data?.assignments ?? []
  const summary = data?.paymentSummary

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading payment summary…</p>
      </div>
    )
  }

  if (isError || !request || !summary) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4">
        <AppSurface className="border-rose-200/90 bg-rose-50/50">
          <p className="text-sm font-semibold text-rose-800">Request not found or payment summary unavailable.</p>
          <Link to="/corporate/requests" className="mt-3 inline-block text-sm font-bold text-brand">Back</Link>
        </AppSurface>
      </div>
    )
  }

  const handlePayment = async () => {
    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        alert('Razorpay SDK failed to load. Are you online?')
        return
      }

      const orderData = await createOrder(id).unwrap()

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Staffivaa',
        description: `Platform Fee for ${request.reference}`,
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            await verifyPayment({
              id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            }).unwrap()
            setPaymentSuccess(true)
          } catch (err) {
            console.error('Payment Verification Failed', err)
            alert('Payment verification failed. Please contact support.')
          }
        },
        theme: {
          color: '#FFC107'
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response){
        console.error('Payment Failed', response.error)
        alert('Payment failed. Please try again.')
      })
      rzp.open()
    } catch (err) {
      console.error('Failed to initiate payment', err)
      alert(err?.data?.message || 'Failed to initiate payment.')
    }
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Payment Successful</h2>
        <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">
          Your payment has been processed successfully. Thank you for using Staffivaa.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Link to={`/corporate/requests/${id}`} className="flex w-full items-center justify-center rounded-[16px] bg-[#FFC107] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800]">
            View Project
          </Link>
          <Link to="/corporate/requests" className="flex w-full items-center justify-center rounded-[16px] bg-slate-100 py-3.5 text-[15px] font-bold text-slate-700 transition hover:bg-slate-200">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Sticky Header */}
      <header className="bg-[#FFC107] px-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3 sticky top-0 z-30 shadow-sm flex items-center gap-3">
        <Link to={`/corporate/requests/${id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 transition active:scale-95">
          <ArrowLeft className="h-5 w-5 text-slate-900" />
        </Link>
        <h1 className="text-base font-extrabold text-slate-900">
          Corporate Platform Fee Checkout
        </h1>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* Project Summary */}
        <AppSurface className="rounded-[24px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-brand" />
            <h2 className="text-[16px] font-extrabold text-slate-900">Project Summary</h2>
          </div>
          
          <div className="space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <span className="text-[13px] font-bold text-slate-500">Project Name</span>
              <span className="text-[13px] font-bold text-slate-900 text-right">{request.projectId?.name || 'Maiyur'}</span>
            </div>
            
            <div className="flex justify-between items-start gap-4">
              <span className="text-[13px] font-bold text-slate-500">Vendor Partner</span>
              <span className="text-[13px] font-bold text-slate-900 text-right flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                {allocation?.vendorId?.contractorProfile?.companyName || allocation?.vendorId?.fullName || 'Vendor'}
              </span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <span className="text-[13px] font-bold text-slate-500">Request ID</span>
              <span className="text-[13px] font-bold text-slate-900 text-right uppercase">{request.reference}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <span className="text-[13px] font-bold text-slate-500">Duration</span>
              <span className="text-[13px] font-bold text-slate-900 text-right flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-400" />
                {formatDate(request.startDate)} to {formatDate(request.endDate || request.startDate)} ({summary.totalDurationInDays} Days)
              </span>
            </div>
          </div>
        </AppSurface>

        {/* Assigned Workers Details */}
        <AppSurface className="rounded-[24px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-slate-700" />
            <h2 className="text-[16px] font-extrabold text-slate-900">Labour Costs</h2>
          </div>
          
          {assignments.length === 0 ? (
            <p className="text-[13px] text-slate-500 font-medium">Wait for Vendor to assign workers before quotation phase.</p>
          ) : (
            <div className="space-y-4">
              {assignments.map(a => (
                <div key={a._id} className="flex justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-[14px] font-bold text-slate-900">{a.labourId?.fullName || 'Worker'}</p>
                    <p className="text-[12px] font-medium text-slate-500 capitalize">{a.categoryId?.name || 'Worker'}</p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      ₹{a.perDayRate || 0}/day × {summary.totalDurationInDays} days
                    </p>
                  </div>
                  <div className="text-[14px] font-black text-slate-900">
                    ₹{(a.perDayRate || 0) * summary.totalDurationInDays}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppSurface>

        {/* Invoice Total */}
        <AppSurface className="rounded-[24px] p-5 bg-slate-900 text-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-2 mb-6">
            <Banknote className="h-5 w-5 text-[#FFC107]" />
            <h2 className="text-[16px] font-extrabold text-white">
              Platform Fee Details
            </h2>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center text-[14px]">
              <span className="font-medium text-slate-300">Total Project Value</span>
              <span className="font-bold text-white">₹{summary?.totalLabourCost || 0}</span>
            </div>
            <div className="flex justify-between items-center text-[14px] text-yellow-400 font-bold">
              <span>Platform Fee</span>
              <span>₹{request.corporatePlatformFeeAmount || 99}</span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
            <span className="text-[16px] font-bold text-slate-200">Amount to Pay</span>
            <span className="text-[24px] font-black text-[#FFC107]">
              ₹{request.corporatePlatformFeeAmount || 99}
            </span>
          </div>
        </AppSurface>

      </div>

      {/* Sticky Bottom Pay Now */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-slate-100 p-4 pb-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)] z-40">
        <button 
          onClick={handlePayment}
          disabled={isCreatingOrder || isVerifying || request.corporatePlatformFeeStatus === 'paid'}
          className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#FFC107] py-4 text-[16px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm disabled:opacity-50"
        >
          {isCreatingOrder || isVerifying ? 'Processing...' : `Pay ₹${request.corporatePlatformFeeAmount || 99} Securely`}
        </button>
      </div>

    </div>
  )
}
