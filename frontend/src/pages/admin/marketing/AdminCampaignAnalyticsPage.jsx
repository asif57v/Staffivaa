import React, { useState, useEffect } from 'react'
import { LineChart, BarChart3, Activity } from 'lucide-react'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { useAuth } from '../../../hooks/useAuth.js'

export function AdminCampaignAnalyticsPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    totalAds: 0,
    activeAds: 0,
    totalViews: 0,
    totalClicks: 0
  })

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiClient.get('/admin/marketing/analytics')
        if (res.data.success) {
          setStats(res.data.data.analytics)
        }
      } catch (e) {
        console.error('Failed to load analytics', e)
      }
    }
    fetchAnalytics()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Campaign Analytics</h1>
        <p className="text-sm text-slate-500">Real-time performance metrics for all marketing campaigns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-5 bg-white border border-slate-100 flex flex-col justify-center">
          <div className="text-slate-500 text-sm font-semibold mb-1 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Active Offers</div>
          <div className="text-3xl font-black text-slate-900">{stats.activeOffers}</div>
          <div className="text-xs text-slate-400 mt-1">Out of {stats.totalOffers} total offers</div>
        </GlassPanel>
        
        <GlassPanel className="p-5 bg-white border border-slate-100 flex flex-col justify-center">
          <div className="text-slate-500 text-sm font-semibold mb-1 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Active Sponsored Ads</div>
          <div className="text-3xl font-black text-slate-900">{stats.activeAds}</div>
          <div className="text-xs text-slate-400 mt-1">Out of {stats.totalAds} total ads</div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-white border border-slate-100 flex flex-col justify-center">
          <div className="text-slate-500 text-sm font-semibold mb-1">Total Views</div>
          <div className="text-3xl font-black text-slate-900">{stats.totalViews}</div>
          <div className="text-xs text-slate-400 mt-1">Across all campaigns</div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-white border border-slate-100 flex flex-col justify-center">
          <div className="text-slate-500 text-sm font-semibold mb-1">Total Clicks (CTR)</div>
          <div className="text-3xl font-black text-slate-900">{stats.totalClicks}</div>
          <div className="text-xs text-slate-400 mt-1">0.0% average CTR</div>
        </GlassPanel>
      </div>

      <GlassPanel className="p-10 text-center bg-white border border-slate-200 mt-8">
        <LineChart className="mx-auto w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Detailed charts coming soon</h3>
        <p className="text-sm text-slate-500 mt-2">Daily Views, Weekly Clicks, and Monthly Performance charts will appear here as data accumulates.</p>
      </GlassPanel>
    </div>
  )
}
