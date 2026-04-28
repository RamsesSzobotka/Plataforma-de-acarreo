import { Hono } from 'hono/tiny'
import { User } from '../../models/user'
import { Driver } from '../../models/driver'
import { Ride } from '../../models/ride'

const app = new Hono()

app.get('/stats', async (c) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'client' })
    const totalDrivers = await Driver.countDocuments()
    const totalRides = await Ride.countDocuments()
    const pendingDrivers = await Driver.countDocuments({ verificationStatus: 'pending' })
    const completedRides = await Ride.countDocuments({ status: 'completed' })
    const paidRides = await Ride.countDocuments({ status: 'paid' })

    const paidRideDocs = await Ride.find({ status: 'paid' }).select('finalPrice')
    const totalRevenue = paidRideDocs.reduce((sum, r) => sum + (r.finalPrice || 0), 0)
    const platformRevenue = totalRevenue * 0.10

    const ridesByStatus = await Ride.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const ridesByMonth = await Ride.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { 
        $group: { 
          _id: { 
            year: { $year: '$createdAt' }, 
            month: { $month: '$createdAt' } 
          },
          count: { $sum: 1 },
          revenue: { $sum: '$finalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 }
    ])

    const driversByStatus = await Driver.aggregate([
      { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
    ])

    return c.json({
      stats: {
        totalUsers,
        totalDrivers,
        totalRides,
        pendingDrivers,
        completedRides,
        paidRides,
        totalRevenue,
        platformRevenue
      },
      ridesByStatus: ridesByStatus.reduce((acc, r) => {
        acc[r._id || 'unknown'] = r.count
        return acc
      }, {} as Record<string, number>),
      ridesByMonth: ridesByMonth.map(r => ({
        month: r._id.year + '-' + String(r._id.month).padStart(2, '0'),
        count: r.count,
        revenue: r.revenue || 0
      })),
      driversByStatus: driversByStatus.reduce((acc, r) => {
        acc[r._id || 'unknown'] = r.count
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return c.json({ error: 'Error fetching stats' }, 500)
  }
})

export default app