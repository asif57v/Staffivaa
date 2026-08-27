import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../services/socket.js'
import { store } from '../store/index.js'

/**
 * Calculates bearing / heading in degrees between two GPS coordinates
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return ((θ * 180) / Math.PI + 360) % 360
}

/**
 * Calculates straight line distance in meters between two coordinates
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Linear interpolation helper
 */
function lerp(start, end, t) {
  return start + (end - start) * t
}

/**
 * useWorkerLocationEmitter
 * Watches worker GPS and emits rate-limited live location updates to the booking's socket room.
 * Includes built-in simulated movement engine for easy testing.
 */
export function useWorkerLocationEmitter({ bookingId, isActive = true, onLocationChange }) {
  const [currentPosition, setCurrentPosition] = useState(null)
  const [heading, setHeading] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [isEmitting, setIsEmitting] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [lastEmittedAt, setLastEmittedAt] = useState(null)

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationStep, setSimulationStep] = useState(0)
  const [simulationTotalSteps, setSimulationTotalSteps] = useState(20)

  const lastPositionRef = useRef(null)
  const lastEmitTimeRef = useRef(0)
  const lastHeadingRef = useRef(0)
  const watchIdRef = useRef(null)
  const simulationTimerRef = useRef(null)

  // Join the dedicated worker booking room on socket
  useEffect(() => {
    if (!bookingId || !isActive) return

    const socket = getSocket()
    if (!socket) return

    const token = store.getState()?.auth?.token || localStorage.getItem('token')

    const joinRoom = () => {
      socket.emit('worker:joinBooking', { bookingId, token })
    }

    if (socket.connected) {
      joinRoom()
    }

    socket.on('connect', joinRoom)

    return () => {
      socket.off('connect', joinRoom)
    }
  }, [bookingId, isActive])

  // Function to emit location with throttling
  const emitLocation = useCallback(
    (lat, lng, deviceHeading, deviceSpeed, isSimulationBypass = false) => {
      const socket = getSocket()
      if (!socket || !socket.connected || !bookingId) return

      const now = Date.now()
      if (!isSimulationBypass && now - lastEmitTimeRef.current < 2800) {
        return
      }

      let computedHeading = deviceHeading
      if (computedHeading == null || isNaN(computedHeading)) {
        if (lastPositionRef.current) {
          const dist = calculateDistanceMeters(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            lat,
            lng
          )
          if (dist >= 2) {
            computedHeading = calculateBearing(
              lastPositionRef.current.lat,
              lastPositionRef.current.lng,
              lat,
              lng
            )
            lastHeadingRef.current = computedHeading
          } else {
            computedHeading = lastHeadingRef.current
          }
        } else {
          computedHeading = lastHeadingRef.current || 0
        }
      } else {
        lastHeadingRef.current = computedHeading
      }

      setHeading(Math.round(computedHeading || 0))
      setSpeed(Math.max(0, Math.round((deviceSpeed || 0) * 3.6)))

      const token = store.getState()?.auth?.token || localStorage.getItem('token')
      const payload = {
        bookingId,
        lat,
        lng,
        heading: Math.round(computedHeading || 0),
        speed: Math.max(0, Math.round((deviceSpeed || 0) * 3.6)),
        timestamp: now,
        token,
      }

      socket.emit('worker:locationUpdate', payload)
      lastEmitTimeRef.current = now
      setLastEmittedAt(new Date(now))
      setIsEmitting(true)
    },
    [bookingId]
  )

  // Start watching real position when not simulating
  useEffect(() => {
    if (!isActive || isSimulating) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (!isSimulating) setIsEmitting(false)
      return
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      return
    }

    const successHandler = (position) => {
      const { latitude: lat, longitude: lng, heading: rawHeading, speed: rawSpeed } = position.coords
      const posObj = { lat, lng }

      setCurrentPosition(posObj)
      setGpsError(null)
      setPermissionDenied(false)

      if (onLocationChange) {
        onLocationChange(posObj)
      }

      emitLocation(lat, lng, rawHeading, rawSpeed)
      lastPositionRef.current = posObj
    }

    const errorHandler = (error) => {
      console.warn('[useWorkerLocationEmitter GPS Error]:', error.message)
      if (error.code === error.PERMISSION_DENIED) {
        setPermissionDenied(true)
        setGpsError('Location permission denied. Please enable GPS in browser settings.')
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setGpsError('GPS signal unavailable. Please ensure location is turned on.')
      } else if (error.code === error.TIMEOUT) {
        setGpsError('GPS location request timed out.')
      } else {
        setGpsError(error.message)
      }
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 2500,
      timeout: 10000,
    }

    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, options)
    watchIdRef.current = navigator.geolocation.watchPosition(successHandler, errorHandler, options)

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isActive, isSimulating, emitLocation, onLocationChange])

  // Simulation Engine (Takes start -> destination, steps over time)
  const startSimulation = useCallback(
    (origin, destination, totalSteps = 20, intervalMs = 3000) => {
      if (!origin || !destination) return

      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current)
      }

      setIsSimulating(true)
      setSimulationTotalSteps(totalSteps)
      setSimulationStep(0)

      let currentStep = 0
      let prevPoint = { lat: origin.lat, lng: origin.lng }
      setCurrentPosition(prevPoint)

      simulationTimerRef.current = setInterval(() => {
        currentStep++
        if (currentStep > totalSteps) {
          clearInterval(simulationTimerRef.current)
          simulationTimerRef.current = null
          setIsSimulating(false)
          return
        }

        const t = currentStep / totalSteps
        const curLat = lerp(origin.lat, destination.lat, t)
        const curLng = lerp(origin.lng, destination.lng, t)
        const curPoint = { lat: curLat, lng: curLng }

        const stepBearing = calculateBearing(prevPoint.lat, prevPoint.lng, curLat, curLng)
        prevPoint = curPoint

        setCurrentPosition(curPoint)
        setSimulationStep(currentStep)

        if (onLocationChange) {
          onLocationChange(curPoint)
        }

        // 30 km/h = 8.33 m/s
        emitLocation(curLat, curLng, stepBearing, 8.33, true)
      }, intervalMs)
    },
    [emitLocation, onLocationChange]
  )

  const stopSimulation = useCallback(() => {
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current)
      simulationTimerRef.current = null
    }
    setIsSimulating(false)
    setSimulationStep(0)
  }, [])

  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current)
      }
    }
  }, [])

  return {
    currentPosition,
    heading,
    speed,
    isEmitting,
    gpsError,
    permissionDenied,
    lastEmittedAt,
    isSimulating,
    simulationStep,
    simulationTotalSteps,
    startSimulation,
    stopSimulation,
  }
}
