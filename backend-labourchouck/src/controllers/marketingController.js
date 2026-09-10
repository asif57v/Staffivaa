import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'
import { Offer } from '../models/Offer.js'
import { SponsoredAd } from '../models/SponsoredAd.js'
import { Banner } from '../models/Banner.js'
import { PopularService } from '../models/PopularService.js'

export const getActivePopularServices = asyncHandler(async (req, res) => {
  let services = await PopularService.find({ isActive: true })
    .sort({ priority: -1, createdAt: -1 })
    .populate('linkedGroup')
    .lean()

  if (services.length === 0) {
    const count = await PopularService.countDocuments()
    if (count === 0) {
      const initial = [
        {
          title: 'AC repair & service',
          image: '/service_ac.png',
          rating: '4.73',
          reviews: '12k',
          price: 299,
          originalPrice: 499,
          discount: '40% OFF',
          isInstant: true,
          priority: 4,
          isActive: true,
        },
        {
          title: 'Intense cleaning (2 bathrooms)',
          image: '/service_cleaning_realistic.png',
          rating: '4.80',
          reviews: '8k',
          price: 872,
          originalPrice: 1038,
          discount: '16% OFF',
          isInstant: false,
          priority: 3,
          isActive: true,
        },
        {
          title: 'Tap & pipe repair',
          image: '/service_plumber.png',
          rating: '4.85',
          reviews: '15k',
          price: 149,
          originalPrice: 199,
          discount: '25% OFF',
          isInstant: true,
          priority: 2,
          isActive: true,
        },
        {
          title: 'Switch & wire repair',
          image: '/service_electrician.png',
          rating: '4.91',
          reviews: '22k',
          price: 99,
          originalPrice: 149,
          discount: '33% OFF',
          isInstant: true,
          priority: 1,
          isActive: true,
        },
      ]
      await PopularService.insertMany(initial)
      services = await PopularService.find({ isActive: true })
        .sort({ priority: -1, createdAt: -1 })
        .populate('linkedGroup')
        .lean()
    }
  }

  return sendSuccess(res, { data: { services } })
})

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
