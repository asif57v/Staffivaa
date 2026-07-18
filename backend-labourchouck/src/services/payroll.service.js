import mongoose from 'mongoose'
import { WageAssignment } from '../models/WageAssignment.js'
import { EarningsLedger } from '../models/EarningsLedger.js'
import { PayoutBatch } from '../models/PayoutBatch.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { User } from '../models/User.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { ATTENDANCE_STATUS } from '../constants/workforceConstants.js'

export const payrollService = {
  /**
   * Sets or updates the daily wage rate for a labour on a specific project.
   * If a rate already exists, closes it and opens a new one to preserve history.
   */
  async setDailyWageRate({ vendorId, labourId, projectId, dailyRate, setById }) {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      // Find existing active rate
      const activeRate = await WageAssignment.findOne({
        labourId,
        projectId,
        vendorId,
        status: 'active',
      }).session(session)

      if (activeRate) {
        if (activeRate.dailyRate === dailyRate) {
          await session.abortTransaction()
          return activeRate
        }
        activeRate.status = 'closed'
        activeRate.effectiveTo = new Date()
        await activeRate.save({ session })
      }

      const newRate = await WageAssignment.create(
        [
          {
            labourId,
            projectId,
            vendorId,
            dailyRate,
            setBy: setById,
            effectiveFrom: new Date(),
          },
        ],
        { session }
      )

      await session.commitTransaction()
      return newRate[0]
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  },

  /**
   * Generates EarningsLedger entries for verified attendances that don't have one.
   */
  async accruePendingEarnings() {
    // Find all 'PRESENT' (or equivalent) attendance records that don't have a ledger entry
    const attendanceRecords = await AttendanceRecord.aggregate([
      {
        $match: {
          attendanceStatus: ATTENDANCE_STATUS.PRESENT,
        },
      },
      {
        $lookup: {
          from: 'earningsledgers',
          localField: '_id',
          foreignField: 'attendanceRecordId',
          as: 'ledger',
        },
      },
      {
        $match: {
          'ledger.0': { $exists: false },
        },
      },
    ])

    const createdLedgers = []
    for (const record of attendanceRecords) {
      // Find the active rate at the time of the shift (or currently active)
      const wageAssignment = await WageAssignment.findOne({
        labourId: record.workerId,
        projectId: record.projectId,
        status: 'active',
      }).sort({ effectiveFrom: -1 })

      if (wageAssignment) {
        // Calculate amount (could involve half-day logic, overtime, etc.)
        // Default to the full daily rate if marked present
        const amount = wageAssignment.dailyRate // Add multipliers here if needed based on totalHours

        const ledger = await EarningsLedger.create({
          labourId: record.workerId,
          projectId: record.projectId,
          vendorId: record.vendorId,
          date: record.shiftDate,
          attendanceStatus: record.attendanceStatus,
          rateApplied: wageAssignment.dailyRate,
          amount,
          attendanceRecordId: record._id,
          status: 'accrued',
        })
        createdLedgers.push(ledger)
      }
    }
    return createdLedgers
  },

  /**
   * Groups all 'accrued' ledgers into PayoutBatches based on a cycle.
   */
  async generatePayoutBatches() {
    // Find all accrued ledgers without a batch
    const accruedLedgers = await EarningsLedger.find({
      status: 'accrued',
      payoutBatchId: null,
    })

    // Group by vendor, project, labour
    const grouped = {}
    for (const ledger of accruedLedgers) {
      const key = `${ledger.vendorId}_${ledger.projectId}_${ledger.labourId}`
      if (!grouped[key]) {
        grouped[key] = {
          vendorId: ledger.vendorId,
          projectId: ledger.projectId,
          labourId: ledger.labourId,
          ledgers: [],
          totalAmount: 0,
          periodStart: ledger.date,
          periodEnd: ledger.date,
        }
      }
      grouped[key].ledgers.push(ledger)
      grouped[key].totalAmount += ledger.amount
      
      if (ledger.date < grouped[key].periodStart) grouped[key].periodStart = ledger.date
      if (ledger.date > grouped[key].periodEnd) grouped[key].periodEnd = ledger.date
    }

    const createdBatches = []
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      for (const key of Object.keys(grouped)) {
        const group = grouped[key]
        if (group.totalAmount > 0) {
          const batch = await PayoutBatch.create(
            [
              {
                labourId: group.labourId,
                projectId: group.projectId,
                vendorId: group.vendorId,
                periodStart: group.periodStart,
                periodEnd: group.periodEnd,
                totalAmount: group.totalAmount,
                status: 'pending_approval',
              },
            ],
            { session }
          )

          await EarningsLedger.updateMany(
            { _id: { $in: group.ledgers.map(l => l._id) } },
            { $set: { payoutBatchId: batch[0]._id, status: 'included_in_payout' } },
            { session }
          )

          createdBatches.push(batch[0])
        }
      }
      await session.commitTransaction()
      return createdBatches
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  },

  /**
   * Approves a PayoutBatch, transferring funds from vendor to labour.
   */
  async approvePayoutBatch(vendorId, batchId) {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const batch = await PayoutBatch.findOne({ _id: batchId, vendorId }).session(session)
      if (!batch) throw new Error('Batch not found or unauthorized')
      if (batch.status === 'approved' || batch.status === 'paid') throw new Error('Batch already processed')

      const vendor = await User.findById(vendorId).session(session)
      const labour = await User.findById(batch.labourId).session(session)

      if (!vendor || !labour) throw new Error('Vendor or Labour not found')

      // Check sufficient funds (Option B: Hold & Alert logic can trigger here if batch.status is set to 'insufficient_funds')
      if (vendor.walletBalance < batch.totalAmount) {
        batch.status = 'insufficient_funds'
        await batch.save({ session })
        await session.commitTransaction()
        // TODO: Send alert notification to vendor & admin
        return { success: false, message: 'Insufficient vendor wallet balance. Batch put on hold.', batch }
      }

      // Perform wallet transfer
      vendor.walletBalance -= batch.totalAmount
      labour.walletBalance += batch.totalAmount

      await vendor.save({ session })
      await labour.save({ session })

      // Create transactions
      const txIdDebit = `TX-PAYROLL-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      await WalletTransaction.create(
        [
          {
            transactionId: txIdDebit,
            projectId: batch.projectId,
            labourId: batch.labourId,
            payerId: vendorId,
            payerType: 'vendor',
            type: 'Settlement', // or Payroll
            source: 'payroll_payout',
            amount: batch.totalAmount,
            status: 'Completed',
          },
        ],
        { session }
      )

      const txIdCredit = `TX-PAYROLL-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      await WalletTransaction.create(
        [
          {
            transactionId: txIdCredit,
            projectId: batch.projectId,
            labourId: batch.labourId, // Receives funds
            payerId: vendorId, // Source is vendor
            payerType: 'labour',
            type: 'Settlement',
            source: 'payroll_payout',
            amount: batch.totalAmount,
            status: 'Completed',
          },
        ],
        { session }
      )

      // Mark batch as paid
      batch.status = 'paid'
      batch.approvedAt = new Date()
      batch.paidAt = new Date()
      await batch.save({ session })

      // Mark ledgers as paid
      await EarningsLedger.updateMany(
        { payoutBatchId: batch._id },
        { $set: { status: 'paid' } },
        { session }
      )

      await session.commitTransaction()
      return { success: true, batch }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  },
}
