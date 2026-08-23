import jwt from 'jsonwebtoken'

export function signAccessToken(user, sessionId) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  const sid = sessionId || user.activeSessionId || null
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      phone: user.phone,
      sid,
    },
    secret,
    { expiresIn },
  )
}

export function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return jwt.verify(token, secret)
}
