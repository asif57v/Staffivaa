import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'
import { Offer } from '../models/Offer.js'
import { SponsoredAd } from '../models/SponsoredAd.js'
import { Banner } from '../models/Banner.js'

export const getActiveOffers = asyncHandler(async (req, res) => {
  const now = new Date()
  const offers = await Offer.find({
    isActive: true,
    $or: [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } }
    ]
  }).sort({ priority: -1 }).lean()

  return sendSuccess(res, { data: { offers } })
})

export const getActiveAds = asyncHandler(async (req, res) => {
  const now = new Date()
  const ads = await SponsoredAd.find({
    isActive: true,
    $or: [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } }
    ]
  }).sort({ priority: -1 }).lean()

  return sendSuccess(res, { data: { ads } })
})

export const getActiveBanners = asyncHandler(async (req, res) => {
  const now = new Date()
  const banners = await Banner.find({
    isActive: true,
    $or: [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } }
    ]
  }).sort({ position: 1, priority: -1 }).lean()

  return sendSuccess(res, { data: { banners } })
})

export const trackCampaign = asyncHandler(async (req, res) => {
  const { type, id, action } = req.body // type: 'BANNER', 'OFFER', 'AD' | action: 'VIEW', 'CLICK'
  
  if (!type || !id || !action) {
    return sendSuccess(res, { message: 'Missing parameters' })
  }

  const inc = action === 'CLICK' ? { clicks: 1 } : (type === 'AD' ? { impressions: 1 } : { views: 1 })

  if (type === 'BANNER') {
    await Banner.findByIdAndUpdate(id, { $inc: inc })
  } else if (type === 'OFFER') {
    await Offer.findByIdAndUpdate(id, { $inc: inc })
  } else if (type === 'AD') {
    await SponsoredAd.findByIdAndUpdate(id, { $inc: inc })
  }

  return sendSuccess(res, { message: 'Tracked successfully' })
})
