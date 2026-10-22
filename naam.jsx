import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BarChart2, Home, Download, Image as ImageIcon, RotateCcw, Trash2, X, RefreshCw } from 'lucide-react';

const DB_NAME = 'ZenJapaDB';
const DB_VERSION = 1;

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

export default function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [isLoaded, setIsLoaded] = useState(false);

    const [count, setCount] = useState(0);
    const [dailyStats, setDailyStats] = useState({
        date: new Date().toISOString().split('T')[0],
        beads: 0,
        malas: 0,
        timeSeconds: 0
    });
    const [deityImage, setDeityImage] = useState(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [showCompletionRipple, setShowCompletionRipple] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    const timerRef = useRef(null);
    const inactivityTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const db = await initDB();
                const today = new Date().toISOString().split('T')[0];

                const tx = db.transaction('stats', 'readonly');
                const statReq = tx.objectStore('stats').get(today);

                statReq.onsuccess = () => {
                    if (statReq.result) {
                        setDailyStats(statReq.result);
                        setCount(statReq.result.beads % 108);
                    }
                };

                const tx2 = db.transaction('settings', 'readonly');
                const imgReq = tx2.objectStore('settings').get('deityImage');

                imgReq.onsuccess = () => {
                    if (imgReq.result) setDeityImage(imgReq.result.data);
                };

                setIsLoaded(true);
            } catch (err) {
                console.error("DB Load Error:", err);
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    const saveStats = useCallback(async (newStats) => {
        try {
            const db = await initDB();
            const tx = db.transaction('stats', 'readwrite');
            tx.objectStore('stats').put(newStats);
        } catch (err) {
            console.error("DB Save Error:", err);
        }
    }, []);

    const saveImage = async (base64Data) => {
        try {
            const db = await initDB();
            const tx = db.transaction('settings', 'readwrite');
            if (base64Data) {
                tx.objectStore('settings').put({ id: 'deityImage', data: base64Data });
            } else {
                tx.objectStore('settings').delete('deityImage');
            }
        } catch (err) {
            console.error("Image Save Error:", err);
        }
    };

    const handleTap = () => {
        if (navigator.vibrate) navigator.vibrate(50);

        setCount((prev) => {
            const next = prev + 1;
            let newStats = { ...dailyStats, beads: dailyStats.beads + 1 };

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
    }, [isTimerRunning, saveStats]);

    const triggerCompletionAnimation = () => {
        setShowCompletionRipple(true);
        setTimeout(() => setShowCompletionRipple(false), 1500);
    };

    const handleUndo = () => {
        if (count > 0 || dailyStats.beads > 0) {
            const newCount = count > 0 ? count - 1 : 107;
            const newStats = {
                ...dailyStats,
                beads: Math.max(0, dailyStats.beads - 1),
                malas: count === 0 && dailyStats.malas > 0 ? dailyStats.malas - 1 : dailyStats.malas
            };
            setCount(newCount);
            setDailyStats(newStats);
            saveStats(newStats);
        }
    };

    const handleResetToday = () => {
        const today = new Date().toISOString().split('T')[0];
        const resetStats = {
            date: today,
            beads: 0,
            malas: 0,
            timeSeconds: 0
        };
        setCount(0);
        setDailyStats(resetStats);
        saveStats(resetStats);
        setShowResetModal(false);
    };

    const handleResetAllData = async () => {
        try {
            const db = await initDB();
            const tx = db.transaction(['stats', 'settings'], 'readwrite');
            tx.objectStore('stats').clear();
            tx.objectStore('settings').clear();
            
            const today = new Date().toISOString().split('T')[0];
            setCount(0);
            setDailyStats({
                date: today,
                beads: 0,
                malas: 0,
                timeSeconds: 0
            });
            setDeityImage(null);
            setShowResetModal(false);
        } catch (e) {
            console.error("Reset All Error:", e);
        }
    };

    const onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800; // High resolution
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = Math.round((height * MAX_SIZE) / width);
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width = Math.round((width * MAX_SIZE) / height);
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                setDeityImage(dataUrl);
                saveImage(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setDeityImage(null);
        saveImage(null);
    };

    const handleExport = async () => {
        try {
            const db = await initDB();
            const stats = await new Promise(res => {
                const tx = db.transaction('stats', 'readonly');
                tx.objectStore('stats').getAll().onsuccess = e => res(e.target.result);
            });
            const dataStr = JSON.stringify({ stats, version: 1 });
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `japa_export_${new Date().toISOString().split('T')[0]}.json`);
            linkElement.click();
        } catch (e) {
            alert("Failed to export data.");
        }
    };

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">Loading...</div>;

    return (
        <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-[#e0eafc] via-[#f1e6f4] to-[#cfdef3] text-slate-800 font-sans selection:bg-indigo-200 select-none">
            {/* Ambient background glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/20 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-200/20 blur-[100px] pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full max-w-md mx-auto shadow-2xl bg-white/10 backdrop-blur-[2px]">
                {/* Header */}
                <header className="pt-8 pb-2 px-6 text-center flex-shrink-0">
                    <h1 className="text-xs tracking-[0.4em] text-slate-500/80 uppercase font-semibold">Naam Japa</h1>
                </header>

                {/* Content Container */}
                <div className="flex-1 relative overflow-y-auto overflow-x-hidden min-h-0">
                    <AnimatePresence mode="wait">
                        {activeTab === 'home' && (
                            <motion.div
                                key="home"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="h-full flex flex-col justify-between"
                            >
                                {/* Top Stats Bar */}
                                <div className="flex justify-center gap-2.5 px-4 pt-1 pb-1 flex-shrink-0">
                                    <div className="bg-white/45 backdrop-blur-md border border-white/60 px-3 py-2 rounded-2xl shadow-sm text-center flex-1">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Time</div>
                                        <div className="text-base sm:text-lg font-medium text-slate-800">{formatTime(dailyStats.timeSeconds)}</div>
                                    </div>
                                    <div className="bg-white/45 backdrop-blur-md border border-white/60 px-3 py-2 rounded-2xl shadow-sm text-center flex-1">
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Malas</div>
                                        <div className="text-base sm:text-lg font-medium text-slate-800">{dailyStats.malas}</div>
                                    </div>
                                    <div className="bg-white/45 backdrop-blur-md border border-white/60 px-3 py-2 rounded-2xl shadow-sm text-center flex-1 relative overflow-hidden">
                                        <div
                                            className="absolute bottom-0 left-0 w-full bg-indigo-500/15 transition-all duration-300 ease-out"
                                            style={{ height: `${(count / 108) * 100}%` }}
                                        />
                                        <div className="relative z-10">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Beads</div>
                                            <div className="text-base sm:text-lg font-medium text-slate-800">{count}<span className="text-[11px] text-slate-400">/108</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Center Mala SVG & Deity Photo */}
                                <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 my-auto w-full">
                                    <AnimatePresence>
                                        {showCompletionRipple && (
                                            <motion.div
                                                initial={{ scale: 0.5, opacity: 1 }}
                                                animate={{ scale: 1.5, opacity: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                className="absolute inset-0 m-auto w-56 h-56 rounded-full bg-indigo-300/40 blur-xl pointer-events-none"
                                            />
                                        )}
                                    </AnimatePresence>

                                    {/* 108 Bead Ring */}
                                    <svg viewBox="0 0 300 300" className="w-auto h-full max-h-[38vh] max-w-[280px] sm:max-w-[320px] aspect-square overflow-visible drop-shadow-sm select-none">
                                        {[...Array(108)].map((_, i) => {
                                            const total = 108;
                                            const angle = (Math.PI / 2) + (i * (2 * Math.PI / total));
                                            const radius = 130;
                                            const cx = 150 + radius * Math.cos(angle);
                                            const cy = 150 + radius * Math.sin(angle);

                                            const isCompleted = i < count;
                                            const isCurrent = i === count;

                                            return (
                                                <motion.circle
                                                    key={i}
                                                    cx={cx}
                                                    cy={cy}
                                                    r={isCurrent ? 5.5 : 3.5}
                                                    fill={isCompleted ? '#6366f1' : isCurrent ? '#818cf8' : 'rgba(255,255,255,0.45)'}
                                                    stroke={isCompleted ? 'none' : 'rgba(255,255,255,0.85)'}
                                                    strokeWidth="1"
                                                    initial={false}
                                                    animate={{
                                                        scale: isCurrent ? 1.3 : 1,
                                                        opacity: isCompleted ? 1 : 0.7
                                                    }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                />
                                            );
                                        })}
                                    </svg>

                                    {/* Inner Deity Frame (Full Image Display - No Aggressive Crop) */}
                                    <div
                                        className="absolute inset-0 m-auto w-[52%] h-[52%] max-w-[170px] max-h-[170px] rounded-full overflow-hidden flex items-center justify-center cursor-pointer group bg-white/20 backdrop-blur-sm border-2 border-white/50 shadow-inner"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {deityImage ? (
                                            <motion.img
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                src={deityImage}
                                                alt="Deity"
                                                className="w-full h-full object-contain p-1 select-none pointer-events-none"
                                                draggable={false}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500/70 p-2 text-center select-none">
                                                <ImageIcon size={28} className="mb-1 opacity-60" />
                                                <span className="text-[11px] font-medium tracking-wide opacity-80">Photo lagayein</span>
                                            </div>
                                        )}

                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={onFileChange}
                                        />
                                    </div>
                                </div>

                                {/* Bottom Controls: Undo, Reset, Big Tap Button */}
                                <div className="px-6 pb-20 pt-1 flex flex-col items-center relative w-full flex-shrink-0">
                                    {/* Quick Actions (Reset & Undo) */}
                                    <div className="w-full flex justify-between items-center px-1 mb-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowResetModal(true)}
                                            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 active:text-rose-600 px-3 py-1.5 rounded-full bg-white/40 active:bg-white/70 border border-white/50 backdrop-blur-md shadow-sm transition-all select-none"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Reset</span>
                                        </button>

                                        <motion.button
                                            type="button"
                                            whileTap={{ scale: 0.92 }}
                                            onClick={handleUndo}
                                            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 active:text-slate-800 px-3 py-1.5 rounded-full bg-white/40 active:bg-white/70 border border-white/50 backdrop-blur-md shadow-sm transition-all disabled:opacity-30 select-none"
                                            disabled={count === 0 && dailyStats.beads === 0}
                                        >
                                            <span>Undo (-1)</span>
                                        </motion.button>
                                    </div>

                                    {/* Big Tap Button (No text selection on long press) */}
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.96 }}
                                        onClick={handleTap}
                                        onContextMenu={(e) => e.preventDefault()}
                                        className="w-full h-22 sm:h-26 relative overflow-hidden rounded-[2rem] bg-white/35 active:bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.08)] flex items-center justify-center select-none touch-manipulation cursor-pointer group"
                                        style={{
                                            WebkitTouchCallout: 'none',
                                            WebkitUserSelect: 'none',
                                            userSelect: 'none',
                                            touchAction: 'manipulation'
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none" />
                                        <span className="text-2xl sm:text-3xl font-light tracking-[0.25em] text-slate-700/90 uppercase pointer-events-none select-none">
                                            Tap
                                        </span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'stats' && (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 pb-24"
                            >
                                <h2 className="text-2xl font-light text-slate-700 mb-6">Today's Journey</h2>

                                <div className="space-y-4">
                                    <div className="bg-white/45 backdrop-blur-md border border-white/50 p-6 rounded-3xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-slate-500 font-medium">Total Beads</div>
                                            <div className="text-3xl font-light text-slate-800">{dailyStats.beads}</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">
                                            <div className="w-4 h-4 rounded-full bg-current" />
                                        </div>
                                    </div>

                                    <div className="bg-white/45 backdrop-blur-md border border-white/50 p-6 rounded-3xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-slate-500 font-medium">Completed Malas</div>
                                            <div className="text-3xl font-light text-slate-800">{dailyStats.malas}</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 border-2 border-dashed border-current" />
                                    </div>

                                    <div className="bg-white/45 backdrop-blur-md border border-white/50 p-6 rounded-3xl shadow-sm flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-slate-500 font-medium">Time Engaged</div>
                                            <div className="text-3xl font-light text-slate-800">{formatTime(dailyStats.timeSeconds)}</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-500">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                                                <circle cx="12" cy="12" r="10" />
                                                <path d="M12 6v6l4 2" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'settings' && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="p-6 pb-24 space-y-5"
                            >
                                <h2 className="text-2xl font-light text-slate-700">Settings & Data</h2>

                                {/* Photo Management */}
                                <div className="bg-white/45 backdrop-blur-md border border-white/50 p-4 rounded-3xl shadow-sm">
                                    <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 px-1">Deity Photo</h3>
                                    
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-white/60 active:bg-white/80 rounded-2xl text-xs font-medium text-slate-700 shadow-sm"
                                        >
                                            <ImageIcon size={16} className="text-indigo-500" />
                                            <span>{deityImage ? "Photo Badlein" : "Photo Lagayein"}</span>
                                        </button>
                                        
                                        {deityImage && (
                                            <button
                                                onClick={handleRemoveImage}
                                                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-2xl text-xs font-medium shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                                <span>Hatayein</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Backup & Reset */}
                                <div className="bg-white/45 backdrop-blur-md border border-white/50 p-4 rounded-3xl shadow-sm space-y-2.5">
                                    <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2 px-1">Data Management</h3>

                                    <button
                                        onClick={handleExport}
                                        className="w-full flex items-center justify-between p-3.5 bg-white/60 active:bg-white/80 rounded-2xl text-slate-700 text-xs font-medium shadow-sm transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Download size={17} className="text-indigo-500" />
                                            <span>Backup Data (Export JSON)</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setShowResetModal(true)}
                                        className="w-full flex items-center justify-between p-3.5 bg-rose-50/70 active:bg-rose-100 rounded-2xl text-rose-600 text-xs font-medium shadow-sm transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <RefreshCw size={17} />
                                            <span>Reset Counters / All Data</span>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Navigation */}
                <div className="absolute bottom-4 left-0 right-0 px-6 z-40 flex-shrink-0">
                    <div className="flex items-center justify-around bg-white/50 backdrop-blur-xl border border-white/60 p-2 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.1)]">
                        <NavButton icon={<BarChart2 size={21} />} active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
                        <NavButton icon={<Home size={21} />} active={activeTab === 'home'} onClick={() => setActiveTab('home')} isCenter />
                        <NavButton icon={<Settings size={21} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                    </div>
                </div>
            </div>

            {/* Reset Confirmation Modal */}
            <AnimatePresence>
                {showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4"
                        >
                            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                                <RotateCcw size={22} />
                            </div>

                            <div>
                                <h3 className="text-base font-semibold text-slate-800">Reset Options</h3>
                                <p className="text-xs text-slate-500 mt-1">Kya aap aaj ka jaap count reset karna chahte hain?</p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <button
                                    onClick={handleResetToday}
                                    className="w-full py-2.5 px-4 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-200 transition-colors"
                                >
                                    Sirf Aaj ka Reset karein (0 Beads)
                                </button>
                                
                                <button
                                    onClick={handleResetAllData}
                                    className="w-full py-2.5 px-4 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-xl text-xs font-medium transition-colors"
                                >
                                    Pura Data Clear karein (All History)
                                </button>

                                <button
                                    onClick={() => setShowResetModal(false)}
                                    className="w-full py-2 px-4 text-slate-400 active:text-slate-600 text-xs font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

const NavButton = ({ icon, active, onClick, isCenter }) => {
    return (
        <button
            onClick={onClick}
            className={`relative p-3 rounded-full transition-all duration-300 ${isCenter ? 'bg-white shadow-sm' : ''
                } ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
            {icon}
            {active && !isCenter && (
                <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
            )}
        </button>
    );
};
