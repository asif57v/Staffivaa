import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema(
  {
    documentType: { type: String, trim: true }, // e.g. 'Aadhar', 'PAN', 'Resume', 'Certificate'
    label: { type: String, trim: true },
    url: { type: String, maxlength: 2048 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const interviewDetailsSchema = new mongoose.Schema(
  {
    round: { type: String, default: 'HR Round', trim: true },
    date: { type: Date },
    time: { type: String, trim: true },
    duration: { type: String, default: '30 Minutes', trim: true },
    mode: { type: String, enum: ['online', 'offline', 'phone'], default: 'offline' },
    location: { type: String, trim: true },
    officeName: { type: String, trim: true },
    joinUrl: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    contactPersonName: { type: String, trim: true },
    contactPersonMobile: { type: String, trim: true },
    contactPersonDesignation: { type: String, trim: true },
    contactPersonEmail: { type: String, trim: true },
    requiredDocuments: [{ type: String, trim: true }],
    candidateInstructions: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'rescheduled', 'cancelled', 'no_show', 'selected', 'rejected', 'next_round'],
      default: 'scheduled',
    },
    cancellationReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    scheduledAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const offerDetailsSchema = new mongoose.Schema(
  {
    companyName: { type: String, trim: true },
    roleTitle: { type: String, trim: true },
    salary: { type: Number },
    salaryType: { type: String, enum: ['daily', 'monthly', 'hourly'], default: 'monthly' },
    location: { type: String, trim: true },
    joiningDate: { type: Date },
    workingHours: { type: Number, default: 8 },
    benefits: [{ type: String, trim: true }],
    documentsRequired: [{ type: String, trim: true }],
    offerLetterUrl: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const joiningDetailsSchema = new mongoose.Schema(
  {
    joiningDate: { type: Date },
    siteLocation: { type: String, trim: true },
    reportingManager: { type: String, trim: true },
    project: { type: String, trim: true },
    department: { type: String, trim: true },
    supervisor: { type: String, trim: true },
    markedJoinedAt: { type: Date },
  },
  { _id: false }
)

const enterpriseApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJob',
      required: true,
      index: true,
    },
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Application Data
    experienceYears: { type: Number, default: 0 },
    documents: [documentSchema],
    
    // Workflow Status Enum
    status: {
      type: String,
      enum: [
        'applied',
        'under_review',
        'shortlisted',
        'interview_scheduled',
        'selected',
        'offered',
        'offer_accepted',
        'waiting_for_joining_payment',
        'joining_pending',
        'joining_activated',
        'joined',
        'rejected',
        'offer_expired',
      ],
      default: 'applied',
      index: true,
    },
    
    // Structured Lifecycle Steps
    interviewDetails: interviewDetailsSchema,
    offerDetails: offerDetailsSchema,
    joiningDetails: joiningDetailsSchema,
    
    // Financial & Invoice References
    joiningInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseJoiningInvoice',
    },
    escrowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnterpriseEscrowTransaction',
    },

    // Feedback & Review Notes
    enterpriseNote: { type: String, trim: true },
    
    // Worker Decision Timestamps
    workerAcceptedOfferAt: { type: Date },
    workerRejectedOfferAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
)

// Ensure a worker can only apply once to a specific job
enterpriseApplicationSchema.index({ jobId: 1, workerId: 1 }, { unique: true })

export const EnterpriseApplication = mongoose.model('EnterpriseApplication', enterpriseApplicationSchema)
