import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Banknote, Building2, Calendar, Users } from 'lucide-react'
import { AppSurface } from '../../../components/app-ui/cards/AppSurface.jsx'
import { useGetVendorJobsQuery, useCreateRazorpayOrderMutation, useVerifyRazorpayPaymentMutation } from '../../../store/api/workforceApi.js'
import { loadRazorpayScript } from '../../../lib/razorpay.js'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function VendorPaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const { data, isLoading, isError } = useGetVendorJobsQuery()
  const [createOrder, { isLoading: isCreatingOrder }] = useCreateRazorpayOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyRazorpayPaymentMutation()

  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const allocation = (data?.allocations ?? []).find((a) => String(a._id) === String(id))
  const request = allocation?.requestId

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading payment summary…</p>
      </div>
    )
  }

  if (isError || !request) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4">
        <AppSurface className="border-rose-200/90 bg-rose-50/50">
          <p className="text-sm font-semibold text-rose-800">Job not found.</p>
          <Link to="/vendor/jobs" className="mt-3 inline-block text-sm font-bold text-brand">Back</Link>
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

      const orderData = await createOrder(request._id).unwrap()

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
              id: request._id,
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
          Your platform fee payment has been processed successfully. You can now start assigning workers!
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Link to={`/vendor/jobs/${id}`} className="flex w-full items-center justify-center rounded-[16px] bg-[#FFC107] py-3.5 text-[15px] font-black text-slate-900 transition hover:bg-[#e0a800]">
            View Job
          </Link>
          <Link to="/vendor/jobs" className="flex w-full items-center justify-center rounded-[16px] bg-slate-100 py-3.5 text-[15px] font-bold text-slate-700 transition hover:bg-slate-200">
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
        <Link to={`/vendor/jobs/${id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 transition active:scale-95">
          <ArrowLeft className="h-5 w-5 text-slate-900" />
        </Link>
        <h1 className="text-base font-extrabold text-slate-900">
          Platform Fee Checkout
        </h1>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* Project Summary */}
        <AppSurface className="rounded-[24px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-brand" />
            <h2 className="text-[16px] font-extrabold text-slate-900">Job Summary</h2>
          </div>
          
          <div className="space-y-3.5">
            <div className="flex justify-between items-start gap-4">
              <span className="text-[13px] font-bold text-slate-500">Corporate Client</span>
              <span className="text-[13px] font-bold text-slate-900 text-right flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                {request.clientId?.corporateProfile?.companyName || request.clientId?.fullName || 'Client'}
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
                {formatDate(request.startDate)} to {formatDate(request.endDate || request.startDate)}
              </span>
            </div>
          </div>
        </AppSurface>

        {/* Invoice Total */}
        <AppSurface className="rounded-[24px] p-5 bg-slate-900 text-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-2 mb-6">
            <Banknote className="h-5 w-5 text-[#FFC107]" />
            <h2 className="text-[16px] font-extrabold text-white">
              Fee Details
            </h2>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center text-[14px] text-yellow-400 font-bold">
              <span>Vendor Platform Fee</span>
              <span>₹{request.vendorPlatformFeeAmount || 111}</span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
            <span className="text-[16px] font-bold text-slate-200">Amount to Pay</span>
            <span className="text-[24px] font-black text-[#FFC107]">
              ₹{request.vendorPlatformFeeAmount || 111}
            </span>
          </div>
        </AppSurface>

      </div>

      {/* Sticky Bottom Pay Now */}
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-slate-100 p-4 pb-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)] z-40">
        <button 
          onClick={handlePayment}
          disabled={isCreatingOrder || isVerifying || request.vendorPlatformFeeStatus === 'paid'}
          className="w-full flex items-center justify-center gap-2 rounded-[16px] bg-[#FFC107] py-4 text-[16px] font-black text-slate-900 transition hover:bg-[#e0a800] active:scale-[0.98] shadow-sm disabled:opacity-50"
        >
          {isCreatingOrder || isVerifying ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          ) : request.vendorPlatformFeeStatus === 'paid' ? (
            <>
              <CheckCircle2 className="h-5 w-5" /> Paid
            </>
          ) : (
            <>
              Pay ₹{request.vendorPlatformFeeAmount || 111} Securely
            </>
          )}
        </button>
      </div>
    </div>
  )
}
