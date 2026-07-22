import { Router } from 'express'
import express from 'express'
import { razorpayWebhook } from '../controllers/webhookController.js'

const router = Router()

// Razorpay webhooks require raw body for signature verification if we were using express middleware, 
// but we stringify the JSON body in our controller. Alternatively, we can use express.raw().
// Here we assume the body is already parsed as JSON by global middleware, so we use stringify.
router.post('/razorpay', razorpayWebhook)

export default router
