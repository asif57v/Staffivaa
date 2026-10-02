import mongoose from 'mongoose'

const enterpriseJobSchema = new mongoose.Schema(
  {
    enterpriseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobTitle: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourCategory',
      required: true,
    },
    numberOfWorkers: { type: Number, required: true, min: 1 },
    locationText: { type: String, required: true, trim: true },
    locationPoint: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' } // [longitude, latitude]
    },
    salary: { type: Number, required: true },
    salaryType: {
      type: String,
      enum: ['daily', 'monthly', 'hourly'],
      default: 'monthly'
    },
    experienceRequired: { type: String, trim: true }, // e.g. "2+ years"
    genderPreference: {
      type: String,
      enum: ['any', 'male', 'female'],
      default: 'any'
    },
    agePreference: { type: String, trim: true }, // e.g. "18-40"
    skillsRequired: [{ type: String, trim: true }],
    
    // Shift & Timing
    workingHours: { type: Number, default: 8 },
    shift: { type: String, trim: true }, // e.g. "Day", "Night", "08:00 AM - 05:00 PM"
    
    // Perks & Amenities (boolean flags)
    providesAccommodation: { type: Boolean, default: false },
    providesFood: { type: Boolean, default: false },
    providesTransportation: { type: Boolean, default: false },
    
    // Contract details
    contractDuration: { type: String, trim: true }, // e.g. "6 months"
    jobDescription: { type: String, trim: true, maxlength: 2000 },
    
    // 📅 Job Timeline
    timeline: {
      applicationStartDate: { type: Date, required: true, default: Date.now },
      applicationLastDate: { type: Date, required: true },
      interviewStartDate: { type: Date }, // Optional
      expectedJoiningDate: { type: Date, required: true },
      projectStartDate: { type: Date }, // Optional
      projectEndDate: { type: Date } // Optional
    },
    
    // Admin Review Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'closed'],
      default: 'pending'
    },
    adminReviewNote: { type: String, trim: true },
    
    // Job visibility
    isLive: { type: Boolean, default: false },

    // Routing: monthly jobs go to the labour feed; daily/hourly jobs go to Admin for direct fulfilment
    dispatchMode: {
      type: String,
      enum: ['labour_feed', 'admin'],
      default: 'labour_feed',
      index: true,
    },
    adminRequestStatus: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
    },
    adminRespondedAt: { type: Date },
    adminRespondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminResponseNote: { type: String, trim: true },

    // Workers assigned by Admin to a daily/hourly request. Either a registered labour (workerId)
    // or an off-app worker captured by name + phone (isExternal).
    assignedWorkers: [
      {
        workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        isExternal: { type: Boolean, default: false },
        name: { type: String, trim: true },
        phone: { type: String, trim: true },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        // Per-period payout records (one per periodKey) so the books stay clear
        payouts: [
          {
            periodKey: { type: String, required: true },
            amount: { type: Number, required: true },
            mode: { type: String, enum: ['wallet', 'cash', 'upi', 'bank', 'other'], required: true },
            note: { type: String, trim: true },
            paidAt: { type: Date, default: Date.now },
            paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
          },
        ],
      },
    ],

    // Admin -> Enterprise "job ending soon" reminders (daily/hourly only)
    reminders: [
      {
        hoursBefore: { type: Number, required: true },
        message: { type: String, trim: true },
        sentAt: { type: Date, default: Date.now },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
)

export const EnterpriseJob = mongoose.model('EnterpriseJob', enterpriseJobSchema)
