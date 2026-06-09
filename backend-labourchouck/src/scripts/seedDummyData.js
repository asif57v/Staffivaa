import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourCategoryGroup } from '../models/LabourCategoryGroup.js'
import { USER_ROLES, CORPORATE_STATUS, KYC_STATUS } from '../constants/roles.js'
import bcrypt from 'bcryptjs'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to DB')

  const passwordHash = await bcrypt.hash('password123', 12)

  // Seed Group
  let group = await LabourCategoryGroup.findOne({ slug: 'trades' })
  if (!group) {
    group = await LabourCategoryGroup.create({
      name: 'Trades',
      slug: 'trades',
      description: 'General construction trades',
      kind: 'trade'
    })
  }

  // Seed Categories
  const catNames = ['Plumber', 'Electrician', 'Carpenter', 'Mason', 'Painter']
  const cats = []
  for (const name of catNames) {
    let cat = await LabourCategory.findOne({ name })
    if (!cat) {
      cat = await LabourCategory.create({
        name,
        slug: name.toLowerCase(),
        description: `Professional ${name}`,
        group: group._id,
        isActive: true,
        baseRateDaily: 500
      })
    }
    cats.push(cat)
  }
  console.log('Categories seeded')

  // Seed Labour Users
  for (let i = 1; i <= 5; i++) {
    const phone = `900000000${i}`
    const kycStates = [KYC_STATUS.PENDING, KYC_STATUS.VERIFIED, KYC_STATUS.FAILED, KYC_STATUS.PENDING, KYC_STATUS.VERIFIED]
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          phone,
          fullName: `Labour Worker ${i}`,
          role: USER_ROLES.LABOUR,
          passwordHash,
          isActive: true,
          labourProfile: {
            kycStatus: kycStates[i-1],
            kycSubmittedAt: new Date(),
            categoryIds: [cats[i % cats.length]._id]
          }
        }
      },
      { upsert: true }
    )
  }
  console.log('Labour users seeded')

  // Seed Corporate Users
  for (let i = 1; i <= 3; i++) {
    const phone = `800000000${i}`
    const statuses = [CORPORATE_STATUS.PENDING, CORPORATE_STATUS.APPROVED, CORPORATE_STATUS.REJECTED]
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          phone,
          fullName: `Corporate Contact ${i}`,
          email: `corp${i}@example.com`,
          role: USER_ROLES.CORPORATE,
          passwordHash,
          isActive: true,
          corporateProfile: {
            companyName: `Corporate Entity ${i}`,
            gstNumber: `22AAAAA0000A1Z${i}`,
            status: statuses[i-1],
            documentsSubmittedAt: new Date(),
            documents: [
              { documentType: 'gst', url: 'https://example.com/doc.pdf', uploadedAt: new Date() }
            ]
          }
        }
      },
      { upsert: true }
    )
  }
  console.log('Corporate users seeded')

  // Seed Vendor Users
  for (let i = 1; i <= 2; i++) {
    const phone = `700000000${i}`
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          phone,
          fullName: `Vendor Contact ${i}`,
          role: USER_ROLES.CONTRACTOR,
          passwordHash,
          isActive: true,
          contractorProfile: {
            businessName: `Vendor Agency ${i}`,
            vendorType: 'agency',
            verificationStatus: i === 1 ? 'pending' : 'approved',
            documentsSubmittedAt: new Date(),
            documents: [
              { documentType: 'pan', url: 'https://example.com/doc.pdf', uploadedAt: new Date() }
            ]
          }
        }
      },
      { upsert: true }
    )
  }
  console.log('Vendor users seeded')

  await mongoose.disconnect()
  console.log('Done.')
}

run().catch(console.error)
