import React, { useEffect } from 'react'
import { Percent, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { useGetVendorCommissionsQuery, useCreateCommissionOrderMutation, useVerifyCommissionPaymentMutation } from '../../../store/api/commissionApi'
import { toast } from 'react-hot-toast'

const VendorCommissionPage = () => {
  const { data: response, isLoading, refetch } = useGetVendorCommissionsQuery()
  const [createOrder, { isLoading: isCreating }] = useCreateCommissionOrderMutation()
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyCommissionPaymentMutation()

  useEffect(() => {
    // Load Razorpay Script
    if (!window.document.getElementById('razorpay-script')) {
      const script = window.document.createElement('script')
      script.id = 'razorpay-script'
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      window.document.body.appendChild(script)
    }
  }, [])

  const commissions = response?.data?.commissions || []

  const handlePayment = async (commission) => {
    try {
      const orderRes = await createOrder(commission._id).unwrap()
      const { orderId, amount } = orderRes.data

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: amount.toString(),
        currency: 'INR',
        name: 'Staffivaa',
        description: `Success Commission for ${commission.requestId?.reference}`,
        order_id: orderId,
        handler: async function (response) {
          try {
            await verifyPayment({
              id: commission._id,
              data: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            }).unwrap()
            toast.success('Commission paid successfully!')
            refetch()
          } catch (err) {
            toast.error(err?.data?.message || 'Payment verification failed')
          }
        },
        theme: {
          color: '#f5b800',
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        toast.error('Payment failed. Please try again.')
      })
      rzp.open()
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to initiate payment')
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading commissions...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Percent className="h-7 w-7 text-[#f5b800]" />
          Success Commissions
        </h1>
        <p className="text-sm text-slate-500 mt-2 font-medium">Manage your platform success commissions for assigned projects.</p>
      </div>

      {commissions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="bg-slate-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Percent className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Commissions Yet</h3>
          <p className="text-sm text-slate-500">You don't have any generated commissions at this time.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {commissions.map((comm) => (
            <div key={comm._id} className="bg-white rounded-[24px] border border-slate-200 overflow-hidden flex flex-col shadow-sm transition hover:shadow-md">
              <div className="p-5 border-b border-slate-100 flex-1">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                    {comm.requestId?.reference}
                  </span>
                  {comm.status === 'paid' ? (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 uppercase">
                      <CheckCircle2 className="h-3 w-3" /> Paid
                    </span>
                  ) : comm.status === 'overdue' ? (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 uppercase">
                      <AlertTriangle className="h-3 w-3" /> Overdue
                    </span>
                  ) : comm.status === 'waived' ? (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 uppercase">
                      <CheckCircle2 className="h-3 w-3" /> Waived
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1 uppercase">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase mb-1">Corporate Client</p>
                    <p className="text-sm font-bold text-slate-800">{comm.clientId?.companyName || comm.clientId?.fullName}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-200">
                    <div>
                      <p className="text-[11px] text-slate-400 font-bold uppercase mb-1">Quotation Amt</p>
                      <p className="text-sm font-bold text-slate-700">₹{comm.quotationAmount?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400 font-bold uppercase mb-1">Commission Rate</p>
                      <p className="text-sm font-bold text-slate-700">
                        {comm.commissionType === 'percentage' ? `${comm.commissionValue}%` : `₹${comm.commissionValue}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-600">Total Payable</span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">₹{comm.commissionAmount?.toLocaleString()}</span>
                </div>
                
                {(comm.status === 'pending_payment' || comm.status === 'overdue') && (
                  <button 
                    onClick={() => handlePayment(comm)}
                    disabled={isCreating || isVerifying}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Pay Commission
                  </button>
                )}
                {comm.status === 'paid' && (
                  <p className="text-xs text-center text-slate-500 font-medium">Paid on {new Date(comm.paidAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default VendorCommissionPage
