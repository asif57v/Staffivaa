import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { EnterpriseJob } from '../models/EnterpriseJob.js'
import { EnterpriseApplication } from '../models/EnterpriseApplication.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to DB')

  // 1. Find Enterprise and Joined Application
  const enterprise = await User.findOne({ role: 'enterprise', 'enterpriseProfile.companyName': 'Apple' })
  if (!enterprise) {
    console.error('Enterprise Apple not found')
    process.exit(1)
  }

  const app = await EnterpriseApplication.findOne({
    enterpriseId: enterprise._id,
    status: 'joined',
  }).populate('workerId').populate('jobId')

  if (!app) {
    console.error('No joined worker application found for enterprise')
    process.exit(1)
  }

  console.log(`Found Joined Worker: ${app.workerId?.fullName} (${app.workerId?.phone}) on Job: "${app.jobId?.jobTitle}"`)

  // 2. Create 5 days of attendance for current month up to today
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const todayDate = now.getDate()

  const datesToCreate = []
  const startDay = Math.max(1, todayDate - 4)
  for (let d = startDay; d <= todayDate; d++) {
    datesToCreate.push(new Date(currentYear, currentMonth, d))
  }

  console.log(`Generating attendance for ${datesToCreate.length} days...`)

  for (const shiftDate of datesToCreate) {
    shiftDate.setHours(0, 0, 0, 0)
    const checkIn = new Date(shiftDate)
    checkIn.setHours(9, 15, 0, 0) // 9:15 AM
    const checkOut = new Date(shiftDate)
    checkOut.setHours(17, 45, 0, 0) // 5:45 PM (8.5 hrs)

    await AttendanceRecord.findOneAndUpdate(
      {
        workerId: app.workerId._id,
        shiftDate,
        enterpriseId: enterprise._id,
      },
      {
        $set: {
          enterpriseApplicationId: app._id,
          enterpriseJobId: app.jobId._id,
          enterpriseId: enterprise._id,
          workerId: app.workerId._id,
          shiftDate,
          checkInAt: checkIn,
          checkOutAt: checkOut,
          attendanceStatus: 'present',
          projectStatus: 'completed',
          status: 'completed',
          totalHours: 8.5,
          overtimeHours: 0.5,
          totalWorkingMinutes: 510,
          verifiedBy: 'labour',
          checkInLocation: {
            lat: 28.6139,
            lng: 77.2090,
            address: 'Industrial Plot 4, Noida Phase II',
          },
          checkOutLocation: {
            lat: 28.6139,
            lng: 77.2090,
            address: 'Industrial Plot 4, Noida Phase II',
          },
        },
      },
      { upsert: true, new: true }
    )
  }

  console.log('SUCCESS_TEST_ATTENDANCE_SEEDED')
  console.log(`Worker: ${app.workerId?.fullName} (Phone: ${app.workerId?.phone})`)
  console.log(`Enterprise: ${enterprise.fullName} - ${enterprise.enterpriseProfile?.companyName} (Phone: ${enterprise.phone})`)
  console.log(`Month: ${currentMonth + 1}, Year: ${currentYear}`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
