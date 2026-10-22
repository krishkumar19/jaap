import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, BarChart2, Home, Download, Upload, 
  Image as ImageIcon, RotateCcw, ChevronLeft, ChevronRight,
  Calendar, Clock, CheckCircle2
} from 'lucide-react';

// ==========================================
// IndexedDB Wrapper (Local Storage Engine)
// ==========================================
const DB_NAME = 'NaamJapaDB';
const DB_VERSION = 2; // Upgraded version for timestamps

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
  });
};

const getTodayString = () => new Date().toISOString().split('T')[0];

// ==========================================
// Main Application Component
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // App State
  const [count, setCount] = useState(0); 
  const [dailyStats, setDailyStats] = useState({
    date: getTodayString(),
    beads: 0,
    malas: 0,
    timeSeconds: 0,
    taps: [] // New: Store exact timestamps of taps
  });
  
  // Stats View State
  const [allStats, setAllStats] = useState({});
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  
  const [deityImage, setDeityImage] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showCompletionRipple, setShowCompletionRipple] = useState(false);
  const [notification, setNotification] = useState(null);

  const timerRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // ----------------------------------------
  // Data Loading & Saving
  // ----------------------------------------
  const loadAllData = async () => {
    try {
      const db = await initDB();
      
      // Load All Stats for Charts
      const txStats = db.transaction('stats', 'readonly');
      const allStatsReq = txStats.objectStore('stats').getAll();
      
      allStatsReq.onsuccess = () => {
        const statsMap = {};
        allStatsReq.result.forEach(stat => {
          statsMap[stat.date] = stat;
        });
        setAllStats(statsMap);
        
        // Set today's active stats
        const todayStr = getTodayString();
        if (statsMap[todayStr]) {
          setDailyStats(statsMap[todayStr]);
          setCount(statsMap[todayStr].beads % 108);
        } else {
          // Initialize today if not present
          const newDay = { date: todayStr, beads: 0, malas: 0, timeSeconds: 0, taps: [] };
          setDailyStats(newDay);
          saveStats(newDay);
        }
      };

      // Load Settings (Image)
      const txSettings = db.transaction('settings', 'readonly');
      const imgReq = txSettings.objectStore('settings').get('deityImage');
      
      imgReq.onsuccess = () => {
        if (imgReq.result) setDeityImage(imgReq.result.data);
      };

      setIsLoaded(true);
    } catch (err) {
      console.error("DB Load Error:", err);
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Reload stats when switching to stats tab to ensure charts are up to date
  useEffect(() => {
    if (activeTab === 'stats') {
      loadAllData();
    }
  }, [activeTab]);

  const saveStats = async (newStats) => {
    try {
      const db = await initDB();
      const tx = db.transaction('stats', 'readwrite');
      tx.objectStore('stats').put(newStats);
      
      // Update local memory map for charts
      setAllStats(prev => ({...prev, [newStats.date]: newStats}));
    } catch (err) {
      console.error("DB Save Error:", err);
    }
  };

  const saveImage = async (base64Data) => {
    try {
      const db = await initDB();
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ id: 'deityImage', data: base64Data });
    } catch (err) {
      console.error("Image Save Error:", err);
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // ----------------------------------------
  // Counting & Timer Logic
  // ----------------------------------------
  const handleTap = () => {
    if (navigator.vibrate) navigator.vibrate(40);

    const now = Date.now();
    setCount((prev) => {
      const next = prev + 1;
      let newStats = { 
        ...dailyStats, 
        beads: dailyStats.beads + 1,
        taps: [...(dailyStats.taps || []), now]
      };
      
      if (next === 108) {
        newStats.malas += 1;
        triggerCompletionAnimation();
        saveStats(newStats);
        setDailyStats(newStats);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
        return 0;
      }
      
      saveStats(newStats);
      setDailyStats(newStats);
      return next;
    });

    setIsTimerRunning(true);
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    
    inactivityTimeoutRef.current = setTimeout(() => {
      setIsTimerRunning(false);
    }, 5000); 
  };

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setDailyStats(prev => {
          const updated = { ...prev, timeSeconds: prev.timeSeconds + 1 };
          saveStats(updated);
          return updated;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const triggerCompletionAnimation = () => {
    setShowCompletionRipple(true);
    setTimeout(() => setShowCompletionRipple(false), 1500);
  };

  const handleUndo = () => {
    if (dailyStats.beads > 0) {
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
      
      setCount(prev => (prev === 0 ? 107 : prev - 1));
      
      const newTaps = [...(dailyStats.taps || [])];
      newTaps.pop(); // Remove last tap
      
      const newStats = { 
        ...dailyStats, 
        beads: Math.max(0, dailyStats.beads - 1),
        malas: count === 0 && dailyStats.malas > 0 ? dailyStats.malas - 1 : dailyStats.malas,
        taps: newTaps
      };
      setDailyStats(newStats);
      saveStats(newStats);
    }
  };

  // ----------------------------------------
  // Image Upload Logic
  // ----------------------------------------
  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setDeityImage(dataUrl);
        saveImage(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    try {
      const db = await initDB();
      const stats = await new Promise(res => {
        db.transaction('stats', 'readonly').objectStore('stats').getAll().onsuccess = e => res(e.target.result);
      });
      const dataStr = JSON.stringify({ stats, version: DB_VERSION });
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const linkElement = document.createElement('a');
      linkElement.href = dataUri;
      linkElement.download = `japa_export_${getTodayString()}.json`;
      linkElement.click();
      showNotification("Data exported successfully!");
    } catch (e) {
      showNotification("Failed to export data.");
    }
  };

  // ----------------------------------------
  // Stats Calculation Helpers
  // ----------------------------------------
  const changeDate = (daysToAdd) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + daysToAdd);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const selectedDayData = allStats[selectedDate] || { beads: 0, malas: 0, timeSeconds: 0, taps: [] };
  
  // Weekly Chart Data Prep
  const last7Days = useMemo(() => {
    const days = [];
    const today = new Date(getTodayString());
    let maxBeads = 0;
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const data = allStats[dateStr];
      const beads = data ? data.beads : 0;
      if (beads > maxBeads) maxBeads = beads;
      days.push({ 
        dateStr, 
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        beads 
      });
    }
    return { days, maxBeads: maxBeads || 108 }; // Prevent div by 0
  }, [allStats]);

  // Hourly Distribution Prep (0-23 hours)
  const hourlyData = useMemo(() => {
    const hours = new Array(24).fill(0);
    let maxTapsInHour = 0;
    (selectedDayData.taps || []).forEach(timestamp => {
      const date = new Date(timestamp);
      const h = date.getHours();
      hours[h]++;
      if (hours[h] > maxTapsInHour) maxTapsInHour = hours[h];
    });
    return { hours, maxTapsInHour: maxTapsInHour || 1 };
  }, [selectedDayData]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `< 1m`;
  };

  const formatDateLabel = (dateStr) => {
    if (dateStr === getTodayString()) return "Today";
    const d = new Date(dateStr);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) return "Yesterday";
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-[#e0eafc] via-[#f1e6f4] to-[#cfdef3] text-slate-800 font-sans selection:bg-indigo-200">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-rose-300/20 blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col h-full max-w-md mx-auto shadow-2xl bg-white/30 backdrop-blur-md border-x border-white/40">
        
        {/* Header */}
        <header className="pt-10 pb-2 px-6 flex justify-center items-center">
          <h1 className="text-[10px] tracking-[0.4em] text-slate-500/80 uppercase font-bold flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-400/50"></span>
            Naam Japa
            <span className="w-4 h-[1px] bg-slate-400/50"></span>
          </h1>
        </header>

        {/* Dynamic Views */}
        <div className="flex-1 relative overflow-y-auto overflow-x-hidden no-scrollbar pb-24">
          <AnimatePresence mode="wait">
            
            {/* ================= HOME VIEW ================= */}
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="h-full flex flex-col pt-4"
              >
                
                {/* Stats Pills */}
                <div className="flex justify-center gap-3 px-6 mb-4">
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 px-4 py-2.5 rounded-2xl shadow-sm text-center flex-1">
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Focus Time</div>
                    <div className="text-xl font-semibold text-slate-700">{formatTime(dailyStats.timeSeconds)}</div>
                  </div>
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 px-4 py-2.5 rounded-2xl shadow-sm text-center flex-1">
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Malas</div>
                    <div className="text-xl font-semibold text-slate-700">{dailyStats.malas}</div>
                  </div>
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 px-4 py-2.5 rounded-2xl shadow-sm text-center flex-1 relative overflow-hidden">
                    <div 
                      className="absolute bottom-0 left-0 w-full bg-indigo-500/15 transition-all duration-500 ease-out" 
                      style={{ height: `${(count / 108) * 100}%` }} 
                    />
                    <div className="relative z-10">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Beads</div>
                      <div className="text-xl font-semibold text-slate-700">{count}<span className="text-xs text-slate-400 font-medium">/108</span></div>
                    </div>
                  </div>
                </div>

                {/* SVG MALA VISUALIZATION */}
                <div className="relative flex-1 flex items-center justify-center w-full px-4 min-h-[300px]">
                  
                  <AnimatePresence>
                    {showCompletionRipple && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 1 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute inset-0 m-auto w-64 h-64 rounded-full bg-indigo-400/40 blur-2xl pointer-events-none z-0"
                      />
                    )}
                  </AnimatePresence>

                  <svg viewBox="0 0 300 300" className="absolute w-[90%] max-w-[340px] overflow-visible drop-shadow-md z-10">
                    {[...Array(108)].map((_, i) => {
                      const angle = (Math.PI / 2) + (i * (2 * Math.PI / 108));
                      const radius = 135;
                      const cx = 150 + radius * Math.cos(angle);
                      const cy = 150 + radius * Math.sin(angle);
                      
                      const isCompleted = i < count;
                      const isCurrent = i === count;

                      return (
                        <motion.circle
                          key={i}
                          cx={cx}
                          cy={cy}
                          r={isCurrent ? 6 : 4}
                          fill={isCompleted ? '#6366f1' : isCurrent ? '#818cf8' : 'rgba(255,255,255,0.6)'}
                          stroke={isCompleted ? 'none' : 'rgba(255,255,255,0.9)'}
                          strokeWidth="1.5"
                          initial={false}
                          animate={{
                            scale: isCurrent ? 1.4 : 1,
                            opacity: isCompleted ? 1 : 0.8
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                      );
                    })}
                  </svg>

                  {/* Center Deity Upload */}
                  <div 
                    className="absolute inset-0 m-auto w-48 h-48 rounded-full flex items-center justify-center cursor-pointer group z-20 shadow-lg overflow-hidden border-2 border-white/50"
                    onClick={() => fileInputRef.current.click()}
                  >
                    {deityImage ? (
                      <motion.img 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={deityImage} 
                        alt="Deity" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/30 backdrop-blur-md flex flex-col items-center justify-center text-slate-500/80 border-2 border-white/40 border-dashed rounded-full">
                        <ImageIcon size={36} className="mb-2 opacity-60" />
                        <span className="text-xs font-semibold tracking-wider opacity-80 uppercase">Add Image</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Upload size={28} className="text-slate-800 drop-shadow-md" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />
                  </div>
                </div>

                {/* Updated Controls Area */}
                <div className="px-6 pb-6 pt-2 flex gap-4 w-full h-36">
                  
                  {/* Enhanced, Accessible Undo Button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleUndo}
                    disabled={dailyStats.beads === 0}
                    className="w-1/3 h-full relative overflow-hidden rounded-[2rem] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_20px_0_rgba(31,38,135,0.05)] flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-0 group-active:opacity-100 transition-opacity duration-200" />
                    <RotateCcw size={28} className="text-slate-500 mb-2 group-active:-rotate-45 transition-transform duration-300" />
                    <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Undo</span>
                  </motion.button>

                  {/* Main Tap Button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTap}
                    className="w-2/3 h-full relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_12px_30px_0_rgba(99,102,241,0.3)] flex items-center justify-center group"
                  >
                    {/* Glass glare effect */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-[2rem]" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                    
                    <span className="text-4xl font-black tracking-widest text-white uppercase drop-shadow-md">Tap</span>
                  </motion.button>

                </div>
              </motion.div>
            )}

            {/* ================= STATS VIEW ================= */}
            {activeTab === 'stats' && (
              <motion.div 
                key="stats"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-700 tracking-wide">Insights</h2>
                  <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
                    <BarChart2 size={24} />
                  </div>
                </div>
                
                {/* Date Switcher */}
                <div className="flex items-center justify-between bg-white/50 backdrop-blur-md border border-white/60 p-2 rounded-2xl mb-6 shadow-sm">
                  <button 
                    onClick={() => changeDate(-1)}
                    className="p-3 bg-white/60 rounded-xl hover:bg-white text-slate-600 transition-colors shadow-sm"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex flex-col items-center flex-1">
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-500"/> 
                      {formatDateLabel(selectedDate)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Selected Date</div>
                  </div>
                  <button 
                    onClick={() => changeDate(1)}
                    disabled={selectedDate === getTodayString()}
                    className="p-3 bg-white/60 rounded-xl hover:bg-white text-slate-600 transition-colors shadow-sm disabled:opacity-30 disabled:hover:bg-white/60"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Selected Day Stats Highlight */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/60 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Beads</div>
                    <div className="text-4xl font-black text-indigo-600">{selectedDayData.beads}</div>
                    <div className="absolute -bottom-4 -right-4 text-indigo-500/10">
                      <CheckCircle2 size={80} />
                    </div>
                  </div>
                  <div className="bg-white/60 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Time Focus</div>
                    <div className="text-2xl font-black text-teal-600 mt-2">{formatTime(selectedDayData.timeSeconds)}</div>
                    <div className="absolute -bottom-4 -right-4 text-teal-500/10">
                      <Clock size={80} />
                    </div>
                  </div>
                </div>

                {/* Time Distribution (Heat Map) */}
                <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm mb-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock size={14} /> Time Distribution
                  </h3>
                  {selectedDayData.taps && selectedDayData.taps.length > 0 ? (
                    <div className="flex items-end justify-between h-20 gap-[2px]">
                      {hourlyData.hours.map((taps, hr) => {
                        const hPercentage = (taps / hourlyData.maxTapsInHour) * 100;
                        return (
                          <div key={hr} className="flex-1 flex flex-col items-center justify-end group relative">
                            {/* Tooltip */}
                            {taps > 0 && (
                              <div className="absolute -top-8 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                {taps} taps at {hr}:00
                              </div>
                            )}
                            <div 
                              className={`w-full rounded-sm transition-all duration-500 ${taps > 0 ? 'bg-gradient-to-t from-teal-400 to-emerald-300' : 'bg-slate-200/50'}`}
                              style={{ height: taps > 0 ? `${Math.max(15, hPercentage)}%` : '15%' }}
                            />
                            {/* Hourly Labels (show every 6 hours) */}
                            {hr % 6 === 0 && <div className="text-[8px] text-slate-400 mt-1 font-semibold">{hr}h</div>}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center text-sm text-slate-400 italic">No activity recorded on this date.</div>
                  )}
                </div>

                {/* Weekly Bar Chart */}
                <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm mb-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart2 size={14} /> Last 7 Days
                  </h3>
                  <div className="flex items-end justify-between h-32 gap-2 mt-2">
                    {last7Days.days.map((day, idx) => {
                      const percentage = (day.beads / last7Days.maxBeads) * 100;
                      const isSelected = day.dateStr === selectedDate;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedDate(day.dateStr)}
                          className="flex-1 flex flex-col items-center justify-end cursor-pointer group"
                        >
                          <div className="text-[9px] font-bold text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{day.beads}</div>
                          <div className="w-full h-full bg-slate-100/50 rounded-lg flex flex-col justify-end overflow-hidden p-[2px]">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${percentage}%` }}
                              transition={{ duration: 0.8, delay: idx * 0.1 }}
                              className={`w-full rounded-md transition-colors ${isSelected ? 'bg-indigo-500' : 'bg-indigo-300 group-hover:bg-indigo-400'}`}
                            />
                          </div>
                          <div className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {day.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </motion.div>
            )}

            {/* ================= SETTINGS VIEW ================= */}
            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 h-full"
              >
                <h2 className="text-2xl font-bold text-slate-700 tracking-wide mb-8">Settings</h2>
                
                <div className="space-y-4">
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Data Management</h3>
                    
                    <button 
                      onClick={handleExport}
                      className="w-full flex items-center justify-between p-4 bg-white/60 rounded-2xl mb-3 hover:bg-white transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Download size={20} /></div>
                        <span>Backup Data (Export JSON)</span>
                      </div>
                    </button>
                    
                    <p className="text-xs text-slate-500 leading-relaxed px-1">
                      Your data is stored securely in your browser's local database. Exporting creates a backup file you can save.
                    </p>
                  </div>

                  <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-3xl shadow-sm">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Appearance</h3>
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      className="w-full flex items-center justify-between p-4 bg-white/60 rounded-2xl hover:bg-white transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><ImageIcon size={20} /></div>
                        <span>Update Center Deity Image</span>
                      </div>
                    </button>
                  </div>
                  
                  <div className="text-center pt-8 opacity-40">
                    <div className="text-[10px] font-bold tracking-widest uppercase">Naam Japa v2.0</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-28 left-0 right-0 mx-8 bg-slate-800 text-white p-4 rounded-2xl text-center text-sm font-semibold shadow-2xl z-40 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} className="text-emerald-400" />
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Bottom Navigation */}
        <div className="absolute bottom-6 left-0 right-0 px-8 z-50">
          <div className="flex items-center justify-around bg-white/70 backdrop-blur-2xl border border-white/80 p-2.5 rounded-[2rem] shadow-[0_8px_32px_0_rgba(31,38,135,0.1)]">
            <NavButton 
              icon={<BarChart2 size={24} />} 
              label="Stats"
              active={activeTab === 'stats'} 
              onClick={() => setActiveTab('stats')} 
            />
            <NavButton 
              icon={<Home size={24} />} 
              label="Home"
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
              isCenter 
            />
            <NavButton 
              icon={<Settings size={24} />} 
              label="Settings"
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------
// Navigation Button Component
// ----------------------------------------
const NavButton = ({ icon, active, onClick, isCenter, label }) => {
  return (
    <button 
      onClick={onClick}
      className={`relative p-3.5 rounded-full transition-all duration-300 flex flex-col items-center gap-1 ${
        isCenter ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-105' : 
        active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
      }`}
    >
      {icon}
      {active && !isCenter && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute inset-0 bg-indigo-50/80 rounded-full -z-10 shadow-sm"
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      )}
    </button>
  );
};