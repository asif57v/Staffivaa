import { LegalPage } from '../models/LegalPage.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'

// ── Default Legal Seed Content ─────────────────────────────────────────────
const DEFAULT_LEGAL_PAGES = [
  {
    title: 'Terms & Conditions',
    slug: 'terms',
    version: 'v1.0',
    status: 'published',
    content: `
      <h2>Staffivaa Platform Terms & Conditions — Key Points</h2>
      <p>By accessing or using <strong>Staffivaa Workforce OS</strong>, all users (Workers, Contractors, Homeowners, Corporate & Enterprise Partners) agree to the following mandatory operational terms:</p>

      <h3>1. Mandatory KYC & Account Verification</h3>
      <ul>
        <li>All workers, vendors, and business entities must complete Aadhaar, Mobile OTP, or GSTIN/Udyam verification before booking or deploying workforce.</li>
        <li>Providing fake documentation or running duplicate accounts will lead to immediate account termination and wallet freezing.</li>
      </ul>

      <h3>2. Geo-Tagged Shift Attendance</h3>
      <ul>
        <li>Workers must mark Check-In and Check-Out strictly within the designated job site GPS boundary via the Staffivaa app.</li>
        <li>Attendance marked outside the site geo-fence will not be counted for daily payout calculations.</li>
      </ul>

      <h3>3. Secure Escrow & Payout Settlements</h3>
      <ul>
        <li>Enterprise and Corporate clients must maintain adequate wallet security balance or escrow prior to job deployment.</li>
        <li>Daily wage payouts are disbursed automatically to verified worker UPI or Bank accounts every evening upon attendance approval.</li>
      </ul>

      <h3>4. Shift Punctuality & No-Show Policy</h3>
      <ul>
        <li>Workers failing to report to assigned job sites without 2-hour advance cancellation will receive a penalty score on their rating.</li>
        <li>In case of worker no-shows, Staffivaa automatically triggers replacement worker allocation within 30 minutes.</li>
      </ul>

      <h3>5. Workplace Conduct & Site Safety</h3>
      <ul>
        <li>All job sites must comply with basic physical safety, non-discrimination, and fair labor guidelines.</li>
        <li>Site vandalism, theft, harassment, physical altercation, or employer non-payment will result in a permanent platform ban and legal action.</li>
      </ul>

      <h3>6. Platform Fees & Invoices</h3>
      <ul>
        <li>Platform service fees and Enterprise joining security deposits processed via Razorpay are non-refundable once workforce shift allocation is initiated.</li>
      </ul>
    `,
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    version: 'v1.0',
    status: 'published',
    content: `
      <h2>Staffivaa Data Protection & Privacy Policy</h2>
      <p>At <strong>Staffivaa</strong>, protecting your personal, financial, and location data is our highest priority. This Privacy Policy details how we collect, store, encrypt, and handle data across our ecosystem.</p>

      <h3>1. Information We Collect</h3>
      <ul>
        <li><strong>Identity Data:</strong> Full Name, Mobile Number, Profile Picture, Aadhaar / Government ID details for verification.</li>
        <li><strong>Business Credentials:</strong> GSTIN, Company Name, Udyam Registration, Bank Account / UPI VPA for corporate payouts.</li>
        <li><strong>Location & Telemetry:</strong> Real-time GPS location coordinates captured exclusively during duty check-in and check-out for geo-fenced attendance verification.</li>
        <li><strong>Device & Application Data:</strong> FCM push notification tokens, IP addresses, OS version, and app performance logs.</li>
      </ul>

      <h3>2. How Your Information is Used</h3>
      <p>Your data is used solely to match skilled labor with relevant job shifts, verify site attendance, calculate daily payrolls, prevent fraud, and send real-time job status notifications.</p>

      <h3>3. Data Encryption & Storage Security</h3>
      <p>All sensitive information is encrypted using 256-bit SSL encryption. Aadhaar and bank details are tokenized and stored in compliance-certified cloud data centers located in India.</p>

      <h3>4. Data Sharing & Third-Party Disclosure</h3>
      <p>We do not sell, rent, or trade personal information to advertisers. Limited profile details (Name, Skill Category, Verification Status) are shared with employers solely for active job assignments.</p>

      <h3>5. User Control & Data Rights</h3>
      <p>Users can request profile updates, view audit logs, or request account deletion by contacting our privacy compliance team at <strong>privacy@staffivaa.com</strong>.</p>
    `,
  },
  {
    title: 'Support & Help Center',
    slug: 'support',
    version: 'v1.0',
    status: 'published',
    content: `
      <h2>Staffivaa Support & Help Center</h2>
      <p>We provide 24/7 dedicated assistance to daily wage workers, contractors, vendors, corporate clients, and enterprise partners across India.</p>

      <h3>Contact Our Support Team</h3>
      <p>
        <strong>Toll-Free Helpline:</strong> +91 1800-123-4567 (Mon-Sat, 8 AM - 8 PM)<br/>
        <strong>WhatsApp Support:</strong> +91 98765-43210<br/>
        <strong>Support Email:</strong> support@staffivaa.com<br/>
        <strong>Corporate Escalations:</strong> enterprise-support@staffivaa.com
      </p>

      <h3>Frequently Asked Questions (FAQ)</h3>

      <h4>Q1: How do workers receive daily wage payouts?</h4>
      <p>Payouts are automatically credited to your registered UPI ID or bank account every evening once the site supervisor verifies your check-in and check-out attendance.</p>

      <h4>Q2: What should I do if an employer or worker fails to report?</h4>
      <p>Go to your Active Shift screen and click <strong>Report Issue / Discrepancy</strong> or call our instant support helpline. Our site dispute team will review geo-logs and re-allocate replacement workers within 30 minutes.</p>

      <h4>Q3: How do Enterprise joining fee payments work?</h4>
      <p>Enterprise joining invoices can be paid online via Razorpay (UPI, Credit/Debit Cards, Net Banking). Upon payment verification, your enterprise wallet is credited immediately.</p>
    `,
  },
]

export const seedDefaultLegalPages = async () => {
  try {
    for (const page of DEFAULT_LEGAL_PAGES) {
      await LegalPage.findOneAndUpdate(
        { slug: page.slug },
        { $setOnInsert: { createdBy: null, publishedAt: new Date() }, ...page },
        { upsert: true, new: true }
      )
      console.log(`[Legal Seed] Synced default page: ${page.slug}`)
    }
  } catch (err) {
    console.error('[Legal Seed Error]:', err.message)
  }
}

// ── Public Controllers ──────────────────────────────────────────────────────

/** GET /api/v1/legal - Get all published legal pages summary */
export const getPublicLegalPages = asyncHandler(async (req, res) => {
  const pages = await LegalPage.find({ status: 'published' })
    .select('title slug version lastUpdated publishedAt')
    .sort({ title: 1 })

  return sendSuccess(res, { data: pages })
})

/** GET /api/v1/legal/:slug - Get single published legal page by slug */
export const getPublicLegalPageBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params
  const page = await LegalPage.findOne({ slug: slug.toLowerCase(), status: 'published' })

  if (!page) {
    return sendError(res, {
      message: 'Legal document not found or currently unavailable',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { data: page })
})

// ── Admin Controllers (Super Admin Only) ───────────────────────────────────

/** GET /api/v1/admin/legal - Get all legal pages (including drafts) */
export const getAdminLegalPages = asyncHandler(async (req, res) => {
  const pages = await LegalPage.find()
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email')
    .sort({ updatedAt: -1 })

  return sendSuccess(res, { data: pages })
})

/** GET /api/v1/admin/legal/:id - Get single legal page by ID */
export const getAdminLegalPageById = asyncHandler(async (req, res) => {
  const page = await LegalPage.findById(req.params.id)

  if (!page) {
    return sendError(res, { message: 'Legal page not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: page })
})

/** POST /api/v1/admin/legal - Create a new legal page */
export const createLegalPage = asyncHandler(async (req, res) => {
  const { title, slug, content, version, status } = req.body

  if (!title || !content) {
    return sendError(res, { message: 'Title and content are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const normalizedSlug = (slug || title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  const existing = await LegalPage.findOne({ slug: normalizedSlug })
  if (existing) {
    return sendError(res, { message: `A page with slug "${normalizedSlug}" already exists`, statusCode: HTTP_STATUS.CONFLICT })
  }

  const page = await LegalPage.create({
    title: title.trim(),
    slug: normalizedSlug,
    content,
    version: version || 'v1.0',
    status: status || 'published',
    createdBy: req.user._id,
    updatedBy: req.user._id,
    publishedAt: status === 'published' ? new Date() : null,
  })

  return sendSuccess(res, {
    message: 'Legal page created successfully',
    data: page,
    statusCode: HTTP_STATUS.CREATED,
  })
})

/** PUT /api/v1/admin/legal/:id - Update legal page */
export const updateLegalPage = asyncHandler(async (req, res) => {
  const { title, slug, content, version, status } = req.body

  const page = await LegalPage.findById(req.params.id)
  if (!page) {
    return sendError(res, { message: 'Legal page not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (slug && slug.toLowerCase() !== page.slug) {
    const existing = await LegalPage.findOne({ slug: slug.toLowerCase(), _id: { $ne: page._id } })
    if (existing) {
      return sendError(res, { message: `Slug "${slug}" is already used by another document`, statusCode: HTTP_STATUS.CONFLICT })
    }
    page.slug = slug.toLowerCase().trim()
  }

  if (title) page.title = title.trim()
  if (content !== undefined) page.content = content
  if (version) page.version = version.trim()
  if (status) {
    if (status === 'published' && page.status !== 'published') {
      page.publishedAt = new Date()
    }
    page.status = status
  }

  page.lastUpdated = new Date()
  page.updatedBy = req.user._id

  await page.save()

  return sendSuccess(res, {
    message: 'Legal page updated successfully',
    data: page,
  })
})

/** PATCH /api/v1/admin/legal/:id/status - Toggle publish status */
export const toggleLegalPageStatus = asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['published', 'draft'].includes(status)) {
    return sendError(res, { message: 'Invalid status. Must be published or draft', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const page = await LegalPage.findById(req.params.id)
  if (!page) {
    return sendError(res, { message: 'Legal page not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  page.status = status
  if (status === 'published') page.publishedAt = new Date()
  page.lastUpdated = new Date()
  page.updatedBy = req.user._id

  await page.save()

  return sendSuccess(res, {
    message: `Page is now ${status}`,
    data: page,
  })
})

/** DELETE /api/v1/admin/legal/:id - Delete legal page */
export const deleteLegalPage = asyncHandler(async (req, res) => {
  const page = await LegalPage.findById(req.params.id)
  if (!page) {
    return sendError(res, { message: 'Legal page not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  await page.deleteOne()

  return sendSuccess(res, { message: 'Legal page deleted successfully' })
})
