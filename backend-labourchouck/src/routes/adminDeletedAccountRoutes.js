import { Router } from 'express'
import { param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  listDeletedAccounts,
  getDeletedAccount,
  getDeletedAccountRecords,
  getDeletedAccountKyc,
} from '../controllers/deletedAccountController.js'

const router = Router()
const idParam = [param('id').isMongoId().withMessage('Invalid id'), validateRequest]

router.use(protect, restrictTo('admin'))

router.get('/', listDeletedAccounts)
router.get('/:id', idParam, getDeletedAccount)
router.get('/:id/records', idParam, getDeletedAccountRecords)
router.get('/:id/kyc', idParam, getDeletedAccountKyc)

export default router
