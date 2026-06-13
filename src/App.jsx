import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, LayoutDashboard, KanbanSquare, UserPlus, Phone, Mail,
  ChevronRight, ChevronLeft, Search, X, Plus, Trash2, CalendarClock,
  GraduationCap, Globe2, BadgeCheck, Briefcase, StickyNote, Loader2,
  Download, Settings as Cog, Send, FileSpreadsheet, Upload, Lock,
  MessageCircle, PhoneCall, Flame, ArrowRight, Wifi, WifiOff, RefreshCw,
  LogOut, Eye, EyeOff, Video, AlertCircle, Calendar, Clock, ChevronDown
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  addNote as dbAddNote, upsertApplication, deleteApplication,
  upsertDocument, deleteDocument,
  getTeam, createTeamMember, deleteTeamMember,
  getSlots, createSlot, bookSlot, freeSlot,
  bulkInsertStudents, getSetting, setSetting
} from "./lib/db";

/* ════ TOKENS ════ */
const T = { ink:"#0A1F3D", blue:"#0d6efd", saffron:"#F59E0B", mist:"#F5F7FB", line:"#E5EAF3", ok:"#16A34A", danger:"#DC2626", teal:"#14B8A6", purple:"#8B5CF6" };

/* ════ ROLE CONFIG ════ */
const ROLE_META = {
  Admin:         { color:"#F59E0B", badge:"#FEF3C7", tx:"#92400E", canCreate:true,  canAssign:true,  canAdvance:true,  canDelete:true  },
  BDE:           { color:"#14B8A6", badge:"#CCFBF1", tx:"#134E4A", canCreate:true,  canAssign:false, canAdvance:false, canDelete:false },
  Counsellor:    { color:"#0d6efd", badge:"#DBEAFE", tx:"#1E40AF", canCreate:false, canAssign:false, canAdvance:true,  canDelete:false },
  "Visa Officer":{ color:"#EF4444", badge:"#FEE2E2", tx:"#991B1B", canCreate:false, canAssign:false, canAdvance:true,  canDelete:false },
};

/* ════ CONSTANTS ════ */
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
const CALL_OUTCOMES = [
  "Not reachable",
  "No answer — callback later",
  "Busy — try again",
  "Wrong number",
  "Not interested",
  "Interested — follow-up needed",
  "Counselling booked ✓",
  "WhatsApp message sent",
];
const MEET_TYPES = ["Google Meet","Zoom","Microsoft Teams","Phone call","In-person"];
const SLOT_TIMES = ["11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
const WA_COMPANY = "https://wa.me/"; // replace with company WhatsApp number

/* ════ HELPERS ════ */
const hashPw    = (s) => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
const stageIdx  = (id) => STAGES.findIndex((s) => s.id===id);
const stageOf   = (id) => STAGES[stageIdx(id)] || STAGES[0];
const fmtDT     = (ts) => new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtDate   = (d) => new Date(d).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
const qualColor = (q) => QUALS.find((x) => x.id===q)?.color || "#64748B";
const waNum     = (p) => "https://wa.me/"+String(p||"").replace(/[^0-9]/g,"");
const isOverdue = (s) => s.follow_up && new Date(s.follow_up) < new Date(new Date().toDateString());
const inp       = { width:"100%", padding:"9px 12px", borderRadius:12, border:"1px solid #CBD5E1", fontSize:14, background:"#fff", marginTop:4, fontWeight:500 };
const todayStr  = () => new Date().toISOString().slice(0,10);

/* ════ ROOT ════ */
export default function App() {
  const [tab,setTab]               = useState("dashboard");
  const [students,setStudents]     = useState([]);
  const [team,setTeam]             = useState([]);
  const [slots,setSlots]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const [dbOk,setDbOk]             = useState(true);
  const [syncing,setSyncing]       = useState(false);
  const [currentUser,setCurrentUser] = useState(null);
  const [query,setQuery]           = useState("");
  const [globalQ,setGlobalQ]       = useState("");
  const [filterStage,setFilterStage]   = useState("all");
  const [filterCountry,setFilterCountry] = useState("all");
  const [filterQual,setFilterQual] = useState("all");
  const [selected,setSelected]     = useState(null);
  const [showAdd,setShowAdd]       = useState(false);
  const [showAddTeam,setShowAddTeam] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showExport,setShowExport] = useState(false);
  const [showImport,setShowImport] = useState(false);
  const [showAddSlot,setShowAddSlot] = useState(false);
  const [exportPass,setExportPass] = useState("");
  const [showExportPass,setShowExportPass] = useState(false);
  const [webhookUrl,setWebhookUrl] = useState("");
  const [security,setSecurity]     = useState({ adminPass:"", exportPass:"", appPass:"" });
  const [toast,setToast]           = useState("");

  const notify = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  /* ── Load ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s,t,sl,wh,sec] = await Promise.all([getStudents(),getTeam(),getSlots(),getSetting("webhookUrl"),getSetting("security")]);
      setStudents(s); setTeam(t); setSlots(sl||[]);
      if (wh) setWebhookUrl(wh);
      if (sec) setSecurity({ adminPass:"", exportPass:"", appPass:"", ...sec });
      setDbOk(true);
    } catch(e) { console.error(e); setDbOk(false); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Role helpers ── */
  const role      = currentUser?.role || "Admin";
  const isAdmin   = role === "Admin";
  const isBDE     = role === "BDE";
  const isCounsel = role === "Counsellor";
  const rm        = ROLE_META[role] || ROLE_META.Admin;
  const counsellors = team.filter((t) => t.role==="Counsellor");

  /* ── Visible students ── */
  const visibleStudents = useMemo(() => {
    if (!currentUser || isAdmin) return students;
    if (isBDE) return students.filter((s) => s.assigned_to===currentUser.id && s.stage==="lead");
    if (isCounsel) return students.filter((s) => s.assigned_to===currentUser.id && ["counsel","shortlist","applied","offer","finance"].includes(s.stage));
    if (role==="Visa Officer") return students.filter((s) => s.assigned_to===currentUser.id && ["visa","predep","departed"].includes(s.stage));
    return [];
  }, [students, currentUser, isAdmin, isBDE, isCounsel, role]);

  const pendingAssignment = useMemo(() => students.filter((s) => s.stage==="lead" && !s.assigned_to), [students]);
  const readyForCounsel   = useMemo(() => students.filter((s) => s.stage==="counsel" && s.assigned_to && !counsellors.find((c)=>c.id===s.assigned_to)), [students, counsellors]);
  const memberName = (id) => team.find((t) => t.id===id)?.name || "";
  const memberRole = (id) => team.find((t) => t.id===id)?.role || "";

  const filtered = useMemo(() => visibleStudents.filter((s) => {
    const q=query.trim().toLowerCase();
    if (q && !`${s.name} ${s.email} ${s.phone} ${s.country}`.toLowerCase().includes(q)) return false;
    if (filterStage!=="all" && s.stage!==filterStage) return false;
    if (filterCountry!=="all" && s.country!==filterCountry) return false;
    if (filterQual!=="all" && s.qualification!==filterQual) return false;
    return true;
  }), [visibleStudents, query, filterStage, filterCountry, filterQual]);

  const searchHits = useMemo(() => {
    const q=globalQ.trim().toLowerCase();
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
    try { setSyncing(true); const u=await updateStudent(id,patch); setStudents((p)=>p.map((s)=>s.id===id?{...s,...u}:s)); }
    catch(e) { notify("Save failed — check connection"); console.error(e); }
    finally { setSyncing(false); }
  };
  const moveStage = async (id, dir) => {
    const s=students.find((x)=>x.id===id); if (!s) return;
    const i=Math.min(STAGES.length-1,Math.max(0,stageIdx(s.stage)+dir));
    await updStudent(id,{stage:STAGES[i].id});
  };
  const doAddNote = async (studentId, text) => {
    if (!text?.trim()) return;
    try { const n=await dbAddNote(studentId,text.trim()); setStudents((p)=>p.map((s)=>s.id===studentId?{...s,notes:[n,...(s.notes||[])]}:s)); }
    catch(e) { notify("Could not save note"); }
  };
  const assignToBDE = async (studentId, bdeId) => {
    await updStudent(studentId, { assigned_to:bdeId });
    notify(`Lead assigned to ${memberName(bdeId)} ✓`);
  };
  const assignCounsellor = async (studentId, counsellorId) => {
    await updStudent(studentId, { assigned_to:counsellorId, stage:"counsel" });
    await doAddNote(studentId, `✅ Assigned to ${memberName(counsellorId)} for counselling session.`);
    notify(`Assigned to ${memberName(counsellorId)} ✓`);
  };
  const doAddStudent = async (form) => {
    try {
      const rec = await createStudent(form);
      await Promise.all(DEFAULT_DOCS.map((n) => upsertDocument({student_id:rec.id,name:n,status:"Pending"})));
      const refreshed = await getStudents(); setStudents(refreshed);
      setShowAdd(false); notify("Lead saved ✓");
    } catch(e) { console.error(e); notify("Could not save lead: "+e.message); }
  };
  const doDeleteStudent = async (id) => {
    try { await deleteStudent(id); setStudents((p)=>p.filter((s)=>s.id!==id)); setSelected(null); }
    catch(e) { notify("Delete failed"); }
  };
  const doAddApp = async (sid, f) => {
    try { const a=await upsertApplication({student_id:sid,...f}); setStudents((p)=>p.map((s)=>s.id===sid?{...s,applications:[a,...(s.applications||[])]}:s)); }
    catch(e) { notify("Could not save application"); }
  };
  const doUpdateApp = async (sid, aid, f) => {
    try { const a=await upsertApplication({id:aid,student_id:sid,...f}); setStudents((p)=>p.map((s)=>s.id===sid?{...s,applications:(s.applications||[]).map((x)=>x.id===aid?a:x)}:s)); }
    catch(e) { notify("Could not update application"); }
  };
  const doDeleteApp = async (sid,aid) => {
    try { await deleteApplication(aid); setStudents((p)=>p.map((s)=>s.id===sid?{...s,applications:(s.applications||[]).filter((x)=>x.id!==aid)}:s)); }
    catch(e) { notify("Could not delete"); }
  };
  const doCycleDoc = async (sid,did,cur,name) => {
    const next=DOC_STATUSES[(DOC_STATUSES.indexOf(cur)+1)%DOC_STATUSES.length];
    try { const d=await upsertDocument({id:did,student_id:sid,name,status:next}); setStudents((p)=>p.map((s)=>s.id===sid?{...s,documents:(s.documents||[]).map((x)=>x.id===did?d:x)}:s)); }
    catch(e) { notify("Could not update document"); }
  };
  const doAddDoc = async (sid,name) => {
    try { const d=await upsertDocument({student_id:sid,name,status:"Pending"}); setStudents((p)=>p.map((s)=>s.id===sid?{...s,documents:[...(s.documents||[]),d]}:s)); }
    catch(e) { notify("Could not add document"); }
  };
  const doDeleteDoc = async (sid,did) => {
    try { await deleteDocument(did); setStudents((p)=>p.map((s)=>s.id===sid?{...s,documents:(s.documents||[]).filter((x)=>x.id!==did)}:s)); }
    catch(e) { notify("Could not delete document"); }
  };
  const doAddTeam = async (m) => {
    try { const r=await createTeamMember(m); setTeam((p)=>[...p,r]); setShowAddTeam(false); }
    catch(e) { notify("Could not add team member"); }
  };
  const doDeleteTeam = async (id) => {
    try { await deleteTeamMember(id); setTeam((p)=>p.filter((t)=>t.id!==id)); }
    catch(e) { notify("Could not delete"); }
  };
  const doAddSlot = async (f) => {
    try { const s=await createSlot(f); setSlots((p)=>[...p,s]); setShowAddSlot(false); notify("Slot added ✓"); }
    catch(e) { notify("Could not add slot"); }
  };
  const doBookSlot = async (slotId, studentId) => {
    try { const s=await bookSlot(slotId,studentId); setSlots((p)=>p.map((x)=>x.id===slotId?s:x)); notify("Slot booked ✓"); }
    catch(e) { notify("Could not book slot"); }
  };
  const doSaveSettings = async (sec) => {
    setSecurity(sec);
    try { await setSetting("security",sec); notify("Settings saved ✓"); }
    catch(e) { notify("Could not save settings"); }
  };
  const doBulkImport = async (rows) => {
    try { await bulkInsertStudents(rows); const r=await getStudents(); setStudents(r); setShowImport(false); notify(`Imported ${rows.length} leads ✓`); }
    catch(e) { notify("Import failed: "+e.message); }
  };

  /* ── Export ── */
  const exportRows = () => students.map((s)=>({ Date:new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),Name:s.name,Phone:s.phone,Email:s.email||"",Qualification:s.qualification||"",Level:s.level,Country:s.country,Intake:s.intake,"Field of Study":s.field,Stage:stageOf(s.stage).label,"Assigned To":memberName(s.assigned_to),"Follow Up":s.follow_up||"" }));
  const doExport = (type) => {
    if (security.exportPass) {
      if (!exportPass) { setShowExportPass(true); return; }
      if (hashPw(exportPass) !== security.exportPass) { notify("Wrong export password"); setExportPass(""); return; }
    }
    if (type==="excel") { const ws=XLSX.utils.json_to_sheet(exportRows()); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Leads"); XLSX.writeFile(wb,"abroadveda-leads.xlsx"); notify("Excel downloaded ✓"); }
    else { const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows())); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="abroadveda-leads.csv"; a.click(); notify("CSV downloaded ✓"); }
    setExportPass(""); setShowExportPass(false); setShowExport(false);
  };
  const sendToSheet = async () => {
    if (!webhookUrl) { notify("Add Google Sheets link in Settings"); return; }
    try { await fetch(webhookUrl,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},body:JSON.stringify({rows:students.map((s)=>[s.name,s.phone,s.email||"",s.country,stageOf(s.stage).label,memberName(s.assigned_to)])})}); notify("Sent to Google Sheets ✓"); }
    catch { notify("Could not reach Google Sheets"); }
  };

  const openStudent = (id) => { setTab("students"); setSelected(id); setGlobalQ(""); };

  /* ── Screens ── */
  if (loading) return <Splash text="Connecting to database…"/>;
  if (!dbOk)   return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:T.mist}}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-lg text-center">
        <WifiOff size={36} className="text-red-400 mx-auto mb-3"/>
        <h2 className="font-extrabold text-lg mb-2">Database not connected</h2>
        <p className="text-sm text-slate-500 mb-4">Check your Supabase keys in GitHub Secrets.</p>
        <button onClick={loadAll} className="w-full py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2" style={{borderColor:T.line}}><RefreshCw size={14}/> Retry</button>
      </div>
    </div>
  );
  if (!currentUser) return <LoginScreen team={team} security={security} onLogin={setCurrentUser}/>;

  const selectedStudent = students.find((s)=>s.id===selected);
  const NAV = [["dashboard",LayoutDashboard,"Dashboard"],["pipeline",KanbanSquare,"Pipeline"],["students",Users,"Students"],...(isAdmin||isCounsel?[["slots",Calendar,"Slots"]]:isBDE?[["slots",Calendar,"Book Slot"]]:[]),...(isAdmin?[["team",Briefcase,"Team"]]:[])] ;

  return (
    <div className="min-h-screen" style={{background:T.mist,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",color:T.ink}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:6px}
        input:focus,select:focus,textarea:focus{outline:2px solid #0d6efd33;border-color:#0d6efd !important}
        .num{font-variant-numeric:tabular-nums}
        .card{background:#fff;border:1px solid ${T.line};border-radius:18px;box-shadow:0 1px 3px rgba(10,31,61,.05)}
        .lift{transition:box-shadow .15s,transform .15s}.lift:hover{box-shadow:0 6px 20px rgba(10,31,61,.09);transform:translateY(-1px)}
        a{text-decoration:none}
      `}</style>

      {/* SIDEBAR */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-40 px-4 py-5" style={{background:T.ink}}>
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
          <div><div className="font-extrabold text-white text-sm tracking-wide">ABROAD VEDA</div><div className="text-[9px] text-blue-200/70 tracking-widest uppercase">CRM Workspace</div></div>
        </div>
        <div className="mt-4 mx-1 px-3 py-2 rounded-xl bg-white/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{background:ROLE_META[role]?.color}}>{currentUser.name[0]}</div>
          <div className="flex-1 min-w-0"><div className="text-white text-xs font-semibold truncate">{currentUser.name}</div><div className="text-[10px]" style={{color:ROLE_META[role]?.color}}>{role}</div></div>
          <button onClick={()=>setCurrentUser(null)} className="p-1 rounded-lg hover:bg-white/10 text-blue-200/60 hover:text-white"><LogOut size={13}/></button>
        </div>
        <nav className="mt-5 space-y-1">
          {NAV.map(([id,Icon,label])=>(
            <button key={id} onClick={()=>{setTab(id);setSelected(null);}}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${tab===id?"text-slate-900 bg-white":"text-blue-100/80 hover:bg-white/10"}`}>
              <Icon size={17} style={tab===id?{color:T.blue}:{}}/>
              {label}
              {id==="students" && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md num" style={{background:tab===id?"#EAF2FF":"rgba(255,255,255,.12)",color:tab===id?T.blue:"#BFD7FF"}}>{visibleStudents.length}</span>}
              {id==="dashboard" && isAdmin && stats.pending>0 && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white num">{stats.pending}</span>}
            </button>
          ))}
        </nav>
        {rm.canCreate && (
          <button onClick={()=>setShowAdd(true)} className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90" style={{background:isBDE?T.teal:T.blue}}>
            <UserPlus size={16}/> {isBDE?"Add lead":"New lead"}
          </button>
        )}
        <div className="mt-auto space-y-1 pt-5 border-t border-white/10">
          {isAdmin && <button onClick={()=>setShowExport(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Download size={15}/> Export leads</button>}
          {isAdmin && <button onClick={()=>setShowImport(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Upload size={15}/> Import leads</button>}
          {isAdmin && <button onClick={()=>setShowSettings(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Cog size={15}/> Settings</button>}
          <div className="px-3 pt-1 text-[10px] text-blue-200/50 flex items-center gap-1.5">{syncing?<><Loader2 size={9} className="animate-spin"/> Syncing…</>:<><Wifi size={9}/> Live database</>}</div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3 border-b" style={{background:"rgba(245,247,251,.92)",backdropFilter:"blur(8px)",borderColor:T.line}}>
          <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
          <div className="relative flex-1 max-w-lg">
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400"/>
            <input value={globalQ} onChange={(e)=>setGlobalQ(e.target.value)} placeholder="Search student — name, phone, email…"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm bg-white" style={{borderColor:T.line}}/>
            {globalQ && <button onClick={()=>setGlobalQ("")} className="absolute right-3 top-3 text-slate-400"><X size={13}/></button>}
            {searchHits.length>0 && (
              <div className="absolute mt-1.5 w-full card overflow-hidden z-50">
                {searchHits.map((s)=>(
                  <button key={s.id} onClick={()=>openStudent(s.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50/50 text-left border-b last:border-0" style={{borderColor:T.line}}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{background:stageOf(s.stage).color}}>{s.name[0]}</span>
                    <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{s.name}</span><span className="block text-[11px] text-slate-400 num">{s.phone} · {stageOf(s.stage).label}</span></span>
                    <ArrowRight size={13} className="text-slate-300"/>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="hidden md:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:ROLE_META[role]?.badge,color:ROLE_META[role]?.tx}}>{role}</span>
          {rm.canCreate && <button onClick={()=>setShowAdd(true)} className="md:hidden p-2.5 rounded-xl text-white" style={{background:T.blue}}><UserPlus size={16}/></button>}
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full pb-24 md:pb-8">

          {/* DASHBOARD */}
          {tab==="dashboard" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">Namaste, {currentUser.name.split(" ")[0]} 🙏</h1>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} · <span style={{color:ROLE_META[role]?.color}}>{role} view</span></p>
              </div>

              {/* Admin: unassigned leads alert */}
              {isAdmin && pendingAssignment.length>0 && (
                <div className="card p-4 border-l-4" style={{borderLeftColor:T.danger}}>
                  <div className="flex items-center gap-2 mb-3"><AlertCircle size={17} style={{color:T.danger}}/><span className="font-bold text-sm">{pendingAssignment.length} lead{pendingAssignment.length!==1?"s":""} waiting for BDE or Counsellor assignment</span></div>
                  <div className="space-y-2">
                    {pendingAssignment.slice(0,5).map((s)=>(
                      <div key={s.id} className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50">
                        <button onClick={()=>openStudent(s.id)} className="font-semibold text-sm hover:underline">{s.name}</button>
                        <span className="text-[11px] text-slate-400 num">{s.phone} · {s.country}</span>
                        <div className="ml-auto flex gap-2">
                          <select defaultValue="" onChange={(e)=>e.target.value&&assignToBDE(s.id,e.target.value)} className="text-xs py-1.5 px-2 rounded-lg border bg-white font-medium" style={{borderColor:T.line}}>
                            <option value="" disabled>Assign BDE…</option>
                            {team.filter((t)=>t.role==="BDE").map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <select defaultValue="" onChange={(e)=>e.target.value&&assignCounsellor(s.id,e.target.value)} className="text-xs py-1.5 px-2 rounded-lg border bg-white font-medium" style={{borderColor:T.line}}>
                            <option value="" disabled>Assign Counsellor…</option>
                            {counsellors.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BDE workflow banner */}
              {isBDE && (
                <div className="card p-4" style={{borderLeft:`4px solid ${T.teal}`}}>
                  <p className="font-bold text-sm flex items-center gap-2 mb-2"><PhoneCall size={14} style={{color:T.teal}}/> Your workflow today</p>
                  <div className="flex flex-wrap gap-3">
                    {["1. Call student","2. Log call outcome","3. Book counselling slot","4. Add as new lead"].map((s,i)=>(
                      <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px]" style={{background:T.teal}}>{i+1}</span>{s.slice(3)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counsellor workflow banner */}
              {isCounsel && (
                <div className="card p-4" style={{borderLeft:`4px solid ${T.blue}`}}>
                  <p className="font-bold text-sm flex items-center gap-2 mb-2"><Video size={14} style={{color:T.blue}}/> Your workflow</p>
                  <div className="flex flex-wrap gap-3">
                    {["1. Admin assigns lead","2. Open student profile","3. Start Google Meet / Zoom","4. Log session","5. Advance stage"].map((s,i)=>(
                      <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px]" style={{background:T.blue}}>{i+1}</span>{s.slice(3)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[["Total",stats.total,T.blue],["Active",stats.active,"#6366F1"],["Offers",stats.offers,T.saffron],["Departed",stats.departed,T.ok],["Follow-ups",stats.followUps,T.danger]].map(([l,v,c])=>(
                  <button key={l} onClick={()=>setTab("students")} className="card lift p-4 text-left">
                    <div className="text-3xl font-extrabold num" style={{color:c}}>{v}</div>
                    <div className="text-xs font-semibold text-slate-500 mt-1">{l}</div>
                  </button>
                ))}
              </div>

              {/* Journey funnel */}
              <div className="card p-5">
                <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><GraduationCap size={16} style={{color:T.blue}}/> Student journey</h2>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {STAGES.map((st)=>{
                    const count=visibleStudents.filter((s)=>s.stage===st.id).length;
                    return (
                      <button key={st.id} onClick={()=>{setTab("students");setFilterStage(st.id);}} className="flex-1 min-w-[64px] group text-center">
                        <div className="text-lg font-extrabold num" style={{color:count?st.color:"#CBD5E1"}}>{count}</div>
                        <div className="h-2 rounded-full mt-1 transition group-hover:opacity-80" style={{background:count?st.color:"#E8EDF5"}}/>
                        <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">{st.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Follow-ups */}
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><CalendarClock size={15} style={{color:T.danger}}/> Follow-ups</h2>
                  {visibleStudents.filter((s)=>s.follow_up).sort((a,b)=>a.follow_up.localeCompare(b.follow_up)).slice(0,5).map((s)=>(
                    <div key={s.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{borderColor:T.line}}>
                      <button onClick={()=>openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate">{s.name}</span>
                        <span className={`text-[11px] font-bold ${isOverdue(s)?"text-red-600":"text-slate-400"}`}>{isOverdue(s)?"Overdue — ":""}{s.follow_up}</span>
                      </button>
                      <a href={`tel:${s.phone}`} className="p-2 rounded-xl hover:bg-blue-50" style={{color:T.blue}}><PhoneCall size={15}/></a>
                      <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-2 rounded-xl hover:bg-green-50 text-green-600"><MessageCircle size={15}/></a>
                    </div>
                  ))}
                  {!visibleStudents.some((s)=>s.follow_up) && <p className="text-sm text-slate-400">No follow-ups scheduled.</p>}
                </div>
                {/* Hot leads */}
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Flame size={15} style={{color:T.danger}}/> Hot leads</h2>
                  {visibleStudents.filter((s)=>s.qualification==="Hot"&&s.stage!=="departed").slice(0,5).map((s)=>(
                    <div key={s.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{borderColor:T.line}}>
                      <button onClick={()=>openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate hover:underline">{s.name}</span>
                        <span className="block text-[11px] text-slate-400">{stageOf(s.stage).label} · {s.country}</span>
                      </button>
                      <a href={`tel:${s.phone}`} className="p-2 rounded-xl hover:bg-blue-50" style={{color:T.blue}}><PhoneCall size={15}/></a>
                      <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-2 rounded-xl hover:bg-green-50 text-green-600"><MessageCircle size={15}/></a>
                    </div>
                  ))}
                  {!visibleStudents.some((s)=>s.qualification==="Hot"&&s.stage!=="departed") && <p className="text-sm text-slate-400">No hot leads in your view.</p>}
                </div>
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {tab==="pipeline" && (
            <div>
              <h1 className="text-xl font-extrabold mb-4">Application pipeline</h1>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {STAGES.map((st)=>{
                  const col=visibleStudents.filter((s)=>s.stage===st.id);
                  return (
                    <div key={st.id} className="w-60 shrink-0 rounded-2xl p-3" style={{background:"#ECF1F9"}}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{background:st.color}}/>
                        <span className="text-xs font-bold">{st.label}</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 num">{col.length}</span>
                      </div>
                      <div className="space-y-2 min-h-[40px]">
                        {col.length===0 && <div className="text-[11px] text-slate-400 text-center py-3 rounded-xl border border-dashed" style={{borderColor:"#CBD5E1"}}>Empty</div>}
                        {col.map((s)=>(
                          <div key={s.id} className="card lift p-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={()=>openStudent(s.id)} className="font-semibold text-sm hover:underline text-left truncate flex-1">{s.name}</button>
                              {s.qualification && <span className="w-2 h-2 rounded-full shrink-0" style={{background:qualColor(s.qualification)}}/>}
                            </div>
                            <div className="text-[11px] text-slate-500">{memberName(s.assigned_to)||"Unassigned"}</div>
                            <div className="flex items-center gap-1 mt-2">
                              {rm.canAdvance && <button onClick={()=>moveStage(s.id,-1)} disabled={stageIdx(s.stage)===0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20"><ChevronLeft size={13}/></button>}
                              <a href={`tel:${s.phone}`} className="flex-1 flex justify-center p-1.5 rounded hover:bg-blue-50" style={{color:T.blue}}><PhoneCall size={13}/></a>
                              <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-green-50 text-green-600"><MessageCircle size={13}/></a>
                              {rm.canAdvance && <button onClick={()=>moveStage(s.id,1)} disabled={stageIdx(s.stage)===STAGES.length-1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20" style={{color:T.blue}}><ChevronRight size={13}/></button>}
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

          {/* STUDENTS LIST */}
          {tab==="students" && !selectedStudent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <h1 className="text-xl font-extrabold mr-auto">Students</h1>
                {rm.canCreate && <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{background:isBDE?T.teal:T.blue}}><UserPlus size={14}/> Add lead</button>}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-400"/>
                  <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Filter…" className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-white" style={{borderColor:T.line}}/>
                </div>
                <select value={filterQual} onChange={(e)=>setFilterQual(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All quals</option>{QUALS.map((q)=><option key={q.id} value={q.id}>{q.id}</option>)}</select>
                <select value={filterStage} onChange={(e)=>setFilterStage(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All stages</option>{STAGES.map((s)=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
                <select value={filterCountry} onChange={(e)=>setFilterCountry(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All countries</option>{COUNTRIES.map((c)=><option key={c}>{c}</option>)}</select>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b" style={{borderColor:T.line}}>
                    <th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Stage</th><th className="p-3">Assigned</th><th className="p-3">Follow-up</th><th className="p-3">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((s)=>{
                      const st=stageOf(s.stage);
                      return (
                        <tr key={s.id} onClick={()=>setSelected(s.id)} className="border-b last:border-0 hover:bg-blue-50/40 cursor-pointer" style={{borderColor:"#F0F4FA"}}>
                          <td className="p-3">
                            <div className="font-semibold flex items-center gap-2">{s.name}
                              {s.qualification && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:qualColor(s.qualification)+"1A",color:qualColor(s.qualification)}}>{s.qualification}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 num">{s.phone}</div>
                          </td>
                          <td className="p-3 text-xs">{s.level} · {s.country}<div className="text-slate-400">{s.field}</div></td>
                          <td className="p-3"><span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{background:st.color+"15",color:st.color}}>{st.label}</span></td>
                          <td className="p-3 text-xs">{memberName(s.assigned_to)||<span className="text-red-500 font-semibold text-[11px]">Unassigned</span>}</td>
                          <td className="p-3 text-xs num">{s.follow_up?<span className={isOverdue(s)?"font-bold text-red-600":""}>{s.follow_up}</span>:<span className="text-slate-300">—</span>}</td>
                          <td className="p-3" onClick={(e)=>e.stopPropagation()}>
                            <div className="flex gap-1">
                              <a href={`tel:${s.phone}`} className="p-1.5 rounded-lg hover:bg-blue-50" style={{color:T.blue}} title="Call"><PhoneCall size={14}/></a>
                              <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="WhatsApp"><MessageCircle size={14}/></a>
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

          {/* STUDENT DETAIL */}
          {tab==="students" && selectedStudent && (
            <StudentDetail
              s={selectedStudent} team={team} counsellors={counsellors}
              memberName={memberName} role={role} rm={rm} isAdmin={isAdmin} isBDE={isBDE} isCounsel={isCounsel}
              slots={slots}
              onBack={()=>setSelected(null)} onUpdate={updStudent} onMove={moveStage}
              onAssignBDE={assignToBDE} onAssignCounsellor={assignCounsellor}
              onAddNote={doAddNote} onBookSlot={doBookSlot}
              onDeleteStudent={doDeleteStudent}
              onAddApp={doAddApp} onUpdateApp={doUpdateApp} onDeleteApp={doDeleteApp}
              onCycleDoc={doCycleDoc} onAddDoc={doAddDoc} onDeleteDoc={doDeleteDoc}
            />
          )}

          {/* SLOTS */}
          {tab==="slots" && (
            <SlotsView slots={slots} team={team} students={students} isAdmin={isAdmin} isBDE={isBDE} isCounsel={isCounsel} currentUser={currentUser} memberName={memberName} onAddSlot={doAddSlot} onBookSlot={doBookSlot} showAddSlot={showAddSlot} setShowAddSlot={setShowAddSlot}/>
          )}

          {/* TEAM */}
          {tab==="team" && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold">Team</h1>
                <button onClick={()=>setShowAddTeam(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}><Plus size={14}/> Add member</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.map((t)=>{
                  const load=students.filter((s)=>s.assigned_to===t.id&&s.stage!=="departed").length;
                  return (
                    <div key={t.id} className="card lift p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white" style={{background:ROLE_META[t.role]?.color||T.blue}}>{t.name.split(" ").map((w)=>w[0]).join("").slice(0,2)}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5" style={{background:ROLE_META[t.role]?.badge,color:ROLE_META[t.role]?.tx}}>{t.role}</div>
                        {t.country&&t.country!=="—" && <div className="text-[11px] text-slate-400 mt-0.5">{t.country} desk</div>}
                        <div className="text-[11px] mt-1 font-semibold num" style={{color:T.blue}}>{load} active</div>
                      </div>
                      <button onClick={()=>doDeleteTeam(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t" style={{background:T.ink,borderColor:"rgba(255,255,255,.08)"}}>
        {NAV.map(([id,Icon,label])=>(
          <button key={id} onClick={()=>{setTab(id);setSelected(null);}} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Icon size={18} style={{color:tab===id?"#fff":"#7C9CCB"}}/>
            <span className="text-[9px] font-bold" style={{color:tab===id?"#fff":"#7C9CCB"}}>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showAdd && rm.canCreate && <AddStudentModal team={team} isBDE={isBDE} currentUser={currentUser} onClose={()=>setShowAdd(false)} onSave={doAddStudent}/>}
      {showAddTeam && isAdmin && <AddTeamModal onClose={()=>setShowAddTeam(false)} onSave={doAddTeam}/>}
      {showImport && isAdmin && <ImportModal team={team} onClose={()=>setShowImport(false)} onImport={doBulkImport}/>}

      {showExport && isAdmin && (
        <Modal title="Export leads" onClose={()=>setShowExport(false)}>
          {showExportPass ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Enter export password to download:</p>
              <input type="password" value={exportPass} onChange={(e)=>setExportPass(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&doExport("excel")} placeholder="Export password" style={inp} autoFocus/>
              <div className="flex gap-2">
                <button onClick={()=>doExport("excel")} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Download Excel</button>
                <button onClick={()=>doExport("csv")} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.ok}}>Download CSV</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <ModalBtn icon={<FileSpreadsheet size={18} style={{color:T.ok}}/>} title="Download Excel (.xlsx)" sub={`${students.length} students`} onClick={()=>doExport("excel")}/>
              <ModalBtn icon={<Download size={18} style={{color:T.blue}}/>} title="Download CSV" sub="Import into Google Sheets" onClick={()=>doExport("csv")}/>
              <ModalBtn icon={<Send size={18} style={{color:T.saffron}}/>} title="Send to Google Sheets" sub={webhookUrl?"Push all leads":"Set URL in Settings first"} onClick={sendToSheet}/>
            </div>
          )}
        </Modal>
      )}

      {showSettings && isAdmin && (
        <Modal title="Settings" onClose={()=>setShowSettings(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Google Sheets webhook URL</label>
              <input value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" style={inp}/>
              <button onClick={()=>setSetting("webhookUrl",webhookUrl).then(()=>notify("Saved ✓"))} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:T.blue}}>Save URL</button>
            </div>
            <SecuritySection security={security} onSave={doSaveSettings}/>
          </div>
        </Modal>
      )}

      {toast && <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg whitespace-nowrap" style={{background:T.ink}}>{toast}</div>}
    </div>
  );
}

/* ════ LOGIN SCREEN ════ */
function LoginScreen({ team, security, onLogin }) {
  const [roleFilter, setRoleFilter] = useState(null);
  const [pin, setPin]   = useState("");
  const [show, setShow] = useState(false);
  const [wrong, setWrong] = useState(false);

  const roles = ["Admin", ...Object.keys(ROLE_META).filter((r)=>r!=="Admin")];
  const members = [{ id:"admin-0", name:"Admin", role:"Admin", isAdmin:true }, ...team.map((t)=>({...t,isAdmin:false}))];
  const filtered = roleFilter ? members.filter((m)=>m.role===roleFilter) : [];

  const go = (m) => {
    if (m.isAdmin && security.adminPass) {
      const h=(s)=>{ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
      if (h(pin)!==security.adminPass) { setWrong(true); setPin(""); return; }
    }
    onLogin({ id:m.id, name:m.name, role:m.role });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:"linear-gradient(160deg,#0A1F3D,#13315C)",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');`}</style>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-xl" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
          <h1 className="font-extrabold text-xl mt-3" style={{color:"#0A1F3D"}}>ABROAD VEDA</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your workspace</p>
        </div>

        {/* Step 1: Choose role */}
        <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Step 1 — Select your role</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {roles.map((r)=>(
            <button key={r} onClick={()=>{setRoleFilter(r);setPin("");setWrong(false);}}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition ${roleFilter===r?"border-blue-500":"border-slate-200 hover:border-slate-300"}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{background:ROLE_META[r]?.color}}>{r[0]}</div>
              <div className="text-left">
                <div className="font-bold text-sm" style={{color:"#0A1F3D"}}>{r}</div>
                <div className="text-[10px] text-slate-400">{r==="Admin"?"Full access":r==="BDE"?"Leads & calls":r==="Counsellor"?"Sessions":r==="Visa Officer"?"Visa & travel":""}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Step 2: Choose name */}
        {roleFilter && (
          <>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Step 2 — Select your name</p>
            <div className="space-y-2 mb-4">
              {filtered.length===0 && <p className="text-sm text-slate-400 text-center py-3">No {roleFilter}s added yet. Admin can add them in the Team section.</p>}
              {filtered.map((m)=>(
                <button key={m.id} onClick={()=>{ if (!m.isAdmin || !security.adminPass) go(m); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-left transition">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white" style={{background:ROLE_META[m.role]?.color}}>{m.name[0]}</div>
                  <div><div className="font-bold text-sm">{m.name}</div><div className="text-[11px] text-slate-400">{m.role}</div></div>
                  <ArrowRight size={14} className="ml-auto text-slate-300"/>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Admin password */}
        {roleFilter==="Admin" && security.adminPass && (
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Step 3 — Enter admin password</p>
            <div className="relative">
              <input type={show?"text":"password"} value={pin} onChange={(e)=>{setPin(e.target.value);setWrong(false);}} onKeyDown={(e)=>e.key==="Enter"&&go(members[0])}
                placeholder="Admin password" className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm pr-10" autoFocus/>
              <button onClick={()=>setShow(!show)} className="absolute right-3 top-2.5 text-slate-400">{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>
            </div>
            {wrong && <p className="text-xs text-red-500 font-semibold mt-1">Wrong password.</p>}
            <button onClick={()=>go(members[0])} className="mt-3 w-full py-2.5 rounded-xl text-white font-bold text-sm" style={{background:"#F59E0B"}}>Sign in as Admin</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════ EXPORT INDIVIDUAL STUDENT ════ */
function exportStudent(s, team, memberName) {
  const stageLabel = STAGES.find((x)=>x.id===s.stage)?.label||s.stage;
  const assignedName = memberName(s.assigned_to);

  // Sheet 1 — Profile
  const profile = [
    ["ABROAD VEDA — Student Profile",""],
    ["",""],
    ["Student ID", `AV-${s.id.toString().toUpperCase().slice(0,8)}`],
    ["Name", s.name],
    ["Phone", s.phone],
    ["Email", s.email||""],
    ["Gender", s.gender||""],
    ["Date of Birth", s.dob||""],
    ["Nationality", s.nationality||""],
    ["City", s.city||""],
    ["",""],
    ["COURSE DETAILS",""],
    ["Level", s.level],
    ["Country", s.country],
    ["Intake", s.intake],
    ["Field of Study", s.field],
    ["Qualification", s.qualification||""],
    ["",""],
    ["CRM STATUS",""],
    ["Stage", stageLabel],
    ["Assigned To", assignedName],
    ["Follow-up", s.follow_up||""],
    ["T&C Accepted", s.consent_tc?"Yes":"No"],
    ["Marketing Consent", s.consent_mkt?"Yes":"No"],
    ["How did you hear?", s.hear_source||""],
    ["Financial Source", s.fin_source||""],
    ["Added On", new Date(s.created_at||Date.now()).toLocaleDateString("en-GB")],
  ];

  // Sheet 2 — Applications
  const apps = (s.applications||[]).map((a)=>[a.course||"",a.institution||"",a.commence_date||"",a.status||""]);

  // Sheet 3 — Documents
  const docRows = (s.documents||DEFAULT_DOCS.map((n)=>({name:n,status:"Pending"}))).map((d)=>[d.name,d.status]);

  // Sheet 4 — Call logs
  const allNotes = s.notes||[];
  const callLogs = allNotes.filter((n)=>n.text?.startsWith("📞")).map((n)=>[new Date(n.created_at||Date.now()).toLocaleDateString("en-GB"), n.text.split("\n")[0].replace("📞 CALL — ",""), n.text.split("\n").slice(1).join(" ")]);
  const sessionLogs = allNotes.filter((n)=>n.text?.startsWith("🎓")).map((n)=>[new Date(n.created_at||Date.now()).toLocaleDateString("en-GB"), n.text.split("\n")[0].replace("🎓 SESSION — ",""), n.text.split("\n").slice(1).join(" ")]);
  const notes = allNotes.filter((n)=>!n.text?.startsWith("📞")&&!n.text?.startsWith("🎓")&&!n.text?.startsWith("✅")).map((n)=>[new Date(n.created_at||Date.now()).toLocaleDateString("en-GB"), n.text]);

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(profile);
  ws1["!cols"] = [{wch:22},{wch:35}];
  XLSX.utils.book_append_sheet(wb, ws1, "Profile");

  if (apps.length > 0) {
    const ws2 = XLSX.utils.aoa_to_sheet([["Course","Institution","Start Date","Status"], ...apps]);
    ws2["!cols"] = [{wch:30},{wch:25},{wch:14},{wch:22}];
    XLSX.utils.book_append_sheet(wb, ws2, "Applications");
  }

  if (docRows.length > 0) {
    const ws3 = XLSX.utils.aoa_to_sheet([["Document","Status"], ...docRows]);
    ws3["!cols"] = [{wch:28},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws3, "Documents");
  }

  if (callLogs.length > 0) {
    const ws4 = XLSX.utils.aoa_to_sheet([["Date","Outcome","Notes"], ...callLogs]);
    ws4["!cols"] = [{wch:12},{wch:30},{wch:40}];
    XLSX.utils.book_append_sheet(wb, ws4, "Call Logs");
  }

  if (sessionLogs.length > 0) {
    const ws5 = XLSX.utils.aoa_to_sheet([["Date","Session","Notes"], ...sessionLogs]);
    ws5["!cols"] = [{wch:12},{wch:30},{wch:40}];
    XLSX.utils.book_append_sheet(wb, ws5, "Sessions");
  }

  if (notes.length > 0) {
    const ws6 = XLSX.utils.aoa_to_sheet([["Date","Note"], ...notes]);
    ws6["!cols"] = [{wch:12},{wch:50}];
    XLSX.utils.book_append_sheet(wb, ws6, "Notes");
  }

  const filename = `AV-${s.name.replace(/\s+/g,"-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/* ════ STUDENT DETAIL ════ */
function StudentDetail({ s, team, counsellors, memberName, role, rm, isAdmin, isBDE, isCounsel, slots, onBack, onUpdate, onMove, onAssignBDE, onAssignCounsellor, onAddNote, onBookSlot, onDeleteStudent, onAddApp, onUpdateApp, onDeleteApp, onCycleDoc, onAddDoc, onDeleteDoc }) {
  const initTab = isBDE?"calls":isCounsel?"session":"overview";
  const [ptab, setPtab]     = useState(initTab);
  const [noteText,setNoteText] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [appForm,setAppForm]= useState({ course:"", institution:"", commence_date:"", status:"Application Preparation" });
  const [showCallModal,setShowCallModal]       = useState(false);
  const [showSessionModal,setShowSessionModal] = useState(false);
  const [callForm,setCallForm]   = useState({ outcome:CALL_OUTCOMES[0], notes:"", date:"", time:"" });
  const [sessionForm,setSessionForm] = useState({ platform:MEET_TYPES[0], duration:"30 mins", outcome:"", notes:"", meetLink:"" });

  const st   = stageOf(s.stage);
  const i    = stageIdx(s.stage);
  const apps = s.applications||[];
  const docs = (s.documents&&s.documents.length>0)?s.documents:DEFAULT_DOCS.map((n,j)=>({id:`tmp-${j}`,name:n,status:"Pending",student_id:s.id}));
  const allNotes    = s.notes||[];
  const callLogs    = allNotes.filter((n)=>n.text?.startsWith("📞"));
  const sessionLogs = allNotes.filter((n)=>n.text?.startsWith("🎓"));
  const otherNotes  = allNotes.filter((n)=>!n.text?.startsWith("📞")&&!n.text?.startsWith("🎓")&&!n.text?.startsWith("✅"));

  // Available slots for booking
  const availableSlots = slots.filter((sl)=>sl.status==="available" && sl.slot_date>=todayStr());

  const saveCallLog = () => {
    let text = `📞 CALL — ${callForm.outcome}`;
    if (callForm.notes) text += `\nNotes: ${callForm.notes}`;
    if (callForm.date && callForm.time) text += `\nCallback: ${callForm.date} at ${callForm.time}`;
    if (callForm.outcome.includes("Counselling booked")) text += `\n🎯 Counselling booked`;
    onAddNote(s.id, text);
    // If booked counselling and BDE, keep in lead stage but flag it
    if (callForm.outcome.includes("Counselling booked") && callForm.bookedSlot) {
      onBookSlot(callForm.bookedSlot, s.id);
    }
    setCallForm({ outcome:CALL_OUTCOMES[0], notes:"", date:"", time:"" });
    setShowCallModal(false);
  };

  const saveSessionLog = () => {
    let text = `🎓 SESSION — ${sessionForm.platform} · ${sessionForm.duration}`;
    if (sessionForm.outcome) text += `\nOutcome: ${sessionForm.outcome}`;
    if (sessionForm.notes) text += `\nNotes: ${sessionForm.notes}`;
    if (sessionForm.meetLink) text += `\nLink: ${sessionForm.meetLink}`;
    onAddNote(s.id, text);
    setShowSessionModal(false);
  };

  const TABS = [
    ...(isBDE||isAdmin?[["calls",`Calls (${callLogs.length})`]]:[] ),
    ...(isCounsel||isAdmin?[["session",`Sessions (${sessionLogs.length})`]]:[] ),
    ["overview","Overview"],
    ["apps",`Applications (${apps.length})`],
    ["docs","Documents"],
    ["notes",`Notes (${otherNotes.length})`],
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ChevronLeft size={16}/> All students</button>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg" style={{background:st.color}}>{s.name[0]}</div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">{s.name}</h1>
              <span className="text-[10px] font-bold text-slate-400">AV-{s.id.toString().toUpperCase().slice(0,8)}</span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
              <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-blue-600 num"><Phone size={12}/> {s.phone}</a>
              <span className="flex items-center gap-1"><Mail size={12}/> {s.email||"—"}</span>
              <span className="flex items-center gap-1"><Globe2 size={12}/> {s.level} · {s.country} · {s.intake}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400">Qual:</span>
              {["Hot","Warm","Cold"].map((q)=>(
                <button key={q} onClick={()=>(isAdmin||isBDE)&&onUpdate(s.id,{qualification:q})}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition"
                  style={s.qualification===q?{background:qualColor(q),color:"#fff",borderColor:qualColor(q)}:{background:"#fff",color:qualColor(q),borderColor:qualColor(q)+"66"}}>
                  {q}
                </button>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={`tel:${s.phone}`}
                className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
                style={{background:"#0d6efd",color:"#fff"}}>
                <PhoneCall size={14}/> Call
              </a>
              <a href={`https://wa.me/${String(s.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
                style={{background:"#25D366",color:"#fff"}}>
                <MessageCircle size={14}/> WhatsApp
              </a>
              {(isBDE||isAdmin) && (
                <button onClick={()=>setShowCallModal(true)}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
                  style={{background:"#F59E0B",color:"#fff"}}>
                  <PhoneCall size={14}/> Log call
                </button>
              )}
              {(isCounsel||isAdmin) && (
                <button onClick={()=>setShowSessionModal(true)}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
                  style={{background:"#8B5CF6",color:"#fff"}}>
                  <Video size={14}/> Log session
                </button>
              )}
              {isAdmin && (
                <button onClick={()=>exportStudent(s, team, memberName)}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
                  style={{background:"#10B981",color:"#fff"}}>
                  <Download size={14}/> Export
                </button>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={()=>{
                if(window.confirm(`Delete ${s.name}? This cannot be undone.`)) onDeleteStudent(s.id);
              }}
              className="p-2 rounded-xl hover:bg-red-100 text-slate-300 hover:text-red-600 transition-colors"
              title="Delete student">
              <Trash2 size={16}/>
            </button>
          )}
        </div>

        {/* Admin: assign BDE + Counsellor */}
        {isAdmin && (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Assign BDE</label>
              <select value={s.stage==="lead"?s.assigned_to||"":""} onChange={(e)=>e.target.value&&onAssignBDE(s.id,e.target.value)} style={inp}>
                <option value="">{memberName(s.assigned_to)||"Unassigned"}</option>
                {team.filter((t)=>t.role==="BDE").map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Assign Counsellor</label>
              <select value={""} onChange={(e)=>e.target.value&&onAssignCounsellor(s.id,e.target.value)} style={inp}>
                <option value="">{counsellors.find((c)=>c.id===s.assigned_to)?.name||"Select counsellor…"}</option>
                {counsellors.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Journey bar */}
        <div className="mt-5">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STAGES.map((stg,idx)=>(
              <button key={stg.id} onClick={()=>isAdmin&&onUpdate(s.id,{stage:stg.id})} disabled={!isAdmin} title={stg.label}
                className="h-2.5 rounded-full flex-1 min-w-[24px] transition" style={{background:idx<=i?stg.color:"#E2E8F0"}}/>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={()=>onMove(s.id,-1)} disabled={i===0||!rm.canAdvance} className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-30" style={{borderColor:"#E5EAF3"}}>← Back</button>
            <span className="text-sm font-bold" style={{color:st.color}}><BadgeCheck size={14} className="inline mr-1"/>{st.label}</span>
            <button onClick={()=>onMove(s.id,1)} disabled={i===STAGES.length-1||!rm.canAdvance} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-30" style={{background:"#0d6efd"}}>Advance →</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <label className="text-xs font-semibold text-slate-500">Assigned to
            <select value={s.assigned_to||""} onChange={(e)=>isAdmin&&onUpdate(s.id,{assigned_to:e.target.value})} disabled={!isAdmin} style={inp}>
              <option value="">Unassigned</option>
              {team.map((t)=><option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Next follow-up
            <input type="date" value={s.follow_up||""} onChange={(e)=>onUpdate(s.id,{follow_up:e.target.value})} style={inp}/>
          </label>
        </div>
      </div>

      {/* Call log modal */}
      {showCallModal && (
        <Modal title="📞 Log call" onClose={()=>setShowCallModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Call outcome
              <select value={callForm.outcome} onChange={(e)=>setCallForm({...callForm,outcome:e.target.value})} style={inp}>
                {CALL_OUTCOMES.map((o)=><option key={o}>{o}</option>)}
              </select>
            </label>
            {(callForm.outcome.includes("callback")||callForm.outcome.includes("Counselling")) && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-500">Date
                  <input type="date" value={callForm.date} onChange={(e)=>setCallForm({...callForm,date:e.target.value})} style={inp} min={todayStr()}/>
                </label>
                <label className="block text-xs font-semibold text-slate-500">Time
                  <select value={callForm.time} onChange={(e)=>setCallForm({...callForm,time:e.target.value})} style={inp}>
                    <option value="">Select…</option>
                    {SLOT_TIMES.map((t)=><option key={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            )}
            {callForm.outcome.includes("Counselling") && availableSlots.length>0 && (
              <label className="block text-xs font-semibold text-slate-500">Book counselling slot (optional)
                <select value={callForm.bookedSlot||""} onChange={(e)=>setCallForm({...callForm,bookedSlot:e.target.value})} style={inp}>
                  <option value="">Select available slot…</option>
                  {availableSlots.map((sl)=><option key={sl.id} value={sl.id}>{fmtDate(sl.slot_date)} at {sl.slot_time}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-500">Notes
              <textarea value={callForm.notes} onChange={(e)=>setCallForm({...callForm,notes:e.target.value})}
                placeholder="Key points from the call…" rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
          </div>
          <button onClick={saveCallLog} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Save call log</button>
        </Modal>
      )}

      {/* Session modal */}
      {showSessionModal && (
        <Modal title="🎓 Log counselling session" onClose={()=>setShowSessionModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Platform
              <select value={sessionForm.platform} onChange={(e)=>setSessionForm({...sessionForm,platform:e.target.value})} style={inp}>{MEET_TYPES.map((m)=><option key={m}>{m}</option>)}</select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Duration
              <select value={sessionForm.duration} onChange={(e)=>setSessionForm({...sessionForm,duration:e.target.value})} style={inp}>
                {["15 mins","30 mins","45 mins","60 mins","90 mins"].map((d)=><option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Outcome
              <select value={sessionForm.outcome} onChange={(e)=>setSessionForm({...sessionForm,outcome:e.target.value})} style={inp}>
                <option value="">Select…</option>
                {["Lead converted — shortlisting started","Needs another session","Student not eligible","Student postponing","Application confirmed","Documents submitted"].map((o)=><option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Session notes
              <textarea value={sessionForm.notes} onChange={(e)=>setSessionForm({...sessionForm,notes:e.target.value})}
                placeholder="e.g. Student wants MSc Data Science. Shortlisting 3 universities." rows={3} style={{...inp,resize:"vertical"}}/>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Meet / Zoom link (optional)
              <input value={sessionForm.meetLink} onChange={(e)=>setSessionForm({...sessionForm,meetLink:e.target.value})} placeholder="https://meet.google.com/…" style={inp}/>
            </label>
          </div>
          <button onClick={saveSessionLog} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.purple}}>Save session</button>
        </Modal>
      )}

      {/* Profile tabs */}
      <div className="flex gap-1 card p-1.5 overflow-x-auto">
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setPtab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${ptab===id?"text-white":"text-slate-500 hover:bg-slate-50"}`}
            style={ptab===id?{background:T.ink}:{}}>
            {label}
          </button>
        ))}
      </div>

      {/* CALLS TAB */}
      {ptab==="calls" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><PhoneCall size={14} style={{color:T.blue}}/> Call history</h2>
            <button onClick={()=>setShowCallModal(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{background:T.blue}}><Plus size={12}/> Log call</button>
          </div>
          {/* Big call + WA buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <a href={`tel:${s.phone}`} className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white" style={{background:T.blue}}><PhoneCall size={16}/> Call now</a>
            <a href={`https://wa.me/${String(s.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white" style={{background:"#25D366"}}><MessageCircle size={16}/> WhatsApp</a>
          </div>
          {callLogs.length===0 && <p className="text-sm text-slate-400">No calls logged. Log every call — admin can see your progress.</p>}
          <div className="space-y-3">
            {callLogs.map((n,idx)=>{
              const lines=(n.text||"").split("\n");
              const outcome=lines[0].replace("📞 CALL — ","");
              const notesTxt=lines.find((l)=>l.startsWith("Notes:"))?.slice(7);
              const callback=lines.find((l)=>l.startsWith("Callback:"))?.slice(10);
              const booked=lines.some((l)=>l.includes("Counselling booked"));
              return (
                <div key={idx} className="border rounded-xl p-3" style={{borderColor:T.line}}>
                  <div className="flex items-center gap-2">
                    <PhoneCall size={13} style={{color:booked?T.teal:T.blue}}/>
                    <span className="text-xs font-bold flex-1" style={{color:booked?T.teal:T.blue}}>{outcome}</span>
                    {booked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:"#CCFBF1",color:"#134E4A"}}>Booked ✓</span>}
                    <span className="text-[11px] text-slate-400 num">{new Date(n.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>
                  </div>
                  {notesTxt && <p className="text-sm text-slate-600 mt-1 ml-5">{notesTxt}</p>}
                  {callback && <p className="text-xs text-slate-400 mt-1 ml-5 flex items-center gap-1"><Clock size={11}/> Callback: {callback}</p>}
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
            <h2 className="font-bold text-sm flex items-center gap-2"><Video size={14} style={{color:T.purple}}/> Counselling sessions</h2>
            <button onClick={()=>setShowSessionModal(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{background:T.purple}}><Plus size={12}/> Log session</button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm" style={{background:"#EEF2FF",color:"#4F46E5"}}><Video size={15}/> Google Meet</a>
            <a href="https://zoom.us/start/videomeeting" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm" style={{background:"#EFF6FF",color:"#2563EB"}}><Video size={15}/> Zoom</a>
          </div>
          {sessionLogs.length===0 && <p className="text-sm text-slate-400">No sessions logged. Use "Log session" after every call.</p>}
          <div className="space-y-3">
            {sessionLogs.map((n,idx)=>{
              const lines=(n.text||"").split("\n");
              const header=lines[0].replace("🎓 SESSION — ","");
              const outcome=lines.find((l)=>l.startsWith("Outcome:"))?.slice(9);
              const notesTxt=lines.find((l)=>l.startsWith("Notes:"))?.slice(7);
              return (
                <div key={idx} className="border rounded-xl p-3" style={{borderColor:T.line}}>
                  <div className="flex items-center gap-2 mb-1">
                    <Video size={13} style={{color:T.purple}}/>
                    <span className="text-xs font-bold flex-1" style={{color:T.purple}}>{header}</span>
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
              <label className="text-xs font-semibold text-slate-500">Gender<select value={s.gender||""} onChange={(e)=>onUpdate(s.id,{gender:e.target.value})} style={inp}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></label>
              <label className="text-xs font-semibold text-slate-500">Date of birth<input type="date" value={s.dob||""} onChange={(e)=>onUpdate(s.id,{dob:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Nationality<input value={s.nationality||""} onChange={(e)=>onUpdate(s.id,{nationality:e.target.value})} placeholder="India" style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">City<input value={s.city||""} onChange={(e)=>onUpdate(s.id,{city:e.target.value})} placeholder="Agra" style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Email<input value={s.email||""} onChange={(e)=>onUpdate(s.id,{email:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Mobile<input value={s.phone||""} onChange={(e)=>onUpdate(s.id,{phone:e.target.value})} style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Quick comment</h2>
            <div className="flex gap-2">
              <input value={noteText} onChange={(e)=>setNoteText(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&noteText.trim()){onAddNote(s.id,noteText);setNoteText("");}}}
                placeholder="Add a quick note…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{borderColor:"#CBD5E1"}}/>
              <button onClick={()=>{if(noteText.trim()){onAddNote(s.id,noteText);setNoteText("");}}} className="px-3 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}>Add</button>
            </div>
            {otherNotes.slice(0,3).map((n,idx)=>(
              <div key={idx} className="text-xs text-slate-500 border-l-2 pl-2 py-0.5 truncate" style={{borderColor:"#0d6efd55"}}>{n.text}</div>
            ))}
          </div>
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Consent & engagement</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_tc} onChange={(e)=>onUpdate(s.id,{consent_tc:e.target.checked})} className="w-4 h-4"/> T&C</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_mkt} onChange={(e)=>onUpdate(s.id,{consent_mkt:e.target.checked})} className="w-4 h-4"/> Marketing</label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">How did you hear?<select value={s.hear_source||""} onChange={(e)=>onUpdate(s.id,{hear_source:e.target.value})} style={inp}><option value="">—</option>{HEAR_SOURCES.map((h)=><option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Financial source<select value={s.fin_source||""} onChange={(e)=>onUpdate(s.id,{fin_source:e.target.value})} style={inp}><option value="">—</option>{FIN_SOURCES.map((h)=><option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Field of study<select value={s.field||""} onChange={(e)=>onUpdate(s.id,{field:e.target.value})} style={inp}>{FIELDS.map((x)=><option key={x}>{x}</option>)}</select></label>
          </div>
        </div>
      )}

      {/* APPS TAB */}
      {ptab==="apps" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3">Course applications</h2>
          {(isAdmin||isCounsel) && (
            <div className="grid sm:grid-cols-5 gap-2 mb-4">
              <input value={appForm.course} onChange={(e)=>setAppForm({...appForm,course:e.target.value})} placeholder="Course name" style={{...inp,marginTop:0}} className="sm:col-span-2"/>
              <input value={appForm.institution} onChange={(e)=>setAppForm({...appForm,institution:e.target.value})} placeholder="University" style={{...inp,marginTop:0}}/>
              <input type="date" value={appForm.commence_date} onChange={(e)=>setAppForm({...appForm,commence_date:e.target.value})} style={{...inp,marginTop:0}}/>
              <button onClick={()=>{if(appForm.course.trim()){onAddApp(s.id,appForm);setAppForm({course:"",institution:"",commence_date:"",status:"Application Preparation"});}}} className="py-2 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}>+ Add</button>
            </div>
          )}
          {apps.length===0 && <p className="text-sm text-slate-400">No applications yet.</p>}
          <div className="space-y-2">
            {apps.map((a)=>(
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border" style={{borderColor:T.line}}>
                <div className="flex-1 min-w-[180px]"><div className="font-semibold text-sm">{a.course}</div><div className="text-[11px] text-slate-500">{a.institution||"—"}{a.commence_date?` · starts ${a.commence_date}`:""}</div></div>
                <select value={a.status} onChange={(e)=>onUpdateApp(s.id,a.id,{...a,status:e.target.value})} className="text-xs font-semibold py-1.5 px-2 rounded-lg border bg-white" style={{borderColor:"#CBD5E1"}}>{APP_STATUSES.map((x)=><option key={x}>{x}</option>)}</select>
                {isAdmin && <button onClick={()=>onDeleteApp(s.id,a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCS TAB */}
      {ptab==="docs" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-sm">Document checklist</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Tap status to cycle: Pending → Received → Verified</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="px-2 py-1 rounded-lg text-white num" style={{background:DOC_COLORS.Verified}}>{docs.filter(d=>d.status==="Verified").length} verified</span>
              <span className="text-slate-400">/ {docs.length}</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            {docs.map((d,idx)=>(
              <div key={d.id||idx} className="flex items-center gap-2 p-2.5 rounded-xl border transition" style={{borderColor:d.status==="Verified"?"#86EFAC":T.line, background:d.status==="Verified"?"#F0FDF4":"#fff"}}>
                <span className="text-sm flex-1">{d.name}</span>
                <button
                  onClick={()=>{
                    if (d.id && !d.id.startsWith("tmp-")) {
                      onCycleDoc(s.id,d.id,d.status,d.name);
                    } else {
                      // temp doc — create it in DB first then cycle
                      onAddDoc(s.id,d.name);
                    }
                  }}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-white shrink-0" style={{background:DOC_COLORS[d.status]}}>{d.status}</button>
                {(isAdmin||isCounsel) && d.id && !d.id.startsWith("tmp-") && (
                  <button onClick={()=>onDeleteDoc(s.id,d.id)} className="p-1 rounded-lg hover:bg-red-50 text-slate-200 hover:text-red-500 shrink-0"><X size={11}/></button>
                )}
              </div>
            ))}
          </div>
          {/* Add new document row */}
          <div className="flex gap-2 p-3 rounded-xl border-2 border-dashed" style={{borderColor:T.line}}>
            <input
              value={newDoc}
              onChange={(e)=>setNewDoc(e.target.value)}
              onKeyDown={(e)=>{
                if(e.key==="Enter" && newDoc.trim()) {
                  onAddDoc(s.id, newDoc.trim());
                  setNewDoc("");
                }
              }}
              placeholder="Type document name and press Enter or click Add…"
              className="flex-1 py-1.5 px-2 rounded-lg border text-sm bg-white"
              style={{borderColor:"#CBD5E1"}}
            />
            <button
              onClick={()=>{
                if(newDoc.trim()) {
                  onAddDoc(s.id, newDoc.trim());
                  setNewDoc("");
                }
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-sm font-semibold shrink-0"
              style={{background:T.blue}}
            ><Plus size={14}/> Add</button>
          </div>
        </div>
      )}

      {/* NOTES TAB */}
      {ptab==="notes" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><StickyNote size={14} style={{color:T.saffron}}/> Counselling notes</h2>
          <div className="flex gap-2 mb-4">
            <input value={noteText} onChange={(e)=>setNoteText(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){onAddNote(s.id,noteText);setNoteText("");}}}
              placeholder="Add a counselling note…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{borderColor:"#CBD5E1"}}/>
            <button onClick={()=>{onAddNote(s.id,noteText);setNoteText("");}} className="px-4 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}>Add</button>
          </div>
          {otherNotes.length===0 && <p className="text-sm text-slate-400">No notes yet.</p>}
          <div className="space-y-2">
            {otherNotes.map((n,idx)=>(
              <div key={idx} className="flex gap-3 items-start text-sm border-l-2 pl-3 py-1" style={{borderColor:"#0d6efd55"}}>
                <span className="text-[11px] text-slate-400 shrink-0 w-20 num">{fmtDT(n.created_at||Date.now())}</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ SLOTS VIEW ════ */
function SlotsView({ slots, team, students, isAdmin, isBDE, isCounsel, currentUser, memberName, onAddSlot, onBookSlot, showAddSlot, setShowAddSlot }) {
  const [newSlot, setNewSlot] = useState({ counsellor_id:"", slot_date:todayStr(), slot_time:"11:00" });
  const counsellors = team.filter((t)=>t.role==="Counsellor");

  // For BDE: show available slots to book
  const availableSlots = slots.filter((s)=>s.status==="available" && s.slot_date>=todayStr());
  // For counsellor: show their own slots
  const mySlots = isCounsel ? slots.filter((s)=>s.counsellor_id===currentUser.id) : [];
  // Group by date
  const grouped = {};
  const display = isAdmin ? slots : isCounsel ? mySlots : availableSlots;
  display.forEach((sl)=>{
    if (!grouped[sl.slot_date]) grouped[sl.slot_date]=[];
    grouped[sl.slot_date].push(sl);
  });

  const studentName = (id) => students.find((s)=>s.id===id)?.name||"";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{isBDE?"Available counselling slots":"Counselling slots"}</h1>
          <p className="text-sm text-slate-500">Working hours: 11:00 AM — 6:00 PM</p>
        </div>
        {(isAdmin||isCounsel) && <button onClick={()=>setShowAddSlot(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}><Plus size={14}/> Add slot</button>}
      </div>

      {Object.keys(grouped).sort().map((date)=>(
        <div key={date} className="card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Calendar size={14} style={{color:T.blue}}/> {fmtDate(date)}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {grouped[date].map((sl)=>{
              const counsellor=team.find((t)=>t.id===sl.counsellor_id);
              const bookedStudentName=sl.booked_by?studentName(sl.booked_by):"";
              return (
                <div key={sl.id} className="border rounded-xl p-3 text-center" style={{borderColor:sl.status==="booked"?"#86EFAC":T.line,background:sl.status==="booked"?"#F0FDF4":"#fff"}}>
                  <div className="text-lg font-extrabold num" style={{color:sl.status==="booked"?T.ok:T.blue}}>{sl.slot_time}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{counsellor?.name||"—"}</div>
                  {sl.status==="booked"
                    ? <div className="text-[10px] font-bold text-green-700 mt-1 truncate">✓ {bookedStudentName||"Booked"}</div>
                    : isBDE ? <button onClick={()=>{if(confirm(`Book ${sl.slot_time} slot with ${counsellor?.name}?`)) onBookSlot(sl.id,currentUser.id);}} className="mt-1.5 text-[10px] font-bold px-2 py-1 rounded-lg text-white w-full" style={{background:T.teal}}>Book</button>
                    : <div className="text-[10px] font-bold text-blue-600 mt-1">Available</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {Object.keys(grouped).length===0 && (
        <div className="card p-8 text-center text-slate-400">
          <Calendar size={32} className="mx-auto mb-2 text-slate-300"/>
          {isBDE ? "No available slots right now. Check back later." : "No slots added yet. Add slots using the button above."}
        </div>
      )}

      {showAddSlot && (
        <Modal title="Add counselling slot" onClose={()=>setShowAddSlot(false)}>
          <div className="space-y-3">
            {isAdmin && <label className="block text-xs font-semibold text-slate-500">Counsellor
              <select value={newSlot.counsellor_id} onChange={(e)=>setNewSlot({...newSlot,counsellor_id:e.target.value})} style={inp}>
                <option value="">Select counsellor…</option>
                {counsellors.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>}
            {isCounsel && <p className="text-sm font-semibold text-slate-600">Adding slot for: {currentUser.name}</p>}
            <label className="block text-xs font-semibold text-slate-500">Date
              <input type="date" value={newSlot.slot_date} onChange={(e)=>setNewSlot({...newSlot,slot_date:e.target.value})} style={inp} min={todayStr()}/>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Time slot
              <select value={newSlot.slot_time} onChange={(e)=>setNewSlot({...newSlot,slot_time:e.target.value})} style={inp}>
                {SLOT_TIMES.map((t)=><option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <button onClick={()=>{
            const counsellor_id = isCounsel ? currentUser.id : newSlot.counsellor_id;
            if (!counsellor_id||!newSlot.slot_date) return;
            onAddSlot({counsellor_id,slot_date:newSlot.slot_date,slot_time:newSlot.slot_time,status:"available"});
            setShowAddSlot(false);
          }} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Add slot</button>
        </Modal>
      )}
    </div>
  );
}

/* ════ SMALL COMPONENTS ════ */
function AddStudentModal({ team, isBDE, currentUser, onClose, onSave }) {
  const [f,setF]=useState({ name:"",phone:"",email:"",level:"PG",country:"UK",intake:"September",field:FIELDS[0],qualification:"Warm",assigned_to:isBDE?currentUser.id:"",stage:"lead" });
  const set=(k)=>(e)=>setF((p)=>({...p,[k]:e.target.value}));
  return (
    <Modal title={isBDE?"Add new lead":"New lead"} onClose={onClose}>
      {isBDE && <div className="mb-3 p-3 rounded-xl text-xs font-semibold" style={{background:"#CCFBF1",color:"#134E4A"}}>Lead will be added under your name. Admin will assign a counsellor.</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *"><input value={f.name} onChange={set("name")} style={inp} placeholder="Student name"/></Field>
        <Field label="Mobile *"><input value={f.phone} onChange={set("phone")} style={inp} placeholder="+91…" type="tel"/></Field>
        <Field label="Email"><input value={f.email} onChange={set("email")} style={inp} type="email"/></Field>
        <Field label="Level"><select value={f.level} onChange={set("level")} style={inp}>{LEVELS.map((l)=><option key={l}>{l}</option>)}</select></Field>
        <Field label="Country"><select value={f.country} onChange={set("country")} style={inp}>{COUNTRIES.map((c)=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Intake"><select value={f.intake} onChange={set("intake")} style={inp}>{INTAKES.map((m)=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Field"><select value={f.field} onChange={set("field")} style={inp}>{FIELDS.map((x)=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Qualification"><select value={f.qualification} onChange={set("qualification")} style={inp}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field>
        {!isBDE && <Field label="Assign to"><select value={f.assigned_to} onChange={set("assigned_to")} style={inp}><option value="">Unassigned</option>{team.map((t)=><option key={t.id} value={t.id}>{t.name} ({t.role})</option>)}</select></Field>}
      </div>
      <button disabled={!f.name.trim()||!f.phone.trim()} onClick={()=>onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{background:isBDE?T.teal:T.blue}}>Save lead</button>
    </Modal>
  );
}

function AddTeamModal({ onClose, onSave }) {
  const [f,setF]=useState({name:"",role:"Counsellor",country:"—"});
  return (
    <Modal title="Add team member" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name *"><input value={f.name} onChange={(e)=>setF({...f,name:e.target.value})} style={inp} placeholder="Full name"/></Field>
        <Field label="Role"><select value={f.role} onChange={(e)=>setF({...f,role:e.target.value})} style={inp}>{Object.keys(ROLE_META).filter((r)=>r!=="Admin").map((r)=><option key={r}>{r}</option>)}</select></Field>
        <Field label="Country desk"><select value={f.country} onChange={(e)=>setF({...f,country:e.target.value})} style={inp}><option>—</option>{COUNTRIES.map((c)=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <button disabled={!f.name.trim()} onClick={()=>onSave(f)} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{background:ROLE_META[f.role]?.color||T.blue}}>Add {f.role}</button>
    </Modal>
  );
}

function SecuritySection({ security, onSave }) {
  const [p,setP]=useState(""); const [a,setA]=useState(""); const [x,setX]=useState(""); const [err,setErr]=useState("");
  const hp=(s)=>{ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return "h"+h.toString(36); };
  const save=()=>{
    if(!p&&!a&&!x){setErr("Enter at least one password.");return;}
    const next={...security};
    if(p) next.appPass=hp(p); if(a) next.adminPass=hp(a); if(x) next.exportPass=hp(x);
    if(next.adminPass&&next.exportPass&&next.adminPass===next.exportPass){setErr("Export password must differ from admin.");return;}
    setErr(""); onSave(next); setP(""); setA(""); setX("");
  };
  return (
    <div className="p-3 rounded-xl border space-y-3" style={{borderColor:T.line}}>
      <div className="font-semibold text-sm">🔒 Passwords</div>
      <p className="text-[11px] text-slate-500">Admin password protects the Admin login and Settings. Export password is required to download data.</p>
      {[["Admin password",a,setA,security.adminPass],["Export password (for downloads)",x,setX,security.exportPass]].map(([label,val,setVal,isSet])=>(
        <label key={label} className="block text-xs font-semibold text-slate-500">{label} {isSet?<span className="text-green-600">· set ✓</span>:<span className="text-slate-400">· not set</span>}
          <input type="password" value={val} onChange={(e)=>setVal(e.target.value)} placeholder={isSet?"Type to change":"Create password"} style={inp}/>
        </label>
      ))}
      {err && <p className="text-[11px] font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold" style={{background:T.blue}}>Save passwords</button>
        {(security.adminPass||security.exportPass) && <button onClick={()=>onSave({adminPass:"",exportPass:"",appPass:""})} className="px-3 py-2 rounded-xl border text-xs font-semibold text-slate-500" style={{borderColor:T.line}}>Remove all</button>}
      </div>
    </div>
  );
}

function ImportModal({ team, onClose, onImport }) {
  const [parsed,setParsed]=useState(null); const [error,setError]=useState("");
  const norm=(k)=>String(k).toLowerCase().replace(/[^a-z]/g,"");
  const handleFile=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    try {
      const buf=await file.arrayBuffer(); const wb=XLSX.read(buf);
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      const recs=rows.map((r)=>{
        const g={}; Object.keys(r).forEach((k)=>{g[norm(k)]=String(r[k]).trim();});
        const name=g.name||g.fullname||""; if(!name) return null;
        const stg=(g.stage||"").toLowerCase();
        const stage=stg?(STAGES.find((s)=>s.label.toLowerCase().includes(stg))?.id||"lead"):"lead";
        const an=(g.assignedto||g.counsellor||"").toLowerCase();
        const assigned_to=team.find((t)=>t.name.toLowerCase()===an)?.id||"";
        const lvl=(g.level||"").toUpperCase();
        const qual=["hot","warm","cold"].includes((g.qualification||"").toLowerCase())?g.qualification[0].toUpperCase()+g.qualification.slice(1).toLowerCase():"";
        return { name,phone:g.phone||g.mobile||"",email:g.email||"",level:LEVELS.includes(lvl)?lvl:"PG",country:COUNTRIES.find((c)=>c.toLowerCase()===(g.country||"").toLowerCase())||(g.country||"UK"),intake:INTAKES.find((m)=>m.toLowerCase()===(g.intake||"").toLowerCase())||"Other",field:g.fieldofstudy||g.field||"Other",stage,assigned_to,qualification:qual,follow_up:g.followup||"" };
      }).filter(Boolean);
      if(!recs.length){setError("No valid rows found.");return;}
      setError(""); setParsed(recs);
    } catch(e){setError("Could not read file: "+e.message);}
  };
  return (
    <Modal title="Import leads from Excel" onClose={onClose}>
      <label className="block w-full p-6 rounded-xl border-2 border-dashed border-slate-300 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30">
        <Upload size={22} className="mx-auto text-slate-400"/>
        <span className="block text-sm font-semibold mt-2">Choose .xlsx or .csv file</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden"/>
      </label>
      {error && <p className="text-[11px] font-semibold text-red-500 mt-2">{error}</p>}
      {parsed && (
        <div className="mt-3 p-3 rounded-xl border border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-700">Found {parsed.length} leads ✓</p>
          <p className="text-[11px] text-green-700 mt-0.5">{parsed.slice(0,4).map((r)=>r.name).join(", ")}{parsed.length>4?` +${parsed.length-4} more`:""}</p>
          <button onClick={()=>onImport(parsed)} className="mt-3 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.ok}}>Import {parsed.length} leads</button>
        </div>
      )}
    </Modal>
  );
}

function Splash({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:"linear-gradient(160deg,#0A1F3D,#13315C)"}}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center font-extrabold text-white text-2xl mb-4" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
        <div className="flex items-center gap-2 text-white/70 justify-center"><Loader2 className="animate-spin" size={16}/>{text}</div>
      </div>
    </div>
  );
}

function ModalBtn({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 text-left" style={{borderColor:T.line}}>
      {icon}<span><span className="font-semibold text-sm block">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </button>
  );
}
function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-500">{label}{children}</label>; }
function Modal({ title, children, onClose }) {
  useEffect(()=>{const h=(e)=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);},[onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(10,31,61,.55)"}} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-extrabold">{title}</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16}/></button></div>
        {children}
      </div>
    </div>
  );
}
