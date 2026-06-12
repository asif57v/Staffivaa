const fs = require('fs');
const path = 'c:/Users/ASUS/OneDrive/Desktop/Appzeto1/staffivaa/frontend/src/pages/app/home/IndividualHomeScreen.jsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('{/* Nearby labour */}');
const endMarker = '      <CategoryPickBottomSheet';
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found');
  process.exit(1);
}

const replacement = `{/* Nearby labour */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.08 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Nearby Labour</h3>
            <button
              type="button"
              onClick={() => setShowAllLabours(true)}
              className="flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-1 mb-1">
            {TRUST_PILLS.map(({ icon: Icon, label }) => {
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-100 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <Icon className={\`h-3.5 w-3.5 \${label.includes('Aadhaar') ? 'text-emerald-500' : 'text-[#F4CC34]'}\`} aria-hidden />
                  {label}
                </span>
              )
            })}
          </div>

          {laboursErr ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-900">
              {laboursErr}
            </p>
          ) : null}

          {!laboursLoading && !laboursErr && labours.length === 0 ? (
            <GlassPanel className="border-dashed border-[#e2e8f0] bg-white p-6 text-center">
              <UserRound className="mx-auto h-10 w-10 text-[#A5B4FC]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[#3730A3]">No profiles in this filter yet</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A5B4FC]">
                Workers appear here once they pick work categories on Staffivaa. Try &quot;All&quot; or book and we&apos;ll match you manually.
              </p>
              <button
                type="button"
                onClick={() => setCategorySheetOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F4CC34] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-[1.05]"
              >
                Find a skill
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </GlassPanel>
          ) : null}

          {laboursLoading ? <AppListSkeleton rows={2} /> : null}

          {!laboursLoading && !laboursErr && nearbyLabours.length > 0 ? (
            <ul className="space-y-3">
              {nearbyLabours.slice(0, 1).map((l) => {
                const ui = l._ui
                const firstCat = (l.tradeCategories || [])[0]
                const dist = distanceLabelFor(l.id)
                const { label: availLabel, dot } = availabilityFromWorkHours(ui.workHoursLabel, ui.responseLabel)

                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(l.id)}
                      className="w-full text-left transition active:scale-[0.98]"
                    >
                      <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]">
                        <div className="flex items-start gap-4">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-50 ring-2 ring-slate-100">
                            <img src={ui.photoUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" decoding="async" />
                            <span aria-hidden className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="truncate text-[17px] font-bold tracking-tight text-slate-900">
                                {l.displayName}
                              </h4>
                              {l.kycVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-600">
                              {firstCat?.name || 'Skilled worker'}
                            </p>
                            
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {ui.rating.toFixed(1)} ({hashSeed(l.id, 200) + 20}+)
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                <ClipboardList className="h-3 w-3" /> {ui.experienceLabel}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-[8px] bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                <MapPin className="h-3 w-3" /> {dist}
                              </span>
                            </div>
                            
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                                <span className={\`h-1.5 w-1.5 rounded-full \${dot}\`} /> {availLabel}
                              </span>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </motion.section>

        {/* Ongoing / Recent Bookings */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.02 }}
          className="space-y-3 mt-8"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Ongoing / Recent Bookings</h3>
            <button
              type="button"
              onClick={() => navigate('/app/bookings')}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#3730A3] hover:text-[#312E81] transition"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Link
            to="/app/bookings"
            className="group flex items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100 active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4CC34] text-white shadow-sm">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-slate-900">Need workers on site?</p>
              <p className="text-[12px] font-medium text-slate-600 mt-0.5">Instant or scheduled booking with roles & site details</p>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>

          {bookingsLoading ? <AppListSkeleton rows={2} /> : null}

          {!bookingsLoading && recentBookings.length ? (
            <motion.div className="space-y-3 mt-3">
              {recentBookings.map((b, idx) => {
                const st = bookingStatusToUi(b.status)
                const primaryLine = (b.lines || [])[0]
                const itemLabel = primaryLine?.categoryName || (b.notes ? 'Service' : 'Labour')
                const qty = primaryLine?.quantity
                const day = formatBookingDay(b.serviceDate)
                const timeHint = b.bookingType === 'instant' ? 'Anytime' : 'Slot'

                return (
                  <motion.div
                    key={b.id || b.ref || idx}
                    initial={reduce ? undefined : { opacity: 0, y: 10 }}
                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: idx * 0.05 }}
                    className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-slate-100">
                        <img src={getCategoryImage(itemLabel)} alt="" className="h-full w-full object-cover" />
                      </div>
                      
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 rounded-[8px] bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            <CalendarClock className="h-3 w-3" />
                            {day} · {timeHint}
                          </span>
                          <span className={\`inline-flex items-center rounded-[8px] px-2 py-0.5 text-[10px] font-bold \${st.tone.replace('ring-1', '')} bg-opacity-20\`}>
                            {st.label}
                          </span>
                        </div>
                        
                        <h4 className="truncate text-[16px] font-bold text-slate-900">{itemLabel}</h4>
                        
                        <div className="mt-1 flex items-start gap-1 text-[11px] font-medium text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug">{b.address}</span>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-600">
                          {qty && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5" /> Qty: {qty}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <UserRound className="h-3.5 w-3.5" /> {b.assignedWorker ? '1 Worker' : 'Seeking Workers'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(\`/app/bookings?ref=\${encodeURIComponent(b.ref || '')}\`)}
                        className="flex-1 rounded-[12px] bg-[#F4CC34] px-4 py-2.5 text-[13px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.98]"
                      >
                        Track
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(\`/app/bookings?rebookFrom=\${encodeURIComponent(b.ref || '')}\`)}
                        className="flex-1 rounded-[12px] border-2 border-[#F4CC34] bg-white px-4 py-2.5 text-[13px] font-bold text-[#F4CC34] shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
                      >
                        Rebook
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : null}

          {!bookingsLoading && !recentBookings.length ? (
            <GlassPanel className="border-dashed border-[#e2e8f0] bg-white p-6 text-center">
              <UserRound className="mx-auto h-10 w-10 text-[#A5B4FC]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[#3730A3]">No bookings yet</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A5B4FC]">When you book labour, your history will appear here.</p>
            </GlassPanel>
          ) : null}
        </motion.section>

        {/* Boost hiring */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="space-y-3 mt-8"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900">Boost hiring</h3>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#3730A3] flex items-center gap-1">
              Swipe <ChevronRight className="h-3 w-3" />
            </span>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {/* Emergency */}
            <motion.div
              className="relative min-w-[85%] sm:min-w-[75%] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] snap-start flex gap-4"
              whileHover={reduce ? undefined : { y: -2 }}
            >
              <div className="flex-1 flex flex-col items-start">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                    <Sparkles className="h-2.5 w-2.5" /> Emergency
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                    <CalendarClock className="h-2.5 w-2.5" /> 30 min match
                  </span>
                </div>
                
                <h4 className="text-[16px] font-extrabold text-slate-900 leading-tight">Need Labour Urgently?</h4>
                <p className="mt-1 text-[12px] font-medium text-slate-500 line-clamp-2">Get verified workers assigned within 30 minutes.</p>
                
                <button
                  type="button"
                  onClick={() => setCategorySheetOpen(true)}
                  className="mt-4 inline-flex items-center gap-1 rounded-[10px] bg-[#F4CC34] px-4 py-2 text-[12px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.96]"
                >
                  Hire Now <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-20 shrink-0 self-end opacity-90">
                <ConstructionIllustration />
              </div>
            </motion.div>

            {/* BuildMart */}
            <motion.div
              className="relative min-w-[85%] sm:min-w-[75%] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] snap-start flex gap-4"
              whileHover={reduce ? undefined : { y: -2 }}
            >
              <div className="flex-1 flex flex-col items-start">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                    <LayoutGrid className="h-2.5 w-2.5" /> Materials
                  </span>
                </div>
                
                <h4 className="text-[16px] font-extrabold text-slate-900 leading-tight">Need Materials?</h4>
                <p className="mt-1 text-[12px] font-medium text-slate-500 line-clamp-2">Order cement, sand, steel & suppliers directly.</p>
                
                <button
                  type="button"
                  onClick={() => navigate('/app/buildmart')}
                  className="mt-4 inline-flex items-center gap-1 rounded-[10px] bg-[#F4CC34] px-4 py-2 text-[12px] font-bold text-slate-900 shadow-sm transition hover:brightness-[1.05] active:scale-[0.96]"
                >
                  Order Now <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="w-20 shrink-0 self-center">
                 {/* Placeholder for material box illustration */}
                 <div className="h-20 w-20 bg-amber-100 rounded-xl flex items-center justify-center">
                    <PaintRoller className="h-8 w-8 text-amber-500 opacity-50" />
                 </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Quick actions */}
        <section className="space-y-3 mt-8">
          <h3 className="px-1 text-[17px] font-bold tracking-tight text-slate-900">Quick actions</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            {[
              { id: 'book', title: 'Book Labour', icon: UserRound, color: 'bg-indigo-100 text-indigo-600', action: () => setCategorySheetOpen(true) },
              { id: 'history', title: 'My Bookings', icon: CalendarClock, color: 'bg-emerald-100 text-emerald-600', action: () => navigate('/app/bookings') },
              { id: 'support', title: 'Support', icon: Headphones, color: 'bg-rose-100 text-rose-600', action: () => navigate('/app/support') }
            ].map((a) => (
              <button
                key={a.id}
                onClick={a.action}
                className="flex flex-1 min-w-[100px] flex-col items-center justify-center gap-2.5 rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] transition active:scale-[0.96]"
              >
                <div className={\`flex h-12 w-12 items-center justify-center rounded-full \${a.color}\`}>
                  <a.icon className="h-6 w-6" />
                </div>
                <span className="text-[13px] font-bold text-slate-900 whitespace-nowrap">{a.title}</span>
              </button>
            ))}
          </div>
        </section>

        {/* How it works */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.12 }}
          className="mt-8"
        >
          <h3 className="mb-4 px-1 text-[17px] font-bold tracking-tight text-slate-900">How it works</h3>
          <div className="flex items-start justify-between relative px-2">
             <div className="absolute top-[22px] left-[10%] right-[10%] border-t-2 border-dashed border-slate-200 z-0" />
             {STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center relative z-10 w-1/3">
                   <div className="h-11 w-11 rounded-full bg-slate-50 border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center mb-2">
                     <span className="text-[18px] font-black text-[#3730A3]">{i + 1}</span>
                   </div>
                   <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">{step.title}</h4>
                   <p className="text-[10px] text-slate-500 text-center px-1 font-medium leading-tight">{step.copy}</p>
                </div>
             ))}
          </div>
        </motion.section>

        {/* Trust */}
        <motion.section
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="mt-8 bg-amber-50/50 -mx-4 px-4 py-4 border-y border-amber-100"
        >
          <div className="flex items-center justify-around">
             <div className="flex flex-col items-center gap-1.5">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Aadhaar Verified</span>
             </div>
             <div className="flex flex-col items-center gap-1.5">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Clear Rates</span>
             </div>
             <div className="flex flex-col items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-700">Safe & Reliable</span>
             </div>
          </div>
        </motion.section>

        {/* Support */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.35 }}
          className="mt-8 pb-4"
        >
          <div className="rounded-[20px] border border-slate-200 bg-[#FAFAFA] p-4 flex items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E0E7FF]">
                 <Headphones className="h-6 w-6 text-[#4F46E5]" />
               </div>
               <div>
                  <h4 className="text-[15px] font-bold text-slate-900">Need help?</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">Chat with our support team</p>
                  <p className="text-[9px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> We typically reply in under 2 minutes
                  </p>
               </div>
             </div>
             <button
               onClick={() => navigate('/app/support')}
               className="shrink-0 rounded-[12px] bg-[#4F46E5] px-4 py-3 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#4338CA] active:scale-[0.98]"
             >
               Chat with support
             </button>
          </div>
        </motion.div>
      </section>
`;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Success');
