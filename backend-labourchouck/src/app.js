import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { globalLimiter } from './middleware/rateLimiters.js'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: function (origin, callback) {
      callback(null, true)
    },
    credentials: true,
  }),
)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '12mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'labourchowck-api' })
})

app.use('/api/v1', globalLimiter, routes)

app.use(errorHandler)

export default app
