import 'dotenv/config'
import mongoose from 'mongoose'
import { io } from 'socket.io-client'
import { connectDb } from './src/config/db.js'
import { WorkforceRequest } from './src/models/WorkforceRequest.js'
import { User } from './src/models/User.js'
import { signAccessToken } from './src/services/tokenService.js'

function calculateBearing(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return ((θ * 180) / Math.PI + 360) % 360
}

function lerp(start, end, t) {
  return start + (end - start) * t
}

async function run() {
  await connectDb()
  console.log(' connected to database.')

  // Find latest active booking or take from command line arguments
  const bookingArg = process.argv[2]
  let request = null

  if (bookingArg) {
    request = await WorkforceRequest.findById(bookingArg)
  } else {
    request = await WorkforceRequest.findOne({
      status: { $in: ['accepted', 'in_progress', 'on_site', 'confirmed', 'pending_review'] },
    }).sort({ updatedAt: -1 })
  }

  if (!request) {
    request = await WorkforceRequest.findOne().sort({ createdAt: -1 })
  }

  if (!request) {
    console.error('❌ No bookings found in database to simulate!')
    process.exit(1)
  }

  console.log(`\n📋 Target Booking: #${request.reference || request._id}`)
  console.log(`📍 Status: ${request.status}`)

  const customerLat = request.locationLat || 22.7196
  const customerLng = request.locationLng || 75.8577

  // Starting position ~3 km away
  const startLat = customerLat - 0.025
  const startLng = customerLng - 0.025

  console.log(`🏁 Start: (${startLat.toFixed(5)}, ${startLng.toFixed(5)})`)
  console.log(`🎯 Destination: (${customerLat.toFixed(5)}, ${customerLng.toFixed(5)})\n`)

  // Create or mock a worker token
  let workerUser = null
  if (request.labourId) {
    workerUser = await User.findById(request.labourId)
  }
  if (!workerUser) {
    workerUser = await User.findOne({ role: 'labour' })
  }
  if (!workerUser) {
    workerUser = { _id: new mongoose.Types.ObjectId(), role: 'labour', phone: '9876543210' }
  }

  const token = signAccessToken(workerUser)

  const socket = io('http://localhost:5001', {
    auth: { token },
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => {
    console.log(`⚡ Connected to Socket.io server (${socket.id})`)
    socket.emit('worker:joinBooking', { bookingId: request._id.toString(), token })
  })

  socket.on('tracking:joined', (ack) => {
    console.log(` Joined tracking room: ${ack.room}`)
    console.log('🚀 Starting route simulation (20 steps, 1 step every 3 seconds)...\n')

    const totalSteps = 20
    let step = 0
    let prevPos = { lat: startLat, lng: startLng }

    const timer = setInterval(() => {
      step++
      if (step > totalSteps) {
        clearInterval(timer)
        console.log('\n🏁 Simulation finished! Worker arrived at destination.')
        socket.emit('tracking:stop', { bookingId: request._id.toString(), reason: 'arrived' })
        setTimeout(() => process.exit(0), 1000)
        return
      }

      const t = step / totalSteps
      const lat = lerp(startLat, customerLat, t)
      const lng = lerp(startLng, customerLng, t)
      const heading = calculateBearing(prevPos.lat, prevPos.lng, lat, lng)
      prevPos = { lat, lng }

      const payload = {
        bookingId: request._id.toString(),
        lat,
        lng,
        heading: Math.round(heading),
        speed: 28, // 28 km/h
        timestamp: Date.now(),
        token,
      }

      socket.emit('worker:locationUpdate', payload)
      console.log(
        `[Step ${step}/${totalSteps}] 📍 Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | 🧭 Heading: ${Math.round(
          heading
        )}° | 🚗 Speed: 28 km/h`
      )
    }, 3000)
  })

  socket.on('tracking:error', (err) => {
    console.error('❌ Tracking Error:', err)
  })
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
