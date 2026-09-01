import { useMemo } from 'react'
import { useWorkerLocationEmitter } from '../../hooks/useWorkerLocationEmitter.js'

function resolveRequestId(assignment) {
  if (!assignment?.requestId) return null
  const req = assignment.requestId
  const id = typeof req === 'object' ? req?._id : req
  return id ? String(id) : null
}

/**
 * Keeps worker GPS broadcasting for active travelling assignments
 * so customers can see live location without opening the navigation screen.
 */
export function WorkerLiveLocationBridge({ assignments }) {
  const travellingRequestId = useMemo(() => {
    if (!Array.isArray(assignments)) return null

    const travelling = assignments.find((assignment) => {
      const status = String(assignment?.status || '').toLowerCase()
      return status === 'accepted' && resolveRequestId(assignment)
    })

    return travelling ? resolveRequestId(travelling) : null
  }, [assignments])

  useWorkerLocationEmitter({
    bookingId: travellingRequestId,
    isActive: Boolean(travellingRequestId),
  })

  return null
}
