import Razorpay from 'razorpay'
import dotenv from 'dotenv'

dotenv.config()

let razorpayInstance = null

export function getRazorpayInstance() {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys not configured')
    }
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    })
  }
  return razorpayInstance
}

export const razorpay = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getRazorpayInstance()
      const value = instance[prop]
      return typeof value === 'function' ? value.bind(instance) : value
    },
  }
)
