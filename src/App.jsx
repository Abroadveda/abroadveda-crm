import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, LayoutDashboard, KanbanSquare, UserPlus, Phone, Mail,
  ChevronRight, ChevronLeft, Search, X, Plus, Trash2, CalendarClock,
  GraduationCap, Globe2, BadgeCheck, Briefcase, StickyNote, Loader2,
  Download, Settings as Cog, Send, FileSpreadsheet, Upload, Lock,
  MessageCircle, PhoneCall, Flame, ArrowRight, Wifi, WifiOff, RefreshCw,
  LogOut, Eye, EyeOff, Video, UserCheck, AlertCircle, CheckCircle2
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  addNote as dbAddNote, upsertApplication, deleteApplication,
  upsertDocument, deleteDocument,
  getTeam, createTeamMember, deleteTeamMember,
  bulkInsertStudents, getSetting, setSetting
} from "./lib/db";

/* ══════════════════════════════════════════════════════════════
   ABROAD VEDA CRM — Role-based workflow
   ══════════════════════════════════════════════════════════════
   WORKFLOW:
   1. BDE  → calls students, books counselling interest, adds lead
   2. Admin → sees new leads, assigns a Counsellor to each
   3. Counsellor → gets session, does Google Meet/Zoom, updates & converts lead
   4. Admin → full visibility at every stage
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink:"#0A1F3D", blue:"#0d6efd", saffron:"#F59E0B",
  mist:"#F5F7FB", line:"#E5EAF3", ok:"#16A34A", danger:"#DC2626",
  teal:"#14B8A6", purple:"#8B5CF6",
};

/* ── Role definitions ───────────────────────────────────────── */
const ROLE_META = {
  Admin: {
    color:"#F59E0B", badge:"#FEF3C7", badgeText:"#92400E",
    desc:"Full access — assigns counsellors, sees everything",
    canCreate:true, canAssign:true, canAdvance:true, canDelete:true,
    visibleStages: null, // all
  },
  BDE: {
    color:"#14B8A6", badge:"#CCFBF1", badgeText:"#134E4A",
    desc:"Creates new leads, calls students, books counselling",
    canCreate:true, canAssign:false, canAdvance:false, canDelete:false,
    visibleStages:["lead"], // BDEs only see New Lead stage
  },
  Counsellor: {
    color:"#0d6efd", badge:"#DBEAFE", badgeText:"#1E40AF",
    desc:"Conducts sessions, converts leads, updates profile",
    canCreate:false, canAssign:false, canAdvance:true, canDelete:false,
    visibleStages:["counsel","shortlist","applied","offer","finance"],
  },
  "Visa Officer": {
    color:"#EF4444", badge:"#FEE2E2", badgeText:"#991B1B",
    desc:"Handles visa filing, pre-departure and departures",
    canCreate:false, canAssign:false, canAdvance:true, canDelete:false,
    visibleStages:["visa","predep","departed"],
  },
};

const STAGES = [
  { id:"lead",      label:"New Lead",             color:"#64748B" },
  { id:"counsel",   label:"Counselling",           color:"#0d6efd" },
  { id:"shortlist", label:"Shortlisting",          color:"#6366F1" },
  { id:"applied",   label:"Application",           color:"#8B5CF6" },
  { id:"offer",     label:"Offer Received",        color:"#F59E0B" },
  { id:"finance",   label:"Finance & Scholarship", color:"#14B8A6" },
  { id:"visa",      label:"Visa Filing",           color:"#EF4444" },
  { id:"predep",    label:"Pre-Departure",         color:"#10B981" },
  { id:"departed",  label:"Departed 🎉",           color:"#16A34A" },
];

const COUNTRIES    = ["UK","Ireland","Germany","Australia","New Zealand","Canada","USA","Europe"];
const INTAKES      = ["January","May","September","Other"];
const LEVELS       = ["UG","PG"];
const FIELDS       = ["Business & Management","Engineering & Technology","Computer & IT","Health & Life Sciences","Science & Research","Arts & Humanities","Law","Design & Media","Hospitality & Aviation","Finance & Economics","Other"];
const QUALS        = [{ id:"Hot",color:"#DC2626" },{ id:"Warm",color:"#F59E0B" },{ id:"Cold",color:"#64748B" }];
const APP_STATUSES = ["Course Enquiry","Application Preparation","Submitted","Offer in Principle","Offer Accepted","Finalised","Closed"];
const DEFAULT_DOCS = ["Passport","10th & 12th Marksheets","Degree & Transcripts","IELTS / PTE Score","SOP","LORs","CV / Resume","Financial Documents"];
const DOC_STATUSES = ["Pending","Received","Verified"];
const DOC_COLORS   = { Pending:"#94A3B8", Received:"#F59E0B", Verified:"#16A34A" };
const HEAR_SOURCES = ["School/College Visit","Friend or Family","Social Media","Website","Walk-in","Education Fair","Other"];
const FIN_SOURCES  = ["Parents","Self-funded","Education Loan","Scholarship","Sponsor"];
const CALL_OUTCOMES = ["Answered — Follow-up set","Answered — Not interested","Answered — Booked for counselling","No answer — Callback later","Busy — Try again","Wrong number","WhatsApp message sent"];
const MEET_LINKS   = ["Google Meet","Zoom","Microsoft Teams","Phone call"];

/* ── Helpers ── */
const hashPw    = (s) => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
const stageIdx  = (id) => STAGES.findIndex((s) => s.id===id);
const stageOf   = (id) => STAGES[stageIdx(id)] || STAGES[0];
const fmtDT     = (ts) => new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const qualColor = (q) => QUALS.find((x) => x.id===q)?.color || "#64748B";
const waLink    = (p) => "https://wa.me/"+String(p||"").replace(/[^0-9]/g,"");
const isOverdue = (s) => s.follow_up && new Date(s.follow_up) < new Date(new Date().toDateString());
const inp       = { width:"100%", padding:"9px 12px", borderRadius:12, border:"1px solid #CBD5E1", fontSize:14, background:"#fff", marginTop:4, fontWeight:500 };

/* ════════════════════════════════════════════════════════════ */
export default function AbroadvedaCRM() {
  const [tab, setTab]           = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [team, setTeam]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dbOk, setDbOk]         = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [query, setQuery]             = useState("");
  const [globalQ, setGlobalQ]         = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterQual, setFilterQual]   = useState("all");

  const [selected, setSelected]         = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [showAddTeam, setShowAddTeam]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport]     = useState(false);
  const [showImport, setShowImport]     = useState(false);

  const [webhookUrl, setWebhookUrl]   = useState("");
  const [security, setSecurity]       = useState({ adminPass:"", exportPass:"", appPass:"" });
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [toast, setToast]             = useState("");

  const notify = (msg, dur=3500) => { setToast(msg); setTimeout(()=>setToast(""), dur); };

  /* ── Load ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s,t,wh,sec] = await Promise.all([getStudents(),getTeam(),getSetting("webhookUrl"),getSetting("security")]);
      setStudents(s||[]); setTeam(t||[]);
      if (wh) setWebhookUrl(wh);
      if (sec) setSecurity({ adminPass:"", exportPass:"", appPass:"", ...sec });
      setDbOk(true);
    } catch(e) { console.error(e); setDbOk(false); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Role helpers ── */
  const role    = currentUser?.role;
  const isAdmin = role === "Admin";
  const isBDE   = role === "BDE";
  const roleMeta = ROLE_META[role] || ROLE_META.Admin;

  /* ── Visible students per role ── */
  const visibleStudents = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return students;
    const allowedStages = ROLE_META[role]?.visibleStages;
    return students.filter((s) => {
      const mine = s.assigned_to === currentUser.id;
      const inStage = !allowedStages || allowedStages.includes(s.stage);
      // BDE: see all unassigned leads + their own leads
      if (isBDE) return inStage && (s.assigned_to === currentUser.id || !s.assigned_to);
      return mine && inStage;
    });
  }, [students, currentUser, isAdmin, isBDE, role]);

  /* ── Students awaiting counsellor assignment (admin only) ── */
  const pendingAssignment = useMemo(() =>
    students.filter((s) => s.stage==="lead" && !s.assigned_to),
    [students]
  );

  const memberName = (id) => team.find((t) => t.id===id)?.name || "Unassigned";
  const memberRole = (id) => team.find((t) => t.id===id)?.role || "";

  const filtered = useMemo(() => visibleStudents.filter((s) => {
    const q = query.trim().toLowerCase();
    if (q && !`${s.name} ${s.email} ${s.phone} ${s.country} ${s.field}`.toLowerCase().includes(q)) return false;
    if (filterStage!=="all" && s.stage!==filterStage) return false;
    if (filterCountry!=="all" && s.country!==filterCountry) return false;
    if (filterQual!=="all" && s.qualification!==filterQual) return false;
    return true;
  }), [visibleStudents, query, filterStage, filterCountry, filterQual]);

  const searchHits = useMemo(() => {
    const q = globalQ.trim().toLowerCase();
    if (!q) return [];
    return visibleStudents.filter((s) => `${s.name} ${s.email} ${s.phone}`.toLowerCase().includes(q)).slice(0,6);
  }, [visibleStudents, globalQ]);

  const stats = useMemo(() => ({
    total:     visibleStudents.length,
    active:    visibleStudents.filter((s) => !["lead","departed"].includes(s.stage)).length,
    offers:    visibleStudents.filter((s) => stageIdx(s.stage)>=stageIdx("offer")&&s.stage!=="departed").length,
    departed:  visibleStudents.filter((s) => s.stage==="departed").length,
    followUps: visibleStudents.filter((s) => s.follow_up && new Date(s.follow_up)<=new Date(Date.now()+2*86400000)).length,
    pending:   pendingAssignment.length,
  }), [visibleStudents, pendingAssignment]);

  /* ── Mutations ── */
  const updStudent = async (id, patch) => {
    try {
      setSyncing(true);
      const u = await updateStudent(id, patch);
      setStudents((p) => p.map((s) => s.id===id?{...s,...u}:s));
    } catch(e) { notify("Save failed — check connection"); console.error(e); }
    finally { setSyncing(false); }
  };

  const moveStage = async (id, dir) => {
    const s = students.find((x) => x.id===id); if (!s) return;
    const i = Math.min(STAGES.length-1, Math.max(0, stageIdx(s.stage)+dir));
    await updStudent(id, { stage:STAGES[i].id });
  };

  const assignCounsellor = async (studentId, counsellorId) => {
    await updStudent(studentId, { assigned_to:counsellorId, stage:"counsel" });
    const counsellor = team.find((t) => t.id===counsellorId);
    await doAddNote(studentId, `✅ Assigned to ${counsellor?.name||"counsellor"} for counselling session.`);
    notify(`Assigned to ${counsellor?.name} ✓`);
  };

  const doAddNote = async (studentId, text) => {
    if (!text.trim()) return;
    try {
      const note = await dbAddNote(studentId, text.trim());
      setStudents((p) => p.map((s) => s.id===studentId?{...s,notes:[note,...(s.notes||[])]}:s));
    } catch(e) { notify("Could not save note"); }
  };

  const doAddCallLog = async (studentId, log) => {
    const parts = [`📞 CALL — ${log.outcome}`];
    if (log.notes) parts.push(`Notes: ${log.notes}`);
    if (log.bookedCounselling) parts.push(`🎯 Booked for counselling`);
    await doAddNote(studentId, parts.join("\n"));
    // If booked for counselling, update stage to counsel
    if (log.bookedCounselling && !isAdmin) {
      await updStudent(studentId, { stage:"counsel" });
      notify("Lead moved to Counselling stage ✓");
    }
  };

  const doAddSessionLog = async (studentId, log) => {
    const parts = [
      `🎓 COUNSELLING SESSION — ${log.platform}`,
      `Duration: ${log.duration}`,
      `Outcome: ${log.outcome}`,
    ];
    if (log.notes) parts.push(`Notes: ${log.notes}`);
    if (log.meetLink) parts.push(`Meet link: ${log.meetLink}`);
    await doAddNote(studentId, parts.join("\n"));
  };

  const doDeleteStudent = async (id) => {
    try { await deleteStudent(id); setStudents((p) => p.filter((s) => s.id!==id)); setSelected(null); }
    catch(e) { notify("Delete failed"); }
  };
  const doAddApp = async (studentId, appForm) => {
    try { const app=await upsertApplication({student_id:studentId,...appForm}); setStudents((p) => p.map((s) => s.id===studentId?{...s,applications:[app,...(s.applications||[])]}:s)); }
    catch(e) { notify("Could not save application"); }
  };
  const doUpdateApp = async (studentId, appId, patch) => {
    try { const app=await upsertApplication({id:appId,student_id:studentId,...patch}); setStudents((p) => p.map((s) => s.id===studentId?{...s,applications:(s.applications||[]).map((a) => a.id===appId?app:a)}:s)); }
    catch(e) { notify("Could not update application"); }
  };
  const doDeleteApp = async (studentId, appId) => {
    try { await deleteApplication(appId); setStudents((p) => p.map((s) => s.id===studentId?{...s,applications:(s.applications||[]).filter((a) => a.id!==appId)}:s)); }
    catch(e) { notify("Could not delete application"); }
  };
  const doCycleDoc = async (studentId, docId, currentStatus, docName) => {
    const next=DOC_STATUSES[(DOC_STATUSES.indexOf(currentStatus)+1)%DOC_STATUSES.length];
    try { const doc=await upsertDocument({id:docId,student_id:studentId,name:docName,status:next}); setStudents((p) => p.map((s) => s.id===studentId?{...s,documents:(s.documents||[]).map((d) => d.id===docId?doc:d)}:s)); }
    catch(e) { notify("Could not update document"); }
  };
  const doAddDoc = async (studentId, name) => {
    try { const doc=await upsertDocument({student_id:studentId,name,status:"Pending"}); setStudents((p) => p.map((s) => s.id===studentId?{...s,documents:[...(s.documents||[]),doc]}:s)); }
    catch(e) { notify("Could not add document"); }
  };
  const doDeleteDoc = async (studentId, docId) => {
    try { await deleteDocument(docId); setStudents((p) => p.map((s) => s.id===studentId?{...s,documents:(s.documents||[]).filter((d) => d.id!==docId)}:s)); }
    catch(e) { notify("Could not delete document"); }
  };
  const doAddStudent = async (form) => {
    try {
      const rec = await createStudent(form);
      await Promise.all(DEFAULT_DOCS.map((n) => upsertDocument({student_id:rec.id,name:n,status:"Pending"})));
      const refreshed = await getStudents(); setStudents(refreshed); setShowAdd(false);
      notify("Lead saved ✓ — Admin will assign a counsellor");
    } catch(e) { notify("Could not save lead"); console.error(e); }
  };
  const doBulkImport = async (rows) => {
    try { await bulkInsertStudents(rows); const r=await getStudents(); setStudents(r); setShowImport(false); notify(`Imported ${rows.length} leads ✓`); }
    catch(e) { notify("Import failed"); }
  };
  const doAddTeam = async (member) => {
    try { const rec=await createTeamMember(member); setTeam((p) => [...p,rec]); setShowAddTeam(false); }
    catch(e) { notify("Could not add team member"); }
  };
  const doDeleteTeam = async (id) => {
    try { await deleteTeamMember(id); setTeam((p) => p.filter((t) => t.id!==id)); }
    catch(e) { notify("Could not delete"); }
  };
  const doSaveSecurity = async (sec) => {
    setSecurity(sec);
    try { await setSetting("security", sec); notify("Passwords updated ✓"); }
    catch(e) { notify("Could not save passwords"); }
  };
  const doSaveWebhook = async (url) => { setWebhookUrl(url); try { await setSetting("webhookUrl", url); } catch(e) {} };

  /* ── Export ── */
  const rowOf = (s) => [new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),s.name,s.phone,s.email||"",s.level,s.country,s.intake,s.field,stageOf(s.stage).label,memberName(s.assigned_to),s.follow_up||"","CRM"];
  const exportRows = () => students.map((s) => ({ Date:new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),Name:s.name,Phone:s.phone,Email:s.email||"",Qualification:s.qualification||"",Level:s.level,Country:s.country,Intake:s.intake,"Field of Study":s.field,Stage:stageOf(s.stage).label,"Assigned To":memberName(s.assigned_to),"Follow Up":s.follow_up||"" }));
  const exportExcel = () => { const ws=XLSX.utils.json_to_sheet(exportRows()); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Leads"); XLSX.writeFile(wb,"abroadveda-leads.xlsx"); notify("Excel downloaded ✓"); };
  const exportCSV = () => { const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows())); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="abroadveda-leads.csv"; a.click(); notify("CSV downloaded ✓"); };
  const sendToSheet = async (rows, silent) => {
    if (!webhookUrl) { if (!silent) notify("Add your Google Sheets link in Settings"); return; }
    try { await fetch(webhookUrl,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},body:JSON.stringify({rows})}); if (!silent) notify("Sent to Google Sheets ✓"); }
    catch { if (!silent) notify("Could not reach Google Sheets"); }
  };

  const openSettings = () => { if (security.adminPass&&!adminUnlocked) { setShowSettings(true); } else setShowSettings(true); };
  const openStudent  = (id) => { setTab("students"); setSelected(id); setGlobalQ(""); };

  /* ── Loading / DB error screens ── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:T.mist }}>
      <div className="text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-xl" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
        <div className="flex items-center gap-2 text-slate-500 justify-center"><Loader2 className="animate-spin" size={18}/> Connecting to database…</div>
      </div>
    </div>
  );
  if (!dbOk) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background:T.mist }}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border" style={{ borderColor:T.line }}>
        <WifiOff size={32} className="text-red-400 mb-3"/>
        <h2 className="font-extrabold text-lg mb-2">Database not connected</h2>
        <p className="text-sm text-slate-500 mb-4">Check your Supabase environment variables.</p>
        <button onClick={loadAll} className="w-full py-2 rounded-xl border text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2" style={{ borderColor:T.line }}><RefreshCw size={14}/> Retry</button>
      </div>
    </div>
  );

  /* ── Role login ── */
  if (!currentUser) return (
    <RoleLoginScreen team={team} security={security} onLogin={setCurrentUser}/>
  );

  const selectedStudent = students.find((s) => s.id===selected);
  const counsellors = team.filter((t) => t.role==="Counsellor");
  const NAV = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["pipeline",  KanbanSquare,   "Pipeline"],
    ["students",  Users,          "Students"],
    ...(isAdmin ? [["team", Briefcase, "Team"]] : []),
  ];

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
          <div><div className="font-extrabold text-white tracking-wide text-sm">ABROAD VEDA</div><div className="text-[9px] text-blue-200/80 tracking-[.18em] uppercase">CRM Workspace</div></div>
        </div>

        {/* User badge */}
        <div className="mt-4 mx-1 px-3 py-2 rounded-xl bg-white/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0" style={{ background:ROLE_META[role]?.color||T.blue }}>{currentUser.name[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{currentUser.name}</div>
            <div className="text-blue-200/70 text-[10px]">{role}</div>
          </div>
          <button onClick={() => setCurrentUser(null)} title="Switch user" className="p-1 rounded-lg hover:bg-white/10 text-blue-200/60 hover:text-white"><LogOut size={13}/></button>
        </div>

        <nav className="mt-5 space-y-1">
          {NAV.map(([id,Icon,label]) => (
            <button key={id} onClick={() => { setTab(id); setSelected(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${tab===id?"text-slate-900 bg-white":"text-blue-100/80 hover:bg-white/10"}`}>
              <Icon size={17} style={tab===id?{color:T.blue}:{}}/>
              {label}
              {id==="students" && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md num" style={{ background:tab===id?"#EAF2FF":"rgba(255,255,255,.12)", color:tab===id?T.blue:"#BFD7FF" }}>{visibleStudents.length}</span>}
              {id==="dashboard" && isAdmin && stats.pending > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white num">{stats.pending}</span>
              )}
            </button>
          ))}
        </nav>

        {roleMeta.canCreate && (
          <button onClick={() => setShowAdd(true)} className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-bold shadow-lg hover:opacity-90" style={{ background:isBDE?T.teal:T.blue }}>
            <UserPlus size={16}/> {isBDE?"Add new lead":"New lead"}
          </button>
        )}

        <div className="mt-auto space-y-1 pt-6 border-t border-white/10">
          {isAdmin && <button onClick={() => setShowExport(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Download size={16}/> Import / Export</button>}
          {isAdmin && <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Cog size={16}/> Settings</button>}
          <div className="px-3 pt-2 text-[10px] text-blue-200/60 flex items-center gap-1.5">
            {syncing?<><Loader2 size={10} className="animate-spin"/> Syncing…</>:<><Wifi size={10}/> Live database</>}
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="md:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3 border-b" style={{ background:"rgba(245,247,251,.92)", backdropFilter:"blur(8px)", borderColor:T.line }}>
          <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shrink-0" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400"/>
            <input value={globalQ} onChange={(e) => setGlobalQ(e.target.value)} placeholder="Search any student — name, phone, email…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm bg-white font-medium" style={{ borderColor:T.line }}/>
            {globalQ && <button onClick={() => setGlobalQ("")} className="absolute right-3 top-3 text-slate-400"><X size={14}/></button>}
            {searchHits.length > 0 && (
              <div className="absolute mt-1.5 w-full card overflow-hidden z-50">
                {searchHits.map((s) => (
                  <button key={s.id} onClick={() => openStudent(s.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50/60 text-left border-b last:border-0" style={{ borderColor:T.line }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background:stageOf(s.stage).color }}>{s.name[0]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{s.name}</span>
                      <span className="block text-[11px] text-slate-400 truncate num">{s.phone} · {stageOf(s.stage).label}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-300"/>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Role badge */}
          <span className="hidden md:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background:ROLE_META[role]?.badge, color:ROLE_META[role]?.badgeText }}>{role}</span>
          {roleMeta.canCreate && <button onClick={() => setShowAdd(true)} className="md:hidden p-2.5 rounded-xl text-white shrink-0" style={{ background:T.blue }}><UserPlus size={16}/></button>}
        </header>

        <main className="p-4 sm:p-6 max-w-6xl mx-auto pb-24 md:pb-8">

          {/* ════ DASHBOARD ════ */}
          {tab==="dashboard" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">Namaste, {currentUser.name.split(" ")[0]} 🙏</h1>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} · <span style={{ color:ROLE_META[role]?.color }}>{role} view</span></p>
              </div>

              {/* ── ADMIN: Pending assignment alert ── */}
              {isAdmin && pendingAssignment.length > 0 && (
                <div className="card p-4 border-l-4" style={{ borderLeftColor:T.danger }}>
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle size={18} style={{ color:T.danger }}/>
                    <span className="font-bold text-sm">{pendingAssignment.length} new lead{pendingAssignment.length!==1?"s":""} waiting for counsellor assignment</span>
                  </div>
                  <div className="space-y-2">
                    {pendingAssignment.slice(0,4).map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                        <button onClick={() => openStudent(s.id)} className="flex-1 min-w-0 text-left">
                          <span className="font-semibold text-sm">{s.name}</span>
                          <span className="text-[11px] text-slate-400 ml-2 num">{s.phone} · {s.country}</span>
                        </button>
                        <select defaultValue="" onChange={(e) => e.target.value && assignCounsellor(s.id, e.target.value)}
                          className="text-xs py-1.5 px-2 rounded-lg border bg-white font-semibold" style={{ borderColor:T.line }}>
                          <option value="" disabled>Assign counsellor…</option>
                          {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  {pendingAssignment.length > 4 && <button onClick={() => { setFilterStage("lead"); setTab("students"); }} className="text-xs font-semibold mt-2" style={{ color:T.blue }}>See all {pendingAssignment.length} unassigned leads →</button>}
                </div>
              )}

              {/* ── BDE dashboard hint ── */}
              {isBDE && (
                <div className="card p-4" style={{ borderLeft:`4px solid ${T.teal}` }}>
                  <p className="font-bold text-sm flex items-center gap-2"><PhoneCall size={15} style={{ color:T.teal }}/> Your workflow</p>
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {["1. Call student","2. Log the call","3. Book for counselling","4. Add as new lead in CRM"].map((step,i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px]" style={{ background:T.teal }}>{i+1}</span>
                        {step.slice(3)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Counsellor dashboard hint ── */}
              {role==="Counsellor" && (
                <div className="card p-4" style={{ borderLeft:`4px solid ${T.blue}` }}>
                  <p className="font-bold text-sm flex items-center gap-2"><Video size={15} style={{ color:T.blue }}/> Your workflow</p>
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {["Admin assigns you a lead","Open student profile","Schedule Google Meet / Zoom","Conduct session","Log session outcome","Advance stage"].map((step,i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px]" style={{ background:T.blue }}>{i+1}</span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  ["Total",stats.total,T.blue],
                  ["Active",stats.active,"#6366F1"],
                  ["Offers",stats.offers,T.saffron],
                  ["Departed",stats.departed,T.ok],
                  ["Follow-ups",stats.followUps,T.danger],
                ].map(([l,v,c]) => (
                  <button key={l} onClick={() => setTab("students")} className="card lift p-4 text-left">
                    <div className="text-3xl font-extrabold num" style={{ color:c }}>{v}</div>
                    <div className="text-xs font-semibold text-slate-500 mt-1">{l}</div>
                  </button>
                ))}
              </div>

              {/* Journey funnel */}
              <div className="card p-5">
                <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><GraduationCap size={16} style={{ color:T.blue }}/> Student journey</h2>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {STAGES.map((st) => {
                    const count = visibleStudents.filter((s) => s.stage===st.id).length;
                    return (
                      <button key={st.id} onClick={() => { setTab("students"); setFilterStage(st.id); }} className="flex-1 min-w-[72px] group text-center">
                        <div className="text-lg font-extrabold num" style={{ color:count?st.color:"#CBD5E1" }}>{count}</div>
                        <div className="h-2.5 rounded-full mt-1 transition group-hover:opacity-80" style={{ background:count?st.color:"#E8EDF5" }}/>
                        <div className="text-[10px] font-semibold text-slate-500 mt-1.5 leading-tight">{st.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Follow-ups */}
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><CalendarClock size={16} style={{ color:T.danger }}/> Follow-ups</h2>
                  {visibleStudents.filter((s) => s.follow_up).sort((a,b) => a.follow_up.localeCompare(b.follow_up)).slice(0,5).map((s) => (
                    <button key={s.id} onClick={() => openStudent(s.id)} className="w-full flex items-center gap-3 py-2 border-b last:border-0 text-left hover:bg-slate-50 rounded-lg px-1" style={{ borderColor:T.line }}>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg num shrink-0 ${isOverdue(s)?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"}`}>{isOverdue(s)?"Overdue":s.follow_up}</span>
                      <span className="text-sm font-semibold truncate">{s.name}</span>
                      <div className="ml-auto flex gap-1 shrink-0">
                        <a href={`tel:${s.phone}`} onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-blue-50" style={{ color:T.blue }}><PhoneCall size={13}/></a>
                        <a href={waLink(s.phone)} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={13}/></a>
                      </div>
                    </button>
                  ))}
                  {!visibleStudents.some((s)=>s.follow_up) && <p className="text-sm text-slate-400">No follow-ups scheduled.</p>}
                </div>
                {/* Hot leads */}
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Flame size={16} style={{ color:T.danger }}/> Hot leads</h2>
                  {visibleStudents.filter((s) => s.qualification==="Hot"&&s.stage!=="departed").slice(0,5).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 py-2 border-b last:border-0 px-1" style={{ borderColor:T.line }}>
                      <button onClick={() => openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate hover:underline">{s.name}</span>
                        <span className="block text-[11px] text-slate-400">{stageOf(s.stage).label} · {s.country}</span>
                      </button>
                      <a href={`tel:${s.phone}`} className="p-2 rounded-lg hover:bg-blue-50" style={{ color:T.blue }}><PhoneCall size={14}/></a>
                      <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={14}/></a>
                    </div>
                  ))}
                  {!visibleStudents.some((s)=>s.qualification==="Hot"&&s.stage!=="departed") && <p className="text-sm text-slate-400">No hot leads in your view.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ════ PIPELINE ════ */}
          {tab==="pipeline" && (
            <div>
              <h1 className="text-xl font-extrabold mb-4">Application pipeline</h1>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {STAGES.map((st) => {
                  const col = visibleStudents.filter((s) => s.stage===st.id);
                  return (
                    <div key={st.id} className="w-64 shrink-0 rounded-2xl p-3" style={{ background:"#ECF1F9" }}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background:st.color }}/>
                        <span className="text-xs font-bold">{st.label}</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 num">{col.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[40px]">
                        {col.length===0 && <div className="text-[11px] text-slate-400 text-center py-3 rounded-xl border border-dashed" style={{ borderColor:"#CBD5E1" }}>Empty</div>}
                        {col.map((s) => (
                          <div key={s.id} className="card lift p-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openStudent(s.id)} className="font-semibold text-sm hover:underline text-left truncate flex-1">{s.name}</button>
                              {s.qualification && <span className="w-2 h-2 rounded-full shrink-0" title={s.qualification} style={{ background:qualColor(s.qualification) }}/>}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{memberName(s.assigned_to)||"Unassigned"}</div>
                            <div className="flex items-center mt-2 gap-1">
                              {roleMeta.canAdvance && <button onClick={() => moveStage(s.id,-1)} disabled={stageIdx(s.stage)===0} className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-20"><ChevronLeft size={14}/></button>}
                              <a href={`tel:${s.phone}`} className="p-1.5 rounded-lg hover:bg-blue-50 flex-1 flex justify-center" style={{ color:T.blue }}><PhoneCall size={13}/></a>
                              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 flex justify-center"><MessageCircle size={13}/></a>
                              {roleMeta.canAdvance && <button onClick={() => moveStage(s.id,1)} disabled={stageIdx(s.stage)===STAGES.length-1} className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-20" style={{ color:T.blue }}><ChevronRight size={14}/></button>}
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
          {tab==="students" && !selectedStudent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <h1 className="text-xl font-extrabold mr-auto">Students</h1>
                {isAdmin && <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm font-semibold" style={{ borderColor:T.line }}><Upload size={14}/> Import</button>}
                {roleMeta.canCreate && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{ background:isBDE?T.teal:T.blue }}><UserPlus size={14}/> Add lead</button>}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-white" style={{ borderColor:T.line }}/>
                </div>
                <select value={filterQual} onChange={(e) => setFilterQual(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All quals</option>{QUALS.map((q) => <option key={q.id} value={q.id}>{q.id}</option>)}</select>
                <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All stages</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}><option value="all">All countries</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b" style={{ borderColor:T.line }}>
                    <th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Stage</th><th className="p-3">Assigned to</th><th className="p-3">Follow-up</th><th className="p-3">Contact</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((s) => {
                      const st=stageOf(s.stage);
                      return (
                        <tr key={s.id} onClick={() => setSelected(s.id)} className="border-b last:border-0 hover:bg-blue-50/40 cursor-pointer" style={{ borderColor:"#F0F4FA" }}>
                          <td className="p-3">
                            <div className="font-semibold flex items-center gap-2">{s.name}
                              {s.qualification && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:qualColor(s.qualification)+"1A", color:qualColor(s.qualification) }}>{s.qualification}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 num">{s.phone}</div>
                          </td>
                          <td className="p-3 text-xs">{s.level} · {s.country}<div className="text-slate-400">{s.field}</div></td>
                          <td className="p-3"><span className="text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap" style={{ background:st.color+"15", color:st.color }}>{st.label}</span></td>
                          <td className="p-3 text-xs">{memberName(s.assigned_to)||<span className="text-red-500 font-semibold">Unassigned</span>}</td>
                          <td className="p-3 text-xs num">{s.follow_up?<span className={isOverdue(s)?"font-bold text-red-600":""}>{s.follow_up}</span>:<span className="text-slate-300">—</span>}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <a href={`tel:${s.phone}`} onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-blue-50" style={{ color:T.blue }}><PhoneCall size={14}/></a>
                              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><MessageCircle size={14}/></a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length===0 && <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-400">No students in your view.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ STUDENT DETAIL ════ */}
          {tab==="students" && selectedStudent && (
            <StudentDetail
              s={selectedStudent} team={team} counsellors={counsellors}
              memberName={memberName} role={role} roleMeta={roleMeta} isAdmin={isAdmin}
              onBack={() => setSelected(null)}
              onUpdate={updStudent} onMove={moveStage}
              onAssign={assignCounsellor}
              onAddNote={doAddNote} onAddCallLog={doAddCallLog} onAddSessionLog={doAddSessionLog}
              onDeleteStudent={doDeleteStudent}
              onAddApp={doAddApp} onUpdateApp={doUpdateApp} onDeleteApp={doDeleteApp}
              onCycleDoc={doCycleDoc} onAddDoc={doAddDoc} onDeleteDoc={doDeleteDoc}
            />
          )}

          {/* ════ TEAM ════ */}
          {tab==="team" && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold">Team</h1>
                <button onClick={() => setShowAddTeam(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}><Plus size={14}/> Add member</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.map((t) => {
                  const load=students.filter((s) => s.assigned_to===t.id&&s.stage!=="departed").length;
                  return (
                    <div key={t.id} className="card lift p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white" style={{ background:ROLE_META[t.role]?.color||T.blue }}>{t.name.split(" ").map((w)=>w[0]).join("").slice(0,2)}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5" style={{ background:ROLE_META[t.role]?.badge, color:ROLE_META[t.role]?.badgeText }}>{t.role}</div>
                        <div className="text-[11px] mt-1 font-semibold num" style={{ color:T.blue }}>{load} active student{load!==1?"s":""}</div>
                      </div>
                      <button onClick={() => doDeleteTeam(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══ MOBILE NAV ══ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t" style={{ background:T.ink, borderColor:"rgba(255,255,255,.08)" }}>
        {NAV.map(([id,Icon,label]) => (
          <button key={id} onClick={() => { setTab(id); setSelected(null); }} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Icon size={18} style={{ color:tab===id?"#fff":"#7C9CCB" }}/>
            <span className="text-[9px] font-bold" style={{ color:tab===id?"#fff":"#7C9CCB" }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ══ MODALS ══ */}
      {showAdd && roleMeta.canCreate && <AddStudentModal team={team} isBDE={isBDE} currentUser={currentUser} onClose={() => setShowAdd(false)} onSave={doAddStudent}/>}
      {showAddTeam && isAdmin && <AddTeamModal onClose={() => setShowAddTeam(false)} onSave={doAddTeam}/>}
      {showImport && isAdmin && <ImportModal team={team} onClose={() => setShowImport(false)} onImport={doBulkImport}/>}

      {showExport && isAdmin && (
        <Modal title="Import / Export" onClose={() => setShowExport(false)}>
          <div className="space-y-2">
            <ModalBtn icon={<FileSpreadsheet size={18} style={{ color:T.ok }}/>} title="Download Excel (.xlsx)" sub={`All ${students.length} students`} onClick={() => { exportExcel(); setShowExport(false); }}/>
            <ModalBtn icon={<Download size={18} style={{ color:T.blue }}/>} title="Download CSV" sub="Import into Google Sheets" onClick={() => { exportCSV(); setShowExport(false); }}/>
            <ModalBtn icon={<Send size={18} style={{ color:T.saffron }}/>} title="Send all to Google Sheets" sub={webhookUrl?"Pushes every lead":"Connect Sheet in Settings first"} onClick={() => { sendToSheet(students.map(rowOf)); setShowExport(false); }}/>
            <ModalBtn icon={<Upload size={18} style={{ color:T.purple }}/>} title="Upload from Excel" sub="Bring in leads from .xlsx or .csv" onClick={() => { setShowExport(false); setShowImport(true); }}/>
          </div>
        </Modal>
      )}

      {showSettings && isAdmin && (
        <Modal title="Settings" onClose={() => setShowSettings(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Google Sheets webhook URL</label>
              <input value={webhookUrl} onChange={(e) => doSaveWebhook(e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" style={inp}/>
            </div>
            <SecuritySection security={security} onSave={doSaveSecurity}/>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg" style={{ background:T.ink }}>{toast}</div>
      )}
    </div>
  );
}

/* ════ ROLE LOGIN SCREEN ════ */
function RoleLoginScreen({ team, security, onLogin }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [show, setShow] = useState(false);

  const members = [
    { id:"admin-0", name:"Admin", role:"Admin", isAdmin:true },
    ...team.map((t) => ({ ...t, isAdmin:false })),
  ];

  const go = () => {
    if (!sel) return;
    if (sel.isAdmin && security.adminPass) {
      const h = (s) => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
      if (h(pin) !== security.adminPass) { setWrong(true); setPin(""); return; }
    }
    onLogin({ id:sel.id, name:sel.name, role:sel.role });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background:"linear-gradient(160deg,#0A1F3D 0%,#13315C 100%)", fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');`}</style>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-xl" style={{ background:"linear-gradient(135deg,#0d6efd,#F59E0B)" }}>AV</div>
          <h1 className="font-extrabold text-xl mt-3" style={{ color:"#0A1F3D" }}>ABROAD VEDA</h1>
          <p className="text-sm text-slate-400 mt-1">Who are you today?</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {members.map((m) => (
            <button key={m.id} onClick={() => { setSel(m); setPin(""); setWrong(false); }}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition ${sel?.id===m.id?"border-blue-500 bg-blue-50":"border-slate-200 hover:border-slate-300"}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ background:ROLE_META[m.role]?.color||"#0d6efd" }}>{m.name[0]}</div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate" style={{ color:"#0A1F3D" }}>{m.name}</div>
                <div className="text-[11px]" style={{ color:ROLE_META[m.role]?.color }}>{m.role}</div>
              </div>
            </button>
          ))}
        </div>
        {sel && (
          <div className="mb-3 p-3 rounded-xl text-xs text-slate-500" style={{ background:ROLE_META[sel.role]?.badge }}>
            <strong style={{ color:ROLE_META[sel.role]?.badgeText }}>{sel.role}:</strong> {ROLE_META[sel.role]?.desc}
          </div>
        )}
        {sel?.isAdmin && security.adminPass && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Admin password</label>
            <div className="relative">
              <input type={show?"text":"password"} value={pin} onChange={(e) => { setPin(e.target.value); setWrong(false); }}
                onKeyDown={(e) => { if(e.key==="Enter") go(); }}
                placeholder="Enter admin password" className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm pr-10"/>
              <button onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-slate-400">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
            </div>
            {wrong && <p className="text-xs font-semibold text-red-500 mt-1">Wrong password.</p>}
          </div>
        )}
        <button disabled={!sel} onClick={go} className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40" style={{ background:sel?ROLE_META[sel.role]?.color||"#0d6efd":"#94a3b8" }}>
          {sel ? `Enter as ${sel.name}` : "Select a profile above"}
        </button>
      </div>
    </div>
  );
}

/* ════ STUDENT DETAIL ════ */
function StudentDetail({ s, team, counsellors, memberName, role, roleMeta, isAdmin, onBack, onUpdate, onMove, onAssign, onAddNote, onAddCallLog, onAddSessionLog, onDeleteStudent, onAddApp, onUpdateApp, onDeleteApp, onCycleDoc, onAddDoc, onDeleteDoc }) {
  const [ptab, setPtab]       = useState(role==="BDE"?"calls":role==="Counsellor"?"session":"overview");
  const [noteText, setNoteText] = useState("");
  const [newDoc, setNewDoc]   = useState("");
  const [appForm, setAppForm] = useState({ course:"", institution:"", commence_date:"", status:"Application Preparation" });
  const [showCallModal, setShowCallModal]     = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [callForm, setCallForm]   = useState({ outcome:CALL_OUTCOMES[0], notes:"", bookedCounselling:false });
  const [sessionForm, setSessionForm] = useState({ platform:MEET_LINKS[0], duration:"30 mins", outcome:"", notes:"", meetLink:"" });

  const st   = stageOf(s.stage);
  const i    = stageIdx(s.stage);
  const apps = s.applications || [];
  const docs = (s.documents&&s.documents.length>0) ? s.documents : DEFAULT_DOCS.map((n,j) => ({ id:`tmp-${j}`, name:n, status:"Pending", student_id:s.id }));
  const allNotes = s.notes || [];
  const callLogs    = allNotes.filter((n) => n.text?.startsWith("📞 CALL"));
  const sessionLogs = allNotes.filter((n) => n.text?.startsWith("🎓 COUNSELLING SESSION"));
  const otherNotes  = allNotes.filter((n) => !n.text?.startsWith("📞")&&!n.text?.startsWith("🎓")&&!n.text?.startsWith("✅"));
  const isCounsellor = role==="Counsellor";
  const isBDE        = role==="BDE";

  const TABS = [
    ...(isBDE ? [["calls",`Calls (${callLogs.length})`]] : []),
    ...(isCounsellor||isAdmin ? [["session",`Sessions (${sessionLogs.length})`]] : []),
    ["overview","Overview"],
    ["apps",`Applications (${apps.length})`],
    ["docs","Documents"],
    ["notes",`Notes (${otherNotes.length})`],
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={16}/> All students</button>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg" style={{ background:st.color }}>{s.name[0]}</div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">{s.name}</h1>
              <span className="text-[10px] font-bold text-slate-400">AV-{s.id.toString().toUpperCase().slice(0,8)}</span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
              <span className="flex items-center gap-1 num"><Phone size={12}/> {s.phone}</span>
              <span className="flex items-center gap-1"><Mail size={12}/> {s.email||"—"}</span>
              <span className="flex items-center gap-1"><Globe2 size={12}/> {s.level} · {s.country} · {s.intake}</span>
            </div>
            {/* Qualification */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400">Qual:</span>
              {["Hot","Warm","Cold"].map((q) => (
                <button key={q} onClick={() => (isAdmin||isBDE)&&onUpdate(s.id,{qualification:q})} disabled={!isAdmin&&!isBDE}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition"
                  style={s.qualification===q?{background:qualColor(q),color:"#fff",borderColor:qualColor(q)}:{background:"#fff",color:qualColor(q),borderColor:qualColor(q)+"66"}}>
                  {q}
                </button>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl" style={{ background:"#EAF2FF", color:"#0d6efd" }}><PhoneCall size={13}/> Call</a>
              <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-green-50 text-green-700"><MessageCircle size={13}/> WhatsApp</a>
              {(isBDE||isAdmin) && <button onClick={() => setShowCallModal(true)} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-orange-50 text-orange-700"><StickyNote size={13}/> Log call</button>}
              {(isCounsellor||isAdmin) && <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-purple-50 text-purple-700"><Video size={13}/> Log session</button>}
            </div>
          </div>
          {isAdmin && <button onClick={() => onDeleteStudent(s.id)} className="p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>}
        </div>

        {/* Admin: assign counsellor */}
        {isAdmin && s.stage==="lead" && !s.assigned_to && (
          <div className="mt-4 p-3 rounded-xl border-2 border-dashed" style={{ borderColor:T.saffron, background:"#FFFBEB" }}>
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1"><AlertCircle size={13}/> Assign a counsellor to move this lead forward</p>
            <div className="flex gap-2">
              <select id="assign-sel" className="flex-1 py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{ borderColor:T.line }}
                defaultValue="">
                <option value="" disabled>Select counsellor…</option>
                {counsellors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => { const sel=document.getElementById("assign-sel").value; if(sel) onAssign(s.id,sel); }} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background:T.blue }}>Assign</button>
            </div>
          </div>
        )}

        {/* Journey progress */}
        <div className="mt-5">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STAGES.map((stg,idx) => (
              <button key={stg.id} onClick={() => isAdmin&&onUpdate(s.id,{stage:stg.id})} disabled={!isAdmin} title={stg.label}
                className="h-2.5 rounded-full flex-1 min-w-[28px] transition"
                style={{ background:idx<=i?stg.color:"#E2E8F0" }}/>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={() => onMove(s.id,-1)} disabled={i===0||!roleMeta.canAdvance} className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-50" style={{ borderColor:"#E5EAF3" }}>← Back</button>
            <span className="text-sm font-bold" style={{ color:st.color }}><BadgeCheck size={14} className="inline mr-1"/>{st.label}</span>
            <button onClick={() => onMove(s.id,1)} disabled={i===STAGES.length-1||!roleMeta.canAdvance} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-30" style={{ background:"#0d6efd" }}>Advance →</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <label className="text-xs font-semibold text-slate-500">Assigned to
            <select value={s.assigned_to||""} onChange={(e) => isAdmin&&onUpdate(s.id,{assigned_to:e.target.value})} disabled={!isAdmin} style={inp}>
              <option value="">Unassigned</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Next follow-up
            <input type="date" value={s.follow_up||""} onChange={(e) => onUpdate(s.id,{follow_up:e.target.value})} style={inp}/>
          </label>
        </div>
      </div>

      {/* Call log modal */}
      {showCallModal && (
        <Modal title="📞 Log a call" onClose={() => setShowCallModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Call outcome
              <select value={callForm.outcome} onChange={(e) => setCallForm({...callForm,outcome:e.target.value})} style={inp}>
                {CALL_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Notes (key points discussed)
              <textarea value={callForm.notes} onChange={(e) => setCallForm({...callForm,notes:e.target.value})}
                placeholder="e.g. Student is interested in UK. Needs IELTS. Booked for session Tuesday 3pm." rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
            {isBDE && (
              <label className="flex items-center gap-2 text-sm font-semibold text-teal-700 p-3 rounded-xl bg-teal-50 cursor-pointer">
                <input type="checkbox" checked={callForm.bookedCounselling} onChange={(e) => setCallForm({...callForm,bookedCounselling:e.target.checked})} className="w-4 h-4"/>
                Student agreed to counselling session — move to Counselling stage
              </label>
            )}
          </div>
          <button onClick={() => { onAddCallLog(s.id,callForm); setCallForm({outcome:CALL_OUTCOMES[0],notes:"",bookedCounselling:false}); setShowCallModal(false); }}
            className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:T.blue }}>Save call log</button>
        </Modal>
      )}

      {/* Session log modal */}
      {showSessionModal && (
        <Modal title="🎓 Log counselling session" onClose={() => setShowSessionModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Platform
              <select value={sessionForm.platform} onChange={(e) => setSessionForm({...sessionForm,platform:e.target.value})} style={inp}>
                {MEET_LINKS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Duration
              <select value={sessionForm.duration} onChange={(e) => setSessionForm({...sessionForm,duration:e.target.value})} style={inp}>
                {["15 mins","30 mins","45 mins","60 mins","90 mins"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Session outcome
              <select value={sessionForm.outcome} onChange={(e) => setSessionForm({...sessionForm,outcome:e.target.value})} style={inp}>
                <option value="">Select…</option>
                {["Lead converted — shortlisting started","Needs another session","Student not eligible","Student postponing","Application confirmed"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Session notes
              <textarea value={sessionForm.notes} onChange={(e) => setSessionForm({...sessionForm,notes:e.target.value})}
                placeholder="e.g. Student wants MSc Data Science. Shortlisting 3 universities. IELTS 7.0 required." rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Meet/Zoom link (optional)
              <input value={sessionForm.meetLink} onChange={(e) => setSessionForm({...sessionForm,meetLink:e.target.value})} placeholder="https://meet.google.com/…" style={inp}/>
            </label>
          </div>
          <button onClick={() => { onAddSessionLog(s.id,sessionForm); setShowSessionModal(false); }}
            className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:"#8B5CF6" }}>Save session</button>
        </Modal>
      )}

      {/* Profile tabs */}
      <div className="flex gap-1 card p-1.5 overflow-x-auto">
        {TABS.map(([id,label]) => (
          <button key={id} onClick={() => setPtab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${ptab===id?"text-white":"text-slate-500 hover:bg-slate-50"}`}
            style={ptab===id?{background:"#0A1F3D"}:{}}>
            {label}
          </button>
        ))}
      </div>

      {/* CALLS TAB */}
      {ptab==="calls" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><PhoneCall size={15} style={{ color:T.blue }}/> Call history</h2>
            <button onClick={() => setShowCallModal(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background:T.blue }}><Plus size={12}/> Log call</button>
          </div>
          <div className="flex gap-3 mb-5">
            <a href={`tel:${s.phone}`} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-1 justify-center" style={{ background:T.blue }}><PhoneCall size={15}/> Call now</a>
            <a href={waLink(s.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-1 justify-center bg-green-600"><MessageCircle size={15}/> WhatsApp</a>
          </div>
          {callLogs.length===0 && <p className="text-sm text-slate-400">No calls logged yet. Log every call — helps the admin see your progress.</p>}
          <div className="space-y-3">
            {callLogs.map((n,idx) => {
              const lines=(n.text||"").split("\n");
              const outcome=lines[0].replace("📞 CALL — ","");
              const notesTxt=lines.find((l)=>l.startsWith("Notes:"))?.replace("Notes: ","");
              const booked=lines.some((l)=>l.includes("Booked for counselling"));
              return (
                <div key={idx} className="border rounded-xl p-3" style={{ borderColor:"#E5EAF3" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <PhoneCall size={13} style={{ color:T.blue }}/>
                    <span className="text-xs font-bold flex-1" style={{ color:T.blue }}>{outcome}</span>
                    {booked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Booked ✓</span>}
                    <span className="text-[11px] text-slate-400 num">{new Date(n.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>
                  </div>
                  {notesTxt && <p className="text-sm text-slate-600 ml-5">{notesTxt}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SESSIONS TAB */}
      {ptab==="session" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><Video size={15} style={{ color:"#8B5CF6" }}/> Counselling sessions</h2>
            <button onClick={() => setShowSessionModal(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{ background:"#8B5CF6" }}><Plus size={12}/> Log session</button>
          </div>
          <div className="flex gap-3 mb-5">
            <a href={`https://meet.google.com/new`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm flex-1 justify-center" style={{ background:"#EEF2FF", color:"#4F46E5" }}><Video size={15}/> Start Google Meet</a>
            <a href={`https://zoom.us/start/videomeeting`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm flex-1 justify-center" style={{ background:"#EFF6FF", color:"#2563EB" }}><Video size={15}/> Start Zoom</a>
          </div>
          {sessionLogs.length===0 && <p className="text-sm text-slate-400">No sessions logged yet. Use "Log session" after every Google Meet or Zoom call.</p>}
          <div className="space-y-3">
            {sessionLogs.map((n,idx) => {
              const lines=(n.text||"").split("\n");
              const platform=lines[0].replace("🎓 COUNSELLING SESSION — ","");
              const duration=lines.find((l)=>l.startsWith("Duration:"))?.replace("Duration: ","");
              const outcome=lines.find((l)=>l.startsWith("Outcome:"))?.replace("Outcome: ","");
              const notesTxt=lines.find((l)=>l.startsWith("Notes:"))?.replace("Notes: ","");
              return (
                <div key={idx} className="border rounded-xl p-3" style={{ borderColor:"#E5EAF3" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Video size={13} style={{ color:"#8B5CF6" }}/>
                    <span className="text-xs font-bold flex-1" style={{ color:"#8B5CF6" }}>{platform} · {duration}</span>
                    <span className="text-[11px] text-slate-400 num">{new Date(n.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>
                  </div>
                  {outcome && <p className="text-xs font-semibold text-slate-700 ml-5 mb-1">{outcome}</p>}
                  {notesTxt && <p className="text-sm text-slate-600 ml-5">{notesTxt}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {ptab==="overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Personal profile</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Gender<select value={s.gender||""} onChange={(e) => onUpdate(s.id,{gender:e.target.value})} style={inp}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></label>
              <label className="text-xs font-semibold text-slate-500">Date of birth<input type="date" value={s.dob||""} onChange={(e) => onUpdate(s.id,{dob:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Nationality<input value={s.nationality||""} onChange={(e) => onUpdate(s.id,{nationality:e.target.value})} placeholder="India" style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">City<input value={s.city||""} onChange={(e) => onUpdate(s.id,{city:e.target.value})} placeholder="Agra" style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Email<input value={s.email||""} onChange={(e) => onUpdate(s.id,{email:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Mobile<input value={s.phone||""} onChange={(e) => onUpdate(s.id,{phone:e.target.value})} style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Quick comment</h2>
            <div className="flex gap-2">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&noteText.trim()) { onAddNote(s.id,noteText); setNoteText(""); } }}
                placeholder="Add a comment…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{ borderColor:"#CBD5E1" }}/>
              <button onClick={() => { if(noteText.trim()) { onAddNote(s.id,noteText); setNoteText(""); } }} className="px-3 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}>Add</button>
            </div>
            {otherNotes.slice(0,3).map((n,idx) => (
              <div key={idx} className="text-xs text-slate-500 border-l-2 pl-2 py-0.5 truncate" style={{ borderColor:"#0d6efd55" }}>{n.text}</div>
            ))}
          </div>
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Consent & engagement</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_tc} onChange={(e) => onUpdate(s.id,{consent_tc:e.target.checked})} className="w-4 h-4"/> T&C</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_mkt} onChange={(e) => onUpdate(s.id,{consent_mkt:e.target.checked})} className="w-4 h-4"/> Marketing</label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">How did you hear?<select value={s.hear_source||""} onChange={(e) => onUpdate(s.id,{hear_source:e.target.value})} style={inp}><option value="">—</option>{HEAR_SOURCES.map((h) => <option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Financial source<select value={s.fin_source||""} onChange={(e) => onUpdate(s.id,{fin_source:e.target.value})} style={inp}><option value="">—</option>{FIN_SOURCES.map((h) => <option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Field of study<select value={s.field||""} onChange={(e) => onUpdate(s.id,{field:e.target.value})} style={inp}>{FIELDS.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
        </div>
      )}

      {/* APPLICATIONS TAB */}
      {ptab==="apps" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3">Course applications</h2>
          {(isAdmin||isCounsellor) && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
              <input value={appForm.course} onChange={(e) => setAppForm({...appForm,course:e.target.value})} placeholder="Course" style={{...inp,marginTop:0}} className="lg:col-span-2"/>
              <input value={appForm.institution} onChange={(e) => setAppForm({...appForm,institution:e.target.value})} placeholder="Institution" style={{...inp,marginTop:0}}/>
              <input type="date" value={appForm.commence_date} onChange={(e) => setAppForm({...appForm,commence_date:e.target.value})} style={{...inp,marginTop:0}}/>
              <button onClick={() => { if(appForm.course.trim()) { onAddApp(s.id,appForm); setAppForm({course:"",institution:"",commence_date:"",status:"Application Preparation"}); } }} className="py-2 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}>+ Add</button>
            </div>
          )}
          {apps.length===0 && <p className="text-sm text-slate-400">No applications yet.</p>}
          <div className="space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border" style={{ borderColor:"#E5EAF3" }}>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-sm">{a.course}</div>
                  <div className="text-[11px] text-slate-500">{a.institution||"—"}{a.commence_date?` · starts ${a.commence_date}`:""}</div>
                </div>
                <select value={a.status} onChange={(e) => onUpdateApp(s.id,a.id,{...a,status:e.target.value})} className="text-xs font-semibold py-1.5 px-2 rounded-lg border bg-white" style={{ borderColor:"#CBD5E1" }}>
                  {APP_STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
                {isAdmin && <button onClick={() => onDeleteApp(s.id,a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {ptab==="docs" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-1">Document checklist</h2>
          <p className="text-[11px] text-slate-400 mb-3">Click status to cycle: Pending → Received → Verified.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor:"#E5EAF3" }}>
                <span className="text-sm flex-1">{d.name}</span>
                <button onClick={() => onCycleDoc(s.id,d.id,d.status,d.name)} className="text-[10px] font-bold px-2 py-1 rounded-lg text-white" style={{ background:DOC_COLORS[d.status] }}>{d.status}</button>
                {isAdmin && <button onClick={() => onDeleteDoc(s.id,d.id)} className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><X size={12}/></button>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newDoc} onChange={(e) => setNewDoc(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&newDoc.trim()) { onAddDoc(s.id,newDoc.trim()); setNewDoc(""); } }} placeholder="Add document…" style={{...inp,marginTop:0}} className="flex-1"/>
            <button onClick={() => { if(newDoc.trim()) { onAddDoc(s.id,newDoc.trim()); setNewDoc(""); } }} className="px-4 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}>Add</button>
          </div>
        </div>
      )}

      {/* NOTES TAB */}
      {ptab==="notes" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><StickyNote size={15} style={{ color:"#F59E0B" }}/> Counselling notes</h2>
          <div className="flex gap-2 mb-4">
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter") { onAddNote(s.id,noteText); setNoteText(""); } }}
              placeholder="Add a counselling note…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{ borderColor:"#CBD5E1" }}/>
            <button onClick={() => { onAddNote(s.id,noteText); setNoteText(""); }} className="px-4 rounded-xl text-white text-sm font-semibold" style={{ background:T.blue }}>Add</button>
          </div>
          {otherNotes.length===0 && <p className="text-sm text-slate-400">No notes yet.</p>}
          <div className="space-y-2">
            {otherNotes.map((n,idx) => (
              <div key={idx} className="flex gap-3 items-start text-sm border-l-2 pl-3 py-1" style={{ borderColor:"#0d6efd55" }}>
                <span className="text-[11px] text-slate-400 shrink-0 mt-0.5 w-24 num">{fmtDT(n.created_at||Date.now())}</span>
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
function AddStudentModal({ team, isBDE, currentUser, onClose, onSave }) {
  const [f,setF] = useState({
    name:"", phone:"", email:"", level:"PG", country:"UK", intake:"September",
    field:FIELDS[0], qualification:"Warm",
    // BDE auto-assigns to themselves, stage stays as lead for admin to assign counsellor
    assigned_to: isBDE ? currentUser.id : "",
    stage:"lead",
  });
  const set = (k) => (e) => setF((p) => ({...p,[k]:e.target.value}));
  return (
    <Modal title={isBDE?"Add new lead":"New lead"} onClose={onClose}>
      {isBDE && (
        <div className="mb-3 p-3 rounded-xl text-xs font-semibold" style={{ background:"#CCFBF1", color:"#134E4A" }}>
          ✓ This lead will be added under your name. Admin will assign a counsellor for the session.
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *"><input value={f.name} onChange={set("name")} style={inp} placeholder="Student name"/></Field>
        <Field label="Mobile *"><input value={f.phone} onChange={set("phone")} style={inp} placeholder="+91 …"/></Field>
        <Field label="Email"><input value={f.email} onChange={set("email")} style={inp}/></Field>
        <Field label="Level"><select value={f.level} onChange={set("level")} style={inp}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Country"><select value={f.country} onChange={set("country")} style={inp}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Intake"><select value={f.intake} onChange={set("intake")} style={inp}>{INTAKES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Field"><select value={f.field} onChange={set("field")} style={inp}>{FIELDS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Qualification"><select value={f.qualification} onChange={set("qualification")} style={inp}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field>
        {!isBDE && (
          <Field label="Assign to"><select value={f.assigned_to} onChange={set("assigned_to")} style={inp}><option value="">Unassigned</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}</select></Field>
        )}
      </div>
      <button disabled={!f.name.trim()||!f.phone.trim()} onClick={() => onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ background:isBDE?T.teal:"#0d6efd" }}>Save lead</button>
    </Modal>
  );
}

function AddTeamModal({ onClose, onSave }) {
  const [f,setF] = useState({ name:"", role:"Counsellor", country:"—" });
  return (
    <Modal title="Add team member" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name *"><input value={f.name} onChange={(e) => setF({...f,name:e.target.value})} style={inp} placeholder="Full name"/></Field>
        <Field label="Role"><select value={f.role} onChange={(e) => setF({...f,role:e.target.value})} style={inp}>{Object.keys(ROLE_META).filter((r)=>r!=="Admin").map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Country desk"><select value={f.country} onChange={(e) => setF({...f,country:e.target.value})} style={inp}><option>—</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <button disabled={!f.name.trim()} onClick={() => onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{ background:ROLE_META[f.role]?.color||"#0d6efd" }}>Add {f.role}</button>
    </Modal>
  );
}

function SecuritySection({ security, onSave }) {
  const [p,setP]=useState(""); const [a,setA]=useState(""); const [x,setX]=useState(""); const [err,setErr]=useState("");
  const hp = (s) => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
  const save = () => {
    if (!p&&!a&&!x) { setErr("Type at least one password."); return; }
    const next={...security};
    if (p) next.appPass=hp(p); if (a) next.adminPass=hp(a); if (x) next.exportPass=hp(x);
    if (next.adminPass&&next.exportPass&&next.adminPass===next.exportPass) { setErr("Export password must differ from admin."); return; }
    setErr(""); onSave(next); setP(""); setA(""); setX("");
  };
  return (
    <div className="p-3 rounded-xl border space-y-3" style={{ borderColor:"#E5EAF3" }}>
      <div className="font-semibold text-sm">🔒 Passwords</div>
      {[["App password",p,setP,security.appPass],["Admin password",a,setA,security.adminPass],["Export password",x,setX,security.exportPass]].map(([label,val,setVal,isSet]) => (
        <label key={label} className="block text-xs font-semibold text-slate-500">{label} {isSet?<span className="text-green-600">· set ✓</span>:<span className="text-slate-400">· not set</span>}
          <input type="password" value={val} onChange={(e) => setVal(e.target.value)} placeholder={isSet?"Type to change":"Create password"} style={inp}/>
        </label>
      ))}
      {err && <p className="text-[11px] font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold" style={{ background:"#0d6efd" }}>Save passwords</button>
        {(security.adminPass||security.exportPass||security.appPass) && <button onClick={() => { onSave({adminPass:"",exportPass:"",appPass:""}); }} className="px-3 py-2 rounded-xl border text-xs font-semibold text-slate-500" style={{ borderColor:"#E5EAF3" }}>Remove all</button>}
      </div>
    </div>
  );
}

function ImportModal({ team, onClose, onImport }) {
  const [parsed,setParsed]=useState(null); const [error,setError]=useState("");
  const norm = (k) => String(k).toLowerCase().replace(/[^a-z]/g,"");
  const handleFile = async (e) => {
    const file=e.target.files?.[0]; if (!file) return;
    try {
      const buf=await file.arrayBuffer(); const wb=XLSX.read(buf);
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      const recs=rows.map((r) => {
        const g={}; Object.keys(r).forEach((k) => { g[norm(k)]=String(r[k]).trim(); });
        const name=g.name||g.fullname||""; if (!name) return null;
        const stageLabel=(g.stage||"").toLowerCase();
        const stage=stageLabel?(STAGES.find((s) => s.label.toLowerCase().includes(stageLabel))?.id||"lead"):"lead";
        const assignedName=(g.assignedto||g.counsellor||"").toLowerCase();
        const assigned_to=team.find((t) => t.name.toLowerCase()===assignedName)?.id||"";
        const lvl=(g.level||"").toUpperCase();
        const qual=["hot","warm","cold"].includes((g.qualification||"").toLowerCase())?(g.qualification[0].toUpperCase()+g.qualification.slice(1).toLowerCase()):"";
        return { name,phone:g.phone||g.mobile||"",email:g.email||"",level:LEVELS.includes(lvl)?lvl:"PG",country:COUNTRIES.find((c)=>c.toLowerCase()===(g.country||"").toLowerCase())||(g.country||"UK"),intake:INTAKES.find((m)=>m.toLowerCase()===(g.intake||"").toLowerCase())||"Other",field:g.fieldofstudy||g.field||"Other",stage,assigned_to,qualification:qual,follow_up:g.followup||"" };
      }).filter(Boolean);
      if (!recs.length) { setError("No valid rows found."); return; }
      setError(""); setParsed(recs);
    } catch { setError("Could not read file."); }
  };
  return (
    <Modal title="Import leads from Excel" onClose={onClose}>
      <label className="block w-full p-6 rounded-xl border-2 border-dashed border-slate-300 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30">
        <Upload size={22} className="mx-auto text-slate-400"/>
        <span className="block text-sm font-semibold mt-2">Choose Excel or CSV file</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden"/>
      </label>
      {error && <p className="text-[11px] font-semibold text-red-500 mt-2">{error}</p>}
      {parsed && (
        <div className="mt-3 p-3 rounded-xl border border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-700">Found {parsed.length} leads ✓</p>
          <button onClick={() => onImport(parsed)} className="mt-3 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background:"#16A34A" }}>Import {parsed.length} leads</button>
        </div>
      )}
    </Modal>
  );
}

function ModalBtn({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 text-left" style={{ borderColor:"#E5EAF3" }}>
      {icon}<span><span className="font-semibold text-sm block">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </button>
  );
}
function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-500">{label}{children}</label>; }
function Modal({ title, children, onClose }) {
  useEffect(()=>{ const h=(e)=>{ if(e.key==="Escape") onClose(); }; window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(10,31,61,0.55)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const T_export = T;
