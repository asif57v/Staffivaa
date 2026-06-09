import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { Project } from '../models/Project.js'
import { Site } from '../models/Site.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { BuildMartLead } from '../models/BuildMartLead.js'
import { Allocation } from '../models/Allocation.js'
import { Assignment } from '../models/Assignment.js'
import { AttendanceRecord } from '../models/AttendanceRecord.js'
import { Invoice } from '../models/Invoice.js'
import { PricingRate } from '../models/PricingRate.js'
import { USER_ROLES } from '../constants/roles.js'
import bcrypt from 'bcryptjs'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to DB')

  const passwordHash = await bcrypt.hash('password123', 12)

  // 1. Seed Individual Users
  for (let i = 1; i <= 3; i++) {
    const phone = `600000000${i}`
    await User.findOneAndUpdate(
      { phone },
      {
        $set: {
          phone,
          fullName: `Individual Client ${i}`,
          role: USER_ROLES.INDIVIDUAL,
          passwordHash,
          isActive: true,
        }
      },
      { upsert: true }
    )
  }
  console.log('Individuals seeded')

  // Get references
  const corp = await User.findOne({ role: USER_ROLES.CORPORATE })
  const ind = await User.findOne({ role: USER_ROLES.INDIVIDUAL })
  const cat = await LabourCategory.findOne()
  const vendor = await User.findOne({ role: USER_ROLES.CONTRACTOR })
  const labour = await User.findOne({ role: USER_ROLES.LABOUR })

  // 2. Project and Site
  let project = await Project.findOne({ corporateId: corp._id })
  if (!project) {
    project = await Project.create({
      corporateId: corp._id,
      name: 'Skyline Towers Phase 1',
      status: 'active',
      startDate: new Date()
    })
  }

  let site = await Site.findOne({ projectId: project._id })
  if (!site) {
    site = await Site.create({
      projectId: project._id,
      corporateId: corp._id,
      name: 'Tower A Site',
      address: '123 Construction Avenue',
      city: 'Metro City'
    })
  }
  console.log('Project and Site seeded')

  // 3. Workforce Request
  let request = await WorkforceRequest.findOne({ clientId: corp._id })
  if (!request) {
    request = await WorkforceRequest.create({
      reference: 'WR-TEST-001',
      sourceType: 'corporate',
      clientId: corp._id,
      projectId: project._id,
      siteId: site._id,
      scheduleType: 'daily',
      startDate: new Date(),
      status: 'pending_review',
      lines: [{ categoryId: cat._id, quantity: 5 }]
    })
  }
  console.log('WorkforceRequest seeded')

  // 4. BuildMart Leads
  let lead = await BuildMartLead.findOne({ phone: '9999999999' })
  if (!lead) {
    await BuildMartLead.create({
      productId: 'PROD-001',
      productName: 'Cement Bags (50kg)',
      name: 'Ramesh Builder',
      phone: '9999999999',
      siteLocation: 'Downtown Site',
      quantity: '100',
      status: 'new'
    })
  }
  console.log('BuildMart leads seeded')

  // 5. Allocation & Assignment
  let allocation = await Allocation.findOne({ requestId: request._id })
  if (!allocation) {
    allocation = await Allocation.create({
      requestId: request._id,
      vendorId: vendor._id,
      notes: 'Vendor assigned for fulfillment'
    })
  }

  let assignment = await Assignment.findOne({ allocationId: allocation._id })
  if (!assignment) {
    assignment = await Assignment.create({
      allocationId: allocation._id,
      requestId: request._id,
      labourId: labour._id,
      vendorId: vendor._id,
      categoryId: cat._id,
      status: 'accepted'
    })
  }
  console.log('Allocation & Assignment seeded')

  // 6. Attendance
  let attendance = await AttendanceRecord.findOne({ assignmentId: assignment._id })
  if (!attendance) {
    await AttendanceRecord.create({
      assignmentId: assignment._id,
      requestId: request._id,
      labourId: labour._id,
      projectId: project._id,
      siteId: site._id,
      shiftDate: new Date(),
      status: 'present',
      verifiedBy: 'admin'
    })
  }
  console.log('Attendance seeded')

  // 7. Pricing Rate
  let pricing = await PricingRate.findOne({ categoryId: cat._id })
  if (!pricing) {
    await PricingRate.create({
      categoryId: cat._id,
      clientType: 'corporate',
      ratePerShift: 700,
      workerRatePerShift: 500,
      gstPercent: 18
    })
  }
  console.log('Pricing Rate seeded')

  // 8. Invoice
  let invoice = await Invoice.findOne({ corporateId: corp._id })
  if (!invoice) {
    await Invoice.create({
      invoiceNumber: 'INV-2023-001',
      corporateId: corp._id,
      projectId: project._id,
      type: 'attendance',
      status: 'issued',
      subtotal: 3500,
      gstTotal: 630,
      total: 4130,
      lines: [
        {
          description: 'Labour services (5 days)',
          billableUnits: 5,
          ratePerUnit: 700,
          amount: 3500,
          gstAmount: 630
        }
      ]
    })
  }
  console.log('Invoice seeded')

  await mongoose.disconnect()
  console.log('All dummy data seeded successfully.')
}

run().catch(console.error)
