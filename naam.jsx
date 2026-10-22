import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    RotateCcw,
    Volume2,
    VolumeX,
    Smartphone,
    Flame,
    Target,
    Download,
    Image as ImageIcon,
    Trash2,
    RefreshCw,
    BarChart3,
    Sparkles,
    Award
} from 'lucide-react';

const DB_NAME = 'ZenJapaDB';
const DB_VERSION = 1;

// Curated authentic devotional quotes (Bhagavad Gita, Saints, Bhakti traditions)
const DEVOTIONAL_QUOTES = [
    {
        quote: "हरेर्नाम हरेर्नाम हरेर्नामैव केवलम्। कलौ नास्त्येव नास्त्येव नास्त्येव गतिरन्यथा॥",
        source: "बृहन्नारदीय पुराण",
        meaning: "कलिकाल में केवल हरि का पावन नाम ही मुक्ति और परम शांति का मार्ग है।"
    },
    {
        quote: "राम नाम मनि दीप धरु जीहँ देहरीं द्वार। तुलसी भीतर बाहिरहुँ जौं चाहसि उजिआर॥",
        source: "गोस्वामी तुलसीदास",
        meaning: "जीभ की देहरी पर राम नाम का दीपक रखो, भीतर और बाहर दोनों ओर प्रकाश हो जाएगा।"
    },
    {
        quote: "कबीर सुमिरन सार है, और सकल जंजाल। आदि अंत सब सोधिया, दूजा देख्या काल॥",
        source: "संत कबीर",
        meaning: "ईश्वर का नाम स्मरण ही जीवन का परम सत्य और सार है।"
    },
    {
        quote: "यज्ञानां जपयज्ञोऽस्मि (समस्त यज्ञों में मैं जप यज्ञ हूँ)",
        source: "श्रीमद्भगवद्गीता (10.25)",
        meaning: "भगवान श्रीकृष्ण कहते हैं कि समस्त साधनाओं में जप साधन ही मेरा साक्षात स्वरूप है।"
    },
    {
        quote: "The repetition of the Holy Name purifies the heart and reveals the Divine within.",
        source: "Swami Vivekananda",
        meaning: "नाम का निरंतर स्मरण हृदय को निर्मल बनाकर आत्म-साक्षात्कार कराता है।"
    },
    {
        quote: "Love everyone, serve everyone, remember God, and tell the truth.",
        source: "Neem Karoli Baba",
        meaning: "सबको प्रेम करो, सबकी सेवा करो, ईश्वर को याद रखो और सत्य बोलो।"
    },
    {
        quote: "नास्ति नाम समं तीर्थं नास्ति नाम समं तपः। नास्ति नाम समं ज्ञानम्...",
        source: "विष्णु सहस्रनाम",
        meaning: "ईश्वर नाम के समान कोई तीर्थ नहीं, कोई तपस्या नहीं और कोई ज्ञान नहीं।"
    },
    {
        quote: "जो नाम का आश्रय लेते हैं, उनके समस्त भय और चिंताएं स्वयं शांत हो जाती हैं।",
        source: "संत तुकाराम",
        meaning: "हरि नाम का सच्चा आश्रय समस्त दुखों से मुक्त कर देता है।"
    }
];

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
    const [isLoaded, setIsLoaded] = useState(false);

    // Chanting & Session State
    const [count, setCount] = useState(0); // 0 to 107
    const [dailyStats, setDailyStats] = useState({
        date: new Date().toISOString().split('T')[0],
        beads: 0,
        malas: 0,
        timeSeconds: 0
    });
    const [allHistory, setAllHistory] = useState([]);
    const [streak, setStreak] = useState(1);

    // Devotional Quote Index
    const [quoteIndex, setQuoteIndex] = useState(() => {
        // Pick consistent quote for today or random
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        return dayOfYear % DEVOTIONAL_QUOTES.length;
    });

    // Preferences & Settings
    const [goalMalas, setGoalMalas] = useState(1);
    const [soundVolume, setSoundVolume] = useState(60);
    const [vibrationIntensity, setVibrationIntensity] = useState(2);
    const [deityImage, setDeityImage] = useState(null);

    // Timer & Controls
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isTimerPaused, setIsTimerPaused] = useState(false);
    const [showCompletionRipple, setShowCompletionRipple] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetModalType, setResetModalType] = useState('session'); // 'session' | 'all'

    const timerRef = useRef(null);
    const inactivityTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioContextRef = useRef(null);

    // Calculate Streak
    const calculateStreak = (history, todayStr, todayBeads) => {
        const dateMap = {};
        history.forEach(item => {
            if (item.beads > 0) dateMap[item.date] = true;
        });
        if (todayBeads > 0) dateMap[todayStr] = true;

        let currentStreak = 0;
        let checkDate = new Date();

        const todayKey = checkDate.toISOString().split('T')[0];
        if (!dateMap[todayKey]) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const key = checkDate.toISOString().split('T')[0];
            if (dateMap[key]) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return Math.max(currentStreak, todayBeads > 0 ? 1 : 0);
    };

    // Load initial data from IndexedDB
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

                const historyReq = tx.objectStore('stats').getAll();
                historyReq.onsuccess = () => {
                    const records = historyReq.result || [];
                    setAllHistory(records);
                    setStreak(calculateStreak(records, today, statReq.result ? statReq.result.beads : 0));
                };

                const txSettings = db.transaction('settings', 'readonly');
                const settingsStore = txSettings.objectStore('settings');

                settingsStore.get('deityImage').onsuccess = (e) => {
                    if (e.target.result) setDeityImage(e.target.result.data);
                };
                settingsStore.get('goalMalas').onsuccess = (e) => {
                    if (e.target.result) setGoalMalas(e.target.result.data);
                };
                settingsStore.get('soundVolume').onsuccess = (e) => {
                    if (e.target.result !== undefined) setSoundVolume(e.target.result.data);
                };
                settingsStore.get('vibrationIntensity').onsuccess = (e) => {
                    if (e.target.result !== undefined) setVibrationIntensity(e.target.result.data);
                };

                setIsLoaded(true);
            } catch (err) {
                console.error("DB Load Error:", err);
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    // Save helpers
    const saveStats = useCallback(async (newStats) => {
        try {
            const db = await initDB();
            const tx = db.transaction('stats', 'readwrite');
            tx.objectStore('stats').put(newStats);
        } catch (err) {
            console.error("DB Save Error:", err);
        }
    }, []);

    const saveSetting = async (key, val) => {
        try {
            const db = await initDB();
            const tx = db.transaction('settings', 'readwrite');
            if (val === null) {
                tx.objectStore('settings').delete(key);
            } else {
                tx.objectStore('settings').put({ id: key, data: val });
            }
        } catch (err) {
            console.error("Setting Save Error:", err);
        }
    };

    // Sound Generation via Web Audio API
    const playSoundFeedback = useCallback((isMalaFinish = false) => {
        if (soundVolume <= 0) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioCtx();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const vol = (soundVolume / 100) * 0.4;

            if (isMalaFinish) {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(528, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1056, ctx.currentTime + 0.4);
                gain.gain.setValueAtTime(vol * 1.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1.2);
            } else {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(420, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.07);
                gain.gain.setValueAtTime(vol, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.07);
            }
        } catch (e) {
            // Ignore
        }
    }, [soundVolume]);

    // Vibration Trigger
    const triggerHaptic = useCallback((isMalaFinish = false) => {
        if (!navigator.vibrate || vibrationIntensity === 0) return;
        if (isMalaFinish) {
            navigator.vibrate([80, 50, 120]);
        } else {
            const hapticDurations = [0, 18, 40, 75];
            navigator.vibrate(hapticDurations[vibrationIntensity] || 35);
        }
    }, [vibrationIntensity]);

    // Tap Handling
    const handleTap = () => {
        triggerHaptic(false);
        playSoundFeedback(false);

        setCount((prev) => {
            const next = prev + 1;
            let newStats = { ...dailyStats, beads: dailyStats.beads + 1 };

            if (next === 108) {
                newStats.malas += 1;
                triggerCompletionAnimation();
                triggerHaptic(true);
                playSoundFeedback(true);
                saveStats(newStats);
                setDailyStats(newStats);
                return 0;
            }

            saveStats(newStats);
            setDailyStats(newStats);
            return next;
        });

        if (!isTimerPaused) {
            setIsTimerRunning(true);
            if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
            inactivityTimeoutRef.current = setTimeout(() => {
                setIsTimerRunning(false);
            }, 6000);
        }
    };

    // Timer Interval
    useEffect(() => {
        if (isTimerRunning && !isTimerPaused) {
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
    }, [isTimerRunning, isTimerPaused, saveStats]);

    const togglePauseTimer = () => {
        setIsTimerPaused(prev => !prev);
        if (isTimerRunning) {
            setIsTimerRunning(false);
        }
    };

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

    const handleResetSession = () => {
        const roundBeads = count;
        setCount(0);
        const updated = {
            ...dailyStats,
            beads: Math.max(0, dailyStats.beads - roundBeads)
        };
        setDailyStats(updated);
        saveStats(updated);
        setShowResetModal(false);
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
            setDailyStats({ date: today, beads: 0, malas: 0, timeSeconds: 0 });
            setAllHistory([]);
            setStreak(0);
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
                const MAX_SIZE = 800;
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

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setDeityImage(dataUrl);
                saveSetting('deityImage', dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = () => {
        setDeityImage(null);
        saveSetting('deityImage', null);
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

    const nextQuote = () => {
        setQuoteIndex((prev) => (prev + 1) % DEVOTIONAL_QUOTES.length);
    };

    // Lifetime Total Beads & Malas Calculation
    const lifetimeBeads = allHistory.reduce((acc, cur) => {
        return cur.date !== dailyStats.date ? acc + (cur.beads || 0) : acc;
    }, 0) + (dailyStats.beads || 0);

    const lifetimeMalas = Math.floor(lifetimeBeads / 108);

    // Goal Calculation
    const targetBeads = goalMalas * 108;
    const progressPercent = Math.min(100, Math.round((dailyStats.beads / targetBeads) * 100));

    // Last 7 Days Activity Data
    const getLast7DaysData = () => {
        const days = [];
        const map = {};
        allHistory.forEach(item => {
            map[item.date] = item.beads;
        });
        map[dailyStats.date] = dailyStats.beads;

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({
                date: dateStr,
                label: i === 0 ? 'Today' : dayName,
                beads: map[dateStr] || 0
            });
        }
        return days;
    };

    const last7Days = getLast7DaysData();
    const maxBeadsInChart = Math.max(...last7Days.map(d => d.beads), 108);
    const activeQuote = DEVOTIONAL_QUOTES[quoteIndex];

    if (!isLoaded) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">Loading Naam Japa...</div>;

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-[#e0eafc] via-[#f1e6f4] to-[#cfdef3] text-slate-800 font-sans selection:bg-indigo-200 select-none antialiased">
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-indigo-300/25 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-rose-200/25 blur-[120px] pointer-events-none" />

            <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col px-4 pt-5 pb-16 space-y-4">
                
                {/* Header with Title and Streak */}
                <header className="flex items-center justify-between px-2 pt-1">
                    <div>
                        <span className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">Daily Sadhana</span>
                        <h1 className="text-xl font-light text-slate-800 tracking-tight">Naam Japa</h1>
                    </div>
                    
                    {/* Streak Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/55 backdrop-blur-md border border-white/60 shadow-sm">
                        <Flame size={15} className={streak > 0 ? "text-amber-500 fill-amber-500" : "text-slate-400"} />
                        <span className="text-xs font-semibold text-slate-700">{streak} {streak === 1 ? 'Day' : 'Days'}</span>
                    </div>
                </header>

                {/* Devotional Quote of the Day Banner */}
                <section
                    onClick={nextQuote}
                    className="relative bg-white/45 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-sm cursor-pointer group hover:bg-white/55 transition-all overflow-hidden"
                    title="Tap to read another devotional quote"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-indigo-700">
                            <Sparkles size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Devotional Thought</span>
                        </div>
                        <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 transition-colors">Tap for Next ✨</span>
                    </div>

                    <p className="text-xs font-serif text-slate-800 leading-relaxed font-medium">
                        "{activeQuote.quote}"
                    </p>
                    
                    {activeQuote.meaning && (
                        <p className="text-[11px] text-slate-600 font-sans mt-1 italic">
                            — {activeQuote.meaning}
                        </p>
                    )}

                    <div className="mt-2 text-right">
                        <span className="text-[10px] font-semibold text-indigo-600/90 tracking-wide">
                            ~ {activeQuote.source}
                        </span>
                    </div>
                </section>

                {/* Lifetime Total Beads & Malas Banner */}
                <section className="bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-rose-500/15 backdrop-blur-xl border border-white/60 p-3.5 rounded-3xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-300">
                            <Award size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Lifetime Total Chanted</div>
                            <div className="text-base font-bold text-slate-800">
                                {lifetimeBeads.toLocaleString()} <span className="text-xs font-normal text-slate-500">Beads</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-semibold text-indigo-700">{lifetimeMalas} Malas</div>
                        <div className="text-[10px] text-slate-400">All-time record</div>
                    </div>
                </section>

                {/* Daily Goal & Progress Card */}
                <section className="bg-white/45 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Target size={15} className="text-indigo-600" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Daily Goal</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 3, 5, 11, 16].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                        setGoalMalas(m);
                                        saveSetting('goalMalas', m);
                                    }}
                                    className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-all ${
                                        goalMalas === m
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-white/50 text-slate-600 hover:bg-white/80'
                                    }`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div>
                        <div className="flex justify-between items-baseline text-xs mb-1.5">
                            <span className="text-slate-500 font-medium">Today: {dailyStats.malas}/{goalMalas} Malas ({dailyStats.beads} Beads)</span>
                            <span className="font-semibold text-indigo-700 text-sm">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden p-0.5">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ ease: "easeOut", duration: 0.5 }}
                            />
                        </div>
                    </div>
                </section>

                {/* Main Chanting & Mala Counter Card */}
                <section className="bg-white/40 backdrop-blur-xl border border-white/60 p-5 rounded-3xl shadow-sm flex flex-col items-center relative overflow-hidden">
                    {/* Top Status Row */}
                    <div className="w-full grid grid-cols-3 gap-2 text-center mb-3">
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl py-2 px-1 border border-white/60">
                            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Today Time</div>
                            <div className="text-sm font-semibold text-slate-800">{formatTime(dailyStats.timeSeconds)}</div>
                        </div>
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl py-2 px-1 border border-white/60">
                            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Today Malas</div>
                            <div className="text-sm font-semibold text-slate-800">{dailyStats.malas}</div>
                        </div>
                        <div className="bg-white/50 backdrop-blur-md rounded-2xl py-2 px-1 border border-white/60">
                            <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Bead</div>
                            <div className="text-sm font-semibold text-slate-800">{count}<span className="text-[10px] text-slate-400">/108</span></div>
                        </div>
                    </div>

                    {/* Mala Visual Ring & Center Deity Frame */}
                    <div className="relative w-full aspect-square max-w-[270px] flex items-center justify-center my-2">
                        <AnimatePresence>
                            {showCompletionRipple && (
                                <motion.div
                                    initial={{ scale: 0.4, opacity: 1 }}
                                    animate={{ scale: 1.6, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="absolute inset-0 m-auto w-56 h-56 rounded-full bg-indigo-300/40 blur-xl pointer-events-none"
                                />
                            )}
                        </AnimatePresence>

                        {/* 108 SVG Beads */}
                        <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible drop-shadow-sm select-none">
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
                                        r={isCurrent ? 5.8 : 3.5}
                                        fill={isCompleted ? '#6366f1' : isCurrent ? '#818cf8' : 'rgba(255,255,255,0.5)'}
                                        stroke={isCompleted ? 'none' : 'rgba(255,255,255,0.85)'}
                                        strokeWidth="1"
                                        initial={false}
                                        animate={{
                                            scale: isCurrent ? 1.3 : 1,
                                            opacity: isCompleted ? 1 : 0.75
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    />
                                );
                            })}
                        </svg>

                        {/* Deity Image (object-contain: completely preserves aspect ratio) */}
                        <div
                            className="absolute inset-0 m-auto w-[52%] h-[52%] max-w-[155px] max-h-[155px] rounded-full overflow-hidden flex items-center justify-center cursor-pointer group bg-white/30 backdrop-blur-sm border-2 border-white/60 shadow-inner"
                            onClick={() => fileInputRef.current?.click()}
                            title="Tap to change Deity photo"
                        >
                            {deityImage ? (
                                <motion.img
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    src={deityImage}
                                    alt="Deity"
                                    className="w-full h-full object-contain p-1 pointer-events-none"
                                    draggable={false}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500/75 p-2 text-center select-none">
                                    <ImageIcon size={26} className="mb-1 opacity-60" />
                                    <span className="text-[10px] font-medium tracking-wide">Photo Add Karein</span>
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

                    {/* Secondary Actions: Reset Session, Pause Timer, Undo */}
                    <div className="w-full flex items-center justify-between px-2 pt-2 pb-3">
                        <button
                            type="button"
                            onClick={() => {
                                setResetModalType('session');
                                setShowResetModal(true);
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-full bg-white/50 active:bg-white/80 border border-white/60 shadow-sm transition-all"
                        >
                            <RotateCcw size={13} />
                            <span>Reset Session</span>
                        </button>

                        <button
                            type="button"
                            onClick={togglePauseTimer}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full border shadow-sm transition-all ${
                                isTimerPaused
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-white/50 text-slate-600 active:bg-white/80 border-white/60'
                            }`}
                        >
                            {isTimerPaused ? <Play size={13} /> : <Pause size={13} />}
                            <span>{isTimerPaused ? 'Resume' : 'Pause'}</span>
                        </button>

                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={handleUndo}
                            className="flex items-center gap-1 text-xs font-medium text-slate-600 active:text-slate-800 px-3 py-1.5 rounded-full bg-white/50 active:bg-white/80 border border-white/60 shadow-sm transition-all disabled:opacity-30"
                            disabled={count === 0 && dailyStats.beads === 0}
                        >
                            <span>Undo (-1)</span>
                        </motion.button>
                    </div>

                    {/* Chanting Tap Button */}
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleTap}
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-full h-24 sm:h-28 relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/60 to-white/30 active:from-white/70 active:to-white/50 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center select-none touch-manipulation cursor-pointer group"
                        style={{
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            touchAction: 'manipulation'
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent pointer-events-none" />
                        <span className="text-3xl font-light tracking-[0.25em] text-slate-700 uppercase pointer-events-none select-none">
                            Tap
                        </span>
                    </motion.button>
                </section>

                {/* Sound & Vibration Feedback Controls */}
                <section className="bg-white/45 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-sm space-y-4">
                    <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 px-1">Feedback Preferences</h2>

                    {/* Sound Slider */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                {soundVolume > 0 ? <Volume2 size={16} className="text-indigo-600" /> : <VolumeX size={16} className="text-slate-400" />}
                                <span>Sound Feedback (Wood Tap / Bell)</span>
                            </div>
                            <span className="font-semibold text-slate-500">{soundVolume}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={soundVolume}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setSoundVolume(val);
                                saveSetting('soundVolume', val);
                            }}
                            className="w-full h-2 bg-slate-200/80 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>

                    {/* Vibration Intensity */}
                    <div className="space-y-2 pt-1 border-t border-white/40">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                <Smartphone size={16} className="text-indigo-600" />
                                <span>Vibration Feedback</span>
                            </div>
                            <span className="font-semibold text-slate-500">
                                {['Off', 'Light', 'Medium', 'Strong'][vibrationIntensity]}
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {['Off', 'Light', 'Med', 'Strong'].map((label, idx) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                        setVibrationIntensity(idx);
                                        saveSetting('vibrationIntensity', idx);
                                        if (navigator.vibrate && idx > 0) {
                                            const haptics = [0, 20, 40, 75];
                                            navigator.vibrate(haptics[idx]);
                                        }
                                    }}
                                    className={`py-1.5 text-xs font-medium rounded-xl border transition-all ${
                                        vibrationIntensity === idx
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white/50 text-slate-600 border-white/60 hover:bg-white/80'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Last 7 Days Activity Graph */}
                <section className="bg-white/45 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 size={16} className="text-indigo-600" />
                            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-600">Weekly Journey</h2>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">Total: {dailyStats.beads} Beads today</span>
                    </div>

                    <div className="flex items-end justify-between gap-2 h-32 pt-4 px-1">
                        {last7Days.map((item, idx) => {
                            const heightPercent = maxBeadsInChart > 0 ? Math.round((item.beads / maxBeadsInChart) * 100) : 0;
                            const isToday = idx === last7Days.length - 1;

                            return (
                                <div key={item.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                    <span className="text-[10px] text-slate-500 font-medium">{item.beads > 0 ? item.beads : ''}</span>
                                    <div className="w-full bg-slate-200/50 rounded-t-xl relative overflow-hidden flex items-end h-20">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${Math.max(heightPercent, item.beads > 0 ? 10 : 0)}%` }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                            className={`w-full rounded-t-xl ${
                                                isToday
                                                    ? 'bg-indigo-600 shadow-sm'
                                                    : 'bg-indigo-400/60'
                                            }`}
                                        />
                                    </div>
                                    <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                                        {item.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Management Section (Photo & Data Backup) */}
                <section className="bg-white/45 backdrop-blur-xl border border-white/60 p-4 rounded-3xl shadow-sm space-y-2.5">
                    <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 px-1">Management</h2>

                    {/* Change/Remove Deity photo */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-white/60 active:bg-white/80 rounded-2xl text-xs font-medium text-slate-700 shadow-sm"
                        >
                            <ImageIcon size={15} className="text-indigo-600" />
                            <span>{deityImage ? "Change Deity Photo" : "Add Deity Photo"}</span>
                        </button>

                        {deityImage && (
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="flex items-center justify-center gap-1 px-4 py-3 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-2xl text-xs font-medium shadow-sm"
                            >
                                <Trash2 size={15} />
                                <span>Remove</span>
                            </button>
                        )}
                    </div>

                    {/* Backup and Full Reset buttons */}
                    <button
                        type="button"
                        onClick={handleExport}
                        className="w-full flex items-center justify-between p-3.5 bg-white/60 active:bg-white/80 rounded-2xl text-slate-700 text-xs font-medium shadow-sm transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Download size={16} className="text-indigo-600" />
                            <span>Backup Data (Export JSON)</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setResetModalType('all');
                            setShowResetModal(true);
                        }}
                        className="w-full flex items-center justify-between p-3.5 bg-rose-50/70 active:bg-rose-100 rounded-2xl text-rose-600 text-xs font-medium shadow-sm transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <RefreshCw size={16} />
                            <span>Reset All History & Data</span>
                        </div>
                    </button>
                </section>

                {/* Footer Note */}
                <footer className="text-center pt-2 text-[11px] text-slate-400">
                    Naam Japa • Pure Peaceful Chanting
                </footer>
            </div>

            {/* Reset Modal Confirmation */}
            <AnimatePresence>
                {showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white/95 backdrop-blur-2xl border border-white/60 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4"
                        >
                            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                                <RotateCcw size={22} />
                            </div>

                            <div>
                                <h3 className="text-base font-semibold text-slate-800">
                                    {resetModalType === 'session' ? 'Reset Current Session?' : 'Reset All History?'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {resetModalType === 'session'
                                        ? 'Sirf current mala round ya aaj ka pura count reset karein?'
                                        : 'Kya aap database se pura jaap history clear karna chahte hain?'}
                                </p>
                            </div>

                            <div className="space-y-2 pt-2">
                                {resetModalType === 'session' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleResetSession}
                                            className="w-full py-2.5 px-4 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-200 transition-colors"
                                        >
                                            Current Round Reset Karein ({count} beads)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResetToday}
                                            className="w-full py-2.5 px-4 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-xl text-xs font-medium transition-colors"
                                        >
                                            Pura Aaj Ka Din Reset Karein (0)
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResetAllData}
                                        className="w-full py-2.5 px-4 bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs font-medium shadow-md transition-colors"
                                    >
                                        Haan, Pura Data Clear Karein
                                    </button>
                                )}

                                <button
                                    type="button"
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
