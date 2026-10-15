import mongoose from 'mongoose'

/** One archived related document (booking, payment, transaction, ...) of a deleted account */
const deletedAccountRecordSchema = new mongoose.Schema(
  {
    deletedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeletedAccount', required: true, index: true },
    modelName: { type: String, required: true },
    originalId: mongoose.Schema.Types.ObjectId,
    data: { type: mongoose.Schema.Types.Mixed },
    originalCreatedAt: Date,
  },
  { timestamps: true },
)

deletedAccountRecordSchema.index({ deletedAccountId: 1, modelName: 1, originalCreatedAt: -1 })

export const DeletedAccountRecord =
  mongoose.models.DeletedAccountRecord || mongoose.model('DeletedAccountRecord', deletedAccountRecordSchema)
