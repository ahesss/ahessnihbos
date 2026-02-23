import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Trash2, ClipboardCopy, Play, CheckCircle2, ShieldCheck, User } from "lucide-react";
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
}

function generateDotVariations(email: string, count: number): string[] {
    const [local, domain] = email.split("@");
    if (!local || !domain) return [];
    const chars = local.replace(/\./g, "").split("");
    if (chars.length <= 1) return [`${chars.join("")}@${domain}`];

    const maxVariations = Math.pow(2, chars.length - 1);
    const results = new Set<string>();
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

const Index = () => {
    const [savedGmail, setSavedGmail] = useState("");
    const [gmail, setGmail] = useState("");
    const [appPassword, setAppPassword] = useState("");
    const [autoBind2FA, setAutoBind2FA] = useState(true);
    const [passwordXT, setPasswordXT] = useState("");
    const [referralCode, setReferralCode] = useState("");
    const [jumlah, setJumlah] = useState("5");
    const [accounts, setAccounts] = useState<AccountEntry[]>([]);
    const [bulkInput, setBulkInput] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [rawHeaders, setRawHeaders] = useState('');

    useEffect(() => {
        setSavedGmail(localStorage.getItem('xt_saved_gmail') || '');
        setPasswordXT(localStorage.getItem('xt_saved_pass') || 'Dicoba@11');
        setReferralCode(localStorage.getItem('xt_saved_ref') || '');
        setAppPassword(localStorage.getItem('xt_saved_app') || '');
    }, []);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    const handleSaveGmail = () => {
        if (gmail) {
            setSavedGmail(gmail);
            localStorage.setItem('xt_saved_gmail', gmail);
            localStorage.setItem('xt_saved_pass', passwordXT);
            localStorage.setItem('xt_saved_ref', referralCode);
            localStorage.setItem('xt_saved_app', appPassword);
            toast.success("Pengaturan tersimpan");
        }
    };

    const handleDeleteSaved = () => {
        setSavedGmail("");
        localStorage.removeItem('xt_saved_gmail');
        toast("Gmail dihapus");
    };

    const handleGenerate = () => {
        const emailToUse = gmail || savedGmail;
        if (!emailToUse || !emailToUse.includes("@")) {
            toast.error("Masukkan email yang valid");
            return;
        }
        const count = parseInt(jumlah);
        const variations = generateDotVariations(emailToUse, count);

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

    const handleParseAndAdd = () => {
        if (!bulkInput.trim()) return;
        const lines = bulkInput.trim().split("\n").filter(Boolean);

        const newAccounts: AccountEntry[] = lines.map(line => {
            const parts = line.split('|');
            return {
                id: Math.random().toString(36).substring(7),
                email: parts[0] || '',
                passwordXT: parts[1] || passwordXT,
                referralCode: parts[2] || referralCode,
                appPassword: parts[3] || appPassword,
                status: 'pending'
            };
        });

        setAccounts(prev => [...prev, ...newAccounts]);
        setBulkInput("");
        addLog(`Parsed & added ${newAccounts.length} entries manually.`);
        toast.success(`${newAccounts.length} entries ditambahkan`);
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

        updateAccount(id, { status: 'solving', message: 'Selesaikan Captcha...' });
        addLog(`[${acc.email}] Membuka panel Captcha...`);

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
                    // 1. Validate Captcha
                    let capRes = await fetch('/api/validate-captcha', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ captchaResult: result })
                    });
                    let capData = await capRes.json();

                    if (!capData.ok || !capData.certificate) {
                        throw new Error(capData.msg || "Gagal validasi captcha di server");
                    }

                    // 2. Register Process
                    const headerLines = rawHeaders.split('\n');
                    const customHeadersObj: any = {};
                    headerLines.forEach(line => {
                        const idx = line.indexOf(':');
                        if (idx > 0) {
                            const key = line.substring(0, idx).trim();
                            const val = line.substring(idx + 1).trim();
                            if (key && val) customHeadersObj[key] = val;
                        }
                    });

                    let regRes = await fetch('/api/register-process', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: acc.email,
                            password: acc.passwordXT,
                            appPassword: acc.appPassword,
                            refCode: acc.referralCode,
                            certificate: capData.certificate,
                            autoBind: autoBind2FA,
                            customHeaders: customHeadersObj
                        })
                    });
                    let regData = await regRes.json();

                    if (regData.ok) {
                        updateAccount(id, {
                            status: 'success',
                            message: `Registered! ID: ${regData.userId}${autoBind2FA ? ' | Joining event...' : ''}`,
                            userId: regData.userId
                        });
                        addLog(`[SUCCESS] ${acc.email} berhasil terdaftar!`);
                        toast.success(`${acc.email} terdaftar!`);
                    } else {
                        throw new Error(regData.msg || "Gagal registrasi");
                    }
                } catch (e: any) {
                    updateAccount(id, { status: 'error', message: e.message });
                    addLog(`[ERROR] ${acc.email}: ${e.message}`);
                    toast.error(`Gagal: ${e.message}`);
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

    const totalGeneratedEmail = accounts.length;
    const availableCount = Math.max(0, (gmail ? Math.pow(2, gmail.replace(/\./g, "").split("@")[0]?.length - 1 || 0) : 0));
    const pendingCount = accounts.filter(a => a.status === 'pending' || a.status === 'error').length;

    return (
        <div className="min-h-screen bg-[#0f0f10] text-[#ececec] p-4 max-w-lg mx-auto pb-24 font-inter text-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 p-2 border-b border-[#2c2c2f] pb-4">
                <Shuffle className="w-5 h-5 text-green-500" />
                <h1 className="text-[15px] font-bold text-white tracking-wide">Gmail Dot Trick Generator</h1>
            </div>

            {/* Saved Gmail */}
            {savedGmail && (
                <div className="mb-5 bg-[#17171a] p-3 rounded-lg border border-[#2c2c2f]">
                    <p className="text-xs mb-2 text-[#777]">Saved Gmail:</p>
                    <div className="flex items-center gap-2">
                        <span className="bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1.5 rounded-md text-xs font-mono">
                            {savedGmail}
                        </span>
                        <button onClick={handleDeleteSaved} className="text-[#a1a1aa] hover:text-red-500 ml-auto transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Inputs */}
            <div className="space-y-4 mb-6 bg-[#1a1a1c] p-4 rounded-xl border border-[#2c2c2f]">
                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">Gmail</label>
                    <div className="flex gap-2">
                        <Input
                            value={gmail}
                            onChange={(e) => setGmail(e.target.value)}
                            placeholder="example@gmail.com"
                            className="bg-[#121214] border-[#2c2c2f] text-white flex-1 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-10"
                            onBlur={handleSaveGmail}
                        />
                        <Button variant="outline" size="icon" onClick={handleSaveGmail} className="bg-green-600 hover:bg-green-700 border-none text-white h-10 w-10 shrink-0">
                            <ClipboardCopy className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">App Password (wajib untuk IMAP OTP)</label>
                    <Input
                        type="password"
                        value={appPassword}
                        onChange={(e) => setAppPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-10 font-mono tracking-widest text-lg"
                        onBlur={handleSaveGmail}
                    />
                </div>

                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">Raw Headers (Bypass WAF/Anti-Bot)</label>
                    <Textarea
                        value={rawHeaders}
                        onChange={(e) => setRawHeaders(e.target.value)}
                        placeholder="Paste headers dari Inspect Element Network tab di sini (seperti file header.txt)"
                        className="w-full bg-[#121214] border border-[#2c2c2f] text-white rounded-md p-2 text-xs font-mono min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500"
                        onBlur={handleSaveGmail}
                    />
                </div>

                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={autoBind2FA}
                            onCheckedChange={(v) => setAutoBind2FA(!!v)}
                            className="border-[#555] data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            id="autobind"
                        />
                        <label htmlFor="autobind" className="text-xs font-semibold text-white cursor-pointer">🔐 Auto-bind 2FA setelah register</label>
                    </div>
                    <span className="text-[10px] text-[#777] uppercase tracking-wider">(auto)</span>
                </div>

                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">Password XT</label>
                    <Input
                        value={passwordXT}
                        onChange={(e) => setPasswordXT(e.target.value)}
                        placeholder="Password untuk akun XT"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-10"
                        onBlur={handleSaveGmail}
                    />
                </div>

                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">Referral Code</label>
                    <Input
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        placeholder="REFCODE"
                        className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 h-10"
                        onBlur={handleSaveGmail}
                    />
                </div>

                <div>
                    <label className="text-xs mb-1.5 block text-[#999] font-medium">Jumlah Generate</label>
                    <Select value={jumlah} onValueChange={setJumlah}>
                        <SelectTrigger className="bg-[#121214] border-[#2c2c2f] text-white focus-visible:ring-1 focus-visible:ring-green-500 h-10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#17171a] border-[#2c2c2f] text-white">
                            {[1, 2, 5, 10, 20, 50].map((n) => (
                                <SelectItem key={n} value={String(n)} className="focus:bg-[#2c2c2f] focus:text-white cursor-pointer">{n}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Stats */}
                <div className="flex justify-between items-center text-xs pt-1">
                    <p>
                        <span className="text-green-500 font-bold">{availableCount} tersedia</span>
                        <span className="text-[#666]"> • {totalGeneratedEmail} di antrian</span>
                    </p>
                    <button onClick={handleResetHistory} className="text-[#777] underline hover:text-white transition-colors">
                        Reset history
                    </button>
                </div>

                <Button onClick={handleGenerate} className="w-full bg-[#189b4a] hover:bg-green-600 text-white font-semibold flex items-center gap-2 h-11 text-sm mt-2 transition-all active:scale-[0.98]">
                    <Shuffle className="w-4 h-4" />
                    Generate Dot Trick
                </Button>
            </div>

            {/* Bulk Input */}
            <div className="mb-6 bg-[#1a1a1c] p-4 rounded-xl border border-[#2c2c2f]">
                <Textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={"Tempel manual di sini:\nemail1@gmail.com|password123|REFCODE1|gmailAppPass\nemail2@gmail.com|password456|REFCODE2"}
                    className="bg-[#121214] border-[#2c2c2f] text-[#ccc] font-mono text-[11px] min-h-[80px] focus-visible:ring-1 focus-visible:ring-[#444] rounded-md"
                />
                <Button onClick={handleParseAndAdd} variant="outline" className="w-full mt-3 bg-[#1e1e20] border-[#333] text-[#aaa] hover:bg-[#252528] hover:text-white h-10 text-xs">
                    Parse & Tambah
                </Button>
            </div>

            {/* Account List */}
            <div className="mb-6">
                <h3 className="text-xs font-bold text-[#888] mb-3 uppercase tracking-wider">{accounts.length} akun — {pendingCount} pending</h3>
                <div className="flex flex-col gap-3">
                    {accounts.map((acc, i) => (
                        <div key={acc.id} className={`p-3 rounded-lg border relative overflow-hidden flex flex-col gap-2 transition-all ${acc.status === 'success' ? 'bg-[#1a2e1d] border-green-500/40' :
                            acc.status === 'error' ? 'bg-[#2b1616] border-red-500/30' :
                                acc.status === 'registering' || acc.status === 'solving' ? 'bg-[#2d2212] border-yellow-500/40' :
                                    'bg-[#17171a] border-[#2c2c2f]'
                            }`}>
                            <div className="flex items-center gap-2">
                                {acc.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                {acc.status === 'error' && <div className="w-3.5 h-3.5 shrink-0 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 text-[10px] font-bold">!</div>}
                                {acc.status === 'pending' && <User className="w-3.5 h-3.5 text-[#555] shrink-0" />}

                                <span className="font-mono text-[11px] truncate flex-1 text-[#ddd]">{acc.email}</span>

                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${acc.status === 'success' ? 'bg-green-500/20 text-green-400' :
                                    acc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                        acc.status === 'solving' || acc.status === 'registering' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-[#333] text-[#777]'
                                    }`}>
                                    {acc.status}
                                </span>

                                <button onClick={() => removeAccount(acc.id)} className="text-[#555] hover:text-red-400 p-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {acc.status === 'pending' || acc.status === 'error' ? (
                                <Button
                                    onClick={() => startManualCaptcha(acc.id)}
                                    className="w-full bg-[#20bb5c] hover:bg-[#1dae54] text-white h-9 text-xs font-semibold shadow-[0_0_10px_rgba(32,187,92,0.2)]"
                                >
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                                    Solve Captcha & Register
                                </Button>
                            ) : acc.message ? (
                                <div className={`text-[11px] ${acc.status === 'success' ? 'text-green-400 font-medium flex items-center gap-1.5' :
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
                <Button onClick={handleStartBatch} disabled={pendingCount === 0} className="w-full bg-[#1dae54] hover:bg-green-500 text-white font-bold h-11 text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    <Play className="w-4 h-4 mr-2" />
                    Start Batch ({pendingCount})
                </Button>
                <div className="max-h-[150px] overflow-y-auto bg-[#0a0a0b] p-3 rounded-md font-mono text-[11px] text-[#888] flex flex-col-reverse border border-[#222]">
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
