import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { Offer } from '../models/Offer.js'
import { SponsoredAd } from '../models/SponsoredAd.js'
import { Banner } from '../models/Banner.js'

// --- Offers ---
export const getOffers = asyncHandler(async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 }).lean()
  return sendSuccess(res, { data: { offers } })
})

export const createOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.create(req.body)
  return sendSuccess(res, { data: { offer }, statusCode: HTTP_STATUS.CREATED, message: 'Offer created successfully' })
})

export const updateOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!offer) return sendError(res, { message: 'Offer not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: { offer }, message: 'Offer updated successfully' })
})

export const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.id)
  if (!offer) return sendError(res, { message: 'Offer not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Offer deleted successfully' })
})

// --- Sponsored Ads ---
export const getAds = asyncHandler(async (req, res) => {
  const ads = await SponsoredAd.find().sort({ createdAt: -1 }).lean()
  return sendSuccess(res, { data: { ads } })
})

export const createAd = asyncHandler(async (req, res) => {
  const ad = await SponsoredAd.create(req.body)
  return sendSuccess(res, { data: { ad }, statusCode: HTTP_STATUS.CREATED, message: 'Ad created successfully' })
})

export const updateAd = asyncHandler(async (req, res) => {
  const ad = await SponsoredAd.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!ad) return sendError(res, { message: 'Ad not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: { ad }, message: 'Ad updated successfully' })
})

export const deleteAd = asyncHandler(async (req, res) => {
  const ad = await SponsoredAd.findByIdAndDelete(req.params.id)
  if (!ad) return sendError(res, { message: 'Ad not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Ad deleted successfully' })
})

// --- Banners ---
export const getBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort({ createdAt: -1 }).lean()
  return sendSuccess(res, { data: { banners } })
})

export const createBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.create(req.body)
  return sendSuccess(res, { data: { banner }, statusCode: HTTP_STATUS.CREATED, message: 'Banner created successfully' })
})

export const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!banner) return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { data: { banner }, message: 'Banner updated successfully' })
})

export const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id)
  if (!banner) return sendError(res, { message: 'Banner not found', statusCode: HTTP_STATUS.NOT_FOUND })
  return sendSuccess(res, { message: 'Banner deleted successfully' })
})

// --- Analytics ---
export const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const totalOffers = await Offer.countDocuments()
  const activeOffers = await Offer.countDocuments({ isActive: true })
  const totalAds = await SponsoredAd.countDocuments()
  const activeAds = await SponsoredAd.countDocuments({ isActive: true })
  
  // Example dummy aggregation for future usage
  const analytics = {
    totalOffers,
    activeOffers,
    totalAds,
    activeAds,
    totalViews: 0,
    totalClicks: 0
  }

  return sendSuccess(res, { data: { analytics } })
})
