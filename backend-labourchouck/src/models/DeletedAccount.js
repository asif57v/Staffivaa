import mongoose from 'mongoose'

/**
 * Archive of an account that was deleted (by the user or an admin).
 * Summary + profile snapshot live here; the (potentially large) related
 * records live in DeletedAccountRecord so we never hit the 16MB doc limit.
 */
const deletedAccountSchema = new mongoose.Schema(
  {
    originalUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, required: true, index: true },
    fullName: String,
    phone: { type: String, index: true },
    email: String,
    companyName: String,
    profileImageUrl: String,
    registeredAt: Date,
    lastLoginAt: Date,
    statusBeforeDeletion: String,
    walletBalanceAtDeletion: { type: Number, default: 0 },
    deletedAt: { type: Date, default: Date.now, index: true },
    deletedBy: { type: String, enum: ['self', 'admin'], default: 'self', index: true },
    deletedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedByName: String,
    deleteReason: String,
    ipAddress: String,
    userAgent: String,
    /** Full copy of the User document (passwordHash removed, KYC images stored separately) */
    userSnapshot: { type: mongoose.Schema.Types.Mixed },
    /** { ModelName: count } of related records archived */
    relatedCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const DeletedAccount =
  mongoose.models.DeletedAccount || mongoose.model('DeletedAccount', deletedAccountSchema)
