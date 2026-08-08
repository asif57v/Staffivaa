import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'
import routes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { globalLimiter } from './middleware/rateLimiters.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.set('trust proxy', 1)

app.use(helmet())
app.use('/audio', express.static(path.join(__dirname, 'audio')))
app.use(
  cors({
    origin: function (origin, callback) {
      callback(null, true)
    },
    credentials: true,
  }),
)
app.options('*', cors({ credentials: true, origin: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '12mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'labourchowck-api' })
})

app.use('/api/v1', globalLimiter, routes)

app.use(errorHandler)

export default app
