import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Trash2, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

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
  const [autoBind2FA, setAutoBind2FA] = useState(false);
  const [passwordXT, setPasswordXT] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [jumlah, setJumlah] = useState("5");
  const [results, setResults] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const totalGenerated = results.length;

  const handleSaveGmail = () => {
    if (gmail) {
      setSavedGmail(gmail);
      toast.success("Gmail tersimpan");
    }
  };

  const handleDeleteSaved = () => {
    setSavedGmail("");
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
    const formatted = variations.map((v) => {
      let line = v;
      if (passwordXT) line += `|${passwordXT}`;
      if (referralCode) line += `|${referralCode}`;
      if (appPassword) line += `|${appPassword}`;
      return line;
    });
    setResults((prev) => [...prev, ...formatted]);
    setLogs((prev) => [...prev, `Generated ${formatted.length} variations`]);
  };

  const handleReset = () => {
    setResults([]);
    setLogs([]);
    toast("History direset");
  };

  const handleCopyGmail = () => {
    navigator.clipboard.writeText(gmail);
    toast.success("Gmail disalin");
  };

  const handleParseAndAdd = () => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.trim().split("\n").filter(Boolean);
    setResults((prev) => [...prev, ...lines]);
    setBulkInput("");
    setLogs((prev) => [...prev, `Parsed & added ${lines.length} entries`]);
    toast.success(`${lines.length} entries ditambahkan`);
  };

  const availableCount = Math.max(0, (gmail ? Math.pow(2, gmail.replace(/\./g, "").split("@")[0]?.length - 1 || 0) : 0) - totalGenerated);

  return (
    <div className="min-h-screen bg-[hsl(160,10%,10%)] text-[hsl(120,10%,80%)] p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Shuffle className="w-6 h-6 text-[hsl(150,60%,50%)]" />
        <h1 className="text-xl font-bold text-[hsl(0,0%,95%)]">Gmail Dot Trick Generator</h1>
      </div>

      {/* Saved Gmail */}
      {savedGmail && (
        <div className="mb-4">
          <p className="text-sm mb-1 text-[hsl(120,5%,55%)]">Saved Gmail:</p>
          <div className="flex items-center gap-2">
            <span className="bg-[hsl(160,60%,25%)] text-[hsl(150,60%,60%)] px-3 py-1 rounded text-sm">
              {savedGmail}
            </span>
            <button onClick={handleDeleteSaved}>
              <Trash2 className="w-4 h-4 text-[hsl(120,5%,55%)]" />
            </button>
          </div>
        </div>
      )}

      {/* Gmail Input */}
      <div className="mb-4">
        <label className="text-sm mb-1 block text-[hsl(120,5%,55%)]">Gmail</label>
        <div className="flex gap-2">
          <Input
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            placeholder="example@gmail.com"
            className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)] flex-1"
            onBlur={handleSaveGmail}
          />
          <Button variant="outline" size="icon" onClick={handleCopyGmail} className="bg-[hsl(150,60%,30%)] border-none text-white hover:bg-[hsl(150,60%,35%)]">
            <ClipboardCopy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* App Password */}
      <div className="mb-4">
        <label className="text-sm mb-1 block text-[hsl(120,5%,55%)]">App Password (opsional)</label>
        <Input
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)]"
        />
      </div>

      {/* Auto-bind 2FA */}
      <div className="mb-4 bg-[hsl(160,10%,15%)] border border-[hsl(160,10%,25%)] rounded-md p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={autoBind2FA}
            onCheckedChange={(v) => setAutoBind2FA(!!v)}
            className="border-[hsl(120,5%,55%)]"
          />
          <span className="text-sm">🔐 Auto-bind 2FA setelah register</span>
        </div>
        <span className="text-sm text-[hsl(120,5%,55%)]">(auto)</span>
      </div>

      {/* Password XT */}
      <div className="mb-4">
        <label className="text-sm mb-1 block text-[hsl(120,5%,55%)]">Password XT</label>
        <Input
          value={passwordXT}
          onChange={(e) => setPasswordXT(e.target.value)}
          placeholder="Password untuk akun XT"
          className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)]"
        />
      </div>

      {/* Referral Code */}
      <div className="mb-4">
        <label className="text-sm mb-1 block text-[hsl(120,5%,55%)]">Referral Code</label>
        <Input
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value)}
          placeholder="REFCODE"
          className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)]"
        />
      </div>

      {/* Jumlah */}
      <div className="mb-2">
        <label className="text-sm mb-1 block text-[hsl(120,5%,55%)]">Jumlah</label>
        <Select value={jumlah} onValueChange={setJumlah}>
          <SelectTrigger className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)]">
            {[5, 10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)} className="text-[hsl(0,0%,90%)]">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <p className="text-sm mb-3">
        <span className="text-[hsl(150,60%,50%)]">{availableCount} tersedia</span>
        <span className="text-[hsl(120,5%,55%)]"> • {totalGenerated} terpakai</span>
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleReset} className="text-sm underline text-[hsl(120,5%,55%)]">
          Reset history
        </button>
        <Button onClick={handleGenerate} className="flex-1 bg-[hsl(150,60%,30%)] hover:bg-[hsl(150,60%,35%)] text-white">
          <Shuffle className="w-4 h-4 mr-2" />
          Generate
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mb-4 bg-[hsl(160,10%,13%)] border border-[hsl(160,10%,25%)] rounded-md p-3">
          <pre className="text-sm whitespace-pre-wrap break-all text-[hsl(0,0%,85%)] font-mono">
            {results.join("\n")}
          </pre>
        </div>
      )}

      {/* Bulk Input */}
      <div className="mb-4">
        <Textarea
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          placeholder={"email1@gmail.com|password123|REFCODE1|gmailAppPass\nemail2@gmail.com|password456|REFCODE2"}
          className="bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(0,0%,90%)] font-mono text-sm"
          rows={4}
        />
      </div>

      <Button onClick={handleParseAndAdd} variant="outline" className="w-full mb-6 bg-[hsl(160,10%,15%)] border-[hsl(160,10%,25%)] text-[hsl(120,5%,55%)] hover:bg-[hsl(160,10%,20%)]">
        Parse & Tambah
      </Button>

      {/* Log */}
      <div className="border-t border-[hsl(160,10%,25%)] pt-3">
        <p className="text-sm font-mono text-[hsl(120,5%,55%)]">≥ Log ({logs.length})</p>
        {logs.map((log, i) => (
          <p key={i} className="text-xs font-mono text-[hsl(120,5%,45%)]">{log}</p>
        ))}
      </div>
    </div>
  );
};

export default Index;
