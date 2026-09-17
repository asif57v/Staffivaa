import 'dotenv/config'
import { connectDb } from '../src/config/db.js'
import { getTransactions } from '../src/controllers/adminWalletController.js'

async function test() {
  await connectDb()
  console.log('Testing exact query params: page=1&limit=10&search=&payerType=user&status=&type=')

  const req = {
    query: {
      page: '1',
      limit: '10',
      search: '',
      payerType: 'user',
      status: '',
      type: ''
    }
  }

  const res = {
    status(code) {
      console.log('HTTP Status Code:', code)
      return {
        json(data) {
          console.log('Response JSON success:', data.success)
          console.log('Returned items:', data?.data?.transactions?.length)
          console.log('Error message if any:', data.message)
        }
      }
    }
  }

  try {
    await getTransactions(req, res)
  } catch (err) {
    console.error('getTransactions crashed with exception:', err)
  }

  process.exit(0)
}

test().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
