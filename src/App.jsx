import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, LayoutDashboard, KanbanSquare, UserPlus, Phone, Mail,
  ChevronRight, ChevronLeft, Search, X, Plus, Trash2, CalendarClock,
  GraduationCap, Globe2, BadgeCheck, Briefcase, StickyNote, Loader2,
  Download, Settings as Cog, Send, FileSpreadsheet, Share2, Upload, Lock,
  MessageCircle, PhoneCall, Flame, ArrowRight, Wifi, WifiOff, RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  addNote as dbAddNote, upsertApplication, deleteApplication,
  upsertDocument, deleteDocument,
  getTeam, createTeamMember, deleteTeamMember,
  bulkInsertStudents, getSetting, setSetting
} from "./lib/db";

/* ════ DESIGN TOKENS ════ */
const T = {
  ink: "#0A1F3D", blue: "#0d6efd", saffron: "#F59E0B",
  mist: "#F5F7FB", line: "#E5EAF3", ok: "#16A34A", danger: "#DC2626",
};

/* ════ CONSTANTS ════ */
const STAGES = [
  { id: "lead",       label: "New Lead",             color: "#64748B" },
  { id: "counsel",    label: "Counselling",          color: "#0d6efd" },
  { id: "shortlist",  label: "Shortlisting",         color: "#6366F1" },
  { id: "applied",    label: "Application",          color: "#8B5CF6" },
  { id: "offer",      label: "Offer Received",       color: "#F59E0B" },
  { id: "finance",    label: "Finance & Scholarship",color: "#14B8A6" },
  { id: "visa",       label: "Visa Filing",          color: "#EF4444" },
  { id: "predep",     label: "Pre-Departure",        color: "#10B981" },
  { id: "departed",   label: "Departed 🎉",          color: "#16A34A" },
];
const COUNTRIES = ["UK","Ireland","Germany","Australia","New Zealand","Canada","USA","Europe"];
const INTAKES   = ["January","May","September","Other"];
const LEVELS    = ["UG","PG"];
const FIELDS    = [
  "Business & Management","Engineering & Technology","Computer & IT",
  "Health & Life Sciences","Science & Research","Arts & Humanities",
  "Law","Design & Media","Hospitality & Aviation","Finance & Economics","Other"
];
const QUALS        = [{ id:"Hot",color:"#DC2626" },{ id:"Warm",color:"#F59E0B" },{ id:"Cold",color:"#64748B" }];
const APP_STATUSES = ["Course Enquiry","Application Preparation","Submitted","Offer in Principle","Offer Accepted","Finalised","Closed"];
const DEFAULT_DOCS = ["Passport","10th & 12th Marksheets","Degree & Transcripts","IELTS / PTE Score","SOP","LORs","CV / Resume","Financial Documents"];
const DOC_STATUSES = ["Pending","Received","Verified"];
const DOC_COLORS   = { Pending:"#94A3B8", Received:"#F59E0B", Verified:"#16A34A" };
const HEAR_SOURCES = ["School/College Visit","Friend or Family","Social Media","Website","Walk-in","Education Fair","Other"];
const FIN_SOURCES  = ["Parents","Self-funded","Education Loan","Scholarship","Sponsor"];

/* ════ HELPERS ════ */
const uid        = () => crypto.randomUUID();
const hashPw     = (s) => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
const stageIdx   = (id) => STAGES.findIndex((s) => s.id === id);
const stageOf    = (id) => STAGES[stageIdx(id)] || STAGES[0];
const fmtDate    = (ts) => new Date(ts).toLocaleDateString("en-GB", { day:"numeric", month:"short" });
const qualColor  = (q) => QUALS.find((x) => x.id === q)?.color || "#64748B";
const waLink     = (p) => "https://wa.me/" + String(p||"").replace(/[^0-9]/g,"");
const isOverdue  = (s) => s.follow_up && new Date(s.follow_up) < new Date(new Date().toDateString());
const inp        = { width:"100%", padding:"9px 12px", borderRadius:12, border:`1px solid #CBD5E1`, fontSize:14, background:"#fff", marginTop:4, fontWeight:500 };

/* ════ ROOT COMPONENT ════ */
export default function AbroadvedaCRM() {
  const [tab, setTab]               = useState("dashboard");
  const [students, setStudents]     = useState([]);
  const [team, setTeam]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [dbOk, setDbOk]             = useState(true);
  const [syncing, setSyncing]       = useState(false);

  const [query, setQuery]           = useState("");
  const [globalQ, setGlobalQ]       = useState("");
  const [filterStage, setFilterStage]     = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterQual, setFilterQual]       = useState("all");

  const [selected, setSelected]     = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [security, setSecurity]     = useState({ adminPass:"", exportPass:"", appPass:"" });
  const [askPass, setAskPass]       = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [appUnlocked, setAppUnlocked]     = useState(false);
  const [toast, setToast]           = useState("");

  const notify = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 3500); };

  /* ── initial load ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, wh, sec] = await Promise.all([
        getStudents(),
        getTeam(),
        getSetting("webhookUrl"),
        getSetting("security"),
      ]);
      setStudents(s || []);
      setTeam(t || []);
      if (wh) setWebhookUrl(wh);
      if (sec) setSecurity({ adminPass:"", exportPass:"", appPass:"", ...sec });
      setDbOk(true);
    } catch (e) {
      console.error(e);
      setDbOk(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── derived ── */
  const memberName = (id) => team.find((t) => t.id === id)?.name || "Unassigned";

  const filtered = useMemo(() => students.filter((s) => {
    const q = query.trim().toLowerCase();
    if (q && !`${s.name} ${s.email} ${s.phone} ${s.country} ${s.field}`.toLowerCase().includes(q)) return false;
    if (filterStage   !== "all" && s.stage        !== filterStage)   return false;
    if (filterCountry !== "all" && s.country       !== filterCountry) return false;
    if (filterQual    !== "all" && s.qualification !== filterQual)    return false;
    return true;
  }), [students, query, filterStage, filterCountry, filterQual]);

  const searchHits = useMemo(() => {
    const q = globalQ.trim().toLowerCase();
    if (!q) return [];
    return students.filter((s) => `${s.name} ${s.email} ${s.phone}`.toLowerCase().includes(q)).slice(0, 6);
  }, [students, globalQ]);

  const stats = useMemo(() => ({
    total:     students.length,
    active:    students.filter((s) => !["lead","departed"].includes(s.stage)).length,
    offers:    students.filter((s) => stageIdx(s.stage) >= stageIdx("offer") && s.stage !== "departed").length,
    departed:  students.filter((s) => s.stage === "departed").length,
    followUps: students.filter((s) => s.follow_up && new Date(s.follow_up) <= new Date(Date.now()+2*86400000)).length,
  }), [students]);

  /* ── mutations ── */
  const updStudent = async (id, patch) => {
    try {
      setSyncing(true);
      const updated = await updateStudent(id, patch);
      setStudents((p) => p.map((s) => s.id === id ? { ...s, ...updated } : s));
    } catch(e) { notify("Save failed — check connection"); console.error(e); }
    finally { setSyncing(false); }
  };

  const moveStage = async (id, dir) => {
    const s = students.find((x) => x.id === id); if (!s) return;
    const i = Math.min(STAGES.length-1, Math.max(0, stageIdx(s.stage)+dir));
    await updStudent(id, { stage: STAGES[i].id });
  };

  const doAddNote = async (studentId, text) => {
    if (!text.trim()) return;
    try {
      const note = await dbAddNote(studentId, text.trim());
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, notes: [note, ...(s.notes||[])] } : s));
    } catch(e) { notify("Could not save note"); console.error(e); }
  };

  const doDeleteStudent = async (id) => {
    try {
      await deleteStudent(id);
      setStudents((p) => p.filter((s) => s.id !== id));
      setSelected(null);
    } catch(e) { notify("Delete failed"); console.error(e); }
  };

  const doAddApp = async (studentId, appForm) => {
    try {
      const app = await upsertApplication({ student_id: studentId, ...appForm });
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, applications: [app, ...(s.applications||[])] } : s));
    } catch(e) { notify("Could not save application"); console.error(e); }
  };

  const doUpdateApp = async (studentId, appId, patch) => {
    try {
      const app = await upsertApplication({ id: appId, student_id: studentId, ...patch });
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, applications: (s.applications||[]).map((a) => a.id === appId ? app : a) } : s));
    } catch(e) { notify("Could not update application"); console.error(e); }
  };

  const doDeleteApp = async (studentId, appId) => {
    try {
      await deleteApplication(appId);
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, applications: (s.applications||[]).filter((a) => a.id !== appId) } : s));
    } catch(e) { notify("Could not delete application"); }
  };

  const doCycleDoc = async (studentId, docId, currentStatus, docName) => {
    const next = DOC_STATUSES[(DOC_STATUSES.indexOf(currentStatus)+1) % DOC_STATUSES.length];
    try {
      const doc = await upsertDocument({ id: docId, student_id: studentId, name: docName, status: next });
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, documents: (s.documents||[]).map((d) => d.id === docId ? doc : d) } : s));
    } catch(e) { notify("Could not update document"); }
  };

  const doAddDoc = async (studentId, name) => {
    try {
      const doc = await upsertDocument({ student_id: studentId, name, status: "Pending" });
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, documents: [...(s.documents||[]), doc] } : s));
    } catch(e) { notify("Could not add document"); }
  };

  const doDeleteDoc = async (studentId, docId) => {
    try {
      await deleteDocument(docId);
      setStudents((p) => p.map((s) => s.id === studentId
        ? { ...s, documents: (s.documents||[]).filter((d) => d.id !== docId) } : s));
    } catch(e) { notify("Could not delete document"); }
  };

  const doAddStudent = async (form) => {
    try {
      const rec = await createStudent(form);
      const full = { ...rec, notes:[], applications:[], documents: DEFAULT_DOCS.map((n) => ({ id: uid(), name:n, status:"Pending", student_id: rec.id })) };
      // seed default docs
      await Promise.all(DEFAULT_DOCS.map((n) => upsertDocument({ student_id: rec.id, name: n, status: "Pending" })));
      const refreshed = await getStudents();
      setStudents(refreshed);
      setShowAdd(false);
      notify("Lead saved ✓");
      if (webhookUrl) sendToSheet([rowOf(rec)], true);
    } catch(e) { notify("Could not save lead — check DB connection"); console.error(e); }
  };

  const doBulkImport = async (rows) => {
    try {
      await bulkInsertStudents(rows);
      const refreshed = await getStudents();
      setStudents(refreshed);
      setShowImport(false);
      notify(`Imported ${rows.length} leads ✓`);
    } catch(e) { notify("Import failed — check DB connection"); console.error(e); }
  };

  const doAddTeam = async (member) => {
    try {
      const rec = await createTeamMember(member);
      setTeam((p) => [...p, rec]);
      setShowAddTeam(false);
    } catch(e) { notify("Could not add team member"); console.error(e); }
  };

  const doDeleteTeam = async (id) => {
    try {
      await deleteTeamMember(id);
      setTeam((p) => p.filter((t) => t.id !== id));
    } catch(e) { notify("Could not delete team member"); }
  };

  const doSaveSecurity = async (sec) => {
    setSecurity(sec);
    try { await setSetting("security", sec); notify("Passwords updated ✓"); }
    catch(e) { notify("Could not save passwords"); }
  };

  const doSaveWebhook = async (url) => {
    setWebhookUrl(url);
    try { await setSetting("webhookUrl", url); }
    catch(e) { console.error(e); }
  };

  /* ── export ── */
  const rowOf = (s) => [
    new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"), s.name, s.phone, s.email||"",
    s.level, s.country, s.intake, s.field, stageOf(s.stage).label,
    memberName(s.assigned_to), s.follow_up||"", "CRM"
  ];
  const exportRows = () => students.map((s) => ({
    Date: new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),
    Name: s.name, Phone: s.phone, Email: s.email||"",
    Qualification: s.qualification||"", Level: s.level, Country: s.country,
    Intake: s.intake, "Field of Study": s.field,
    Stage: stageOf(s.stage).label, "Assigned To": memberName(s.assigned_to),
    "Follow Up": s.follow_up||"",
  }));
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "abroadveda-leads.xlsx");
    notify("Excel downloaded ✓");
  };
  const exportCSV = () => {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows()));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
    a.download = "abroadveda-leads.csv";
    a.click();
    notify("CSV downloaded ✓");
  };
  const sendToSheet = async (rows, silent) => {
    if (!webhookUrl) { if (!silent) notify("Add your Google Sheets link in Settings first"); return; }
    try {
      await fetch(webhookUrl, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"text/plain" }, body: JSON.stringify({ rows }) });
      if (!silent) notify(`Sent ${rows.length} rows to Google Sheets ✓`);
    } catch { if (!silent) notify("Could not reach Google Sheets"); }
  };

  /* ── locks ── */
  const openExport   = () => { if (security.exportPass) setAskPass("export"); else setShowExport(true); };
  const openSettings = () => { if (security.adminPass && !adminUnlocked) setAskPass("admin"); else setShowSettings(true); };
  const openStudent  = (id) => { setTab("students"); setSelected(id); setGlobalQ(""); };

  /* ── render: loading ── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: T.mist }}>
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-xl" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
        <div className="flex items-center gap-2 text-slate-500 justify-center"><Loader2 className="animate-spin" size={18} /> Connecting to database…</div>
      </div>
    </div>
  );

  /* ── render: DB not configured ── */
  if (!dbOk) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: T.mist }}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border" style={{ borderColor: T.line }}>
        <WifiOff size={32} className="text-red-400 mb-3" />
        <h2 className="font-extrabold text-lg mb-2">Database not connected</h2>
        <p className="text-sm text-slate-500 mb-4">Could not reach Supabase. Please check that <code className="bg-slate-100 px-1 rounded">.env.local</code> contains your <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> values, then restart the dev server.</p>
        <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="block text-center py-2 rounded-xl text-white font-semibold text-sm mb-2" style={{ background: T.blue }}>Open Supabase Dashboard</a>
        <button onClick={loadAll} className="w-full py-2 rounded-xl border text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2" style={{ borderColor: T.line }}><RefreshCw size={14} /> Retry connection</button>
      </div>
    </div>
  );

  /* ── render: app lock ── */
  if (security.appPass && !appUnlocked) return (
    <LockScreen onSubmit={(pw) => {
      const ok = hashPw(pw) === security.appPass || (security.adminPass && hashPw(pw) === security.adminPass);
      if (ok) setAppUnlocked(true);
      return ok;
    }} />
  );

  const selectedStudent = students.find((s) => s.id === selected);
  const NAV = [["dashboard",LayoutDashboard,"Dashboard"],["pipeline",KanbanSquare,"Pipeline"],["students",Users,"Students"],["team",Briefcase,"Team"]];

  return (
    <div className="min-h-screen" style={{ background:T.mist, fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif", color:T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        ::-webkit-scrollbar{height:8px;width:8px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:8px}
        input:focus,select:focus,textarea:focus{outline:2px solid #0d6efd33;border-color:#0d6efd !important}
        .num{font-variant-numeric:tabular-nums}
        .card{background:#fff;border:1px solid ${T.line};border-radius:18px;box-shadow:0 1px 2px rgba(10,31,61,.04)}
        .lift{transition:box-shadow .15s,transform .15s}.lift:hover{box-shadow:0 6px 18px rgba(10,31,61,.08);transform:translateY(-1px)}
      `}</style>

      {/* ══ SIDEBAR ══ */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-40 px-4 py-5" style={{ background:T.ink }}>
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white shrink-0" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
          <div className="leading-tight">
            <div className="font-extrabold text-white tracking-wide text-sm">ABROAD VEDA</div>
            <div className="text-[9px] text-blue-200/80 tracking-[.18em] uppercase">CRM Workspace</div>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {NAV.map(([id,Icon,label]) => (
            <button key={id} onClick={() => { setTab(id); setSelected(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${tab===id?"text-slate-900 bg-white":"text-blue-100/80 hover:bg-white/10"}`}>
              <Icon size={17} style={tab===id?{ color:T.blue }:{}} /> {label}
              {id==="students" && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md num" style={{ background:tab===id?"#EAF2FF":"rgba(255,255,255,.12)", color:tab===id?T.blue:"#BFD7FF" }}>{students.length}</span>}
            </button>
          ))}
        </nav>
        <button onClick={() => setShowAdd(true)} className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90" style={{ background:T.blue }}>
          <UserPlus size={16} /> New lead
        </button>
        <div className="mt-auto space-y-1 pt-6 border-t border-white/10">
          <button onClick={openExport}   className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Download size={16} /> Import / Export</button>
          <button onClick={openSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Cog size={16} /> Settings</button>
          <div className="px-3 pt-2 text-[10px] text-blue-200/60 flex items-center gap-1.5">
            {syncing ? <><Loader2 size={10} className="animate-spin" /> Syncing…</> : <><Wifi size={10} /> Live database</>}
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="md:pl-60">
        {/* top bar */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3 border-b" style={{ background:"rgba(245,247,251,.92)", backdropFilter:"blur(8px)", borderColor:T.line }}>
          <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shrink-0" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input value={globalQ} onChange={(e) => setGlobalQ(e.target.value)} placeholder="Search any student — name, phone, email…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm bg-white font-medium" style={{ borderColor:T.line }} />
            {globalQ && <button onClick={() => setGlobalQ("")} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
            {searchHits.length > 0 && (
              <div className="absolute mt-1.5 w-full card overflow-hidden z-50">
                {searchHits.map((s) => (
                  <button key={s.id} onClick={() => openStudent(s.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50/60 text-left border-b last:border-0" style={{ borderColor:T.line }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background:stageOf(s.stage).color }}>{s.name[0]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{s.name}</span>
                      <span className="block text-[11px] text-slate-400 truncate num">{s.phone} · {stageOf(s.stage).label}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-300" />
                  </button>
                ))}
              </div>
            )}
            {globalQ.trim() && searchHits.length === 0 && (
              <div className="absolute mt-1.5 w-full card px-4 py-3 text-sm text-slate-400 z-50">No student found — <button onClick={() => { setGlobalQ(""); setShowAdd(true); }} className="font-semibold" style={{ color:T.blue }}>add as new lead?</button></div>
            )}
          </div>
          <button onClick={() => setShowAdd(true)} className="md:hidden p-2.5 rounded-xl text-white shrink-0" style={{ background:T.blue }}><UserPlus size={16} /></button>
          <button onClick={openExport}   className="md:hidden p-2.5 rounded-xl border bg-white shrink-0" style={{ borderColor:T.line }}><Download size={15} /></button>
          <button onClick={openSettings} className="md:hidden p-2.5 rounded-xl border bg-white shrink-0" style={{ borderColor:T.line }}><Cog size={15} /></button>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl mx-auto pb-24 md:pb-8">

          {/* ════ DASHBOARD ════ */}
          {tab === "dashboard" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">Namaste, team 🙏</h1>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB",{ weekday:"long", day:"numeric", month:"long" })} — here's where every student stands.</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  ["Total students",  stats.total,     T.blue,    ()=>{ setFilterStage("all");      setFilterQual("all"); }],
                  ["Active journeys", stats.active,    "#6366F1", ()=>{ setFilterStage("all");      setFilterQual("all"); }],
                  ["Offers in hand",  stats.offers,    T.saffron, ()=>{ setFilterStage("offer");    setFilterQual("all"); }],
                  ["Departed",        stats.departed,  T.ok,      ()=>{ setFilterStage("departed"); setFilterQual("all"); }],
                  ["Follow-ups due",  stats.followUps, T.danger,  ()=>{ setFilterStage("all");      setFilterQual("all"); }],
                ].map(([l,v,c,pre]) => (
                  <button key={l} onClick={() => { pre(); setTab("students"); }} className="card lift p-4 text-left">
                    <div className="text-3xl font-extrabold num" style={{ color:c }}>{v}</div>
                    <div className="text-xs font-semibold text-slate-500 mt-1">{l}</div>
                  </button>
                ))}
              </div>
              <div className="card p-5">
                <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><GraduationCap size={16} style={{ color:T.blue }} /> Student journey</h2>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {STAGES.map((st) => {
                    const count = students.filter((s) => s.stage === st.id).length;
                    return (
                      <button key={st.id} onClick={() => { setTab("students"); setFilterStage(st.id); setFilterQual("all"); }} className="flex-1 min-w-[72px] group text-center">
                        <div className="text-lg font-extrabold num" style={{ color:count?st.color:"#CBD5E1" }}>{count}</div>
                        <div className="h-2.5 rounded-full mt-1 transition group-hover:opacity-80" style={{ background:count?st.color:"#E8EDF5" }} />
                        <div className="text-[10px] font-semibold text-slate-500 mt-1.5 leading-tight">{st.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><CalendarClock size={16} style={{ color:T.danger }} /> Upcoming follow-ups</h2>
                  {students.filter((s) => s.follow_up).sort((a,b) => a.follow_up.localeCompare(b.follow_up)).slice(0,6).map((s) => (
                    <button key={s.id} onClick={() => openStudent(s.id)} className="w-full flex items-center gap-3 py-2 border-b last:border-0 text-left hover:bg-slate-50 rounded-lg px-2" style={{ borderColor:T.line }}>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg num ${isOverdue(s)?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"}`}>{isOverdue(s)?"Overdue · ":""}{s.follow_up}</span>
                      <span className="text-sm font-semibold truncate">{s.name}</span>
                      <span className="text-[11px] text-slate-400 ml-auto shrink-0">{memberName(s.assigned_to)}</span>
                    </button>
                  ))}
                  {!students.some((s)=>s.follow_up) && <p className="text-sm text-slate-400">Nothing scheduled. Open a student profile to set a follow-up date.</p>}
                </div>
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Flame size={16} style={{ color:T.danger }} /> Hot leads to chase</h2>
                  {students.filter((s) => s.qualification==="Hot" && s.stage!=="departed").slice(0,6).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 py-2 border-b last:border-0 px-2" style={{ borderColor:T.line }}>
                      <button onClick={() => openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate hover:underline">{s.name}</span>
                        <span className="block text-[11px] text-slate-400 truncate">{stageOf(s.stage).label} · {s.country}</span>
                      </button>
                      <a href={`tel:${s.phone}`} className="p-2 rounded-lg hover:bg-blue-50" style={{ color:T.blue }}><PhoneCall size={14} /></a>
                      <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={14} /></a>
                    </div>
                  ))}
                  {!students.some((s)=>s.qualification==="Hot"&&s.stage!=="departed") && <p className="text-sm text-slate-400">No hot leads. Mark a student "Hot" on their profile to see them here.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ════ PIPELINE ════ */}
          {tab === "pipeline" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div><h1 className="text-xl font-extrabold">Application pipeline</h1><p className="text-xs text-slate-500">Move students with the arrows. Changes save to the database instantly.</p></div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {STAGES.map((st) => {
                  const col = students.filter((s) => s.stage === st.id);
                  return (
                    <div key={st.id} className="w-64 shrink-0 rounded-2xl p-3" style={{ background:"#ECF1F9" }}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background:st.color }} />
                        <span className="text-xs font-bold">{st.label}</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 num">{col.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[40px]">
                        {col.length===0 && <div className="text-[11px] text-slate-400 text-center py-3 rounded-xl border border-dashed" style={{ borderColor:"#CBD5E1" }}>Empty</div>}
                        {col.map((s) => (
                          <div key={s.id} className="card lift p-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openStudent(s.id)} className="font-semibold text-sm hover:underline text-left truncate flex-1">{s.name}</button>
                              {s.qualification && <span className="w-2 h-2 rounded-full shrink-0" title={s.qualification} style={{ background:qualColor(s.qualification) }} />}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{s.country} · {s.level} · {s.intake}</div>
                            <div className="text-[11px] text-slate-400">{memberName(s.assigned_to)}</div>
                            <div className="flex items-center mt-2">
                              <button onClick={() => moveStage(s.id,-1)} disabled={stageIdx(s.stage)===0} className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-20"><ChevronLeft size={14} /></button>
                              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="p-1 rounded-lg hover:bg-green-50 text-green-600 mx-auto"><MessageCircle size={13} /></a>
                              <button onClick={() => moveStage(s.id,1)} disabled={stageIdx(s.stage)===STAGES.length-1} className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-20" style={{ color:T.blue }}><ChevronRight size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════ STUDENTS ════ */}
          {tab === "students" && !selectedStudent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <h1 className="text-xl font-extrabold mr-auto">Students</h1>
                <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50" style={{ borderColor:T.line }}><Upload size={14} /> Import Excel</button>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}><UserPlus size={14} /> Add</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter this list…" className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-white" style={{ borderColor:T.line }} />
                </div>
                <select value={filterQual}    onChange={(e) => setFilterQual(e.target.value)}    className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All quals</option>{QUALS.map((q) => <option key={q.id} value={q.id}>{q.id}</option>)}</select>
                <select value={filterStage}   onChange={(e) => setFilterStage(e.target.value)}   className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All stages</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All countries</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b" style={{ borderColor:T.line }}>
                    <th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Stage</th><th className="p-3">Assigned to</th><th className="p-3">Follow-up</th><th className="p-3">Contact</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((s) => {
                      const st = stageOf(s.stage);
                      return (
                        <tr key={s.id} onClick={() => setSelected(s.id)} className="border-b last:border-0 hover:bg-blue-50/40 cursor-pointer" style={{ borderColor:"#F0F4FA" }}>
                          <td className="p-3">
                            <div className="font-semibold flex items-center gap-2">{s.name}
                              {s.qualification && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:qualColor(s.qualification)+"1A", color:qualColor(s.qualification) }}>{s.qualification}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 num">{s.phone}</div>
                          </td>
                          <td className="p-3 text-xs">{s.level} · {s.country} · {s.intake}<div className="text-slate-400">{s.field}</div></td>
                          <td className="p-3"><span className="text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap" style={{ background:st.color+"15", color:st.color }}>{st.label}</span></td>
                          <td className="p-3 text-xs">{memberName(s.assigned_to)}</td>
                          <td className="p-3 text-xs num">{s.follow_up ? <span className={isOverdue(s)?"font-bold text-red-600":""}>{s.follow_up}</span> : <span className="text-slate-300">—</span>}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <a href={`tel:${s.phone}`} onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-blue-50" style={{ color:T.blue }}><PhoneCall size={14} /></a>
                              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={14} /></a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length===0 && <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-400">No students match these filters.<br /><button onClick={() => setShowAdd(true)} className="mt-2 font-bold hover:underline" style={{ color:T.blue }}>+ Add a new lead</button></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ STUDENT DETAIL ════ */}
          {tab === "students" && selectedStudent && (
            <StudentDetail
              s={selectedStudent} team={team} memberName={memberName}
              onBack={() => setSelected(null)}
              onUpdate={updStudent}
              onMove={moveStage}
              onAddNote={doAddNote}
              onDeleteStudent={doDeleteStudent}
              onAddApp={doAddApp}
              onUpdateApp={doUpdateApp}
              onDeleteApp={doDeleteApp}
              onCycleDoc={doCycleDoc}
              onAddDoc={doAddDoc}
              onDeleteDoc={doDeleteDoc}
            />
          )}

          {/* ════ TEAM ════ */}
          {tab === "team" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold">Counsellors & BDEs</h1>
                <button onClick={() => setShowAddTeam(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}><Plus size={14} /> Add member</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.map((t) => {
                  const load = students.filter((s) => s.assigned_to === t.id && s.stage!=="departed").length;
                  return (
                    <div key={t.id} className="card lift p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white" style={{ background:t.role==="BDE"?T.saffron:T.blue }}>{t.name.split(" ").map((w)=>w[0]).join("").slice(0,2)}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-[11px] text-slate-500">{t.role}{t.country&&t.country!=="—"?` · ${t.country} desk`:""}</div>
                        <div className="text-[11px] mt-1 font-semibold num" style={{ color:T.blue }}>{load} active student{load!==1?"s":""}</div>
                      </div>
                      <button onClick={() => doDeleteTeam(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t" style={{ background:T.ink, borderColor:"rgba(255,255,255,.08)" }}>
        {NAV.map(([id,Icon,label]) => (
          <button key={id} onClick={() => { setTab(id); setSelected(null); }} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Icon size={18} style={{ color:tab===id?"#fff":"#7C9CCB" }} />
            <span className="text-[9px] font-bold" style={{ color:tab===id?"#fff":"#7C9CCB" }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ══ MODALS ══ */}
      {showAdd && <AddStudentModal team={team} onClose={() => setShowAdd(false)} onSave={doAddStudent} />}
      {showAddTeam && <AddTeamModal onClose={() => setShowAddTeam(false)} onSave={doAddTeam} />}
      {showImport && <ImportModal team={team} onClose={() => setShowImport(false)} onImport={doBulkImport} />}

      {showExport && (
        <Modal title="Import / Export leads" onClose={() => setShowExport(false)}>
          <div className="space-y-2">
            <ModalBtn icon={<FileSpreadsheet size={18} style={{ color:T.ok }} />} title="Download Excel (.xlsx)" sub={`All ${students.length} students with stage & counsellor`} onClick={() => { exportExcel(); setShowExport(false); }} />
            <ModalBtn icon={<Download size={18} style={{ color:T.blue }} />} title="Download CSV" sub="Import into Google Sheets: File → Import" onClick={() => { exportCSV(); setShowExport(false); }} />
            <ModalBtn icon={<Send size={18} style={{ color:T.saffron }} />} title="Send all to Google Sheets" sub={webhookUrl?"Pushes every lead to your connected Sheet":"Connect your Sheet in Settings first"} onClick={() => { sendToSheet(students.map(rowOf)); setShowExport(false); }} />
            <ModalBtn icon={<Upload size={18} style={{ color:"#8B5CF6" }} />} title="Upload leads from Excel" sub="Bring in leads from an .xlsx or .csv file" onClick={() => { setShowExport(false); setShowImport(true); }} />
          </div>
        </Modal>
      )}

      {showSettings && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Google Sheets connection (Apps Script web app URL)</label>
              <input value={webhookUrl} onChange={(e) => doSaveWebhook(e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" style={inp} />
              <p className="text-[11px] text-slate-400 mt-1">New leads are automatically pushed to this Sheet.</p>
            </div>
            <SecuritySection security={security} onSave={doSaveSecurity} />
          </div>
        </Modal>
      )}

      {askPass && (
        <PasswordPrompt
          title={askPass==="admin"?"Admin lock 🔒":"Export is locked 🔒"}
          hint={askPass==="admin"?"Enter the admin password to open Settings.":"Enter the export password to download or send leads."}
          onClose={() => setAskPass(null)}
          onSubmit={(pw) => {
            const target = askPass==="admin"?security.adminPass:security.exportPass;
            if (hashPw(pw)!==target) return false;
            if (askPass==="admin") { setAdminUnlocked(true); setShowSettings(true); }
            else setShowExport(true);
            setAskPass(null);
            return true;
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg" style={{ background:T.ink }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ════ STUDENT DETAIL ════ */
function StudentDetail({ s, team, memberName, onBack, onUpdate, onMove, onAddNote, onDeleteStudent, onAddApp, onUpdateApp, onDeleteApp, onCycleDoc, onAddDoc, onDeleteDoc }) {
  const [ptab, setPtab]         = useState("overview");
  const [note, setNote]         = useState("");
  const [newDoc, setNewDoc]     = useState("");
  const [appForm, setAppForm]   = useState({ course:"", institution:"", commence_date:"", status:APP_STATUSES[1] });
  const st = stageOf(s.stage);
  const i  = stageIdx(s.stage);
  const apps = s.applications || [];
  const docs = (s.documents && s.documents.length > 0) ? s.documents : DEFAULT_DOCS.map((n,j) => ({ id:`tmp-${j}`, name:n, status:"Pending", student_id:s.id }));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={16} /> All students</button>

      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg" style={{ background:st.color }}>{s.name[0]}</div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">{s.name}</h1>
              <span className="text-[10px] font-bold text-slate-400">ID: AV-{s.id.toString().toUpperCase().slice(0,8)}</span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
              <span className="flex items-center gap-1 num"><Phone size={12}/> {s.phone}</span>
              <span className="flex items-center gap-1"><Mail size={12}/> {s.email||"—"}</span>
              <span className="flex items-center gap-1"><Globe2 size={12}/> {s.level} · {s.country} · {s.intake} intake</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 mr-1">Qualification:</span>
              {QUALS.map((q) => (
                <button key={q.id} onClick={() => onUpdate(s.id,{ qualification:q.id })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition"
                  style={s.qualification===q.id?{ background:q.color, color:"#fff", borderColor:q.color }:{ background:"#fff", color:q.color, borderColor:q.color+"66" }}>
                  {q.id}
                </button>
              ))}
              <span className="flex-1" />
              <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ background:"#EAF2FF", color:"#0d6efd" }}><PhoneCall size={12}/> Call</a>
              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700"><MessageCircle size={12}/> WhatsApp</a>
            </div>
          </div>
          <button onClick={() => onDeleteStudent(s.id)} className="p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
        </div>

        <div className="mt-5">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STAGES.map((stg,idx) => (
              <button key={stg.id} onClick={() => onUpdate(s.id,{ stage:stg.id })} title={stg.label}
                className="h-2.5 rounded-full flex-1 min-w-[28px] transition"
                style={{ background:idx<=i?stg.color:"#E2E8F0" }} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={() => onMove(s.id,-1)} disabled={i===0} className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-50" style={{ borderColor:"#E5EAF3" }}>← Back</button>
            <span className="text-sm font-bold" style={{ color:st.color }}><BadgeCheck size={14} className="inline mr-1"/>{st.label}</span>
            <button onClick={() => onMove(s.id,1)} disabled={i===STAGES.length-1} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-30" style={{ background:"#0d6efd" }}>Advance →</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <label className="text-xs font-semibold text-slate-500">Assigned counsellor / BDE
            <select value={s.assigned_to||""} onChange={(e) => onUpdate(s.id,{ assigned_to:e.target.value })} style={inp}>
              <option value="">Unassigned</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Next follow-up
            <input type="date" value={s.follow_up||""} onChange={(e) => onUpdate(s.id,{ follow_up:e.target.value })} style={inp} />
          </label>
        </div>
      </div>

      <div className="flex gap-1 card p-1.5 overflow-x-auto">
        {[["overview","Overview"],["apps",`Applications (${apps.length})`],["docs","Documents"],["notes",`Notes (${(s.notes||[]).length})`]].map(([id,label]) => (
          <button key={id} onClick={() => setPtab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${ptab===id?"text-white":"text-slate-500 hover:bg-slate-50"}`}
            style={ptab===id?{ background:"#0A1F3D" }:{}}>
            {label}
          </button>
        ))}
      </div>

      {ptab==="overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Personal profile</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Gender
                <select value={s.gender||""} onChange={(e) => onUpdate(s.id,{ gender:e.target.value })} style={inp}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select>
              </label>
              <label className="text-xs font-semibold text-slate-500">Date of birth
                <input type="date" value={s.dob||""} onChange={(e) => onUpdate(s.id,{ dob:e.target.value })} style={inp} />
              </label>
              <label className="text-xs font-semibold text-slate-500">Nationality
                <input value={s.nationality||""} onChange={(e) => onUpdate(s.id,{ nationality:e.target.value })} placeholder="India" style={inp} />
              </label>
              <label className="text-xs font-semibold text-slate-500">City
                <input value={s.city||""} onChange={(e) => onUpdate(s.id,{ city:e.target.value })} placeholder="Agra" style={inp} />
              </label>
            </div>
            <h2 className="font-bold text-sm pt-2">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Email
                <input value={s.email||""} onChange={(e) => onUpdate(s.id,{ email:e.target.value })} style={inp} />
              </label>
              <label className="text-xs font-semibold text-slate-500">Mobile
                <input value={s.phone||""} onChange={(e) => onUpdate(s.id,{ phone:e.target.value })} style={inp} />
              </label>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Consent & engagement</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_tc} onChange={(e) => onUpdate(s.id,{ consent_tc:e.target.checked })} className="w-4 h-4" /> T&C acceptance</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_mkt} onChange={(e) => onUpdate(s.id,{ consent_mkt:e.target.checked })} className="w-4 h-4" /> Marketing</label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">How did you hear?
              <select value={s.hear_source||""} onChange={(e) => onUpdate(s.id,{ hear_source:e.target.value })} style={inp}><option value="">—</option>{HEAR_SOURCES.map((h) => <option key={h}>{h}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Primary financial source
              <select value={s.fin_source||""} onChange={(e) => onUpdate(s.id,{ fin_source:e.target.value })} style={inp}><option value="">—</option>{FIN_SOURCES.map((h) => <option key={h}>{h}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Field of study
              <select value={s.field||""} onChange={(e) => onUpdate(s.id,{ field:e.target.value })} style={inp}>{FIELDS.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
          </div>
        </div>
      )}

      {ptab==="apps" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3">Course applications</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
            <input value={appForm.course} onChange={(e) => setAppForm({...appForm,course:e.target.value})} placeholder="Course, e.g. MSc Data Science" style={{...inp,marginTop:0}} className="lg:col-span-2" />
            <input value={appForm.institution} onChange={(e) => setAppForm({...appForm,institution:e.target.value})} placeholder="Institution" style={{...inp,marginTop:0}} />
            <input type="date" value={appForm.commence_date} onChange={(e) => setAppForm({...appForm,commence_date:e.target.value})} style={{...inp,marginTop:0}} />
            <button onClick={() => { if(appForm.course.trim()) { onAddApp(s.id,appForm); setAppForm({course:"",institution:"",commence_date:"",status:APP_STATUSES[1]}); } }} className="py-2 rounded-xl text-white text-sm font-semibold" style={{ background:"#0d6efd" }}>+ Add</button>
          </div>
          {apps.length===0 && <p className="text-sm text-slate-400">No applications yet.</p>}
          <div className="space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border" style={{ borderColor:"#E5EAF3" }}>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-sm">{a.course}</div>
                  <div className="text-[11px] text-slate-500">{a.institution||"—"}{a.commence_date?` · starts ${a.commence_date}`:""}</div>
                </div>
                <select value={a.status} onChange={(e) => onUpdateApp(s.id,a.id,{ ...a, status:e.target.value })} className="text-xs font-semibold py-1.5 px-2 rounded-lg border bg-white" style={{ borderColor:"#CBD5E1" }}>
                  {APP_STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
                <button onClick={() => onDeleteApp(s.id,a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ptab==="docs" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-1">Document checklist</h2>
          <p className="text-[11px] text-slate-400 mb-3">Click a status to cycle: Pending → Received → Verified.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor:"#E5EAF3" }}>
                <span className="text-sm flex-1">{d.name}</span>
                <button onClick={() => onCycleDoc(s.id,d.id,d.status,d.name)} className="text-[10px] font-bold px-2 py-1 rounded-lg text-white" style={{ background:DOC_COLORS[d.status] }}>{d.status}</button>
                <button onClick={() => onDeleteDoc(s.id,d.id)} className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&newDoc.trim()) { onAddDoc(s.id,newDoc.trim()); setNewDoc(""); } }} placeholder="Add document…" style={{...inp,marginTop:0}} className="flex-1" />
            <button onClick={() => { if(newDoc.trim()) { onAddDoc(s.id,newDoc.trim()); setNewDoc(""); } }} className="px-4 rounded-xl text-white text-sm font-semibold" style={{ background:"#0d6efd" }}>Add</button>
          </div>
        </div>
      )}

      {ptab==="notes" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><StickyNote size={15} style={{ color:"#F59E0B" }} /> Counselling notes</h2>
          <div className="flex gap-2 mb-4">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter") { onAddNote(s.id,note); setNote(""); } }}
              placeholder="e.g. Discussed SOP draft, sending checklist on WhatsApp…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{ borderColor:"#CBD5E1" }} />
            <button onClick={() => { onAddNote(s.id,note); setNote(""); }} className="px-4 rounded-xl text-white text-sm font-semibold" style={{ background:"#0d6efd" }}>Add</button>
          </div>
          {(s.notes||[]).length===0 && <p className="text-sm text-slate-400">No notes yet.</p>}
          <div className="space-y-2">
            {(s.notes||[]).map((n,idx) => (
              <div key={idx} className="flex gap-3 items-start text-sm border-l-2 pl-3 py-1" style={{ borderColor:"#0d6efd55" }}>
                <span className="text-[11px] text-slate-400 shrink-0 mt-0.5 w-20 num">{fmtDate(n.created_at||Date.now())}</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ SMALL COMPONENTS ════ */
function AddStudentModal({ team, onClose, onSave }) {
  const [f, setF] = useState({ name:"", phone:"", email:"", level:"PG", country:"UK", intake:"September", field:FIELDS[0], assigned_to:"", qualification:"Warm" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]:e.target.value }));
  return (
    <Modal title="New lead" onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *"><input value={f.name}   onChange={set("name")}   style={inp} placeholder="Student name" /></Field>
        <Field label="Mobile *">   <input value={f.phone}  onChange={set("phone")}  style={inp} placeholder="+91 …" /></Field>
        <Field label="Email">      <input value={f.email}  onChange={set("email")}  style={inp} placeholder="name@email.com" /></Field>
        <Field label="Level">      <select value={f.level}  onChange={set("level")}  style={inp}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Country">    <select value={f.country} onChange={set("country")} style={inp}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Intake">     <select value={f.intake}  onChange={set("intake")}  style={inp}>{INTAKES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Field">      <select value={f.field}   onChange={set("field")}   style={inp}>{FIELDS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Assign to">  <select value={f.assigned_to} onChange={set("assigned_to")} style={inp}><option value="">Unassigned</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}</select></Field>
        <Field label="Qualification"><select value={f.qualification} onChange={set("qualification")} style={inp}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field>
      </div>
      <button disabled={!f.name.trim()||!f.phone.trim()} onClick={() => onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ background:"#0d6efd" }}>Save lead</button>
    </Modal>
  );
}

function AddTeamModal({ onClose, onSave }) {
  const [f, setF] = useState({ name:"", role:"Counsellor", country:"—" });
  return (
    <Modal title="Add team member" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name *"><input value={f.name} onChange={(e) => setF({...f,name:e.target.value})} style={inp} placeholder="Full name" /></Field>
        <Field label="Role"><select value={f.role} onChange={(e) => setF({...f,role:e.target.value})} style={inp}><option>Counsellor</option><option>BDE</option><option>Visa Officer</option><option>Admin</option></select></Field>
        <Field label="Country desk"><select value={f.country} onChange={(e) => setF({...f,country:e.target.value})} style={inp}><option>—</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <button disabled={!f.name.trim()} onClick={() => onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ background:"#0d6efd" }}>Add member</button>
    </Modal>
  );
}

function SecuritySection({ security, onSave }) {
  const [p,setP]=useState(""); const [a,setA]=useState(""); const [x,setX]=useState(""); const [err,setErr]=useState("");
  const save = () => {
    if (!p&&!a&&!x) { setErr("Type a new password in at least one field."); return; }
    const next = { ...security };
    if (p) next.appPass   = hashPw(p);
    if (a) next.adminPass  = hashPw(a);
    if (x) next.exportPass = hashPw(x);
    if (next.adminPass && next.exportPass && next.adminPass===next.exportPass) { setErr("Export password must differ from admin password."); return; }
    setErr(""); onSave(next); setP(""); setA(""); setX("");
  };
  return (
    <div className="p-3 rounded-xl border space-y-3" style={{ borderColor:"#E5EAF3" }}>
      <div className="font-semibold text-sm">🔒 Passwords</div>
      <p className="text-[11px] text-slate-500">App password: required to open the app. Admin password: protects Settings and unlocks the app. Export password: required to download or push data.</p>
      {[["App password",p,setP,security.appPass],["Admin password",a,setA,security.adminPass],["Export password",x,setX,security.exportPass]].map(([label,val,setVal,set]) => (
        <label key={label} className="block text-xs font-semibold text-slate-500">{label} {set?<span className="text-green-600">· set ✓</span>:<span className="text-slate-400">· not set</span>}
          <input type="password" value={val} onChange={(e) => setVal(e.target.value)} placeholder={set?"Type to change":"Create password"} style={inp} />
        </label>
      ))}
      {err && <p className="text-[11px] font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold" style={{ background:"#0d6efd" }}>Save passwords</button>
        {(security.adminPass||security.exportPass||security.appPass) && <button onClick={() => { onSave({ adminPass:"",exportPass:"",appPass:"" }); setP(""); setA(""); setX(""); setErr(""); }} className="px-3 py-2 rounded-xl border text-xs font-semibold text-slate-500" style={{ borderColor:"#E5EAF3" }}>Remove all</button>}
      </div>
    </div>
  );
}

function PasswordPrompt({ title, hint, onClose, onSubmit }) {
  const [pw,setPw]=useState(""); const [wrong,setWrong]=useState(false);
  const tryIt = () => { if (!onSubmit(pw)) { setWrong(true); setPw(""); } };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3">{hint}</p>
      <input type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} onKeyDown={(e) => { if(e.key==="Enter") tryIt(); }} placeholder="Password" style={inp} />
      {wrong && <p className="text-[11px] font-semibold text-red-500 mt-2">Wrong password — try again.</p>}
      <button onClick={tryIt} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:"#0d6efd" }}>Unlock</button>
    </Modal>
  );
}

function LockScreen({ onSubmit }) {
  const [pw,setPw]=useState(""); const [wrong,setWrong]=useState(false);
  const go = () => { if (!onSubmit(pw)) { setWrong(true); setPw(""); } };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background:"linear-gradient(160deg,#0A1F3D 0%,#13315C 100%)", fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');`}</style>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-xl" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
        <h1 className="font-extrabold text-lg mt-3" style={{ color:"#0A1F3D" }}>ABROAD VEDA</h1>
        <p className="text-[11px] tracking-widest uppercase text-slate-400">Counsellor & BDE Workspace</p>
        <div className="flex items-center gap-2 justify-center mt-5 text-slate-500 text-sm"><Lock size={14} /> Enter password to continue</div>
        <input type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }} onKeyDown={(e) => { if(e.key==="Enter") go(); }} placeholder="App password" className="mt-3 w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm text-center" />
        {wrong && <p className="text-[11px] font-semibold text-red-500 mt-2">Wrong password — try again.</p>}
        <button onClick={go} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:"#0d6efd" }}>Unlock workspace</button>
        <p className="text-[10px] text-slate-400 mt-3">Admins can also unlock with the admin password.</p>
      </div>
    </div>
  );
}

function ImportModal({ team, onClose, onImport }) {
  const [parsed,setParsed]=useState(null); const [error,setError]=useState("");
  const norm = (k) => String(k).toLowerCase().replace(/[^a-z]/g,"");
  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:"" });
      const recs = rows.map((r) => {
        const g = {}; Object.keys(r).forEach((k) => { g[norm(k)] = String(r[k]).trim(); });
        const name = g.name||g.fullname||g.studentname||""; if (!name) return null;
        const stageLabel = (g.stage||"").toLowerCase();
        const stage = stageLabel ? (STAGES.find((s) => s.label.toLowerCase().includes(stageLabel))?.id||"lead") : "lead";
        const assignedName = (g.assignedto||g.counsellor||"").toLowerCase();
        const assigned_to = team.find((t) => t.name.toLowerCase()===assignedName)?.id||"";
        const lvl = (g.level||"").toUpperCase();
        const qual = ["hot","warm","cold"].includes((g.qualification||"").toLowerCase()) ? (g.qualification[0].toUpperCase()+g.qualification.slice(1).toLowerCase()) : "";
        return { name, phone:g.phone||g.mobile||"", email:g.email||"", level:LEVELS.includes(lvl)?lvl:"PG",
          country:COUNTRIES.find((c)=>c.toLowerCase()===(g.country||"").toLowerCase())||(g.country||"UK"),
          intake:INTAKES.find((m)=>m.toLowerCase()===(g.intake||"").toLowerCase())||"Other",
          field:g.fieldofstudy||g.field||"Other", stage, assigned_to, qualification:qual,
          follow_up:g.followup||"" };
      }).filter(Boolean);
      if (!recs.length) { setError("No valid rows — make sure the sheet has a 'Name' column."); return; }
      setError(""); setParsed(recs);
    } catch { setError("Could not read file — try saving as .xlsx or .csv"); }
  };
  const dlTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ Name:"Student Name", Phone:"+91 9XXXXXXXXX", Email:"name@email.com", Qualification:"Warm", Level:"PG", Country:"UK", Intake:"September", "Field of Study":"Business & Management", Stage:"New Lead", "Assigned To":"", "Follow Up":"" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Leads"); XLSX.writeFile(wb,"abroadveda-import-template.xlsx");
  };
  return (
    <Modal title="Import leads from Excel" onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">Upload .xlsx or .csv. Must have a <b>Name</b> column; other columns are matched automatically.</p>
      <label className="block w-full p-6 rounded-xl border-2 border-dashed border-slate-300 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30">
        <Upload size={22} className="mx-auto text-slate-400" />
        <span className="block text-sm font-semibold mt-2">Choose Excel or CSV file</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
      </label>
      <button onClick={dlTemplate} className="mt-2 text-[11px] font-semibold hover:underline" style={{ color:"#0d6efd" }}>Download blank import template</button>
      {error && <p className="text-[11px] font-semibold text-red-500 mt-2">{error}</p>}
      {parsed && (
        <div className="mt-3 p-3 rounded-xl border border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-700">Found {parsed.length} lead{parsed.length!==1?"s":""} ✓</p>
          <p className="text-[11px] text-green-700 mt-0.5">{parsed.slice(0,5).map((r)=>r.name).join(", ")}{parsed.length>5?` +${parsed.length-5} more`:""}</p>
          <button onClick={() => onImport(parsed)} className="mt-3 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:"#16A34A" }}>Import {parsed.length} lead{parsed.length!==1?"s":""}</button>
        </div>
      )}
    </Modal>
  );
}

function ModalBtn({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 text-left" style={{ borderColor:"#E5EAF3" }}>
      {icon}
      <span><span className="font-semibold text-sm block">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </button>
  );
}

function Field({ label, children }) {
  return <label className="block text-xs font-semibold text-slate-500">{label}{children}</label>;
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key==="Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(10,31,61,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
