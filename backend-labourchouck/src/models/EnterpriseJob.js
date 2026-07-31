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
  },
  { timestamps: true }
)

export const EnterpriseJob = mongoose.model('EnterpriseJob', enterpriseJobSchema)
