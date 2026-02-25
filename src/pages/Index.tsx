import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Trash2, ClipboardCopy, Play, CheckCircle2, ShieldCheck, User, Bot, Globe, Eye, EyeOff, Save, CloudUpload, CloudDownload, KeyRound, Activity, Clock, Zap, Target } from "lucide-react";
import { toast } from "sonner";

declare global {
    interface Window {
        initGeetest4: any;
    }
}

type AccountStatus = 'pending' | 'solving' | 'registering' | 'success' | 'error';

interface AccountEntry {
    id: string;
    email: string;
    passwordXT: string;
    referralCode: string;
    appPassword: string;
    status: AccountStatus;
    message?: string;
    userId?: string;
    startTime?: number; // Untuk hitung kecepatan
    endTime?: number;
}

interface SavedConfig {
    id: string;
    gmail: string;
    passXT: string;
    appPass: string;
    refCode: string;
}

function generateDotVariations(email: string, count: number): string[] {
    const [local, domain] = email.split("@");
    if (!local || !domain) return [];
    const chars = local.replace(/\./g, "").split("");
    if (chars.length <= 1) return [`${chars.join("")}@${domain}`];

    const maxVariations = Math.pow(2, chars.length - 1);
    const results = new Set<string>();

    // Safety limit to avoid browser crash on very long emails, but usually up to 15 chars is fine (16k)
    const attempts = Math.min(count, maxVariations);
    let tries = 0;

    while (results.size < attempts && tries < attempts * 10) {
        let result = chars[0];
        for (let i = 1; i < chars.length; i++) {
            if (Math.random() > 0.5) result += ".";
            result += chars[i];
        }
        results.add(`${result}@${domain}`);
        tries++;
    }
    return Array.from(results);
}

function calculateMaxVariations(email: string): number {
    const [local] = email.split("@");
    if (!local) return 0;
    const chars = local.replace(/\./g, "").split("");
    if (chars.length <= 1) return 1;
    return Math.pow(2, chars.length - 1);
}

const Index = () => {
    const [gmail, setGmail] = useState("");
    const [appPassword, setAppPassword] = useState("");
    const [passwordXT, setPasswordXT] = useState("");
    const [referralCode, setReferralCode] = useState("");
    const [jumlah, setJumlah] = useState("5");
    const [accounts, setAccounts] = useState<AccountEntry[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [serverIp, setServerIp] = useState("Loading IP...");
    const [usedEmails, setUsedEmails] = useState<string[]>([]);
    const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
    const [visibleAppPassIdx, setVisibleAppPassIdx] = useState<number | null>(null);
    const [syncToken, setSyncToken] = useState<string>(localStorage.getItem('xt_sync_token') || '');
    const [audioEnabled, setAudioEnabled] = useState<boolean>(true); // Bebas matikan/hidupkan suara

    // Analitik
    const [sessionStats, setSessionStats] = useState({
        successCount: 0,
        totalTimeSeconds: 0, // Total waktu untuk semua akun sukses di sesi ini
        fastestTimeSeconds: 999
    });

    // Authorization State
    const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
    const [pinInput, setPinInput] = useState("");
    const CORRECT_PIN = "251203";

    useEffect(() => {
        // Cek login status awal
        if (localStorage.getItem('xt_authorized') === 'true') {
            setIsAuthorized(true);
        }
        // Load persist form data
        setGmail(localStorage.getItem('xt_active_gmail') || '');
        setPasswordXT(localStorage.getItem('xt_active_pass') || 'Dicoba@11');
        setReferralCode(localStorage.getItem('xt_active_ref') || '');
        setAppPassword(localStorage.getItem('xt_active_app') || '');

        // Load arrays
        setUsedEmails(JSON.parse(localStorage.getItem('xt_used_emails') || '[]'));
        setSavedConfigs(JSON.parse(localStorage.getItem('xt_saved_configs') || '[]'));

        // Load configs from old version if they exist, then clear old keys
        const oldSavedGmail = localStorage.getItem('xt_saved_gmail');
        if (oldSavedGmail) {
            const oldConf: SavedConfig = {
                id: Math.random().toString(36).substring(7),
                gmail: oldSavedGmail,
                passXT: localStorage.getItem('xt_saved_pass') || '',
                appPass: localStorage.getItem('xt_saved_app') || '',
                refCode: localStorage.getItem('xt_saved_ref') || ''
            };
            setSavedConfigs([oldConf]);
            localStorage.setItem('xt_saved_configs', JSON.stringify([oldConf]));
            localStorage.removeItem('xt_saved_gmail');
            localStorage.removeItem('xt_saved_pass');
            localStorage.removeItem('xt_saved_app');
            localStorage.removeItem('xt_saved_ref');
        }

        // Fetch Client IP directly from browser
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => {
                if (data.ip) setServerIp(data.ip);
                else setServerIp("Unknown IP");
            })
            .catch(() => setServerIp("Error loading IP"));
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (pinInput === CORRECT_PIN) {
            setIsAuthorized(true);
            localStorage.setItem('xt_authorized', 'true');
            toast.success("Akses Diberikan!");
        } else {
            toast.error("PIN Akses Salah!");
            setPinInput("");
        }
    };

    const handleLogout = () => {
        setIsAuthorized(false);
        localStorage.removeItem('xt_authorized');
        toast("Sesi diakhiri");
    };

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    // Fungsi Suara (Menggunakan Web Audio API agar pasti bunyi tanpa block internet/CDN)
    const playSound = (type: 'swoosh' | 'success' | 'error') => {
        if (!audioEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            // Re-use context agar tidak memory leak
            if (!(window as any).xtAudioCtx) {
                (window as any).xtAudioCtx = new AudioContextClass();
            }
            const ctx: AudioContext = (window as any).xtAudioCtx;

            if (ctx.state === 'suspended') {
                ctx.resume(); // Atasi kebijakan Autoplay browser
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            if (type === 'success') {
                // Suara Koin (Nada tinggi 1)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);

                // Nada tinggi 2 menyusul
                setTimeout(() => {
                    if (ctx.state === 'suspended') return;
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1200, ctx.currentTime);
                    osc2.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.1);
                    gain2.gain.setValueAtTime(0, ctx.currentTime);
                    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
                    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                    osc2.start(ctx.currentTime);
                    osc2.stop(ctx.currentTime + 0.3);
                }, 100);

            } else if (type === 'error') {
                // Suara Buzzer Error
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);

            } else if (type === 'swoosh') {
                // Suara angin (pindah akun)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) { }
    };

    // Auto-save form inputs to active cache so they don't disappear on refresh
    const handleSaveActiveForm = () => {
        localStorage.setItem('xt_active_gmail', gmail);
        localStorage.setItem('xt_active_pass', passwordXT);
        localStorage.setItem('xt_active_ref', referralCode);
        localStorage.setItem('xt_active_app', appPassword);
    };

    // Save as a permanent configuration profile
    const handleSaveConfig = () => {
        if (!gmail) {
            toast.error("Gmail tidak boleh kosong");
            return;
        }
        setSavedConfigs(prev => {
            const newConf: SavedConfig = {
                id: Math.random().toString(36).substring(7),
                gmail,
                passXT: passwordXT,
                appPass: appPassword,
                refCode: ""
            };
            const updated = [...prev, newConf];
            localStorage.setItem('xt_saved_configs', JSON.stringify(updated));
            return updated;
        });
        toast.success("Profil tersimpan!");
    };

    const handleDeleteConfig = (id: string) => {
        setSavedConfigs(prev => {
            const updated = prev.filter(c => c.id !== id);
            localStorage.setItem('xt_saved_configs', JSON.stringify(updated));
            return updated;
        });
        toast("Profil dihapus");
    };

    const handleSyncSave = async () => {
        if (!syncToken) {
            toast.error("Masukkan Token Sync terlebih dahulu");
            return;
        }
        localStorage.setItem('xt_sync_token', syncToken);

        toast.loading("Mempersiapkan penyimpanan aman...", { id: "sync-save" });

        try {
            // 1. Ambil data cloud terlebih dahulu supaya tidak saling timpa
            let cloudConfigs: SavedConfig[] = [];
            let cloudUsedEmails: string[] = [];

            try {
                const loadRes = await fetch('/api/sync/load', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: syncToken })
                });
                const loadResult = await loadRes.json();
                if (loadResult.ok && loadResult.data) {
                    if (loadResult.data.savedConfigs) cloudConfigs = loadResult.data.savedConfigs;
                    if (loadResult.data.usedEmails) cloudUsedEmails = loadResult.data.usedEmails;
                }
            } catch (e) {
                // Abaikan error load jika misal token memang masih benar-benar baru
            }

            // 2. Gabungkan (Merge) data cloud dengan data lokal yang sekarang

            // Merge Configs berdasarkan Gmail
            let finalConfigs = savedConfigs;

            // JIKA LOKAL KOSONG MELOMPONG (Misal: buka di HP baru), KITA JANGAN TIMPA CLOUD YANG ADA. KITA PAKAI CLOUD PUNYA.
            // Namun, jika lokal ada isinya (misal: 1 atau 5 akun), kita anggap lokal adalah kebenaran mutlak (Timpa).
            // Ini memungkinkan penghapusan (delete profile) tersinkronisasi.
            if (savedConfigs.length === 0 && cloudConfigs.length > 0) {
                finalConfigs = cloudConfigs;
            }

            // Merge Emails Unik
            const mergedUsedEmails = Array.from(new Set([...cloudUsedEmails, ...usedEmails]));

            // 3. Simpan data gabungan tersebut ke Cloud
            const dataToSave = {
                savedConfigs: finalConfigs,
                usedEmails: mergedUsedEmails
            };

            const res = await fetch('/api/sync/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: syncToken, data: dataToSave })
            });
            const result = await res.json();

            if (result.ok) {
                // Update tabel lokal dengan hasil gabungan
                setSavedConfigs(finalConfigs);
                localStorage.setItem('xt_saved_configs', JSON.stringify(finalConfigs));

                setUsedEmails(mergedUsedEmails);
                localStorage.setItem('xt_used_emails', JSON.stringify(mergedUsedEmails));

                toast.success(result.msg, { id: "sync-save" });
            }
            else toast.error(result.msg, { id: "sync-save" });
        } catch (e) {
            toast.error("Gagal terhubung ke server untuk sync", { id: "sync-save" });
        }
    };

    const handleSyncLoad = async () => {
        if (!syncToken) {
            toast.error("Masukkan Token Sync terlebih dahulu");
            return;
        }
        localStorage.setItem('xt_sync_token', syncToken);
        try {
            const res = await fetch('/api/sync/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: syncToken })
            });
            const result = await res.json();
            if (result.ok && result.data) {
                if (result.data.savedConfigs) {
                    setSavedConfigs(result.data.savedConfigs);
                    localStorage.setItem('xt_saved_configs', JSON.stringify(result.data.savedConfigs));
                }
                if (result.data.usedEmails) {
                    setUsedEmails(prev => {
                        const merged = Array.from(new Set([...prev, ...result.data.usedEmails]));
                        localStorage.setItem('xt_used_emails', JSON.stringify(merged));
                        return merged;
                    });
                }
                toast.success(result.msg);
            } else {
                toast.error(result.msg);
            }
        } catch (e) {
            toast.error("Gagal terhubung ke server untuk load data");
        }
    };

    const handleGenerate = () => {
        const emailToUse = gmail;
        if (!emailToUse || !emailToUse.includes("@")) {
            toast.error("Masukkan email yang valid");
            return;
        }
        const count = parseInt(jumlah);
        const allVariations = generateDotVariations(emailToUse, Math.max(count * 5, 500));
        const variations = allVariations.filter(v => !usedEmails.includes(v)).slice(0, count);

        if (variations.length === 0) {
            toast.error("Semua variasi dot trick dari email ini sudah terdaftar!");
            return;
        }

        const newAccounts: AccountEntry[] = variations.map(v => ({
            id: Math.random().toString(36).substring(7),
            email: v,
            passwordXT: passwordXT,
            referralCode: referralCode,
            appPassword: appPassword,
            status: 'pending'
        }));

        setAccounts(prev => [...prev, ...newAccounts]);
        addLog(`${newAccounts.length} dot trick variations generated!`);
        toast.success(`${newAccounts.length} variasi ditambahkan`);
    };

    const handleResetHistory = () => {
        if (window.confirm('Reset semua antrian?')) {
            setAccounts([]);
            setLogs([]);
            addLog("Antrian direset.");
        }
    };

    const handleCopyGmail = () => {
        navigator.clipboard.writeText(gmail);
        toast.success("Gmail disalin");
    };

    const updateAccount = (id: string, updates: Partial<AccountEntry>) => {
        setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, ...updates } : acc));
    };

    const removeAccount = (id: string) => {
        setAccounts(prev => prev.filter(acc => acc.id !== id));
    };

    const startManualCaptcha = (id: string) => {
        if (!window.initGeetest4) {
            toast.error("GeeTest script belum dimuat");
            return;
        }

        const acc = accounts.find(a => a.id === id);
        if (!acc) return;

        updateAccount(id, { status: 'solving', message: 'Selesaikan Captcha...', startTime: Date.now() });
        addLog(`[${acc.email}] Membuka panel Captcha...`);
        playSound('swoosh');

        window.initGeetest4({
            captchaId: "f6cb1abffdcdf0b30659fd3bb4c0e929",
            product: "bind",
        }, function (captchaObj: any) {
            captchaObj.onReady(function () {
                captchaObj.showCaptcha();
            }).onSuccess(async function () {
                const result = captchaObj.getValidate();
                addLog(`[${acc.email}] Captcha berhasil dipecahkan! Melakukan proses registrasi...`);
                updateAccount(id, { status: 'registering', message: 'Loading OTP & Registering...' });

                try {
                    // 1. Prepare Headers (Auto-generated Only)
                    let customHeadersObj: any = {};
                    addLog(`[${acc.email}] 🔑 Generating unique device headers...`);
                    const genRes = await fetch('/api/generate-device-headers');
                    customHeadersObj = await genRes.json();
                    addLog(`[${acc.email}] ✅ Device identity generated.`);
                    await new Promise(r => setTimeout(r, 1000));

                    // Client-side execution helper
                    const xtFetchClient = async (urlPath: string, opts: any = {}) => {
                        const { body, query, method = 'POST', isMinimal = false } = opts;
                        let token = opts.token;

                        let headers: any = {
                            'Accept': 'application/json, text/plain, */*'
                        };
                        if (body) headers['Content-Type'] = 'application/json';

                        if (urlPath.includes('/acapi/')) {
                            headers['api-version'] = '2';
                            headers['xt-host'] = 'www.xtpro.online';
                        } else {
                            headers['api-version'] = '4';
                        }
                        headers['device'] = 'web';

                        if (token) {
                            headers['authorization'] = `Bearer ${token}`;
                            headers['token'] = token;
                        }

                        if (!isMinimal) {
                            for (const [key, value] of Object.entries(customHeadersObj)) {
                                if (value && key !== 'api-version') headers[key] = value as string;
                            }
                        }

                        let url = 'https://www.xtpro.online' + urlPath;
                        if (query) {
                            const qs = new URLSearchParams(query).toString();
                            url += '?' + qs;
                        }

                        const res = await fetch(url, {
                            method,
                            headers,
                            body: body && method !== 'GET' ? JSON.stringify(body) : undefined
                        });
                        const text = await res.text();
                        try { return { ...JSON.parse(text), _httpStatus: res.status }; }
                        catch (e) { return { rc: -1, _httpStatus: res.status, mc: text }; }
                    };

                    const xtSuccessClient = (data: any) => data?.rc === 0 || data?.rc === '0' || data?.code === 0 || data?.code === '0' || data?.returnCode === 0 || data?.returnCode === '0' || data?._httpStatus === 200;
                    const xtMsgClient = (data: any) => data?.mc || data?.msg || data?.message || data?.desc || JSON.stringify(data);

                    // 2. Validate Captcha (Directly to XT)
                    addLog(`[${acc.email}] Validating captcha via Client...`);
                    updateAccount(id, { status: 'registering', message: 'Validating Captcha...' });
                    let capData = await xtFetchClient('/xt-app/public/captcha/validate', {
                        query: {
                            data: JSON.stringify({
                                lot_number: result.lot_number,
                                captcha_output: result.captcha_output,
                                pass_token: result.pass_token,
                                gen_time: result.gen_time
                            }), type: '2'
                        },
                        method: 'POST',
                        isMinimal: true
                    });
                    if (!capData.data?.certificate) throw new Error(xtMsgClient(capData) || "Gagal validasi captcha. (Pastikan ekstensi Bypass CORS aktif!)");

                    addLog(`[${acc.email}] ✅ Captcha validated.`);
                    await new Promise(r => setTimeout(r, 2000));

                    // 3. Send OTP (Directly to XT)
                    addLog(`[${acc.email}] 🔥 Sending OTP code via Client...`);
                    updateAccount(id, { status: 'registering', message: 'Mengirim OTP...' });
                    let sendOtpData = await xtFetchClient('/uaapi/user/msg/doSendCode', {
                        query: { codeType: '101', apiKey: 'regist' },
                        body: { codeType: '101', receiveAddress: acc.email.trim(), puzzleValidateString: capData.data.certificate, regChannel: 'regist' },
                        isMinimal: true
                    });
                    if (!xtSuccessClient(sendOtpData)) throw new Error(xtMsgClient(sendOtpData) || "Gagal kirim OTP");
                    addLog(`[${acc.email}] 📨 OTP sent! Waiting 5s...`);
                    await new Promise(r => setTimeout(r, 5000));

                    // 4. Poll for OTP (Max 90s, Backend)
                    updateAccount(id, { status: 'registering', message: 'Mencari OTP di Gmail...' });
                    let otpFound: string | null = null;
                    const startTime = Date.now();
                    while (!otpFound && (Date.now() - startTime) < 90000) {
                        addLog(`[${acc.email}] 🔍 Searching for OTP...`);
                        let pollRes = await fetch('/api/fetch-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: acc.email, appPassword: acc.appPassword })
                        });
                        let pollData = await pollRes.json();
                        if (pollData.ok && pollData.otp) {
                            otpFound = pollData.otp;
                            break;
                        }
                        await new Promise(r => setTimeout(r, 5000));
                    }
                    if (!otpFound) throw new Error("OTP tidak masuk ke Gmail (Timeout 90s)");

                    // 5. Complete Register (Directly to XT)
                    addLog(`[${acc.email}] 🚀 Registering account via Client...`);
                    updateAccount(id, { status: 'registering', message: 'Selesaikan pendaftaran...' });

                    let keyData = await xtFetchClient('/uaapi/uaa/authorize/passwd/publicKey', { method: 'POST', isMinimal: true });
                    if (!keyData?.data?.publicKey) throw new Error("Gagal mengambil public key");

                    let encRes = await fetch('/api/encrypt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: acc.passwordXT, publicKey: keyData.data.publicKey })
                    });
                    let encData = await encRes.json();
                    if (!encData.ok) throw new Error("Gagal encrypt password");

                    let regData = await xtFetchClient('/uaapi/user/v2/reg', {
                        body: {
                            userName: acc.email.trim(),
                            countryCode: '',
                            dynamicCode: otpFound.trim(),
                            loginPwd: encData.encrypted,
                            passwdId: keyData.data.passwdId,
                            recommendCode: acc.referralCode || 'AKNSZM',
                            regChannel: 'regist',
                            apiKey: 'regist'
                        }
                    });

                    if (!xtSuccessClient(regData)) throw new Error("Gagal mendaftar: " + xtMsgClient(regData));

                    let userId = regData?.data?.userId || regData?.data?.uid || '';
                    let token = regData?.data?.accessToken || '';

                    // Save to DB
                    await fetch('/api/save-account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: acc.email, password: acc.passwordXT, userId, refCode: acc.referralCode, token })
                    });

                    // Join Event & Draw List
                    addLog(`[${acc.email}] ℹ️ Auto-joining event dengan ref=none...`);
                    // First Apply (We don't strictly check success here, just fire it)
                    try {
                        let applyRes = await xtFetchClient('/acapi/general/activity/apply/999999999999991', { token });
                        addLog(`[${acc.email}] 🔥 ✅ Event joined — referral terhubung!`);
                    } catch (e) {
                        // silently ignore
                    }

                    // Second Apply to get draw count
                    try {
                        let drawRes = await xtFetchClient('/acapi/lucky/draw/10/index/309322e7-eb77-4a0b-ae9b-1d70e4eedda5', { token });
                        addLog(`[${acc.email}] 🔥 ${acc.email} ditambahkan ke draw list!`);
                    } catch (e) {
                        // silently ignore
                    }

                    setUsedEmails(prev => {
                        const updated = [...prev, acc.email];
                        localStorage.setItem('xt_used_emails', JSON.stringify(updated));
                        return updated;
                    });

                    // Hitung Kecepatan Analitik dengan state acc paling baru agar startTime tidak undefined
                    const endTime = Date.now();

                    setAccounts(prevAccounts => {
                        const currentAcc = prevAccounts.find(a => a.id === id);
                        if (currentAcc && currentAcc.startTime) {
                            const durationSec = (endTime - currentAcc.startTime) / 1000;

                            setSessionStats(prev => ({
                                successCount: prev.successCount + 1,
                                totalTimeSeconds: prev.totalTimeSeconds + durationSec,
                                fastestTimeSeconds: Math.min(prev.fastestTimeSeconds, durationSec)
                            }));
                            addLog(`[${acc.email}] 🔥 ✅ Registered & token! (${durationSec.toFixed(1)}s)`);
                        } else {
                            addLog(`[${acc.email}] 🔥 ✅ Registered & token!`);
                        }
                        return prevAccounts;
                    });

                    updateAccount(id, { status: 'success', message: `Registered! ID: ${userId}`, userId, endTime });
                    addLog(`[${acc.email}] ℹ️ ${acc.email} disimpan ke database`);
                    playSound('success');
                    toast.success(`${acc.email} terdaftar!`);
                } catch (e: any) {
                    updateAccount(id, { status: 'error', message: e.message, endTime: Date.now() });
                    addLog(`[ERROR] ${acc.email}: ${e.message}`);
                    playSound('error');
                    toast.error(`Gagal: ${e.message}`);
                } finally {
                    // Trigger next in queue automatically almost instantly
                    setTimeout(() => {
                        setAccounts(currentAccounts => {
                            // Hapus akun yang sukses agar UI jadi bersih
                            const remainingAccounts = currentAccounts.filter(a => a.status !== 'success');

                            const nextAcc = remainingAccounts.find(a => a.status === 'pending');
                            if (nextAcc && window.initGeetest4) {
                                addLog(`[Batch] 🔄 Memulai akun selanjutnya: ${nextAcc.email}`);
                                // Lanjut secepatnya agar efisien waktu
                                setTimeout(() => startManualCaptcha(nextAcc.id), 100);
                            }
                            return remainingAccounts;
                        });
                    }, 100); // Tanpa jeda panjang, langsung sikat antrean berikutnya
                }
            }).onError(function (e: any) {
                updateAccount(id, { status: 'error', message: 'Captcha Error: ' + e.msg });
                addLog(`[ERROR] ${acc.email} Captcha error: ${e.msg}`);
            }).onClose(function () {
                setAccounts(prev => prev.map(a =>
                    a.id === id && a.status === 'solving' ? { ...a, status: 'pending', message: 'Captcha dibatalkan' } : a
                ));
            });
        });
    };

    const handleStartBatch = () => {
        const pendingAcc = accounts.find(a => a.status === 'pending' || a.status === 'error');
        if (pendingAcc) {
            startManualCaptcha(pendingAcc.id);
        } else {
            toast.info("Tidak ada antrian yang pending");
        }
    };

    const getBaseEmail = (emailStr: string) => {
        if (!emailStr || !emailStr.includes("@")) return "";
        const [local, domain] = emailStr.split("@");
        return `${local.replace(/\./g, "")}@${domain}`.toLowerCase();
    };

    // Kalkulasi Statistik Dot Trick untuk email yang sedang diketik (gmail)
    const activeBaseEmail = getBaseEmail(gmail);
    const maxAvailable = calculateMaxVariations(gmail);

    // Cari berapa akun yang sudah didaftarkan (sukses) khusus untuk base email ini
    const usedForThisEmail = usedEmails.filter(e => getBaseEmail(e) === activeBaseEmail).length;

    // Berapa sisa yang masih bisa di-generate
    const remainingAvailable = Math.max(0, maxAvailable - usedForThisEmail);

    const successCount = accounts.filter(a => a.status === 'success').length;
    const pendingCount = accounts.filter(a => a.status === 'pending' || a.status === 'error').length;
    const remainingCount = accounts.filter(a => a.status !== 'success').length;

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#0f0f10] text-[#ececec] flex items-center justify-center p-4 font-inter">
                <div className="bg-[#17171a] border border-[#2c2c2f] p-8 rounded-2xl w-full max-w-sm flex flex-col items-center shadow-2xl relative overflow-hidden">
                    {/* Decorative glow */}
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl point-events-none"></div>
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl point-events-none"></div>

                    <Bot className="w-16 h-16 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)] mb-4 relative z-10" />
                    <h1 className="text-2xl font-black tracking-widest uppercase mb-1 relative z-10">AHESS <span className="text-green-500">PRO</span></h1>
                    <p className="text-xs text-[#777] mb-8 font-medium text-center relative z-10">Auto-Registration System<br />Area Terbatas</p>

                    <form onSubmit={handleLogin} className="w-full relative z-10 flex flex-col gap-3">
                        <Input
                            type="password"
                            placeholder="Masukkan PIN Akses"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            className="bg-[#121214] border-[#333] text-center text-lg tracking-widest focus-visible:ring-1 focus-visible:ring-green-500 h-12"
                            autoFocus
                        />
                        <Button type="submit" className="w-full bg-[#1dae54] hover:bg-green-500 text-white font-bold h-12 rounded-lg transition-transform active:scale-[0.98]">
                            MASUK
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f10] text-[#ececec] p-4 max-w-lg mx-auto pb-24 font-inter text-sm relative">
            {/* Header - Ditengah, logo agak besar, huruf besar AHESS */}
            <div className="flex flex-col items-center justify-center mb-4 p-2 border-b border-[#2c2c2f] pb-4 relative">
                <div className="flex flex-col items-center gap-1 mb-1 relative group cursor-pointer" onClick={handleLogout} title="Klik logo untuk Logout">
                    <Bot className="w-12 h-12 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-transform group-hover:scale-105 group-hover:text-red-500 group-hover:drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
                    <h1 className="text-[22px] font-black text-[#ececec] tracking-widest uppercase mb-0">
                        AHESS
                    </h1>
                </div>
                {/* IP Jaringan - Kanan atas, agak kecil */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-[#17171a] border border-[#2c2c2f] rounded-full px-2.5 py-1">
                    <Globe className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] font-mono text-[#aaa]">{serverIp}</span>
                </div>
                {/* Toggle Suara - Kiri atas */}
                <button
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className="absolute top-2 left-2 flex items-center justify-center bg-[#17171a] border border-[#2c2c2f] hover:bg-[#2c2c2f] rounded-full w-7 h-7 transition-colors"
                    title={audioEnabled ? "Matikan Suara" : "Hidupkan Suara"}
                >
                    <span className="text-[14px]">{audioEnabled ? "🔊" : "🔇"}</span>
                </button>
            </div>

            {/* ANALYTICS DASHBOARD MINI */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="bg-[#17171a] border border-[#2c2c2f] rounded-xl p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-green-500/0 via-green-500 to-green-500/0 opacity-50"></div>
                    <Target className="w-4 h-4 text-green-500 mb-1 opacity-80" />
                    <span className="text-[10px] text-[#777] font-bold uppercase tracking-wider mb-0.5">Sukses Sesi Ini</span>
                    <span className="text-xl font-black text-[#ececec]">{sessionStats.successCount}</span>
                </div>
                <div className="bg-[#17171a] border border-[#2c2c2f] rounded-xl p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0 opacity-50"></div>
                    <Clock className="w-4 h-4 text-blue-500 mb-1 opacity-80" />
                    <span className="text-[10px] text-[#777] font-bold uppercase tracking-wider mb-0.5">Rata-Rata Waktu</span>
                    <span className="text-xl font-black text-[#ececec]">
                        {sessionStats.successCount > 0 ? (sessionStats.totalTimeSeconds / sessionStats.successCount).toFixed(1) : "0.0"}<span className="text-xs text-[#666] ml-0.5">s</span>
                    </span>
                </div>
                <div className="bg-[#17171a] border border-[#2c2c2f] rounded-xl p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-yellow-500/0 via-yellow-500 to-yellow-500/0 opacity-50"></div>
                    <Zap className="w-4 h-4 text-yellow-500 mb-1 opacity-80" />
                    <span className="text-[10px] text-[#777] font-bold uppercase tracking-wider mb-0.5">Rekor Tercepat</span>
                    <span className="text-xl font-black text-[#ececec]">
                        {sessionStats.fastestTimeSeconds !== 999 ? sessionStats.fastestTimeSeconds.toFixed(1) : "0.0"}<span className="text-xs text-[#666] ml-0.5">s</span>
                    </span>
                </div>
            </div>

            {/* Saved Configurations List - Jarak didekatkan, ukuran diperkecil */}
            {savedConfigs.length > 0 && (
                <div className="mb-5 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-[10px] font-bold text-[#777] uppercase tracking-wider">Profil Tersimpan</h3>
                    </div>
                    {savedConfigs.map((conf, idx) => {
                        const base = getBaseEmail(conf.gmail);
                        const used = usedEmails.filter(e => getBaseEmail(e) === base).length;
                        const max = calculateMaxVariations(conf.gmail);
                        const remain = Math.max(0, max - used);

                        return (
                            <div key={conf.id} className="bg-[#17171a] p-2 rounded-md border border-[#2c2c2f] hover:border-[#189b4a] transition-colors group cursor-pointer"
                                onClick={() => {
                                    setGmail(conf.gmail);
                                    setPasswordXT(conf.passXT);
                                    setAppPassword(conf.appPass);
                                    handleSaveActiveForm();
                                    toast.success("Profil dimuat ke form");
                                }}>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col flex-1 truncate">
                                        <p className="text-[12px] text-green-400 font-bold truncate pr-2">{conf.gmail}</p>
                                        <p className="text-[10px] text-[#888] mt-0.5">
                                            Terpakai: <span className="text-green-500 font-bold">{used.toLocaleString()}</span> &nbsp;•&nbsp; Sisa: <span className="text-blue-400 font-bold">{remain.toLocaleString()}</span>
                                        </p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteConfig(conf.id); }} className="text-[#555] hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Inputs */}
            <div className="space-y-3 mb-5 bg-[#1a1a1c] p-3 rounded-xl border border-[#2c2c2f]">
                <div className="p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg mb-2">
                    <label className="text-[11px] mb-1.5 block text-blue-400 font-bold flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        Cloud Sync Token
                    </label>
                    <div className="flex gap-2">
                        <Input
                            value={syncToken}
                            onChange={(e) => setSyncToken(e.target.value)}
                            placeholder="Buat kunci rahasia bebas (misal: RAHASIAKU)"
                            className="bg-[#121214] border-[#2c2c2f] text-white flex-1 focus-visible:ring-1 focus-visible:ring-blue-500 h-8 text-[#aaa] text-[12px]"
                        />
                        <Button variant="outline" size="icon" onClick={handleSyncSave} className="bg-[#1f1f22] hover:bg-blue-600/20 border-[#333] hover:border-blue-500 text-blue-400 h-8 w-8 shrink-0 transition-colors" title="Simpan Data ke Cloud">
                            <CloudUpload className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleSyncLoad} className="bg-[#1f1f22] hover:bg-green-600/20 border-[#333] hover:border-green-500 text-green-400 h-8 w-8 shrink-0 transition-colors" title="Muat Data dari Cloud">
                            <CloudDownload className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <p className="text-[9px] text-[#777] mt-1.5 leading-tight">Buat token bebas. Simpan untuk upload profil, gunakan token yang sama di HP/PC lain untuk download profil.</p>
                </div>

                <div>
                    <label className="text-[11px] mb-1 block text-[#999] font-medium">Gmail</label>
                    <div className="flex gap-2 mb-1.5">
                        <Input
                            value={gmail}
                            onChange={(e) => { setGmail(e.target.value); handleSaveActiveForm(); }}
                            placeholder="example@gmail.com"
                            className="bg-[#121214] border-[#2c2c2f] text-white flex-1 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-8 text-[12px] placeholder:text-[#555]"
                            onBlur={handleSaveActiveForm}
                        />
                        <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(gmail); toast.success("Disalin"); }} className="bg-[#1f1f22] hover:bg-[#2c2c2f] border-[#333] text-white h-8 w-8 shrink-0" title="Copy">
                            <ClipboardCopy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700 border-none text-white h-8 w-8 shrink-0" title="Simpan sebagai Profil">
                            <Save className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    {/* INDIKATOR DOT TRICK */}
                    {gmail && gmail.includes("@") && (
                        <div className="text-[10px] flex justify-between px-1">
                            <span className="text-[#888]">Variasi: <span className="text-[#ddd]">{maxAvailable.toLocaleString()}</span></span>
                            <span className="text-green-500">Terpakai/Sukses: <span className="font-bold">{usedForThisEmail.toLocaleString()}</span></span>
                            <span className="text-blue-400">Sisa: <span className="font-bold">{remainingAvailable.toLocaleString()}</span></span>
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-[11px] mb-1 block text-[#999] font-medium">App Password (untuk OTP)</label>
                    <Input
                        type="password"
                        value={appPassword}
                        onChange={(e) => { setAppPassword(e.target.value); handleSaveActiveForm(); }}
                        placeholder="••••••••••••••••"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-8 font-mono tracking-widest text-[14px] placeholder:text-[#555] placeholder:tracking-normal"
                        onBlur={handleSaveActiveForm}
                    />
                </div>

                <div>
                    <label className="text-[11px] mb-1 block text-[#999] font-medium">Password XT</label>
                    <Input
                        value={passwordXT}
                        onChange={(e) => { setPasswordXT(e.target.value); handleSaveActiveForm(); }}
                        placeholder="Password untuk akun XT"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-8 text-[12px] placeholder:text-[#555]"
                        onBlur={handleSaveActiveForm}
                    />
                </div>

                <div>
                    <label className="text-[11px] mb-1 block text-[#999] font-medium">Referral Code</label>
                    <Input
                        value={referralCode}
                        onChange={(e) => { setReferralCode(e.target.value); handleSaveActiveForm(); }}
                        placeholder="REFCODE"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-8 text-[12px] font-mono placeholder:text-[#555] uppercase"
                        onBlur={handleSaveActiveForm}
                    />
                </div>

                <div>
                    <label className="text-[11px] mb-1 block text-[#999] font-medium">Jumlah Generate</label>
                    <Select value={jumlah} onValueChange={setJumlah}>
                        <SelectTrigger className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 h-8 text-[12px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#17171a] border-[#2c2c2f] text-white text-[12px]">
                            {[1, 2, 5, 10, 20, 50].map((n) => (
                                <SelectItem key={n} value={String(n)} className="focus:bg-[#2c2c2f] focus:text-white cursor-pointer">{n}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Stats Bawah & Tombol Kanan Kiri */}
                <div className="flex justify-between items-center text-[10px] pt-1 mb-2">
                    <p>
                        <span className="text-yellow-500 font-bold">{accounts.length} di antrean</span>
                        <span className="text-[#666]"> • </span>
                        <span className="text-green-500 font-bold">{pendingCount} pending</span>
                    </p>
                    <button onClick={handleResetHistory} className="text-[#777] underline hover:text-white transition-colors">
                        Kosongkan antrean
                    </button>
                </div>

                <div className="flex gap-2 w-full mt-1.5">
                    <Button onClick={handleGenerate} className="flex-1 bg-[#189b4a] hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-1.5 h-9 text-[12px] transition-all active:scale-[0.98]">
                        <Shuffle className="w-3.5 h-3.5" />
                        Gen Dot Trick
                    </Button>
                    <Button onClick={handleStartBatch} disabled={pendingCount === 0} className="w-[100px] bg-[#1dae54] hover:bg-green-500 text-white font-bold h-9 text-[12px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                        <Play className="w-3.5 h-3.5 mr-1" />
                        Batch
                    </Button>
                </div>
            </div>

            {/* Account List */}
            <div className="mb-6">
                <h3 className="text-xs font-bold text-[#888] mb-2 uppercase tracking-wider">{accounts.length} akun — {pendingCount} pending</h3>
                <div className="flex flex-col gap-2">
                    {accounts.map((acc, i) => (
                        <div key={acc.id} className={`p-2 rounded-md border relative overflow-hidden flex flex-col gap-1.5 transition-all ${acc.status === 'success' ? 'bg-[#1a2e1d] border-green-500/40' :
                            acc.status === 'error' ? 'bg-[#2b1616] border-red-500/30' :
                                acc.status === 'registering' || acc.status === 'solving' ? 'bg-[#2d2212] border-yellow-500/40' :
                                    'bg-[#17171a] border-[#2c2c2f]'
                            }`}>
                            <div className="flex items-center gap-1.5 w-full">
                                {acc.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
                                {acc.status === 'error' && <div className="w-3 h-3 shrink-0 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-[9px] font-bold">!</div>}
                                {acc.status === 'pending' && <User className="w-3 h-3 text-[#555] shrink-0" />}

                                <span className="font-mono text-[10px] truncate flex-1 text-[#ddd]">{acc.email}</span>

                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${acc.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                    acc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                        acc.status === 'solving' || acc.status === 'registering' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-[#333] text-[#777]'
                                    }`}>
                                    {acc.status}
                                </span>

                                <button onClick={() => removeAccount(acc.id)} className="text-[#555] hover:text-red-400 p-0.5 shrink-0 ml-1">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>

                            {acc.status === 'pending' || acc.status === 'error' ? (
                                <Button
                                    onClick={() => startManualCaptcha(acc.id)}
                                    className="w-full bg-[#20bb5c] hover:bg-[#1dae54] text-white h-7 text-[10px] font-semibold rounded shadow-[0_0_10px_rgba(32,187,92,0.2)] mt-0.5"
                                >
                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                    Solve Captcha & Register
                                </Button>
                            ) : acc.message ? (
                                <div className={`text-[10px] ${acc.status === 'success' ? 'text-green-400 font-medium flex items-center gap-1.5' :
                                    acc.status === 'error' ? 'text-red-400' : 'text-yellow-400 animate-pulse'
                                    }`}>
                                    {acc.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                                    {acc.message}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 p-3 bg-[#121214]/95 border border-[#2c2c2f] rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-[#888] uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-500" /> System Logs
                    </h3>
                </div>
                <div className="max-h-[300px] overflow-y-auto bg-[#0a0a0b] p-3 rounded-md font-mono text-[11px] text-[#888] flex flex-col-reverse border border-[#222]">
                    {logs.slice().reverse().map((log, i) => (
                        <div key={i} className={`whitespace-pre-wrap mb-1 ${log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[ERROR]') ? 'text-red-400' : ''}`}>{log}</div>
                    ))}
                    {logs.length === 0 && <span>≥ Logs ready (menunggu eksekusi)</span>}
                </div>
            </div>
        </div>
    );
};

export default Index;
