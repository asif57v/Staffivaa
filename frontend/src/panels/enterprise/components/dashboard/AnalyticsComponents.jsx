import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3 } from 'lucide-react'

const hiringData = [
  { name: 'Mon', actual: 120, target: 150 },
  { name: 'Tue', actual: 140, target: 150 },
  { name: 'Wed', actual: 180, target: 150 },
  { name: 'Thu', actual: 210, target: 200 },
  { name: 'Fri', actual: 240, target: 250 },
  { name: 'Sat', actual: 230, target: 250 },
  { name: 'Sun', actual: 250, target: 250 },
]

const departmentData = [
  { name: 'Ops', value: 45 },
  { name: 'Logist', value: 30 },
  { name: 'Mgmt', value: 25 },
]
const PIE_COLORS = ['#111827', '#FFC107', '#E2E8F0']

export function DashboardAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Hiring Bar Chart */}
      <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E7EB] flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#111827] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-400" /> Hiring Analytics
            </h2>
            <p className="text-[12px] font-medium text-slate-500 mt-1">Last 6 months projection</p>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
            <button className="px-3 py-1 text-[12px] font-bold text-slate-500 hover:text-slate-900 rounded-lg">Mon</button>
            <button className="px-3 py-1 text-[12px] font-bold bg-white text-[#111827] rounded-lg shadow-sm">Wk</button>
          </div>
        </div>
        
        <div className="flex-1 min-h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hiringData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={0} barSize={40}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
              <RechartsTooltip 
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', padding: '12px 16px', fontWeight: 'bold' }}
              />
              <Bar dataKey="target" fill="#FEF3C7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="actual" fill="#FFC107" radius={[6, 6, 0, 0]} style={{ transform: 'translateX(-40px)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex items-center justify-between mt-4 border-t border-slate-50 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFC107]"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEF3C7]"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target</span>
          </div>
        </div>
      </div>

      {/* Dept Split Pie Chart */}
      <div className="bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E7EB] flex flex-col">
        <h2 className="text-[16px] font-extrabold text-[#111827] mb-6">Dept Split</h2>
        
        <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={departmentData}
                cx="35%"
                cy="50%"
                innerRadius={65}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          <div className="absolute left-[35%] top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <span className="text-[20px] font-extrabold text-[#111827] leading-none">1.2k</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total</span>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 space-y-4">
            {departmentData.map((dept, idx) => (
              <div key={idx} className="flex items-center gap-8 justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }}></div>
                  <span className="text-[13px] font-bold text-slate-700">{dept.name}</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#111827]">{dept.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
