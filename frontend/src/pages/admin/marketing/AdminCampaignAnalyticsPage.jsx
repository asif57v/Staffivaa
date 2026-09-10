import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Layers,
  ArrowUpRight,
  Download,
  RefreshCw,
  Calendar,
  Sparkles,
  Tag,
  Tv,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { apiClient } from '../../../api/http.js'

const CHANNEL_COLORS = {
  'Offers & Discounts': '#10b981',
  'Sponsored Ads': '#0284c7',
  'Banners': '#8b5cf6',
}

const PIE_COLORS = ['#10b981', '#0284c7', '#8b5cf6', '#f59e0b']

function CustomChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-md text-xs">
        <p className="font-bold text-slate-800 mb-1.5 border-b border-slate-100 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-bold font-mono text-slate-900">
                {entry.name.includes('CTR') ? `${entry.value}%` : entry.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function AdminCampaignAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoSync, setAutoSync] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [timeRange, setTimeRange] = useState('30') // '7', '14', '30'
  const [chartType, setChartType] = useState('area') // 'area', 'bar'
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('ALL') // 'ALL', 'Offer', 'Sponsored Ad', 'Banner'
  const [searchQuery, setSearchQuery] = useState('')

  const [stats, setStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    totalAds: 0,
    activeAds: 0,
    totalBanners: 0,
    activeBanners: 0,
    totalViews: 0,
    totalClicks: 0,
    overallCtr: 0,
    breakdown: {
      offers: { total: 0, active: 0, views: 0, clicks: 0 },
      ads: { total: 0, active: 0, views: 0, clicks: 0 },
      banners: { total: 0, active: 0, views: 0, clicks: 0 },
    },
    channelDistribution: [],
    topCampaigns: [],
    trendData: [],
  })

  const fetchAnalytics = async (mode = 'initial') => {
    if (mode === 'manual') setRefreshing(true)
    else if (mode === 'initial') setLoading(true)
    // mode === 'background' performs silent background update without loading spinners
    try {
      const res = await apiClient.get('/admin/marketing/analytics')
      if (res.data.success && res.data.data?.analytics) {
        const data = res.data.data.analytics
        setStats({
          totalOffers: data.totalOffers || 0,
          activeOffers: data.activeOffers || 0,
          totalAds: data.totalAds || 0,
          activeAds: data.activeAds || 0,
          totalBanners: data.totalBanners || 0,
          activeBanners: data.activeBanners || 0,
          totalViews: data.totalViews || 0,
          totalClicks: data.totalClicks || 0,
          overallCtr: data.overallCtr || (data.totalViews > 0 ? Number(((data.totalClicks / data.totalViews) * 100).toFixed(2)) : 0),
          breakdown: data.breakdown || {
            offers: { total: data.totalOffers, active: data.activeOffers, views: 0, clicks: 0 },
            ads: { total: data.totalAds, active: data.activeAds, views: 0, clicks: 0 },
            banners: { total: 0, active: 0, views: 0, clicks: 0 },
          },
          channelDistribution: data.channelDistribution || [],
          topCampaigns: data.topCampaigns || [],
          trendData: data.trendData || [],
        })
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error('Failed to load analytics', e)
    } finally {
      if (mode === 'initial') setLoading(false)
      if (mode === 'manual') setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics('initial')
  }, [])

  // Auto real-time background sync every 12 seconds
  useEffect(() => {
    if (!autoSync) return
    const interval = setInterval(() => {
      fetchAnalytics('background')
    }, 12000)
    return () => clearInterval(interval)
  }, [autoSync])

  // Filter trend data by selected time range
  const filteredTrendData = useMemo(() => {
    const raw = stats.trendData || []
    const days = parseInt(timeRange, 10) || 30
    if (raw.length <= days) return raw
    return raw.slice(raw.length - days)
  }, [stats.trendData, timeRange])

  // Filter leaderboard table
  const filteredTopCampaigns = useMemo(() => {
    let list = stats.topCampaigns || []
    if (campaignTypeFilter !== 'ALL') {
      list = list.filter((c) => c.type === campaignTypeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((c) => c.name?.toLowerCase().includes(q))
    }
    return list
  }, [stats.topCampaigns, campaignTypeFilter, searchQuery])

  // CSV Export
  const handleExportCsv = () => {
    const dataList = stats.topCampaigns || []
    if (!dataList.length) return
    const headers = ['Name', 'Type', 'Status', 'Views/Impressions', 'Clicks', 'CTR (%)']
    const rows = [headers.join(',')]
    dataList.forEach((c) => {
      const name = `"${(c.name || '').replace(/"/g, '""')}"`
      const type = c.type
      const status = c.isActive ? 'Active' : 'Inactive'
      const views = c.views || 0
      const clicks = c.clicks || 0
      const ctr = `${c.ctr || 0}%`
      rows.push([name, type, status, views, clicks, ctr].join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `Campaign_Analytics_${new Date().toISOString().split('T')[0]}.csv`)
    a.click()
  }

  // Distribution chart data
  const pieData = useMemo(() => {
    if (stats.channelDistribution && stats.channelDistribution.length > 0) {
      return stats.channelDistribution.filter((d) => d.views > 0 || d.clicks > 0)
    }
    return [
      { name: 'Offers & Discounts', value: stats.breakdown.offers?.views || 1, views: stats.breakdown.offers?.views || 0, clicks: stats.breakdown.offers?.clicks || 0 },
      { name: 'Sponsored Ads', value: stats.breakdown.ads?.views || 1, views: stats.breakdown.ads?.views || 0, clicks: stats.breakdown.ads?.clicks || 0 },
      { name: 'Banners', value: stats.breakdown.banners?.views || 1, views: stats.breakdown.banners?.views || 0, clicks: stats.breakdown.banners?.clicks || 0 },
    ]
  }, [stats.channelDistribution, stats.breakdown])

  const channelComparisonData = useMemo(() => {
    return [
      {
        name: 'Offers',
        views: stats.breakdown?.offers?.views || 0,
        clicks: stats.breakdown?.offers?.clicks || 0,
        ctr: (stats.breakdown?.offers?.views || 0) > 0 ? Number((((stats.breakdown?.offers?.clicks || 0) / (stats.breakdown?.offers?.views || 1)) * 100).toFixed(1)) : 0,
      },
      {
        name: 'Sponsored Ads',
        views: stats.breakdown?.ads?.views || 0,
        clicks: stats.breakdown?.ads?.clicks || 0,
        ctr: (stats.breakdown?.ads?.views || 0) > 0 ? Number((((stats.breakdown?.ads?.clicks || 0) / (stats.breakdown?.ads?.views || 1)) * 100).toFixed(1)) : 0,
      },
      {
        name: 'Banners',
        views: stats.breakdown?.banners?.views || 0,
        clicks: stats.breakdown?.banners?.clicks || 0,
        ctr: (stats.breakdown?.banners?.views || 0) > 0 ? Number((((stats.breakdown?.banners?.clicks || 0) / (stats.breakdown?.banners?.views || 1)) * 100).toFixed(1)) : 0,
      },
    ]
  }, [stats.breakdown])

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-7 w-56 bg-slate-200 rounded-lg" />
            <div className="h-4 w-80 bg-slate-200 rounded-lg mt-2" />
          </div>
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Campaign Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {autoSync ? 'Real-Time Live' : 'Live Paused'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Last sync: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Real-time performance metrics, trend charts, and conversion analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              autoSync
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            Auto-Sync: {autoSync ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => fetchAnalytics('manual')}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand text-white hover:bg-brand-dark transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-5 bg-linear-to-br from-emerald-50/50 to-white border border-emerald-100/80 shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Active Offers
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.activeOffers}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Out of {stats.totalOffers} total offers</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-700 group-hover:scale-110 transition">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <Link
            to="/admin/marketing/offers"
            className="mt-3.5 pt-3 border-t border-emerald-100/60 flex items-center justify-between text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            <span>Manage offers</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </GlassPanel>

        <GlassPanel className="p-5 bg-linear-to-br from-sky-50/50 to-white border border-sky-100/80 shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5" /> Sponsored Ads
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.activeAds}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Out of {stats.totalAds} total ads</p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-100/70 text-sky-700 group-hover:scale-110 transition">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <Link
            to="/admin/marketing/ads"
            className="mt-3.5 pt-3 border-t border-sky-100/60 flex items-center justify-between text-xs font-bold text-sky-700 hover:text-sky-900"
          >
            <span>Manage ads</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </GlassPanel>

        <GlassPanel className="p-5 bg-linear-to-br from-violet-50/50 to-white border border-violet-100/80 shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Total Views
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.totalViews.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Across all campaign types</p>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-100/70 text-violet-700 group-hover:scale-110 transition">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-violet-100/60 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Active banners</span>
            <span className="font-bold text-slate-800">{stats.activeBanners} active</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 bg-linear-to-br from-amber-50/50 to-white border border-amber-100/80 shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" /> Total Clicks (CTR)
              </p>
              <p className="text-3xl font-black text-slate-900 mt-2">{stats.totalClicks.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{stats.overallCtr}% average CTR</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100/70 text-amber-700 group-hover:scale-110 transition">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-amber-100/60 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Engagement status</span>
            <span className="font-bold text-emerald-600">Optimal</span>
          </div>
        </GlassPanel>
      </div>

      {/* Main Performance Trends Chart */}
      <GlassPanel className="p-6 bg-white border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Campaign Performance Trends</h2>
            <p className="text-xs text-slate-500 mt-0.5">Daily impressions, user clicks, and dynamic CTR over time</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Chart type toggle */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartType === 'area' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Area Trend
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartType === 'bar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bar Chart
              </button>
            </div>

            {/* Time range toggle */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTimeRange('7')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeRange === '7' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('14')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeRange === '14' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                14 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('30')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  timeRange === '30' ? 'bg-brand text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={filteredTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Views (Impressions)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#viewsGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#clicksGrad)"
                />
              </AreaChart>
            ) : (
              <BarChart data={filteredTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="views" name="Views (Impressions)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="clicks" name="Clicks" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      {/* Breakdown Section: Channel Distribution & Channel Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Share Donut */}
        <GlassPanel className="p-6 bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Engagement by Campaign Type</h3>
              <p className="text-xs text-slate-500">Distribution of views across active channels</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHANNEL_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(val, name, item) => [
                    `${val.toLocaleString()} views (${item.payload.clicks || 0} clicks)`,
                    name,
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Mini Channel Summary */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100/80">
              <p className="text-[11px] font-bold text-emerald-800">Offers</p>
              <p className="text-sm font-black text-emerald-950 mt-0.5">
                {(stats.breakdown?.offers?.views || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">{stats.breakdown?.offers?.clicks || 0} clicks</p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100/80">
              <p className="text-[11px] font-bold text-sky-800">Sponsored Ads</p>
              <p className="text-sm font-black text-sky-950 mt-0.5">
                {(stats.breakdown?.ads?.views || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-sky-600 font-semibold">{stats.breakdown?.ads?.clicks || 0} clicks</p>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-50/70 border border-violet-100/80">
              <p className="text-[11px] font-bold text-violet-800">Banners</p>
              <p className="text-sm font-black text-violet-950 mt-0.5">
                {(stats.breakdown?.banners?.views || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-violet-600 font-semibold">{stats.breakdown?.banners?.clicks || 0} clicks</p>
            </div>
          </div>
        </GlassPanel>

        {/* Channel CTR Comparison Bar */}
        <GlassPanel className="p-6 bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">CTR & Conversion Comparison</h3>
              <p className="text-xs text-slate-500">Average Click-Through Rate (%) across channels</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                <RechartsTooltip
                  formatter={(val, name) => [`${val}%`, 'Click-Through Rate']}
                />
                <Bar dataKey="ctr" name="CTR (%)" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {channelComparisonData.map((entry, index) => (
                    <Cell
                      key={`cell-bar-${index}`}
                      fill={entry.name === 'Offers' ? '#10b981' : entry.name === 'Sponsored Ads' ? '#0284c7' : '#8b5cf6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand shrink-0" />
            <span>
              <strong>Tip:</strong> Promotional discounts and limited-time offers generate the highest engagement rates on mobile screens.
            </span>
          </div>
        </GlassPanel>
      </div>

      {/* Top Performing Campaigns Table / Leaderboard */}
      <GlassPanel className="p-6 bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Campaign Performance Leaderboard</h3>
            <p className="text-xs text-slate-500">Ranked by impressions, click engagement, and conversion CTR</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search query */}
            <input
              type="text"
              placeholder="Search campaign name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-brand/30 w-44"
            />

            {/* Filter buttons */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              {['ALL', 'Offer', 'Sponsored Ad', 'Banner'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCampaignTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    campaignTypeFilter === type
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Campaign Details</th>
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Views / Impr.</th>
                <th className="p-3.5 text-right">Clicks</th>
                <th className="p-3.5 text-right">CTR</th>
                <th className="p-3.5 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTopCampaigns.length > 0 ? (
                filteredTopCampaigns.map((camp, idx) => {
                  const channelBadge = {
                    Offer: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
                    'Sponsored Ad': 'bg-sky-50 text-sky-700 border-sky-200/70',
                    Banner: 'bg-violet-50 text-violet-700 border-violet-200/70',
                  }[camp.type] || 'bg-slate-50 text-slate-700 border-slate-200'

                  const linkTo = {
                    Offer: '/admin/marketing/offers',
                    'Sponsored Ad': '/admin/marketing/ads',
                    Banner: '/admin/marketing/banners',
                  }[camp.type] || '/admin/marketing'

                  return (
                    <tr key={camp.id || idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 max-w-xs truncate">{camp.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {camp.id?.slice?.(-6) || '—'}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${channelBadge}`}>
                          {camp.type}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {camp.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            <XCircle className="w-3.5 h-3.5" /> Paused
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                        {camp.views.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-800">
                        {camp.clicks.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className="font-mono font-black text-brand text-xs">{camp.ctr}%</span>
                      </td>
                      <td className="p-3.5 text-center">
                        <Link
                          to={linkTo}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-brand hover:bg-brand/10 transition"
                          title="View campaign settings"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No campaign records match your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}

