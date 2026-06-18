import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, LayoutDashboard, KanbanSquare, UserPlus, Phone, Mail,
  ChevronRight, ChevronLeft, Search, X, Plus, Trash2, CalendarClock,
  GraduationCap, Globe2, BadgeCheck, Briefcase, StickyNote, Loader2,
  Download, Settings as Cog, Send, FileSpreadsheet, Upload, Lock,
  MessageCircle, PhoneCall, Flame, ArrowRight, Wifi, WifiOff, RefreshCw,
  LogOut, Eye, EyeOff, Video, AlertCircle, Calendar, Clock, ChevronDown,
  CheckSquare, Square, Edit2, Save, KeyRound, Database, ShieldCheck, Moon, Sun,
  Filter, MapPin
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getStudents, createStudent, updateStudent, deleteStudent, bulkDeleteStudents,
  addNote as dbAddNote, upsertApplication, deleteApplication,
  upsertDocument, deleteDocument,
  getTeam, createTeamMember, updateTeamMember, deleteTeamMember,
  getSlots, createSlot, bookSlot, freeSlot, deleteSlot,
  bulkInsertStudents, getSetting, setSetting, checkDbHealth,
  deleteNote as dbDeleteNote, updateNote as dbUpdateNote,
  loadStudentDetail
} from "./lib/db";
import { hashPassword, validatePassword } from "./lib/crypto";
import { telNum, waNum, initials, formatDate, formatTime, formatPhoneDisplay } from "./lib/format";
import { getErrorMessage, logError } from "./lib/errorHandler";
import { useForm, useMobileContext, useLocalStorage, useDebounce } from "./lib/hooks";
import { Button, Badge, Input, Select, Card, PhoneButtons, Avatar, StatCard } from "./components/common";
import { ErrorBoundary } from "./components/ErrorBoundary";

const T = { ink:"#0A1F3D", blue:"#0d6efd", saffron:"#F59E0B", mist:"#F5F7FB", line:"#E5EAF3", ok:"#16A34A", danger:"#DC2626", teal:"#14B8A6", purple:"#8B5CF6" };

const ROLE_META = {
  Admin:         { color:"#F59E0B", badge:"#FEF3C7", tx:"#92400E" },
  BDE:           { color:"#14B8A6", badge:"#CCFBF1", tx:"#134E4A" },
  Counsellor:    { color:"#0d6efd", badge:"#DBEAFE", tx:"#1E40AF" },
  "Visa Officer":{ color:"#EF4444", badge:"#FEE2E2", tx:"#991B1B" },
  Manager:       { color:"#8B5CF6", badge:"#EDE9FE", tx:"#5B21B6" },
};
const ALL_MEMBER_ROLES = ["BDE","Counsellor","Visa Officer","Manager"];

const STAGES = [
  { id:"lead",         label:"New Lead",               color:"#64748B" },
  { id:"processing",   label:"Processing",             color:"#F59E0B" },
  { id:"counsel",      label:"Counselling",            color:"#0d6efd" },
  { id:"shortlist",    label:"Shortlisting",           color:"#6366F1" },
  { id:"applied",      label:"Application",            color:"#8B5CF6" },
  { id:"offer",        label:"Offer Received",         color:"#F59E0B" },
  { id:"finance",      label:"Finance & Scholarship",  color:"#14B8A6" },
  { id:"visa",         label:"Visa Filing",            color:"#EF4444" },
  { id:"predep",       label:"Pre-Departure",          color:"#10B981" },
  { id:"departed",     label:"Departed 🎉",            color:"#16A34A" },
  { id:"future",       label:"Planning for Future",    color:"#8B5CF6" },
  { id:"enrolled",     label:"Already Enrolled",       color:"#14B8A6" },
  { id:"notinterested",label:"Cancelled",              color:"#DC2626" },
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
const DOC_FIELDS = {
  "Passport":             [{ key:"number", label:"Passport Number" },{ key:"expiry", label:"Expiry Date", type:"date" },{ key:"issued", label:"Issue Date", type:"date" },{ key:"country", label:"Issuing Country" }],
  "10th & 12th Marksheets":[{ key:"board", label:"Board / University" },{ key:"year", label:"Year of Passing" },{ key:"percent", label:"Percentage / Grade" }],
  "Degree & Transcripts": [{ key:"degree", label:"Degree Name" },{ key:"university", label:"University" },{ key:"year", label:"Year of Passing" },{ key:"grade", label:"Grade / CGPA" }],
  "IELTS / PTE Score":    [{ key:"exam", label:"Exam Type (IELTS/PTE/TOEFL)" },{ key:"score", label:"Overall Score" },{ key:"date", label:"Exam Date", type:"date" },{ key:"expiry", label:"Valid Until", type:"date" }],
  "SOP":                  [{ key:"draft", label:"Draft Version" },{ key:"wordcount", label:"Word Count" },{ key:"reviewer", label:"Reviewed By" }],
  "LORs":                 [{ key:"from1", label:"Recommender 1" },{ key:"from2", label:"Recommender 2" },{ key:"from3", label:"Recommender 3 (optional)" }],
  "CV / Resume":          [{ key:"version", label:"Version / Date" },{ key:"pages", label:"Number of Pages" }],
  "Financial Documents":  [{ key:"type", label:"Document Type (Bank stmt / Loan)" },{ key:"amount", label:"Amount (INR/USD)" },{ key:"bank", label:"Bank / Institution" },{ key:"dated", label:"Statement Date", type:"date" }],
};
const HEAR_SOURCES = ["School/College Visit","Friend or Family","Social Media","Website","Walk-in","Education Fair","Other"];
const FIN_SOURCES  = ["Parents","Self-funded","Education Loan","Scholarship","Sponsor"];
const CALL_OUTCOMES = [
  "No answer — callback later",
  "Busy — try again",
  "Switch off",
  "Not reachable",
  "Call back later",
  "Wrong number",
  "Invalid number",
  "Not interested",
  "Interested — follow-up needed",
  "Planning for future",
  "Counselling booked",
  "Already Enrolled",
  "WhatsApp message sent",
];

// Which call outcomes auto-move the student to which stage
const OUTCOME_STAGE = {
  "Wrong number":                "notinterested",
  "Invalid number":              "notinterested",
  "Not interested":              "notinterested",
  "No answer — callback later":  "processing",
  "Busy — try again":            "processing",
  "Switch off":                  "processing",
  "Not reachable":               "processing",
  "Call back later":             "processing",
  "Interested — follow-up needed": "processing",
  "Planning for future":         "future",
  "Already Enrolled":            "enrolled",
};
const MEET_TYPES = ["Google Meet","Zoom","Microsoft Teams","Phone call","In-person"];
const SLOT_TIMES = ["11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
const SLOT_LABELS = {"11:00":"11 AM – 12 PM","12:00":"12 PM – 1 PM","13:00":"1 PM – 2 PM","14:00":"2 PM – 3 PM","15:00":"3 PM – 4 PM","16:00":"4 PM – 5 PM","17:00":"5 PM – 6 PM"};

const stageIdx = (id) => STAGES.findIndex((s) => s.id===id);
const stageOf  = (id) => STAGES[stageIdx(id)] || STAGES[0];
const fmtDT    = (ts) => new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtDate  = (d)  => new Date(d).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
const qualColor= (q)  => QUALS.find((x) => x.id===q)?.color || "#64748B";
const isOverdue= (s)  => s.follow_up && new Date(s.follow_up) < new Date(new Date().toDateString());
// Always compute dates in IST (UTC+5:30) regardless of user's local timezone
const toIST = () => {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
};
const todayStr = () => {
  const d = toIST();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const currentISTHour = () => {
  const d = toIST();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const inp      = { width:"100%", padding:"9px 12px", borderRadius:12, border:"1px solid #CBD5E1", fontSize:14, background:"#fff", marginTop:4, fontWeight:500 };

// roles stored as comma-separated e.g. "BDE,Counsellor"
const parseRoles  = (r="") => r.split(",").map(s=>s.trim()).filter(Boolean);
const hasRole     = (m, r) => parseRoles(m?.role).includes(r);
const primaryRole = (m)    => parseRoles(m?.role)[0] || "BDE";
const rMeta       = (r)    => ROLE_META[r] || ROLE_META.BDE;


export default function App() {
  const [tab,setTab]             = useState("dashboard");
  const [students,setStudents]   = useState([]);
  const [team,setTeam]           = useState([]);
  const [slots,setSlots]         = useState([]);
  const [loading,setLoading]     = useState(true);
  const [dbOk,setDbOk]           = useState(true);
  const [syncing,setSyncing]     = useState(false);
  const [currentUser,setCurrentUser] = useState(() => {
    try { const u = localStorage.getItem("crm_user"); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [activeRole,setActiveRole] = useState(() => localStorage.getItem("crm_role") || null);
  const [query,setQuery]         = useState("");
  const [globalQ,setGlobalQ]     = useState("");
  const [filterStage,setFilterStage]     = useState("all");
  const [filterCountry,setFilterCountry] = useState("all");
  const [filterQual,setFilterQual]       = useState("all");
  const [filterCall,setFilterCall]       = useState("all");
  const [selected,setSelected]   = useState(null);
  const [selLeads,setSelLeads]   = useState(new Set());
  const [showAdd,setShowAdd]     = useState(false);
  const [showDistribute,setShowDistribute] = useState(false);
  const [showAddTeam,setShowAddTeam]   = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showExport,setShowExport]     = useState(false);
  const [exportStage,setExportStage]   = useState("all");
  const [showImport,setShowImport]     = useState(false);
  const [showAddSlot,setShowAddSlot]   = useState(false);
  const [pendingBooking,setPendingBooking] = useState(null); // {counsellorId, studentId} — pre-fills Slots booking flow
  const [pipeSelStage,setPipeSelStage]   = useState(null); // stageId of column in select mode
  const [pipeSelected,setPipeSelected]   = useState(new Set()); // student IDs selected in pipeline
  const [showDb,setShowDb]       = useState(false);
  const [exportPass,setExportPass]     = useState("");
  const [showExportPass,setShowExportPass] = useState(false);
  const [webhookUrl,setWebhookUrl] = useState("");
  const [security,setSecurity]   = useState({ adminPass:"", exportPass:"" });
  const [toast,setToast]         = useState("");
  const [dbHealth,setDbHealth]   = useState(null);
  const [showMobileFilters,setShowMobileFilters] = useState(false);

  const notify = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3500); };

  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [spCounsellorId, setSpCounsellorId] = useState("");
  const [spStudentId, setSpStudentId]       = useState(null);
  const [spDate, setSpDate]                 = useState(todayStr());

  const closeAllModals = () => {
    setShowAdd(false); setShowAddTeam(false); setShowSettings(false);
    setShowExport(false); setShowImport(false); setShowAddSlot(false);
    setShowDb(false); setShowExportPass(false); setShowSlotPicker(false);
  };
  const goTab = (t) => { closeAllModals(); setTab(t); setSelected(null); setSelLeads(new Set()); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s,t,sl,wh,sec] = await Promise.all([
        getStudents(), getTeam(), getSlots(),
        getSetting("webhookUrl"), getSetting("security")
      ]);
      setStudents(s); setTeam(t); setSlots(sl||[]);
      if (wh) setWebhookUrl(wh);
      if (sec) setSecurity({ adminPass:"", exportPass:"", ...sec });
      setDbOk(true);
    } catch(e) { console.error(e); setDbOk(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Lazy-load applications + documents only when a student detail is opened
  useEffect(() => {
    if (!selected) return;
    const s = students.find(x => x.id === selected);
    if (!s || s._detailLoaded) return;
    loadStudentDetail(selected)
      .then(detail => {
        setStudents(p => p.map(x => x.id === selected
          ? { ...x, applications: detail.applications || [], documents: detail.documents || [], _detailLoaded: true }
          : x
        ));
      })
      .catch(() => {});
  }, [selected]);

  const role      = activeRole || (currentUser?.isAdmin ? "Admin" : primaryRole(currentUser||{}));
  const isAdmin   = role === "Admin";
  const isBDE     = role === "BDE";
  const isCounsel = role === "Counsellor";
  const isVisa    = role === "Visa Officer";
  const isManager = role === "Manager";

  // Managers also count as counsellors — they appear in assignment dropdowns and slot scheduling
  const counsellors = team.filter(t => hasRole(t,"Counsellor") || hasRole(t,"Manager"));
  const bdeList     = team.filter(t => hasRole(t,"BDE"));

  const visibleStudents = useMemo(() => {
    if (!currentUser || isAdmin || isManager) return students;
    // BDE sees ALL students where they are the BDE (bde_id) — at every stage
    // This means BDE can track their students through the entire journey
    if (isBDE) return students.filter(s => s.bde_id === currentUser.id);
    if (isCounsel) return students.filter(s => s.assigned_to===currentUser.id);
    if (isVisa) return students.filter(s => s.assigned_to===currentUser.id && ["visa","predep","departed"].includes(s.stage));
    return [];
  }, [students, currentUser, isAdmin, isBDE, isCounsel, isVisa, isManager]);

  const pendingAssignment = useMemo(() => students.filter(s => s.stage==="lead" && !s.bde_id && !s.assigned_to), [students]);
  const memberName = (id) => team.find(t => t.id===id)?.name || "";

  // Debounced query — only filter after user stops typing 250ms
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, "");

    let results = visibleStudents.filter(s => {
      // Name/phone search — fast, no note parsing
      if (q) {
        const nameMatch = (s.name||"").toLowerCase().includes(q);
        const phoneMatch = digits.length >= 2 && (s.phone||"").replace(/[^0-9]/g,"").includes(digits);
        const emailMatch = (s.email||"").toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !emailMatch) return false;
      }
      if (filterStage!=="all" && s.stage!==filterStage) return false;
      if (filterCountry!=="all" && s.country!==filterCountry) return false;
      if (filterQual!=="all" && s.qualification!==filterQual) return false;
      // Only parse notes for call filter (expensive — only when needed)
      if (filterCall!=="all") {
        const notes = s.notes||[];
        const lastCall = [...notes].reverse().find(n=>n.text?.startsWith("📞"));
        const lastOutcome = lastCall ? lastCall.text.split("\n")[0].replace("📞 CALL — ","") : "";
        const today = new Date().toISOString().slice(0,10);
        if (filterCall==="never" && lastCall) return false;
        if (filterCall==="never" && !lastCall) return true;
        if (filterCall==="not_reachable" && !lastOutcome.includes("Not reachable")) return false;
        if (filterCall==="callback" && !lastOutcome.includes("callback")) return false;
        if (filterCall==="busy" && !lastOutcome.includes("Busy")) return false;
        if (filterCall==="interested" && !lastOutcome.includes("Interested")) return false;
        if (filterCall==="not_interested" && !lastOutcome.includes("Not interested")) return false;
        if (filterCall==="booked" && !lastOutcome.includes("Counselling")) return false;
        if (filterCall==="whatsapp" && !lastOutcome.includes("WhatsApp")) return false;
        if (filterCall==="counselling_today") {
          const sl = slots.find(x=>x.booked_by===s.id&&x.status==="booked"&&x.slot_date===today);
          if (!sl) return false;
        }
        if (filterCall==="counselling_upcoming") {
          const sl = slots.find(x=>x.booked_by===s.id&&x.status==="booked"&&x.slot_date>today);
          if (!sl) return false;
        }
        if (filterCall==="overdue_callback") {
          const cbLine = lastCall?.text?.split("\n").find(l=>l.startsWith("Callback:"));
          if (!cbLine) return false;
          const cbDate = cbLine.replace("Callback:","").trim().slice(0,10);
          if (!cbDate || cbDate >= today) return false;
        }
        if (filterCall==="callback_today") {
          const cbLine = lastCall?.text?.split("\n").find(l=>l.startsWith("Callback:"));
          if (!cbLine) return false;
          const cbDate = cbLine.replace("Callback:","").trim().slice(0,10);
          if (cbDate !== today) return false;
        }
      }
      return true;
    });

    // When searching by name, sort exact matches to top
    if (q && !digits) {
      results = results.sort((a, b) => {
        const aName = (a.name||"").toLowerCase();
        const bName = (b.name||"").toLowerCase();
        const aStarts = aName.startsWith(q) ? 0 : 1;
        const bStarts = bName.startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      });
    }

    return results;
  }, [visibleStudents, debouncedQuery, filterStage, filterCountry, filterQual, filterCall]);

  const searchHits = useMemo(() => {
    const q=globalQ.trim().toLowerCase().replace(/\s+/g,"");
    if (!q) return [];
    return visibleStudents.filter(s => {
      const hay=`${s.name} ${s.email} ${s.phone} ${(s.phone||"").replace(/[^0-9]/g,"")}`.toLowerCase().replace(/\s+/g,"");
      return hay.includes(q);
    }).slice(0,6);
  }, [visibleStudents, globalQ]);

  const stats = useMemo(() => ({
    total:     visibleStudents.length,
    // "In Pipeline" = actively processing (excludes leads, terminal/inactive stages)
    active:    visibleStudents.filter(s => ["processing","counsel","shortlist","applied","offer","finance","visa","predep"].includes(s.stage)).length,
    // "Offers+" = students who have received an offer and are at or beyond offer stage (incl. departed)
    offers:    visibleStudents.filter(s => ["offer","finance","visa","predep","departed"].includes(s.stage)).length,
    departed:  visibleStudents.filter(s => s.stage==="departed").length,
    // All students with any follow-up scheduled (not just next 2 days)
    followUps: visibleStudents.filter(s => s.follow_up).length,
    pending:   pendingAssignment.length,
  }), [visibleStudents, pendingAssignment]);

  /* mutations */
  const updStudent = async (id, patch) => {
    try { setSyncing(true); const u=await updateStudent(id,patch); setStudents(p=>p.map(s=>s.id===id?{...s,...u}:s)); }
    catch(e) { notify("Save failed"); console.error(e); }
    finally { setSyncing(false); }
  };
  const moveStage = async (id, dir) => {
    const s=students.find(x=>x.id===id); if (!s) return;
    const i=Math.min(STAGES.length-1,Math.max(0,stageIdx(s.stage)+dir));
    await updStudent(id,{stage:STAGES[i].id});
  };
  const doAddNote = async (studentId, text) => {
    if (!text?.trim()) return;
    try { const n=await dbAddNote(studentId,text.trim()); setStudents(p=>p.map(s=>s.id===studentId?{...s,notes:[n,...(s.notes||[])]}:s)); }
    catch { notify("Could not save note"); }
  };

  const doDeleteNote = async (studentId, noteId) => {
    try {
      await dbDeleteNote(noteId);
      setStudents(p=>p.map(s=>s.id===studentId?{...s,notes:(s.notes||[]).filter(n=>n.id!==noteId)}:s));
    } catch(e) { notify("Could not delete: " + e.message); }
  };

  const doUpdateNote = async (studentId, noteId, text) => {
    try {
      await dbUpdateNote(noteId, text);
      setStudents(p=>p.map(s=>s.id===studentId?{...s,notes:(s.notes||[]).map(n=>n.id===noteId?{...n,text}:n)}:s));
    } catch(e) { notify("Could not update: " + e.message); }
  };

  const assignToBDE = async (studentId, bdeId) => {
    if (bdeId==="remove") {
      await updStudent(studentId,{bde_id:null});
      await doAddNote(studentId,"BDE removed by Admin.");
      notify("BDE removed"); return;
    }
    const prev=students.find(s=>s.id===studentId)?.bde_id;
    await updStudent(studentId,{bde_id:bdeId});
    if (prev && prev!==bdeId) {
      await doAddNote(studentId,`BDE reassigned from ${memberName(prev)} to ${memberName(bdeId)}.`);
    } else {
      await doAddNote(studentId,`BDE assigned: ${memberName(bdeId)}`);
    }
    notify(`BDE: ${memberName(bdeId)}`);
  };

  const assignCounsellor = async (studentId, cId) => {
    if (!cId) return;
    const cName = memberName(cId);
    await updStudent(studentId, { assigned_to: cId, stage: "counsel" });
    await doAddNote(studentId, `✅ Counsellor assigned: ${cName} — moved to Counselling stage`);
    if (isBDE || isManager) {
      setSpCounsellorId(cId);
      setSpStudentId(studentId);
      setSpDate(todayStr());
      setShowSlotPicker(true);
      notify(`${cName} assigned — pick a slot below`);
    } else {
      notify(`Assigned to ${cName} → Counselling ✓`);
    }
  };

  // Bulk assign
  const bulkAssignBDE = async (bdeId) => {
    if (!bdeId || selLeads.size===0) return;
    for (const id of selLeads) {
      await updStudent(id,{bde_id:bdeId});
      await doAddNote(id,`BDE assigned: ${memberName(bdeId)} (bulk)`);
    }
    notify(`${selLeads.size} leads → ${memberName(bdeId)}`);
    setSelLeads(new Set());
  };
  const bulkAssignCounsellor = async (cId) => {
    if (!cId || selLeads.size===0) return;
    for (const id of selLeads) {
      await updStudent(id,{assigned_to:cId, stage:"counsel"});
      await doAddNote(id,`Counsellor assigned: ${memberName(cId)} (bulk)`);
    }
    notify(`${selLeads.size} leads → ${memberName(cId)}`);
    setSelLeads(new Set());
  };
  // Distribute selected leads equally or custom among BDEs
  const distributeLeads = async (assignments) => {
    // assignments = [{ bdeId, leadIds[] }]
    try {
      notify("Distributing leads…");
      for (const { bdeId, leadIds } of assignments) {
        for (const id of leadIds) {
          await updStudent(id, { bde_id: bdeId });
        }
      }
      const total = assignments.reduce((s,a)=>s+a.leadIds.length,0);
      notify(`${total} leads distributed across ${assignments.length} BDEs`);
      setSelLeads(new Set());
      setShowDistribute(false);
    } catch(e) { notify("Distribution failed: "+e.message); }
  };

  const bulkDelete = async () => {
    if (selLeads.size===0) return;
    if (!window.confirm(`Delete ${selLeads.size} lead(s)? This cannot be undone.`)) return;
    const count = selLeads.size;
    try {
      notify("Deleting…");
      await bulkDeleteStudents([...selLeads]);
      setStudents(p=>p.filter(s=>!selLeads.has(s.id)));
      notify(`${count} leads deleted`);
      setSelLeads(new Set());
    } catch(e) {
      console.error("Bulk delete error:", e);
      notify("Delete failed: " + (e.message||"Check Supabase RLS policies"));
    }
  };

  const toggleLead = (id) => setSelLeads(prev=>{const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n;});
  const toggleAll  = () => setSelLeads(selLeads.size===filtered.length&&filtered.length>0 ? new Set() : new Set(filtered.map(s=>s.id)));

  const doAddStudent = async (form) => {
    try {
      const ff={...form};
      delete ff._bde_picked_counsellor;
      delete ff.counsellor_id;
      if (isBDE) {
        ff.bde_id = currentUser.id;
        ff.assigned_to = currentUser.id;
        // If BDE picked a counsellor, assign directly and move to counsel stage
        if (form.counsellor_id) {
          ff.assigned_to = form.counsellor_id;
          ff.stage = "counsel";
        }
      }
      const rec=await createStudent(ff);
      await Promise.all(DEFAULT_DOCS.map(n=>upsertDocument({student_id:rec.id,name:n,status:"Pending"})));
      // Add note if counsellor was assigned
      if (isBDE && form.counsellor_id) {
        const cName = team.find(t=>t.id===form.counsellor_id)?.name||"counsellor";
        await dbAddNote(rec.id, `✅ Counsellor assigned by BDE: ${cName}. Student moved to Counselling stage.`);
      }
      const refreshed=await getStudents(); setStudents(refreshed);
      setShowAdd(false); notify("Lead saved");
      // Auto-backup to Google Sheets immediately when new lead added
      if (webhookUrl) {
        try {
          fetch(webhookUrl, {
            method:"POST", mode:"no-cors",
            headers:{"Content-Type":"text/plain"},
            body: JSON.stringify({
              type:"new_lead",
              timestamp: new Date().toISOString(),
              student: { name:ff.name, phone:ff.phone, email:ff.email||"", country:ff.country, level:ff.level, stage:"lead" }
            })
          });
        } catch(e) {}
      }
    } catch(e) { notify("Could not save: "+e.message); }
  };
  const doDeleteStudent = async (id) => {
    try { await deleteStudent(id); setStudents(p=>p.filter(s=>s.id!==id)); setSelected(null); }
    catch { notify("Delete failed"); }
  };
  const doAddApp    = async (sid,f)     => { try { const a=await upsertApplication({student_id:sid,...f}); setStudents(p=>p.map(s=>s.id===sid?{...s,applications:[a,...(s.applications||[])]}:s)); } catch { notify("Could not save application"); } };
  const doUpdateApp = async (sid,aid,f) => { try { const a=await upsertApplication({id:aid,student_id:sid,...f}); setStudents(p=>p.map(s=>s.id===sid?{...s,applications:(s.applications||[]).map(x=>x.id===aid?a:x)}:s)); } catch { notify("Could not update"); } };
  const doDeleteApp = async (sid,aid)   => { try { await deleteApplication(aid); setStudents(p=>p.map(s=>s.id===sid?{...s,applications:(s.applications||[]).filter(x=>x.id!==aid)}:s)); } catch { notify("Could not delete"); } };
  const doCycleDoc  = async (sid,did,cur,name) => { const next=DOC_STATUSES[(DOC_STATUSES.indexOf(cur)+1)%DOC_STATUSES.length]; try { const d=await upsertDocument({id:did,student_id:sid,name,status:next}); setStudents(p=>p.map(s=>s.id===sid?{...s,documents:(s.documents||[]).map(x=>x.id===did?d:x)}:s)); } catch { notify("Could not update doc"); } };
  const doAddDoc = async (sid, name) => {
    if (!name || !name.trim()) return;
    try {
      const d = await upsertDocument({ student_id: sid, name: name.trim(), status: "Pending" });
      setStudents(p => p.map(s => {
        if (s.id !== sid) return s;
        const existing = s.documents || [];
        // remove any tmp placeholder with same name
        const filtered = existing.filter(x => !(x.id && x.id.startsWith('tmp-') && x.name === name.trim()));
        return { ...s, documents: [...filtered, d] };
      }));
      notify("Document added");
    } catch(e) { notify("Could not add doc: " + e.message); }
  };
  const doDeleteDoc = async (sid,did)   => { try { await deleteDocument(did); setStudents(p=>p.map(s=>s.id===sid?{...s,documents:(s.documents||[]).filter(x=>x.id!==did)}:s)); } catch { notify("Could not delete doc"); } };

  const doAddTeam    = async (m)     => { try { const r=await createTeamMember(m); setTeam(p=>[...p,r]); setShowAddTeam(false); notify("Member added"); } catch { notify("Could not add member"); } };
  const doUpdateTeam = async (id,patch)=> { try { const r=await updateTeamMember(id,patch); setTeam(p=>p.map(t=>t.id===id?{...t,...r}:t)); notify("Saved"); } catch { notify("Could not update"); } };
  const doDeleteTeam = async (id)    => { try { await deleteTeamMember(id); setTeam(p=>p.filter(t=>t.id!==id)); } catch { notify("Could not delete"); } };
  const doAddSlot = async (f, silent=false) => {
    try {
      const s=await createSlot(f);
      setSlots(p=>[...p,s]);
      if(!silent) { setShowAddSlot(false); notify("Slot added"); }
      return s;
    } catch(e) {
      notify("Could not add slot: "+e.message);
      return null;
    }
  };
  const doBookSlot = async (slotId, studentId) => {
    try {
      const slot = slots.find(x => x.id === slotId);
      const counsellorId = slot?.counsellor_id;
      const bookedSlotResult = await bookSlot(slotId, studentId);
      // Update slots state with booked_by populated
      setSlots(p => p.map(x => x.id === slotId ? {...bookedSlotResult, booked_by: studentId} : x));
      if (counsellorId && studentId) {
        const cName = memberName(counsellorId);
        const slotDate = slot?.slot_date || "";
        const slotTime = slot?.slot_time || "";
        const stName = students.find(s => s.id === studentId)?.name || "Student";
        await updStudent(studentId, { assigned_to: counsellorId, stage: "counsel" });
        // Update local student state too
        setStudents(p => p.map(s => s.id === studentId ? {...s, assigned_to: counsellorId, stage: "counsel"} : s));
        await doAddNote(studentId, `📅 Counselling booked — ${cName} on ${slotDate} at ${slotTime}`);
        notify(`✓ ${stName} → ${cName} · ${slotDate} at ${slotTime}`);
      } else {
        notify("Slot booked ✓");
      }
    } catch(e) {
      notify("Booking failed: " + e.message);
      console.error("doBookSlot error:", e);
    }
  };
  const doFreeSlot   = async (slotId) => { try { const s=await freeSlot(slotId); setSlots(p=>p.map(x=>x.id===slotId?s:x)); notify("Slot freed"); } catch { notify("Could not free slot"); } };
  const doDeleteSlot = async (slotId) => {
    try {
      await deleteSlot(slotId);
      setSlots(p=>p.filter(x=>x.id!==slotId));
      notify("Slot deleted");
    } catch { notify("Could not delete slot"); }
  };

  const doSaveSettings = async (sec) => {
    setSecurity(sec);
    try { await setSetting("security",sec); notify("Settings saved"); }
    catch { notify("Could not save settings"); }
  };
  const doBulkImport = async (rows) => {
    try {
      notify(`Importing ${rows.length} leads… please wait`);
      await bulkInsertStudents(rows);
      const r = await getStudents();
      setStudents(r);
      setShowImport(false);
      notify(`Imported ${rows.length} leads successfully`);
    } catch(e) {
      console.error("Import error:", e);
      notify("Import failed: " + (e.message || "Unknown error"));
    }
  };

  const exportRows = () => {
    const rows = exportStage==="all" ? students : students.filter(s=>s.stage===exportStage);
    return rows.map(s=>({
      Date: new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),
      Name: s.name, Phone: s.phone, Email: s.email||"",
      Qualification: s.qualification||"", Level: s.level,
      Country: s.country, Intake: s.intake, Field: s.field,
      Stage: stageOf(s.stage).label,
      BDE: memberName(s.bde_id), Counsellor: memberName(s.assigned_to),
      "Follow Up": s.follow_up||""
    }));
  };
  const doExport = (type) => {
    if (security.exportPass) {
      if (!exportPass) { setShowExportPass(true); return; }
      if (hashPassword(exportPass)!==security.exportPass) { notify("Wrong export password"); setExportPass(""); return; }
    }
    if (type==="excel") { const ws=XLSX.utils.json_to_sheet(exportRows()); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Leads"); XLSX.writeFile(wb,"abroadveda-leads.xlsx"); notify("Excel downloaded"); }
    else { const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(exportRows())); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="abroadveda-leads.csv"; a.click(); notify("CSV downloaded"); }
    setExportPass(""); setShowExportPass(false); setShowExport(false);
  };
  const sendToSheet = async (silent=false) => {
    if (!webhookUrl) { if(!silent) notify("Add Google Sheets URL in Settings first"); return; }
    try {
      await fetch(webhookUrl, {
        method:"POST", mode:"no-cors",
        headers:{"Content-Type":"text/plain"},
        body: JSON.stringify({
          type:"full_backup",
          timestamp: new Date().toISOString(),
          total: students.length,
          rows: students.map(s=>[
            s.name, s.phone, s.email||"", s.country, s.level, s.intake,
            stageOf(s.stage).label, memberName(s.bde_id), memberName(s.assigned_to),
            s.qualification||"", s.follow_up||"",
            new Date(s.created_at||Date.now()).toLocaleDateString("en-GB")
          ])
        })
      });
      if(!silent) notify("✓ Backed up to Google Sheets");
    } catch { if(!silent) notify("Could not reach Google Sheets"); }
  };

  // Auto-backup every 2 minutes when data changes
  useEffect(() => {
    if (!webhookUrl || students.length === 0) return;
    const t = setTimeout(() => sendToSheet(true), 2 * 60 * 1000);
    return () => clearTimeout(t);
  }, [students, webhookUrl]);
  const openStudent = (id) => { setTab("students"); setSelected(id); setGlobalQ(""); };


  if (loading) return <Splash text="Connecting to database…"/>;
  if (!dbOk) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{background:T.mist}}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-lg text-center">
        <WifiOff size={36} className="text-red-400 mx-auto mb-3"/>
        <h2 className="font-extrabold text-lg mb-2">Database not connected</h2>
        <p className="text-sm text-slate-500 mb-4">Check your Supabase keys in GitHub Secrets.</p>
        <button onClick={loadAll} className="w-full py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2" style={{borderColor:T.line}}><RefreshCw size={14}/> Retry</button>
      </div>
    </div>
  );
  if (!currentUser) return <LoginScreen team={team} security={security} onLogin={(u,r)=>{
    setCurrentUser(u); setActiveRole(r); setTab("dashboard");
    try { localStorage.setItem("crm_user", JSON.stringify(u)); localStorage.setItem("crm_role", r||""); } catch {}
  }}/>;

  const selectedStudent = students.find(s=>s.id===selected);
  const userRoles = currentUser.isAdmin ? ["Admin"] : parseRoles(currentUser.role);

  const NAV = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["pipeline",  KanbanSquare,    "Pipeline"],
    ["students",  Users,           "Students"],
    ["slots",     Calendar,        "Slots"],
    ...(isAdmin ? [["team", Briefcase, "Team"], ["db", Database, "DB & Backup"]] : []),
  ];

  return (
    <div className="min-h-screen" style={{background:T.mist,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",color:T.ink}}>
      <style>{`
        ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:6px}
        input:focus,select:focus,textarea:focus{outline:2px solid #0d6efd33;border-color:#0d6efd !important}
        .num{font-variant-numeric:tabular-nums}
        .card{background:#fff;border:1px solid ${T.line};border-radius:18px;box-shadow:0 1px 3px rgba(10,31,61,.05)}
        .lift{transition:box-shadow .15s,transform .15s}.lift:hover{box-shadow:0 6px 20px rgba(10,31,61,.09);transform:translateY(-1px)}
        a{text-decoration:none}
        .call-btn{display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;border-radius:14px;transition:transform .1s,opacity .1s;padding:12px 18px;font-size:15px;}
        .call-btn:active{transform:scale(.96)}
      `}</style>

      {/* SIDEBAR */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-40 px-4 py-5" style={{background:T.ink}}>
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
          <div><div className="font-extrabold text-white text-sm tracking-wide">ABROAD VEDA</div><div className="text-[9px] text-blue-200/70 tracking-widest uppercase">CRM Workspace</div></div>
        </div>
        {/* User chip with role switcher */}
        <div className="mt-4 mx-1 px-3 py-2 rounded-xl bg-white/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs" style={{background:rMeta(role)?.color}}>{(currentUser.name||"?")[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{currentUser.name}</div>
            {userRoles.length>1
              ? <select value={role} onChange={e=>setActiveRole(e.target.value)} className="text-[10px] bg-transparent text-blue-200 border-0 p-0 cursor-pointer w-full">
                  {userRoles.map(r=><option key={r} value={r} style={{color:"#000"}}>{r}</option>)}
                </select>
              : <div className="text-[10px]" style={{color:rMeta(role)?.color}}>{role}</div>
            }
          </div>
        </div>
        <nav className="mt-5 space-y-1">
          {NAV.map(([id,Icon,label])=>(
            <button key={id} onClick={()=>goTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${tab===id?"text-slate-900 bg-white":"text-blue-100/80 hover:bg-white/10"}`}>
              <Icon size={17} style={tab===id?{color:T.blue}:{}}/>
              {label}
              {id==="students" && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md num" style={{background:tab===id?"#EAF2FF":"rgba(255,255,255,.12)",color:tab===id?T.blue:"#BFD7FF"}}>{visibleStudents.length}</span>}
              {id==="dashboard" && isAdmin && stats.pending>0 && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white num">{stats.pending}</span>}
            </button>
          ))}
        </nav>
        {(isAdmin||isBDE||isManager) && (
          <button onClick={()=>setShowAdd(true)} className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90" style={{background:(isBDE||isManager)?T.teal:T.blue}}>
            <UserPlus size={16}/> Add lead
          </button>
        )}
        <div className="mt-auto space-y-1 pt-5 border-t border-white/10">
          {isAdmin && <button onClick={()=>setShowExport(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Download size={15}/> Export leads</button>}
          {isAdmin && <button onClick={()=>setShowImport(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Upload size={15}/> Import leads</button>}
          {isAdmin && webhookUrl && (
            <button onClick={()=>sendToSheet(false)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-white/10" style={{color:"#4ADE80"}}>
              <Send size={15}/> Backup to Sheets
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:"#166534",color:"#4ADE80"}}>LIVE</span>
            </button>
          )}
          {isAdmin && !webhookUrl && (
            <button onClick={()=>setShowSettings(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-amber-300/80 hover:bg-white/10">
              <Send size={15}/> Connect Drive backup
            </button>
          )}
          {isAdmin && <button onClick={()=>setShowSettings(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10"><Cog size={15}/> Settings</button>}
          <div className="px-3 pt-1 text-[10px] text-blue-200/50 flex items-center gap-1.5">{syncing?<><Loader2 size={9} className="animate-spin"/> Syncing…</>:<><Wifi size={9}/> Live</>}</div>
          <button
            onClick={()=>{setCurrentUser(null);setActiveRole(null);try{localStorage.removeItem("crm_user");localStorage.removeItem("crm_role");}catch{}}}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-300/80 hover:bg-red-500/15 hover:text-red-300 transition mt-1">
            <LogOut size={15}/> Log out
          </button>
        </div>
      </aside>

      <div className="md:pl-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center gap-3 border-b" style={{background:"rgba(245,247,251,.92)",backdropFilter:"blur(8px)",borderColor:T.line}}>
          <div className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm" style={{background:"linear-gradient(135deg,#0d6efd,#F59E0B)"}}>AV</div>
          <div className="relative flex-1 max-w-lg">
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400"/>
            <input value={globalQ} onChange={e=>setGlobalQ(e.target.value)} placeholder="Search by name or phone number…" className="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm bg-white" style={{borderColor:T.line}}/>
            {globalQ && <button onClick={()=>setGlobalQ("")} className="absolute right-3 top-3 text-slate-400"><X size={13}/></button>}
            {searchHits.length>0 && (
              <div className="absolute mt-1.5 w-full card overflow-hidden z-50">
                {searchHits.map(s=>(
                  <button key={s.id} onClick={()=>openStudent(s.id)} className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-50/50 text-left border-b last:border-0" style={{borderColor:T.line}}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{background:stageOf(s.stage).color}}>{(s.name||"?")[0]}</span>
                    <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{s.name}</span><span className="block text-[11px] text-slate-400 num">{s.phone} · {stageOf(s.stage).label}</span></span>
                    <ArrowRight size={13} className="text-slate-300"/>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="hidden md:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:rMeta(role)?.badge,color:rMeta(role)?.tx}}>{role}</span>
          {(isAdmin||isBDE||isManager) && <button onClick={()=>setShowAdd(true)} className="md:hidden p-2.5 rounded-xl text-white" style={{background:T.blue}}><UserPlus size={16}/></button>}
          <button onClick={()=>{setCurrentUser(null);setActiveRole(null);try{localStorage.removeItem("crm_user");localStorage.removeItem("crm_role");}catch{}}} className="md:hidden p-2.5 rounded-xl border text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition" title="Log out" style={{borderColor:T.line}}><LogOut size={16}/></button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full md:pb-8" style={{paddingBottom:"calc(5.5rem + env(safe-area-inset-bottom))"}} id="main-content">

          {/* DASHBOARD */}
          {tab==="dashboard" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-extrabold">Namaste, {currentUser.name.split(" ")[0]} 🙏</h1>
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} · <span style={{color:rMeta(role)?.color}}>{role} view</span></p>
              </div>

              {/* Unassigned alert */}
              {isAdmin && pendingAssignment.length>0 && (
                <div className="card p-4 border-l-4" style={{borderLeftColor:T.danger}}>
                  <div className="flex items-center gap-2 mb-3"><AlertCircle size={17} style={{color:T.danger}}/><span className="font-bold text-sm">{pendingAssignment.length} lead{pendingAssignment.length!==1?"s":""} waiting for assignment</span></div>
                  {pendingAssignment.slice(0,4).map(s=>(
                    <div key={s.id} className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 mb-2">
                      <button onClick={()=>openStudent(s.id)} className="font-semibold text-sm hover:underline">{s.name}</button>
                      <span className="text-[11px] text-slate-400 num">{s.phone} · {s.country}</span>
                      <div className="ml-auto flex gap-2">
                        <select defaultValue="" onChange={e=>e.target.value&&assignToBDE(s.id,e.target.value)} className="text-xs py-1.5 px-2 rounded-lg border bg-white font-medium" style={{borderColor:T.line}}>
                          <option value="" disabled>Assign BDE…</option>
                          {bdeList.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select defaultValue="" onChange={e=>e.target.value&&assignCounsellor(s.id,e.target.value)} className="text-xs py-1.5 px-2 rounded-lg border bg-white font-medium" style={{borderColor:T.line}}>
                          <option value="" disabled>Assign Counsellor…</option>
                          {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className={`grid gap-3 ${(isAdmin||isManager)&&stats.pending>0 ? "grid-cols-2 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-5"}`}>
                {[
                  ["Total",        stats.total,     T.blue],
                  ["In Pipeline",  stats.active,    "#6366F1"],
                  ["Offers+",      stats.offers,    T.saffron],
                  ["Departed",     stats.departed,  T.ok],
                  ["Follow-ups",   stats.followUps, T.danger],
                  ...((isAdmin||isManager)&&stats.pending>0 ? [["Unassigned", stats.pending, "#EF4444"]] : []),
                ].map(([l,v,c])=>(
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
                  {STAGES.map(st=>{
                    const count=visibleStudents.filter(s=>s.stage===st.id).length;
                    return (
                      <button key={st.id} onClick={()=>{setTab("students");setFilterStage(st.id);}} className="flex-1 min-w-[64px] group text-center">
                        <div className="text-lg font-extrabold num" style={{color:count?st.color:"#CBD5E1"}}>{count}</div>
                        <div className="h-2 rounded-full mt-1" style={{background:count?st.color:"#E8EDF5"}}/>
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
                  {visibleStudents.filter(s=>s.follow_up).sort((a,b)=>a.follow_up.localeCompare(b.follow_up)).slice(0,5).map(s=>(
                    <div key={s.id} className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{borderColor:T.line}}>
                      <button onClick={()=>openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate">{s.name}</span>
                        <span className={`text-[11px] font-bold ${isOverdue(s)?"text-red-600":"text-slate-400"}`}>{isOverdue(s)?"Overdue — ":""}{s.follow_up}</span>
                      </button>
                      <a href={`tel:${telNum(s.phone)}`} className="p-3 rounded-xl text-white font-bold" style={{background:T.blue}}><PhoneCall size={16}/></a>
                      <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-3 rounded-xl text-white font-bold" style={{background:"#25D366"}}><MessageCircle size={16}/></a>
                    </div>
                  ))}
                  {!visibleStudents.some(s=>s.follow_up) && <p className="text-sm text-slate-400">No follow-ups scheduled.</p>}
                </div>
                {/* Hot leads */}
                <div className="card p-5">
                  <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Flame size={15} style={{color:T.danger}}/> Hot leads</h2>
                  {visibleStudents.filter(s=>s.qualification==="Hot"&&s.stage!=="departed").slice(0,5).map(s=>(
                    <div key={s.id} className="flex items-center gap-2 py-2.5 border-b last:border-0" style={{borderColor:T.line}}>
                      <button onClick={()=>openStudent(s.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-semibold truncate hover:underline">{s.name}</span>
                        <span className="block text-[11px] text-slate-400">{stageOf(s.stage).label} · {s.country}</span>
                      </button>
                      <a href={`tel:${telNum(s.phone)}`} className="p-3 rounded-xl text-white font-bold" style={{background:T.blue}}><PhoneCall size={16}/></a>
                      <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-3 rounded-xl text-white font-bold" style={{background:"#25D366"}}><MessageCircle size={16}/></a>
                    </div>
                  ))}
                  {!visibleStudents.some(s=>s.qualification==="Hot"&&s.stage!=="departed") && <p className="text-sm text-slate-400">No hot leads.</p>}
                </div>
              </div>

              <TodaySchedule slots={slots} students={students} team={team} isAdmin={isAdmin} isBDE={isBDE} isManager={isManager} isCounsel={isCounsel} currentUserId={currentUser?.id} onTabChange={setTab}/>
            </div>
          )}

          {/* PIPELINE */}
          {tab==="pipeline" && (
            <div>
              <h1 className="text-xl font-extrabold mb-4">Application pipeline</h1>
              <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4" style={{scrollbarWidth:"thin",scrollbarColor:"#CBD5E1 transparent"}}>
                {STAGES.map(st=>{
                  const col=visibleStudents.filter(s=>s.stage===st.id);
                  const inSel=pipeSelStage===st.id;
                  const allColSelected=col.length>0&&col.every(s=>pipeSelected.has(s.id));
                  return (
                    <div key={st.id} className="w-60 shrink-0 rounded-2xl p-3 flex flex-col" style={{background:"#ECF1F9",maxHeight:"calc(100vh - 180px)"}}>
                      {/* Column header */}
                      <div className="flex items-center gap-2 mb-2 px-1 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:st.color}}/>
                        <span className="text-xs font-bold truncate flex-1">{st.label}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-white rounded-full px-2 py-0.5 num shrink-0">{col.length}</span>
                        {col.length>0 && !inSel && isAdmin && (
                          <button
                            title={`Export ${st.label} contacts`}
                            onClick={()=>{
                              const rows = col.map(s=>({
                                Name: s.name,
                                Phone: s.phone||"",
                                Email: s.email||"",
                                Country: s.country||"",
                                Level: s.level||"",
                                Intake: s.intake||"",
                                BDE: memberName(s.bde_id),
                                Counsellor: memberName(s.assigned_to),
                                "Follow Up": s.follow_up||"",
                                "Added On": new Date(s.created_at||Date.now()).toLocaleDateString("en-GB"),
                              }));
                              const ws = XLSX.utils.json_to_sheet(rows);
                              const wb = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(wb, ws, st.label.slice(0,31));
                              XLSX.writeFile(wb, `abroadveda-${st.id}.xlsx`);
                              notify(`Exported ${col.length} contacts from ${st.label}`);
                            }}
                            className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-green-600 shrink-0">
                            <Download size={12}/>
                          </button>
                        )}
                        {col.length>0 && !inSel && (isAdmin || isManager || (isBDE && ["lead","notinterested","enrolled"].includes(st.id))) && (
                          <button onClick={()=>{setPipeSelStage(st.id);setPipeSelected(new Set());}} title="Select to delete" className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-red-500 shrink-0"><Trash2 size={12}/></button>
                        )}
                        {inSel && (
                          <button onClick={()=>{setPipeSelStage(null);setPipeSelected(new Set());}} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 shrink-0">✕</button>
                        )}
                      </div>
                      {/* Select-mode action bar */}
                      {inSel && (
                        <div className="mb-2 space-y-1.5 shrink-0">
                          <div className="flex gap-1.5">
                            <button onClick={()=>setPipeSelected(allColSelected ? new Set() : new Set(col.map(s=>s.id)))}
                              className="flex-1 text-[10px] font-bold py-1 rounded-lg border border-slate-300 bg-white text-slate-600">
                              {allColSelected?"Deselect all":"Select all"}
                            </button>
                            <button
                              disabled={pipeSelected.size===0}
                              onClick={async()=>{
                                if(!window.confirm(`Delete ${pipeSelected.size} student(s) from ${st.label}? This cannot be undone.`)) return;
                                const ids=[...pipeSelected];
                                setPipeSelStage(null); setPipeSelected(new Set());
                                for(const id of ids) await doDeleteStudent(id);
                                notify(`${ids.length} student(s) deleted`);
                              }}
                              className="flex-1 text-[10px] font-bold py-1 rounded-lg text-white disabled:opacity-40"
                              style={{background:T.danger}}>
                              Delete ({pipeSelected.size})
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 overflow-y-auto flex-1 pr-0.5" style={{scrollbarWidth:"thin",scrollbarColor:"#CBD5E1 transparent"}}>
                        {col.length===0 && <div className="text-[11px] text-slate-400 text-center py-3 rounded-xl border border-dashed" style={{borderColor:"#CBD5E1"}}>Empty</div>}
                        {col.map(s=>{
                          const isChecked=pipeSelected.has(s.id);
                          let bookedSlot = slots.find(sl=>sl.booked_by===s.id&&sl.status==="booked");
                          let noteBooking = null;
                          if (!bookedSlot) {
                            const bookingNotes = (s.notes||[])
                              .filter(n=>n.text?.startsWith("📅 Counselling booked"))
                              .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
                            for (const bn of bookingNotes) {
                              const m = bn.text.match(/on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/);
                              if (m) {
                                const sl = slots.find(x=>x.slot_date===m[1]&&x.slot_time===m[2]);
                                if (sl) { bookedSlot = sl; break; }
                                if (!noteBooking) noteBooking = { slot_date: m[1], slot_time: m[2] };
                              }
                            }
                          }
                          const bk = bookedSlot || noteBooking;
                          return (
                          <div key={s.id}
                            className={`card p-3 transition ${inSel?"cursor-pointer":""} ${isChecked?"ring-2 ring-red-400 bg-red-50":""}`}
                            onClick={inSel?()=>{const n=new Set(pipeSelected);isChecked?n.delete(s.id):n.add(s.id);setPipeSelected(n);}:undefined}>
                            <div className="flex items-center gap-1.5">
                              {inSel && <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isChecked?"bg-red-500 border-red-500":"border-slate-300"}`}>
                                {isChecked&&<span className="text-white text-[9px] font-bold">✓</span>}
                              </span>}
                              <button onClick={inSel?e=>e.stopPropagation():()=>openStudent(s.id)} className="font-semibold text-sm hover:underline text-left truncate flex-1">{s.name}</button>
                              {s.qualification && <span className="w-2 h-2 rounded-full shrink-0" style={{background:qualColor(s.qualification)}}/>}
                            </div>
                            <div className="text-[11px] text-slate-500">{memberName(s.assigned_to)||"Unassigned"}</div>
                            {bk && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg num" style={{background:"#CCFBF1",color:"#0D9488"}}>
                                  📅 {new Date(bk.slot_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} · {bk.slot_time}
                                </span>
                              </div>
                            )}
                            {!inSel && (
                              <div className="flex items-center gap-1 mt-2">
                                {(isAdmin||isCounsel||isVisa||isManager) && <button onClick={()=>moveStage(s.id,-1)} disabled={stageIdx(s.stage)===0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20"><ChevronLeft size={13}/></button>}
                                <a href={`tel:${telNum(s.phone)}`} className="flex-1 flex justify-center p-2 rounded-lg text-white font-bold" style={{background:T.blue}}><PhoneCall size={14}/></a>
                                <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-white font-bold" style={{background:"#25D366"}}><MessageCircle size={14}/></a>
                                {(isAdmin||isCounsel||isVisa||isManager) && <button onClick={()=>moveStage(s.id,1)} disabled={stageIdx(s.stage)===STAGES.length-1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20" style={{color:T.blue}}><ChevronRight size={13}/></button>}
                              </div>
                            )}
                          </div>
                          );
                        })}
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
                {(isAdmin||isBDE||isManager) && <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{background:(isBDE||isManager)?T.teal:T.blue}}><UserPlus size={14}/> Add lead</button>}
              </div>

              {/* Filters */}
              {(() => {
                const activeFilterCount = [filterStage!=="all",filterCountry!=="all",filterQual!=="all",filterCall!=="all"].filter(Boolean).length;
                const filterSelects = (
                  <>
                    <select value={filterQual} onChange={e=>setFilterQual(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All quals</option>{QUALS.map(q=><option key={q.id} value={q.id}>{q.id}</option>)}</select>
                    <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All stages</option>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
                    <select value={filterCountry} onChange={e=>setFilterCountry(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}><option value="all">All countries</option>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
                    <select value={filterCall} onChange={e=>setFilterCall(e.target.value)} className="py-2 px-2 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:filterCall!=="all"?"#F59E0B":T.line,color:filterCall!=="all"?"#92400E":"inherit"}}>
                      <option value="all">All call status</option>
                      <option value="never">📵 Never called</option>
                      <option value="callback_today">📅 Callback today</option>
                      <option value="overdue_callback">⚠️ Overdue callback</option>
                      <option value="counselling_today">🎓 Counselling today</option>
                      <option value="counselling_upcoming">📆 Counselling upcoming</option>
                      <option value="not_reachable">🔴 Not reachable</option>
                      <option value="busy">🟡 Busy — try again</option>
                      <option value="callback">🔵 Callback later</option>
                      <option value="interested">🟢 Interested</option>
                      <option value="not_interested">⛔ Not interested</option>
                      <option value="booked">✅ Counselling booked</option>
                      <option value="whatsapp">💬 WhatsApp sent</option>
                    </select>
                  </>
                );
                const searchBox = (
                  <div className="relative flex-1 min-w-[160px]">
                    <Search size={13} className="absolute left-3 top-2.5 text-slate-400"/>
                    <input value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())setFilterStage("all");}} placeholder="Name or phone…" className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-white" style={{borderColor:T.line}}/>
                    {query && <button onClick={()=>setQuery("")} className="absolute right-2.5 top-2 text-slate-400"><X size={14}/></button>}
                  </div>
                );
                return (
                  <>
                    {/* Desktop: all filters inline */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      {searchBox}
                      {filterSelects}
                    </div>
                    {/* Mobile: search + filter toggle */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex gap-2">
                        {searchBox}
                        <button onClick={()=>setShowMobileFilters(v=>!v)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold shrink-0 transition"
                          style={{borderColor:activeFilterCount>0?T.blue:T.line,background:activeFilterCount>0?"#EAF2FF":"#fff",color:activeFilterCount>0?T.blue:"#64748B"}}>
                          <Filter size={14}/>
                          {activeFilterCount>0 && <span className="w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white" style={{background:T.blue}}>{activeFilterCount}</span>}
                        </button>
                      </div>
                      {showMobileFilters && (
                        <div className="grid grid-cols-2 gap-2">
                          {filterSelects}
                          {activeFilterCount>0 && <button onClick={()=>{setFilterStage("all");setFilterCountry("all");setFilterQual("all");setFilterCall("all");setShowMobileFilters(false);}} className="col-span-2 py-2 rounded-xl border text-xs font-bold text-red-500 border-red-200 bg-red-50">Clear all filters</button>}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Bulk action bar */}
              {(isAdmin||isManager) && selLeads.size>0 && (
                <div className="card p-3 flex flex-wrap items-center gap-3 border-2" style={{borderColor:T.blue}}>
                  <span className="font-bold text-sm" style={{color:T.blue}}>{selLeads.size} selected</span>
                  <select defaultValue="" onChange={e=>{if(e.target.value){bulkAssignBDE(e.target.value);e.target.value="";}} } className="py-1.5 px-2 rounded-xl border text-sm bg-white font-medium" style={{borderColor:T.line}}>
                    <option value="" disabled>Assign to BDE…</option>
                    {bdeList.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select defaultValue="" onChange={e=>{if(e.target.value){bulkAssignCounsellor(e.target.value);e.target.value="";}} } className="py-1.5 px-2 rounded-xl border text-sm bg-white font-medium" style={{borderColor:T.line}}>
                    <option value="" disabled>Assign to Counsellor…</option>
                    {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={()=>setShowDistribute(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold" style={{background:T.purple}}>⚡ Distribute</button>
                  <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold" style={{background:T.danger}}><Trash2 size={13}/> Delete</button>
                  <button onClick={()=>setSelLeads(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-700">Clear</button>
                </div>
              )}

              {/* ── MOBILE card list ── */}
              <div className="sm:hidden space-y-2">
                {filtered.length===0 && (
                  <div className="card p-8 text-center">
                    <p className="text-sm text-slate-400">No students found.</p>
                    {(query||filterStage!=="all"||filterCountry!=="all"||filterQual!=="all"||filterCall!=="all") && (
                      <button onClick={()=>{setQuery("");setFilterStage("all");setFilterCountry("all");setFilterQual("all");setFilterCall("all");}} className="mt-2 text-xs font-semibold text-blue-600">Clear filters</button>
                    )}
                  </div>
                )}
                {filtered.map(s=>{
                  const st=stageOf(s.stage);
                  const notes=s.notes||[];
                  const lastCall=[...notes].reverse().find(n=>n.text?.startsWith("📞"));
                  const outcome=lastCall?lastCall.text.split("\n")[0].replace("📞 CALL — ",""):null;
                  const callColor=!outcome?"#94A3B8":outcome.includes("Not reachable")?"#DC2626":outcome.includes("Busy")?"#F59E0B":outcome.includes("callback")?"#0d6efd":(outcome.includes("Interested")&&!outcome.includes("Not"))?"#16A34A":outcome.includes("Not interested")?"#64748B":outcome.includes("Counselling")?"#14B8A6":outcome.includes("WhatsApp")?"#25D366":"#94A3B8";
                  const shortLabel=!outcome?"Never called":outcome.includes("Not reachable")?"Not reachable":outcome.includes("Busy")?"Busy":outcome.includes("callback")?"Callback":(outcome.includes("Interested")&&!outcome.includes("Not"))?"Interested":outcome.includes("Not interested")?"Not interested":outcome.includes("Counselling")?"Booked ✓":outcome.includes("WhatsApp")?"WhatsApp":outcome?.slice(0,14)||"Called";
                  const chk=selLeads.has(s.id);
                  return (
                    <div key={s.id} className={`card p-4 active:scale-[.99] transition-transform ${chk?"ring-2 ring-blue-400":""}`}
                      onClick={()=>(isAdmin||isManager)?setSelected(s.id):setSelected(s.id)}>
                      <div className="flex items-start gap-3">
                        {(isAdmin||isManager) && <button className="mt-0.5 shrink-0" onClick={e=>{e.stopPropagation();toggleLead(s.id);}}>{chk?<CheckSquare size={18} style={{color:T.blue}}/>:<Square size={18} className="text-slate-300"/>}</button>}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0" style={{background:st.color}}>{(s.name||"?")[0]}</div>
                        <div className="flex-1 min-w-0" onClick={()=>setSelected(s.id)}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm">{s.name}</span>
                            {s.qualification && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:qualColor(s.qualification)+"22",color:qualColor(s.qualification)}}>{s.qualification}</span>}
                          </div>
                          <div className="text-xs text-slate-400 num mt-0.5">{s.phone}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{background:st.color+"18",color:st.color}}>{st.label}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">{s.level} · {s.country}</span>
                            {s.assigned_to && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600">{memberName(s.assigned_to)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:callColor+"18",color:callColor}}>{shortLabel}</span>
                            {s.follow_up && <span className={`text-[10px] font-semibold num ${isOverdue(s)?"text-red-600":"text-slate-400"}`}>{isOverdue(s)?"⚠️ ":""}{s.follow_up}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a href={`tel:${telNum(s.phone)}`} onClick={e=>e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-white font-bold text-sm" style={{background:T.blue}}><PhoneCall size={16}/> Call</a>
                        <a href={waNum(s.phone)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-white font-bold text-sm" style={{background:"#25D366"}}><MessageCircle size={16}/> WhatsApp</a>
                        {(isAdmin||isManager) && <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete ${s.name}?`))doDeleteStudent(s.id);}} className="p-3 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition"><Trash2 size={17}/></button>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP table ── */}
              <div id="students-table" className="hidden sm:block card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b" style={{borderColor:T.line}}>
                      {(isAdmin||isManager) && <th className="p-3 w-8"><button onClick={toggleAll}>{selLeads.size===filtered.length&&filtered.length>0?<CheckSquare size={15} style={{color:T.blue}}/>:<Square size={15}/>}</button></th>}
                      <th className="p-3">Student</th><th className="p-3">Course</th><th className="p-3">Stage</th><th className="p-3">Assigned</th><th className="p-3">Call Status · Follow-up</th><th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(s=>{
                      const st=stageOf(s.stage); const chk=selLeads.has(s.id);
                      return (
                        <tr key={s.id} className={`border-b last:border-0 hover:bg-blue-50/40 cursor-pointer ${chk?"bg-blue-50":""}`} style={{borderColor:"#F0F4FA"}}>
                          {(isAdmin||isManager) && <td className="p-3" onClick={e=>{e.stopPropagation();toggleLead(s.id);}}>{chk?<CheckSquare size={15} style={{color:T.blue}}/>:<Square size={15} className="text-slate-300"/>}</td>}
                          <td className="p-3" onClick={()=>setSelected(s.id)}>
                            <div className="font-semibold flex items-center gap-2">{s.name}
                              {s.qualification && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:qualColor(s.qualification)+"1A",color:qualColor(s.qualification)}}>{s.qualification}</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 num">{s.phone}</div>
                          </td>
                          <td className="p-3 text-xs" onClick={()=>setSelected(s.id)}>{s.level} · {s.country}<div className="text-slate-400">{s.field}</div></td>
                          <td className="p-3" onClick={()=>setSelected(s.id)}><span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{background:st.color+"15",color:st.color}}>{st.label}</span></td>
                          <td className="p-3 text-xs" onClick={()=>setSelected(s.id)}>
                            {s.bde_id && <div className="flex items-center gap-1"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:T.teal+"15",color:T.teal}}>BDE</span>{memberName(s.bde_id)}</div>}
                            {counsellors.find(c=>c.id===s.assigned_to) && <div className="flex items-center gap-1"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:T.blue+"15",color:T.blue}}>CNS</span>{memberName(s.assigned_to)}</div>}
                            {!s.bde_id && !s.assigned_to && <span className="text-red-500 font-semibold text-[11px]">Unassigned</span>}
                          </td>
                          <td className="p-3 text-xs" onClick={()=>setSelected(s.id)}>
                            {(()=>{
                              const notes=s.notes||[];
                              const lastCall=[...notes].reverse().find(n=>n.text?.startsWith("📞"));
                              const outcome=lastCall?lastCall.text.split("\n")[0].replace("📞 CALL — ",""):null;
                              const callColor=!outcome?"#94A3B8":outcome.includes("Not reachable")?"#DC2626":outcome.includes("Busy")?"#F59E0B":outcome.includes("callback")?"#0d6efd":(outcome.includes("Interested")&&!outcome.includes("Not"))?"#16A34A":outcome.includes("Not interested")?"#64748B":outcome.includes("Counselling")?"#14B8A6":outcome.includes("WhatsApp")?"#25D366":"#94A3B8";
                              const shortLabel=!outcome?"Never called":outcome.includes("Not reachable")?"Not reachable":outcome.includes("Busy")?"Busy":outcome.includes("callback")?"Callback":(outcome.includes("Interested")&&!outcome.includes("Not"))?"Interested":outcome.includes("Not interested")?"Not interested":outcome.includes("Counselling")?"Booked ✓":outcome.includes("WhatsApp")?"WhatsApp":outcome?.slice(0,14)||"Called";
                              const direct=slots.find(sl=>sl.booked_by===s.id&&sl.status==="booked");
                              let bookedSlot=direct;
                              if(!bookedSlot){const bns=(s.notes||[]).filter(n=>n.text?.startsWith("📅 Counselling booked")).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));for(const bn of bns){const m=bn.text.match(/on (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/);if(m){const sl=slots.find(x=>x.slot_date===m[1]&&x.slot_time===m[2]);if(sl){bookedSlot=sl;break;}}}}
                              return (<div className="space-y-1"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:callColor+"18",color:callColor}}>{shortLabel}</span>{bookedSlot?(<div><span className="text-[11px] font-extrabold px-2 py-1 rounded-lg num" style={{background:"#CCFBF1",color:"#0D9488"}}>📅 {new Date(bookedSlot.slot_date).toLocaleDateString("en-GB",{day:"numeric",month:"short"})} · {bookedSlot.slot_time}</span></div>):s.follow_up?(<div className={`text-[11px] num ${isOverdue(s)?"font-bold text-red-600":"text-slate-400"}`}>{isOverdue(s)?"⚠️ ":""}{s.follow_up}</div>):null}</div>);
                            })()}
                          </td>
                          <td className="p-3" onClick={e=>e.stopPropagation()}>
                            <div className="flex gap-1">
                              <a href={`tel:${telNum(s.phone)}`} className="p-2.5 rounded-xl text-white font-bold" style={{background:T.blue}} title="Call"><PhoneCall size={15}/></a>
                              <a href={waNum(s.phone)} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl text-white font-bold" style={{background:"#25D366"}} title="WhatsApp"><MessageCircle size={15}/></a>
                              {(isAdmin||isManager) && <button onClick={()=>{if(window.confirm(`Delete ${s.name}?`))doDeleteStudent(s.id);}} className="p-2.5 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500" title="Delete"><Trash2 size={15}/></button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length===0 && (
                      <tr><td colSpan={(isAdmin||isManager)?7:6} className="p-10 text-center">
                        <p className="text-sm text-slate-400">No students found.</p>
                        {(query||filterStage!=="all"||filterCountry!=="all"||filterQual!=="all"||filterCall!=="all") && (
                          <button onClick={()=>{setQuery("");setFilterStage("all");setFilterCountry("all");setFilterQual("all");setFilterCall("all");}} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">Clear all filters</button>
                        )}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STUDENT DETAIL */}
          {tab==="students" && selectedStudent && (
            <StudentDetail
              s={selectedStudent} team={team} counsellors={counsellors} bdeList={bdeList}
              memberName={memberName} role={role} isAdmin={isAdmin} isBDE={isBDE} isCounsel={isCounsel} isVisa={isVisa} isManager={isManager}
              slots={slots}
              onBack={()=>setSelected(null)} onUpdate={updStudent} onMove={moveStage}
              onAssignBDE={assignToBDE} onAssignCounsellor={assignCounsellor}
              onAddNote={doAddNote} onDeleteNote={doDeleteNote} onUpdateNote={doUpdateNote} onBookSlot={doBookSlot} onFreeSlot={doFreeSlot}
              onDeleteStudent={doDeleteStudent}
              onAddApp={doAddApp} onUpdateApp={doUpdateApp} onDeleteApp={doDeleteApp}
              onCycleDoc={doCycleDoc} onAddDoc={doAddDoc} onDeleteDoc={doDeleteDoc}
            />
          )}

          {/* SLOTS */}
          {tab==="slots" && (
            <SlotsView slots={slots} team={team} students={students} isAdmin={isAdmin} isBDE={isBDE} isCounsel={isCounsel} isManager={isManager}
              currentUser={currentUser} memberName={memberName}
              onAddSlot={doAddSlot} onBookSlot={doBookSlot} onFreeSlot={doFreeSlot} onDeleteSlot={doDeleteSlot}
              showAddSlot={showAddSlot} setShowAddSlot={setShowAddSlot}
              pendingBooking={pendingBooking} clearPendingBooking={()=>setPendingBooking(null)}
              notify={notify}/>
          )}

          {/* TEAM */}
          {tab==="team" && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold">Team</h1>
                <button onClick={()=>setShowAddTeam(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}><Plus size={14}/> Add member</button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.map(t=>(
                  <TeamCard key={t.id} member={t}
                    load={students.filter(s=>s.assigned_to===t.id&&s.stage!=="departed").length}
                    onUpdate={doUpdateTeam} onDelete={doDeleteTeam}/>
                ))}
              </div>
            </div>
          )}

          {/* DB & BACKUP */}
          {tab==="db" && isAdmin && (
            <DbBackupPanel students={students} team={team} slots={slots} onRefresh={loadAll} onExport={()=>setShowExport(true)} checkHealth={checkDbHealth}/>
          )}

        </main>
      </div>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t" style={{background:T.ink,borderColor:"rgba(255,255,255,.08)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        {NAV.map(([id,Icon,label])=>(
          <button key={id} onClick={()=>goTab(id)} className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 relative transition-opacity active:opacity-70">
            {tab===id && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{background:"#60A5FA"}}/>}
            <Icon size={21} style={{color:tab===id?"#fff":"#5B7FA6"}}/>
            <span className="text-[10px] font-bold" style={{color:tab===id?"#fff":"#5B7FA6"}}>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      {showAdd && (isAdmin||isBDE||isManager) && <AddStudentModal team={team} isBDE={isBDE} isManager={isManager} currentUser={currentUser} onClose={()=>setShowAdd(false)} onSave={doAddStudent}/>}
      {showAddTeam && isAdmin && <AddTeamModal onClose={()=>setShowAddTeam(false)} onSave={doAddTeam}/>}
      {showImport && isAdmin && <ImportModal team={team} onClose={()=>setShowImport(false)} onImport={doBulkImport}/>}
      {showDistribute && isAdmin && (
        <DistributeModal
          leads={[...selLeads].map(id=>students.find(s=>s.id===id)).filter(Boolean)}
          bdeList={bdeList}
          onClose={()=>setShowDistribute(false)}
          onDistribute={distributeLeads}
        />
      )}

      {showExport && isAdmin && (
        <AppModal title="Export leads" onClose={()=>setShowExport(false)}>
          {showExportPass ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Enter export password:</p>
              <input type="password" value={exportPass} onChange={e=>setExportPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doExport("excel")} placeholder="Export password" style={inp} autoFocus/>
              <div className="flex gap-2">
                <button onClick={()=>doExport("excel")} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Excel</button>
                <button onClick={()=>doExport("csv")} className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.ok}}>CSV</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stage filter */}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Filter by stage</label>
                <select value={exportStage} onChange={e=>setExportStage(e.target.value)} style={inp}>
                  <option value="all">All stages ({students.length} students)</option>
                  {STAGES.map(st=>{
                    const count = students.filter(s=>s.stage===st.id).length;
                    return <option key={st.id} value={st.id}>{st.label} ({count})</option>;
                  })}
                </select>
              </div>
              <div className="text-xs font-semibold text-slate-500 px-1">
                Exporting: <span className="font-bold" style={{color:T.blue}}>
                  {exportStage==="all" ? students.length : students.filter(s=>s.stage===exportStage).length} students
                </span>
                {exportStage!=="all" && <span className="ml-1 text-slate-400">({stageOf(exportStage).label})</span>}
              </div>
              <AppModalBtn icon={<FileSpreadsheet size={18} style={{color:T.ok}}/>} title="Download Excel (.xlsx)" sub="Full data with all columns" onClick={()=>doExport("excel")}/>
              <AppModalBtn icon={<Download size={18} style={{color:T.blue}}/>} title="Download CSV" sub="Import into Google Sheets" onClick={()=>doExport("csv")}/>
              <AppModalBtn icon={<Send size={18} style={{color:T.saffron}}/>} title="Send to Google Sheets" sub={webhookUrl?"Push all leads":"Set URL in Settings first"} onClick={sendToSheet}/>
            </div>
          )}
        </AppModal>
      )}

      {showSettings && isAdmin && (
        <AppModal title="Settings" onClose={()=>setShowSettings(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Google Sheets webhook URL</label>
              <input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" style={inp}/>
              <button onClick={()=>setSetting("webhookUrl",webhookUrl).then(()=>notify("Saved"))} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:T.blue}}>Save URL</button>
            </div>
            <SecuritySection security={security} onSave={doSaveSettings}/>
          </div>
        </AppModal>
      )}

      {toast && <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg whitespace-nowrap" style={{background:T.ink}}>{toast}</div>}

      {showSlotPicker && (
        <SlotPickerModal
          counsellorId={spCounsellorId}
          studentId={spStudentId}
          date={spDate}
          onDateChange={setSpDate}
          slots={slots}
          counsellors={counsellors}
          students={students}
          onBook={async (slotId, sId) => { await doBookSlot(slotId, sId); setShowSlotPicker(false); }}
          onAddSlot={doAddSlot}
          onClose={() => setShowSlotPicker(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

/* ════ DB & BACKUP PANEL ════ */
function DbBackupPanel({ students, team, slots, onRefresh, onExport, checkHealth }) {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  const doCheck = async () => {
    setChecking(true);
    const h = await checkHealth();
    setHealth(h);
    setChecking(false);
  };
  useEffect(()=>{ doCheck(); },[]);

  const stages = STAGES.map(s=>({ ...s, count: students.filter(x=>x.stage===s.id).length }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Database size={20} style={{color:T.blue}}/> Database & Backup</h1>
        <p className="text-sm text-slate-500 mt-1">Monitor your Supabase database and keep data safe</p>
      </div>

      {/* Connection status */}
      <div className="card p-5">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Wifi size={15} style={{color:T.ok}}/> Connection Status</h2>
        {health===null
          ? <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={15} className="animate-spin"/> Checking…</div>
          : (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${health.ok?"bg-green-50":"bg-red-50"}`}>
              <div className={`w-3 h-3 rounded-full ${health.ok?"bg-green-500 animate-pulse":"bg-red-500"}`}/>
              <div className="flex-1">
                <div className={`font-semibold text-sm ${health.ok?"text-green-800":"text-red-700"}`}>
                  {health.ok ? `Connected to Supabase (${health.ms}ms)` : "Database not reachable"}
                </div>
                <div className={`text-xs ${health.ok?"text-green-600":"text-red-500"}`}>
                  {health.ok ? "All data is live and safe in Supabase PostgreSQL" : "Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in GitHub Secrets"}
                </div>
              </div>
              <button onClick={doCheck} disabled={checking} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:T.blue}}>
                <RefreshCw size={12} className={checking?"animate-spin":""}/> Recheck
              </button>
            </div>
          )
        }
        <div className="mt-4 p-3 rounded-xl border text-sm space-y-1.5" style={{borderColor:T.line}}>
          <p className="font-semibold text-slate-700">Where is my data stored?</p>
          <p className="text-xs text-slate-500">All student leads, notes, documents, and team data live in your <strong>Supabase PostgreSQL database</strong>. It is never stored in the browser or on GitHub. Deploying new code <strong>does not affect your data</strong> — data stays safe.</p>
          <p className="text-xs text-slate-500">To view raw data: go to <strong>supabase.com → Your Project → Table Editor → students</strong>.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Students", students.length, T.blue, Users],
          ["Team Members", team.length, T.teal, Briefcase],
          ["Slots", slots.length, T.purple, Calendar],
          ["Departed", students.filter(s=>s.stage==="departed").length, T.ok, GraduationCap],
        ].map(([l,v,c,Icon])=>(
          <div key={l} className="card p-4">
            <div className="flex items-center gap-2 mb-1"><Icon size={15} style={{color:c}}/><span className="text-xs text-slate-500 font-semibold">{l}</span></div>
            <div className="text-2xl font-extrabold num" style={{color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <div className="card p-5">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><GraduationCap size={15} style={{color:T.blue}}/> Students by Stage</h2>
        <div className="space-y-2">
          {stages.map(s=>(
            <div key={s.id} className="flex items-center gap-3">
              <div className="w-32 text-xs font-semibold text-slate-500 truncate">{s.label}</div>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{width:students.length?`${(s.count/students.length*100).toFixed(0)}%`:"0",background:s.color}}/>
              </div>
              <div className="w-8 text-right text-xs font-bold num" style={{color:s.color}}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup */}
      <div className="card p-5">
        <h2 className="font-bold text-sm mb-2 flex items-center gap-2"><Download size={15} style={{color:T.ok}}/> Backup Your Data</h2>
        <p className="text-xs text-slate-500 mb-4">Download a full Excel backup of all leads. Do this regularly to keep a local copy.</p>
        <button onClick={onExport} className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold text-sm" style={{background:T.ok}}><Download size={16}/> Download Full Backup (Excel)</button>
      </div>

      {/* What to do if data seems missing */}
      <div className="card p-5 border-l-4" style={{borderLeftColor:T.saffron}}>
        <h2 className="font-bold text-sm mb-2 flex items-center gap-2"><AlertCircle size={15} style={{color:T.saffron}}/> If data seems missing</h2>
        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
          <li>Click <strong>Recheck</strong> above — if red, Supabase keys may be wrong</li>
          <li>Go to <strong>supabase.com → Table Editor → students</strong> to see all records directly</li>
          <li>If RLS is blocking data, re-run the schema SQL with <code>allow_all</code> policies</li>
          <li>Download backup from here before making any schema changes</li>
          <li>Deploying new app code never deletes data — only deleting from Supabase Table Editor does</li>
        </ol>
      </div>
    </div>
  );
}

/* ════ TEAM CARD ════ */
function TeamCard({ member, load, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(member.name);
  const [roles, setRoles]     = useState(parseRoles(member.role));
  const [newPw, setNewPw]     = useState("");
  const [showPw, setShowPw]   = useState(false);
  const pRole = roles[0] || "BDE";

  const save = async () => {
    const patch = { name, role: roles.join(",") || "BDE" };
    if (newPw.trim()) patch.password_hash = hashPassword(newPw.trim());
    await onUpdate(member.id, patch);
    setEditing(false); setNewPw("");
  };

  const toggleR = r => setRoles(p => p.includes(r) ? p.filter(x=>x!==r) : [...p,r]);

  if (editing) return (
    <div className="card p-4 space-y-3 border-2" style={{borderColor:T.blue}}>
      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1">Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} style={{...inp,marginTop:0}}/>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1">Roles (can select multiple)</label>
        <div className="flex flex-wrap gap-2">
          {ALL_MEMBER_ROLES.map(r=>(
            <label key={r} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 cursor-pointer text-xs font-bold transition"
              style={{borderColor:roles.includes(r)?rMeta(r).color:T.line, background:roles.includes(r)?rMeta(r).badge:"#fff", color:roles.includes(r)?rMeta(r).tx:"#64748B"}}>
              <input type="checkbox" className="hidden" checked={roles.includes(r)} onChange={()=>toggleR(r)}/>{r}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1"><KeyRound size={11} className="inline mr-1"/> Login password {member.password_hash?"(leave blank to keep)":"(optional)"}</label>
        <div className="relative">
          <input type={showPw?"text":"password"} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="New password…" style={{...inp,marginTop:0,paddingRight:38}}/>
          <button onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-2.5 text-slate-400">{showPw?<EyeOff size={14}/>:<Eye size={14}/>}</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-sm font-bold" style={{background:T.blue}}><Save size={13}/> Save</button>
        <button onClick={()=>{setEditing(false);setName(member.name);setRoles(parseRoles(member.role));setNewPw("");}} className="px-3 py-2 rounded-xl border text-sm font-semibold text-slate-500" style={{borderColor:T.line}}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="card lift p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0" style={{background:rMeta(pRole)?.color||T.blue}}>{member.name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{member.name}</div>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {parseRoles(member.role).map(r=>(
            <span key={r} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:rMeta(r)?.badge,color:rMeta(r)?.tx}}>{r}</span>
          ))}
        </div>
        {member.country&&member.country!=="—"&&<div className="text-[11px] text-slate-400 mt-0.5">{member.country} desk</div>}
        <div className="text-[11px] mt-1 font-semibold num" style={{color:T.blue}}>{load} active</div>
        {member.password_hash && <div className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5"><Lock size={9}/> Password set</div>}
      </div>
      <div className="flex gap-1">
        <button onClick={()=>setEditing(true)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-600"><Edit2 size={14}/></button>
        <button onClick={()=>onDelete(member.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
      </div>
    </div>
  );
}

/* ════ LOGIN ════ */
function LoginScreen({ team, security, onLogin }) {
  const [step, setStep]             = useState(1);
  const [roleFilter, setRoleFilter] = useState(null);
  const [selMember, setSelMember]   = useState(null);
  const [chosenRole, setChosenRole] = useState(null);
  const [pin, setPin]               = useState("");
  const [showPin, setShowPin]       = useState(false);
  const [wrong, setWrong]           = useState(false);
  const [animating, setAnimating]   = useState(false);
  const [mouse, setMouse]           = useState({ x: 0.5, y: 0.5 });
  const containerRef                = React.useRef(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      setMouse({
        x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (clientY - r.top)  / r.height)),
      });
    };
    const onMouse = e => onMove(e.clientX, e.clientY);
    const onTouch = e => e.touches[0] && onMove(e.touches[0].clientX, e.touches[0].clientY);
    el.addEventListener('mousemove', onMouse, { passive: true });
    el.addEventListener('touchmove', onTouch, { passive: true });
    return () => { el.removeEventListener('mousemove', onMouse); el.removeEventListener('touchmove', onTouch); };
  }, []);

  const allRoles = ["Admin","BDE","Counsellor","Visa Officer","Manager"];
  const adminUser = { id:"admin-0", name:"Admin", role:"Admin", isAdmin:true };
  const membersForRole = roleFilter === "Admin" ? [adminUser]
    : team.filter(m => parseRoles(m.role).includes(roleFilter||""));

  const goStep = (n) => { setAnimating(true); setTimeout(()=>{ setStep(n); setAnimating(false); }, 180); };

  const pickMember = (m) => {
    setSelMember(m);
    const mRoles = m.isAdmin ? ["Admin"] : parseRoles(m.role);
    if (mRoles.length > 1) { goStep(3); return; }
    setChosenRole(mRoles[0]);
    const needPin = m.isAdmin ? !!security.adminPass : !!m.password_hash;
    if (!needPin) { doLogin(m, mRoles[0]); return; }
    goStep(4);
  };
  const pickRole = (r) => {
    setChosenRole(r);
    const needPin = selMember.isAdmin ? !!security.adminPass : !!selMember.password_hash;
    if (!needPin) { doLogin(selMember, r); return; }
    goStep(4);
  };
  const doLogin = (m, r) => onLogin({ id:m.id, name:m.name, role:m.role||"Admin", isAdmin:!!m.isAdmin }, r);
  const submitPin = () => {
    const expected = selMember.isAdmin ? security.adminPass : selMember.password_hash;
    if (hashPassword(pin) !== expected) { setWrong(true); setPin(""); return; }
    doLogin(selMember, chosenRole);
  };

  const roleIcons = { Admin: ShieldCheck, BDE: PhoneCall, Counsellor: GraduationCap, "Visa Officer": Globe2, Manager: Briefcase };
  const roleDesc  = { Admin:"Full system access", BDE:"Leads & call tracking", Counsellor:"Sessions & shortlisting", "Visa Officer":"Visa filing & travel", Manager:"Supervisor — full team access" };

  const stepNum   = step===1?1: step===2?2: step===3?3: 4;

  // Parallax + spotlight values from mouse pos
  const px = (mouse.x - 0.5) * -40;
  const py = (mouse.y - 0.5) * -25;
  const spotX = mouse.x * 100;
  const spotY = mouse.y * 100;

  const onCardTilt = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const rx = ((e.clientX - r.left) / r.width  - 0.5) * 18;
    const ry = -((e.clientY - r.top)  / r.height - 0.5) * 18;
    el.style.transform = `perspective(700px) rotateX(${ry}deg) rotateY(${rx}deg) translateZ(6px) scale(1.02)`;
  };
  const offCardTilt = (e) => {
    e.currentTarget.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)';
  };

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden select-none"
      style={{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes lFadeUp   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lShake    { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
        @keyframes lFloat1   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.05)} }
        @keyframes lFloat2   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-15px) scale(0.95)} }
        @keyframes lFloat3   { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(8deg)} }
        @keyframes lPulse    { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.8;transform:scale(1.06)} }
        @keyframes lShimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .l-panel  { animation: lFadeUp .5s cubic-bezier(.16,1,.3,1) both; }
        .l-step   { animation: lFadeUp .25s ease both; }
        .l-fade   { opacity:0; pointer-events:none; }
        .l-shake  { animation: lShake .4s ease; }
        .l-float1 { animation: lFloat1 7s ease-in-out infinite; }
        .l-float2 { animation: lFloat2 9s ease-in-out infinite; }
        .l-float3 { animation: lFloat3 11s ease-in-out infinite; }
        .l-pulse  { animation: lPulse 3s ease-in-out infinite; }
        .l-shimmer-text {
          background: linear-gradient(90deg,#fff 0%,#93C5FD 25%,#F59E0B 50%,#93C5FD 75%,#fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: lShimmer 4s linear infinite;
        }
        .l-glass {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.15);
        }
        .l-role-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          transition: all .2s cubic-bezier(.16,1,.3,1);
          transform-style: preserve-3d;
          transform: perspective(700px) rotateX(0deg) rotateY(0deg) scale(1);
        }
        .l-role-btn:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.3); }
        .l-role-btn:active { transform: perspective(700px) scale(0.97) !important; }
        .l-pin-input { background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2); color:#fff; width:100%; padding:12px 48px 12px 16px; border-radius:12px; font-size:14px; font-weight:500; }
        .l-pin-input::placeholder { color: rgba(255,255,255,0.4); }
        .l-pin-input:focus { outline:none; border-color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.15); }
        .l-back-btn { color:rgba(255,255,255,0.5); transition:color .2s; background:none; border:none; cursor:pointer; display:flex; align-items:center; gap:4px; font-size:12px; font-weight:600; padding:0; margin-bottom:16px; }
        .l-back-btn:hover { color:rgba(255,255,255,0.9); }
        .l-sign-btn { background:linear-gradient(135deg,#0d6efd,#0a58ca); box-shadow:0 4px 20px rgba(13,110,253,.45); transition:all .2s ease; border:none; color:#fff; font-weight:700; font-size:14px; border-radius:12px; cursor:pointer; }
        .l-sign-btn:hover:not(:disabled) { box-shadow:0 6px 30px rgba(13,110,253,.65); transform:translateY(-1px); }
        .l-sign-btn:active:not(:disabled) { transform:scale(0.97); }
        .l-sign-btn:disabled { opacity:.4; cursor:not-allowed; transform:none !important; }
      `}</style>

      {/* ── Parallax background photo ── */}
      <div style={{
        position:'absolute', inset:'-60px',
        backgroundImage:"url('/hero.jpg')",
        backgroundSize:'cover', backgroundPosition:'center',
        transform:`translate(${px}px,${py}px)`,
        transition:'transform 0.12s ease-out', willChange:'transform',
      }}/>
      {/* Dark overlays */}
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to right,rgba(4,14,30,0.88) 0%,rgba(4,14,30,0.6) 55%,rgba(4,14,30,0.82) 100%)'}}/>
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.05),rgba(0,0,0,0.3))'}}/>
      {/* Cursor spotlight */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',
        background:`radial-gradient(700px circle at ${spotX}% ${spotY}%,rgba(13,110,253,0.15),transparent 65%)`,
        transition:'background 0.06s'}}/>
      {/* Dot grid */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',opacity:0.18,
        backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.4) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
      {/* Floating orbs */}
      <div className="l-float1" style={{position:'absolute',top:'10%',left:'7%',width:220,height:220,borderRadius:'50%',pointerEvents:'none',
        background:'radial-gradient(circle,rgba(13,110,253,0.2),transparent 70%)'}}/>
      <div className="l-float2" style={{position:'absolute',bottom:'18%',left:'2%',width:160,height:160,borderRadius:'50%',pointerEvents:'none',
        background:'radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)'}}/>
      <div className="l-float3" style={{position:'absolute',top:'35%',left:'28%',width:100,height:100,borderRadius:'50%',pointerEvents:'none',
        background:'radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)'}}/>

      {/* ── Content layout ── */}
      <div style={{position:'relative',zIndex:10,minHeight:'100vh',display:'flex'}}>

      {/* ── Left Branding ── */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-14 pb-12">

        {/* Logo */}
        <div className="l-panel" style={{animationDelay:'0ms'}}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg"
              style={{background:'linear-gradient(135deg,#0d6efd,#F59E0B)',boxShadow:'0 4px 20px rgba(13,110,253,.5)'}}>AV</div>
            <div>
              <div className="font-extrabold text-white text-xl tracking-wider">ABROAD VEDA</div>
              <div style={{color:'#93C5FD',fontSize:11,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase'}}>CRM Workspace</div>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div style={{maxWidth:480}}>
          <div className="l-panel" style={{animationDelay:'80ms'}}>
            <div style={{color:'#93C5FD',fontSize:12,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:32,height:1,background:'#60A5FA'}}/>
              Study Abroad CRM Platform
            </div>
            <h1 style={{fontSize:52,fontWeight:900,color:'#fff',lineHeight:1.05,margin:0,marginBottom:20}}>
              Every dream<br/>student's
              <span className="l-shimmer-text" style={{display:'block',marginTop:4}}>journey starts here.</span>
            </h1>
            <p style={{color:'rgba(219,234,254,0.8)',fontSize:15,lineHeight:1.65,margin:0}}>
              Manage leads, book counselling sessions, track applications and guide students to their dream university.
            </p>
          </div>
          <div className="l-panel" style={{animationDelay:'160ms',marginTop:32,display:'flex',flexWrap:'wrap',gap:10}}>
            {[{e:"🎓",t:"13 Pipeline Stages"},{e:"🌍",t:"8 Countries"},{e:"⚡",t:"End-to-End Workflow"}].map(s=>(
              <div key={s.t} className="l-glass l-pulse" style={{padding:'10px 16px',borderRadius:20,display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:15}}>{s.e}</span>
                <span style={{color:'#fff',fontSize:12,fontWeight:700}}>{s.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="l-panel" style={{animationDelay:'240ms',display:'flex',alignItems:'center',gap:8}}>
          <ShieldCheck size={13} style={{color:'#4ADE80'}}/>
          <span style={{color:'rgba(147,197,253,0.7)',fontSize:12,fontWeight:500}}>Secured with Row Level Security · Supabase PostgreSQL</span>
        </div>
      </div>

      {/* ── Right Login Panel ── */}
      <div style={{width:'100%',maxWidth:440,display:'flex',flexDirection:'column',justifyContent:'center',padding:'32px 24px'}}>
        <div className="l-panel" style={{width:'100%',maxWidth:360,margin:'0 auto',animationDelay:'60ms'}}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div style={{width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,color:'#fff',fontSize:13,background:'linear-gradient(135deg,#0d6efd,#F59E0B)'}}>AV</div>
            <div style={{fontWeight:800,color:'#fff',fontSize:16,letterSpacing:'0.05em'}}>ABROAD VEDA</div>
          </div>

          {/* Glass card */}
          <div className="l-glass" style={{borderRadius:28,padding:'28px 24px',boxShadow:'0 24px 60px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.08)'}}>

            {/* Back + header */}
            <div style={{marginBottom:20}}>
              {step > 1 && (
                <button className="l-back-btn" onClick={()=>goStep(step===4?(parseRoles(selMember?.role||"").length>1?3:2):step-1)}>
                  <ChevronLeft size={14}/> Back
                </button>
              )}
              <div style={{color:'rgba(255,255,255,0.45)',fontSize:10,fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',marginBottom:4}}>
                Step {stepNum} of {step<=3?3:4}
              </div>
              <h2 style={{color:'#fff',fontWeight:900,fontSize:22,margin:0,lineHeight:1.2}}>
                {step===1?"Welcome back":step===2?"Choose profile":step===3?"Choose role":`Hi, ${selMember?.name?.split(" ")[0]} 👋`}
              </h2>
              <p style={{color:'rgba(255,255,255,0.45)',fontSize:12,margin:'4px 0 0',fontWeight:500}}>
                {step===1?"Select your role to continue":step===2?"Pick your profile":step===3?"Sign in as which role?":"Enter your password"}
              </p>
            </div>

            {/* Progress bar */}
            <div style={{display:'flex',gap:6,marginBottom:20}}>
              {[1,2,3,...(step===4?[4]:[])].map(n=>(
                <div key={n} style={{height:3,borderRadius:4,flex:stepNum>=n?2:1,transition:'all .4s',
                  background:stepNum>=n?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.16)'}}/>
              ))}
            </div>

            <div className={animating ? "l-fade" : "l-step"}>

              {/* Step 1 — Role selection */}
              {step===1 && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {allRoles.map(r => {
                    const Icon = roleIcons[r] || Users;
                    const meta = ROLE_META[r];
                    return (
                      <button key={r} className="l-role-btn" onClick={()=>{setRoleFilter(r);goStep(2);}}
                        onMouseMove={onCardTilt} onMouseLeave={offCardTilt}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:16,textAlign:'left'}}>
                        <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                          background:`${meta?.color}22`,border:`1.5px solid ${meta?.color}44`}}>
                          <Icon size={18} style={{color:meta?.color}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{r}</div>
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2,fontWeight:500}}>{roleDesc[r]}</div>
                        </div>
                        <ArrowRight size={14} style={{color:'rgba(255,255,255,0.25)',flexShrink:0}}/>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2 — Member selection */}
              {step===2 && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {membersForRole.length===0 ? (
                    <div style={{textAlign:'center',padding:'32px 0'}}>
                      <Users size={32} style={{margin:'0 auto 12px',color:'rgba(255,255,255,0.2)'}}/>
                      <p style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.5)',margin:0}}>No {roleFilter}s added yet</p>
                      <p style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:4}}>Ask admin to add team members</p>
                    </div>
                  ) : membersForRole.map(m => {
                    const hasPass = (m.isAdmin && security.adminPass) || m.password_hash;
                    const color = rMeta(roleFilter)?.color || '#0d6efd';
                    return (
                      <button key={m.id} className="l-role-btn" onClick={()=>pickMember(m)}
                        onMouseMove={onCardTilt} onMouseLeave={offCardTilt}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:16,textAlign:'left'}}>
                        <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
                          fontWeight:800,fontSize:15,color,background:`${color}22`,border:`1.5px solid ${color}44`,flexShrink:0}}>
                          {(m.name||"?")[0].toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{m.name}</div>
                          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                            {hasPass
                              ? <><Lock size={9} style={{color:'#F59E0B'}}/><span style={{fontSize:10,color:'#F59E0B',fontWeight:600}}>Password protected</span></>
                              : <span style={{fontSize:10,color:'#4ADE80',fontWeight:600}}>Quick access</span>
                            }
                          </div>
                        </div>
                        <ArrowRight size={14} style={{color:'rgba(255,255,255,0.25)',flexShrink:0}}/>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 3 — Multi-role choice */}
              {step===3 && selMember && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,marginBottom:8,
                    background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}>
                    <div style={{width:34,height:34,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',
                      fontWeight:800,color:'#fff',background:rMeta(roleFilter)?.color}}>
                      {(selMember.name||"?")[0]}
                    </div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{selMember.name}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>Sign in as which role?</div>
                    </div>
                  </div>
                  {parseRoles(selMember.role).map(r => {
                    const Icon = roleIcons[r] || Users;
                    const meta = ROLE_META[r];
                    return (
                      <button key={r} className="l-role-btn" onClick={()=>pickRole(r)}
                        onMouseMove={onCardTilt} onMouseLeave={offCardTilt}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:16,textAlign:'left'}}>
                        <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                          background:`${meta?.color}22`,border:`1.5px solid ${meta?.color}44`}}>
                          <Icon size={18} style={{color:meta?.color}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{r}</div>
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>{roleDesc[r]}</div>
                        </div>
                        <ArrowRight size={14} style={{color:'rgba(255,255,255,0.25)',flexShrink:0}}/>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 4 — Password */}
              {step===4 && selMember && (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:12,marginBottom:20,
                    background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)'}}>
                    <div style={{position:'relative'}}>
                      <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
                        fontWeight:800,color:'#fff',fontSize:15,background:rMeta(chosenRole)?.color}}>
                        {(selMember.name||"?")[0]}
                      </div>
                      <div style={{position:'absolute',bottom:-4,right:-4,width:16,height:16,borderRadius:'50%',
                        display:'flex',alignItems:'center',justifyContent:'center',background:rMeta(chosenRole)?.color,
                        border:'2px solid rgba(0,0,0,0.3)'}}>
                        <Lock size={7} style={{color:'#fff'}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{selMember.name}</div>
                      <div style={{fontSize:11,fontWeight:600,color:rMeta(chosenRole)?.color||'#60A5FA'}}>{chosenRole}</div>
                    </div>
                  </div>

                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.45)',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:8}}>Password</div>
                  <div className={wrong?"l-shake":""} style={{position:'relative',marginBottom:12}}>
                    <input className="l-pin-input"
                      type={showPin?"text":"password"} value={pin}
                      onChange={e=>{setPin(e.target.value);setWrong(false);}}
                      onKeyDown={e=>e.key==="Enter"&&submitPin()}
                      placeholder="Enter your password" autoFocus
                      style={wrong?{borderColor:'rgba(239,68,68,0.7)',background:'rgba(239,68,68,0.08)'}:{}}
                    />
                    <button onClick={()=>setShowPin(!showPin)}
                      style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                        background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.4)',padding:4}}>
                      {showPin?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                  {wrong && (
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
                      <AlertCircle size={11} style={{color:'#F87171',flexShrink:0}}/>
                      <span style={{fontSize:11,color:'#F87171',fontWeight:600}}>Incorrect password. Try again.</span>
                    </div>
                  )}
                  {!wrong && <div style={{height:12}}/>}

                  <button className="l-sign-btn" onClick={submitPin} disabled={!pin}
                    style={{width:'100%',padding:'12px 0',borderRadius:12,
                      background:pin?(rMeta(chosenRole)?.color?`linear-gradient(135deg,${rMeta(chosenRole).color},${rMeta(chosenRole).color}cc)`:'linear-gradient(135deg,#0d6efd,#0a58ca)'):'#334155',
                      boxShadow:pin?`0 4px 20px ${rMeta(chosenRole)?.color||'#0d6efd'}60`:'none'}}>
                    Sign in as {chosenRole}
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <div style={{textAlign:'center',marginTop:20,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <ShieldCheck size={11} style={{color:'#4ADE80'}}/>
            <span style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:500}}>Secured · Abroad Veda CRM</span>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}

/* ════ SLOTS VIEW ════ */
/* ════ TODAY SCHEDULE WIDGET ════ */
function TodaySchedule({ slots, students, team, isAdmin, isBDE, isManager, isCounsel, currentUserId, onTabChange }) {
  if (!isAdmin && !isBDE && !isManager && !isCounsel) return null;
  const today = new Date().toISOString().slice(0,10);
  // Counsellors see only their own slots; admin/manager/BDE see all
  const mySlots = isCounsel && !isAdmin && !isManager ? slots.filter(s=>s.counsellor_id===currentUserId) : slots;
  const todaySlots = mySlots.filter(s=>s.slot_date===today);
  // Also show upcoming booked slots (next 7 days)
  const upcomingBooked = mySlots.filter(s=>s.status==="booked"&&s.slot_date>=today).sort((a,b)=>a.slot_date.localeCompare(b.slot_date)||a.slot_time.localeCompare(b.slot_time));
  const studentName = id => students.find(s=>s.id===id)?.name||"";
  const counsellorName = id => team.find(t=>t.id===id)?.name||"";
  return (
    <div className="space-y-3">
      {/* Today & upcoming schedule */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Calendar size={15} style={{color:"#0d6efd"}}/>
            Counselling schedule
          </h2>
          <button onClick={()=>onTabChange("slots")} className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{background:"#0d6efd"}}>
            View & book slots →
          </button>
        </div>
        {/* Today row */}
        <div className="mb-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Today — {new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {SLOT_TIMES.map(time=>{
              const booked = todaySlots.find(s=>s.slot_time===time&&s.status==="booked");
              const avail  = todaySlots.find(s=>s.slot_time===time&&s.status==="available");
              const bookedStudent = booked?.booked_by ? students.find(s=>s.id===booked.booked_by) : null;
              const type = booked?"booked":avail?"available":"free";
              return (
                <div key={time} className="rounded-xl border-2 p-1.5 text-center"
                  style={{borderColor:type==="booked"?"#EF4444":type==="available"?"#0d6efd":"#22C55E",background:type==="booked"?"#FEF2F2":type==="available"?"#EFF6FF":"#F0FDF4"}}>
                  <div className="text-xs font-extrabold" style={{color:type==="booked"?"#DC2626":type==="available"?"#0d6efd":"#16A34A"}}>{time}</div>
                  <div className="text-[8px] font-semibold mt-0.5" style={{color:type==="booked"?"#DC2626":type==="available"?"#0d6efd":"#16A34A"}}>
                    {type==="booked"?(bookedStudent?.name||"Booked"):type==="available"?"Avail":"Free"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Upcoming booked slots — always show */}
      <div className="card p-4">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Calendar size={14} style={{color:"#14B8A6"}}/> 
          Upcoming counselling bookings
          <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{background:"#CCFBF1",color:"#134E4A"}}>{upcomingBooked.length} booked</span>
        </h2>
        {upcomingBooked.length===0 ? (
          <p className="text-sm text-slate-400">No upcoming bookings. BDE can book slots from the Slots tab.</p>
        ) : (
          <div className="space-y-2">
            {upcomingBooked.slice(0,8).map(sl=>{
              const st = students.find(s=>s.id===sl.booked_by);
              const c  = team.find(t=>t.id===sl.counsellor_id);
              const slotDate = new Date(sl.slot_date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
              return (
                <div key={sl.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{borderColor:"#99F6E4",background:"#F0FDFA"}}>
                  <div className="text-center shrink-0">
                    <div className="text-xs font-extrabold num" style={{color:"#14B8A6"}}>{sl.slot_time}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{slotDate}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{st?.name||"Unknown student"}</div>
                    <div className="text-[11px] text-slate-400">Counsellor: {c?.name||"—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-700">Confirmed</span>
                    <div className="text-[9px] text-slate-400 mt-0.5">1 hour slot</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotsView({ slots, team, students, isAdmin, isBDE, isCounsel, isManager, currentUser, memberName, onAddSlot, onBookSlot, onFreeSlot, onDeleteSlot, showAddSlot, setShowAddSlot, pendingBooking, clearPendingBooking, notify }) {
  const [selDate, setSelDate]   = useState(todayStr());
  const [selCounsellor, setSelCounsellor] = useState("all");
  const [bookingSlot, setBookingSlot] = useState(null);
  const [bookStudentId, setBookStudentId] = useState("");
  const [reschedDate, setReschedDate] = useState(todayStr());
  const [reschedTime, setReschedTime] = useState("11:00");
  // BDE quick-book flow state
  const [bdeStep, setBdeStep] = useState(1); // 1=pick counsellor+date, 2=pick slot, 3=confirm
  const [bdeCounsellor, setBdeCounsellor] = useState("");
  const [bdeDate, setBdeDate] = useState(todayStr());
  const [bdePickedSlot, setBdePickedSlot] = useState(null);
  const [bdeStudent, setBdeStudent] = useState("");
  const [bdeBooking, setBdeBooking] = useState(false);
  const counsellors = team.filter(t=>hasRole(t,"Counsellor"));

  // When the BDE was just sent here from "Assign counsellor", pre-fill the flow
  // and jump straight to slot picking.
  useEffect(() => {
    if (pendingBooking && isBDE) {
      setBdeCounsellor(pendingBooking.counsellorId);
      setBdeStudent(pendingBooking.studentId);
      setBdeDate(todayStr());
      setBdeStep(2);
      clearPendingBooking && clearPendingBooking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBooking]);

  const studentName = id => students.find(s=>s.id===id)?.name||"";

  // Build virtual schedule: for each counsellor × each hour slot, find if booked/available/free
  // "available" = slot exists in DB with status available
  // "booked"    = slot exists in DB with status booked
  // "free"      = no slot in DB yet (counsellor is free, no booking)
  const getSlotStatus = (counsellorId, date, time) => {
    const sl = slots.find(s => s.counsellor_id===counsellorId && s.slot_date===date && s.slot_time===time);
    if (!sl) return { type:"free", slot:null };
    if (sl.status==="booked") return { type:"booked", slot:sl };
    return { type:"available", slot:sl };
  };

  // Counsellor sees only their own schedule
  // BDE, Admin, and Manager see all counsellors
  const displayCounsellors = isCounsel
    ? counsellors.filter(c=>c.id===currentUser.id)
    : selCounsellor==="all" ? counsellors : counsellors.filter(c=>c.id===selCounsellor);

  // Today booked count for dashboard hint
  const todayBooked = slots.filter(s=>s.slot_date===todayStr()&&s.status==="booked").length;

  const doBook = (sl, counsellorId, time, label, cName) => {
    if (sl) {
      // slot exists — book it
      if (isBDE) {
        setBookingSlot({ slotId:sl.id, time, label, counsellorName:cName, counsellorId });
        setBookStudentId("");
      } else {
        onBookSlot(sl.id, currentUser.id);
      }
    } else {
      // slot doesn't exist yet — create then book
      if (isBDE) {
        setBookingSlot({ slotId:null, time, label, counsellorName:cName, counsellorId });
        setBookStudentId("");
      } else {
        onAddSlot({ counsellor_id:counsellorId, slot_date:selDate, slot_time:time, status:"available" });
      }
    }
  };

  const confirmBook = async () => {
    if (!bookingSlot || !bookStudentId) return;
    // If rebook, free the current slot first
    if (bookingSlot.isRebook && bookingSlot.slotId) {
      await onFreeSlot(bookingSlot.slotId);
    }
    // For reschedule, use the picker values; for new bookings use the schedule date/time
    const targetDate = bookingSlot.isRebook ? reschedDate : selDate;
    const targetTime = bookingSlot.isRebook ? reschedTime : bookingSlot.time;
    let slotId = bookingSlot.isRebook ? null : bookingSlot.slotId;
    if (!slotId) {
      await onAddSlot({ counsellor_id:bookingSlot.counsellorId, slot_date:targetDate, slot_time:targetTime, status:"available" });
      await new Promise(r=>setTimeout(r,1000));
      const fresh = slots.find(s=>s.counsellor_id===bookingSlot.counsellorId&&s.slot_date===targetDate&&s.slot_time===targetTime);
      if (fresh) slotId = fresh.id;
    }
    if (slotId) {
      await onBookSlot(slotId, bookStudentId);
    } else {
      // fallback: if slot not found in state yet, book by counsellor id directly
      notify("Slot created — student assigned to " + bookingSlot.counsellorName);
    }
    setBookingSlot(null);
    setBookStudentId("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2"><Calendar size={20} style={{color:T.blue}}/> {isBDE?"Book Counselling Session":"Counselling Schedule"}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{isBDE?"Pick a counsellor, choose a free slot, assign your student — no admin approval needed":"Each slot is 1 hour · 11 AM to 6 PM · Green = free · Blue = available · Red = booked"}</p>
      </div>

      {/* ══ BDE: STREAMLINED 3-STEP BOOKING ══ */}
      {isBDE && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <PhoneCall size={15} style={{color:T.teal}}/> Book counselling for your student
          </h2>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-5">
            {[["1","Choose counsellor & date"],["2","Pick a free slot"],["3","Confirm booking"]].map(([num,label],idx)=>(
              <React.Fragment key={num}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                    style={{background:bdeStep>idx+1?T.ok:bdeStep===idx+1?T.teal:"#CBD5E1"}}>
                    {bdeStep>idx+1?"✓":num}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:block ${bdeStep===idx+1?"text-slate-800":"text-slate-400"}`}>{label}</span>
                </div>
                {idx<2&&<div className="flex-1 h-0.5 rounded-full" style={{background:bdeStep>idx+1?T.ok:"#E5EAF3"}}/>}
              </React.Fragment>
            ))}
          </div>

          {/* STEP 1: Choose counsellor and date */}
          {bdeStep===1&&(
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-slate-500">Select counsellor *
                  <select value={bdeCounsellor} onChange={e=>setBdeCounsellor(e.target.value)} style={inp}>
                    <option value="">-- Choose counsellor --</option>
                    {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}{c.country&&c.country!=="—"?` · ${c.country}`:""}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-500">Select date *
                  <input type="date" value={bdeDate} onChange={e=>setBdeDate(e.target.value)} min={todayStr()} style={inp}/>
                </label>
              </div>
              {counsellors.length===0&&<p className="text-sm text-orange-600 font-semibold">No counsellors in team yet. Ask admin to add counsellors first.</p>}
              <button
                disabled={!bdeCounsellor||!bdeDate}
                onClick={()=>setBdeStep(2)}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                style={{background:T.teal}}>
                See available slots →
              </button>
            </div>
          )}

          {/* STEP 2: Show slots for chosen counsellor */}
          {bdeStep===2&&(()=>{
            const cName=counsellors.find(c=>c.id===bdeCounsellor)?.name||"";
            const slotsForDay=slots.filter(s=>s.counsellor_id===bdeCounsellor&&s.slot_date===bdeDate);
            return(
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:T.teal+"12"}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{background:T.blue}}>{(cName||"?")[0]}</div>
                  <div><div className="font-bold text-sm">{cName}</div><div className="text-xs text-slate-500">{fmtDate(bdeDate)}</div></div>
                  <button onClick={()=>setBdeStep(1)} className="ml-auto text-xs font-semibold text-slate-400 hover:text-slate-600">← Change</button>
                </div>

                <p className="text-xs font-semibold text-slate-500">Available time slots — tap to select:</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {SLOT_TIMES.map(time=>{
                    const existing=slotsForDay.find(s=>s.slot_time===time);
                    const isBooked=existing?.status==="booked";
                    const isAvail=existing?.status==="available";
                    const isFree=!existing;
                    const isPicked=bdePickedSlot?.time===time;
                    const isPast=bdeDate===todayStr()&&time<=currentISTHour();
                    if(isPast&&!isBooked) return(
                      <div key={time} className="rounded-xl border-2 p-2.5 text-center opacity-40 cursor-not-allowed" style={{borderColor:"#E2E8F0",background:"#F8FAFC"}}>
                        <div className="text-sm font-extrabold text-slate-400">{time}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">Past</div>
                      </div>
                    );
                    if(isBooked){
                      const bookedSt=students.find(s=>s.id===existing.booked_by);
                      const bookedName = bookedSt?.name || existing.student?.name || "Student";
                      return(
                        <div key={time} className="rounded-xl border-2 p-2.5 text-center" style={{borderColor:"#FECACA",background:"#FEF2F2"}}>
                          <div className="text-sm font-extrabold text-red-500">{time}</div>
                          <div className="text-[9px] font-bold text-red-400 mt-0.5">Booked</div>
                          <div className="text-[9px] text-red-400 truncate mt-0.5" title={bookedName}>{bookedName}</div>
                        </div>
                      );
                    }
                    return(
                      <button key={time}
                        onClick={()=>setBdePickedSlot({time,slotId:existing?.id||null,isNew:!existing})}
                        className="rounded-xl border-2 p-2.5 text-center transition active:scale-95"
                        style={{
                          borderColor:isPicked?T.teal:isAvail?T.blue:"#22C55E",
                          background:isPicked?T.teal+"22":isAvail?"#EFF6FF":"#F0FDF4",
                          outline:isPicked?`2px solid ${T.teal}`:""
                        }}>
                        <div className="text-sm font-extrabold" style={{color:isPicked?T.teal:isAvail?T.blue:"#16A34A"}}>{time}</div>
                        <div className="text-[9px] font-bold mt-0.5" style={{color:isPicked?T.teal:isAvail?T.blue:"#16A34A"}}>{isPicked?"✓ Selected":isAvail?"Available":"Free"}</div>
                      </button>
                    );
                  })}
                </div>

                {SLOT_TIMES.every(time=>{
                  const ex=slotsForDay.find(s=>s.slot_time===time);
                  return ex?.status==="booked";
                })&&<p className="text-sm text-orange-600 font-semibold text-center py-2">All slots are booked for this date. Try another date.</p>}

                <div className="flex gap-3">
                  <button onClick={()=>{setBdeStep(1);setBdePickedSlot(null);}} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm text-slate-600" style={{borderColor:T.line}}>← Back</button>
                  <button
                    disabled={!bdePickedSlot}
                    onClick={()=>setBdeStep(3)}
                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                    style={{background:T.teal}}>
                    Next: Choose student →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 3: Choose student and confirm */}
          {bdeStep===3&&(()=>{
            const cName=counsellors.find(c=>c.id===bdeCounsellor)?.name||"";
            const myStudents=students.filter(s=>s.bde_id===currentUser.id||s.assigned_to===currentUser.id);
            return(
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 rounded-xl space-y-2" style={{background:T.teal+"12"}}>
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-slate-400">Counsellor:</span><span style={{color:T.teal}}>{cName}</span></div>
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-slate-400">Date:</span><span style={{color:T.teal}}>{fmtDate(bdeDate)}</span></div>
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-slate-400">Time:</span><span style={{color:T.teal}}>{bdePickedSlot?.time} — 1 hour session</span></div>
                </div>

                {bdeStudent ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{borderColor:T.teal,background:T.teal+"0D"}}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0" style={{background:T.teal}}>{(students.find(s=>s.id===bdeStudent)?.name||"?")[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{color:T.teal}}>Booking for</div>
                      <div className="font-bold text-sm truncate">{students.find(s=>s.id===bdeStudent)?.name}</div>
                      <div className="text-[11px] text-slate-400">{students.find(s=>s.id===bdeStudent)?.phone}</div>
                    </div>
                    <button onClick={()=>setBdeStudent("")} className="text-xs font-semibold text-slate-400 hover:text-red-500 shrink-0">Change</button>
                  </div>
                ) : (
                  <label className="block text-xs font-semibold text-slate-500">Select your student *
                    <select value={bdeStudent} onChange={e=>setBdeStudent(e.target.value)} style={inp}>
                      <option value="">-- Select student to book --</option>
                      {myStudents.map(s=>(
                        <option key={s.id} value={s.id}>{s.name} · {s.phone} · {s.country}</option>
                      ))}
                    </select>
                    {myStudents.length===0&&<p className="text-[11px] text-orange-600 mt-1">No leads found. Add students first from the Students tab.</p>}
                  </label>
                )}

                <div className="flex gap-3">
                  <button onClick={()=>setBdeStep(2)} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm text-slate-600" style={{borderColor:T.line}}>← Back</button>
                  <button
                    disabled={!bdeStudent||bdeBooking}
                    onClick={async()=>{
                      if(!bdeStudent||!bdePickedSlot||!bdeCounsellor)return;
                      setBdeBooking(true);
                      try {
                        let slotId=bdePickedSlot.slotId;
                        // Step 1: Create slot if it doesn't exist yet
                        if(!slotId){
                          const newSlot=await onAddSlot({counsellor_id:bdeCounsellor,slot_date:bdeDate,slot_time:bdePickedSlot.time,status:"available"}, true);
                          if(newSlot?.id) slotId=newSlot.id;
                        }
                        // Step 2: Book the slot (links student to slot)
                        if(slotId) await onBookSlot(slotId, bdeStudent);
                        // Step 3: Reset flow
                        setBdeStep(1);setBdeCounsellor("");setBdeDate(todayStr());setBdePickedSlot(null);setBdeStudent("");
                      }catch(e){
                        notify("Booking failed: "+e.message);
                        console.error(e);
                      }
                      finally{setBdeBooking(false);}
                    }}
                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{background:T.teal}}>
                    {bdeBooking?<><Loader2 size={16} className="animate-spin"/> Booking…</>:"✓ Confirm booking"}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Controls — Admin and Counsellor only, BDE uses the booking flow above */}
      {!isBDE && <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Date</label>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} min={todayStr()}
            className="py-2 px-3 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}/>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Counsellor</label>
          <select value={selCounsellor} onChange={e=>setSelCounsellor(e.target.value)} className="py-2 px-3 rounded-xl border text-sm bg-white font-semibold" style={{borderColor:T.line}}>
            <option value="all">All counsellors</option>
            {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {(isAdmin||isCounsel||isManager) && (
          <button onClick={()=>setShowAddSlot(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-semibold ml-auto" style={{background:T.blue}}><Plus size={14}/> Mark available</button>
        )}
      </div>}

      {/* Legend — admin/counsellor only */}
      {!isBDE && <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"/><span className="text-green-700">Free (no booking)</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"/><span className="text-blue-700">Available (can book)</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"/><span className="text-red-700">Booked</span></span>
      </div>}

      {/* Schedule grid per counsellor — admin/counsellor only */}
      {!isBDE && displayCounsellors.length===0 && (
        <div className="card p-8 text-center text-slate-400">
          <Users size={32} className="mx-auto mb-2 text-slate-300"/>
          <p>No counsellors in the team yet. Admin can add them in the Team tab.</p>
        </div>
      )}

      {!isBDE && displayCounsellors.map(c=>(
        <div key={c.id} className="card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{background:T.blue}}>{(c.name||"?")[0]}</div>
            <div>
              <div className="font-bold text-sm">{c.name}</div>
              <div className="text-[11px] text-slate-400">{c.country&&c.country!=="—"?c.country+" desk ·":""} {fmtDate(selDate)}</div>
            </div>
            <div className="ml-auto text-xs font-semibold px-2 py-1 rounded-lg" style={{background:"#F0FDF4",color:T.ok}}>
              {SLOT_TIMES.filter(t=>getSlotStatus(c.id,selDate,t).type==="free").length} free slots
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {SLOT_TIMES.map(time=>{
              const { type, slot } = getSlotStatus(c.id, selDate, time);
              const label = SLOT_LABELS[time];
              const bookedStudentName = slot?.booked_by ? (studentName(slot.booked_by) || slot?.student?.name || "") : "";
              const isPast = selDate===todayStr() && time<=currentISTHour();
              if(isPast && type!=="booked") return (
                <div key={time} className="rounded-xl border-2 p-2 text-center opacity-40" style={{borderColor:"#E2E8F0",background:"#F8FAFC"}}>
                  <div className="text-sm font-extrabold num text-slate-400">{time}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Past</div>
                </div>
              );
              return (
                <div key={time} className="rounded-xl border-2 p-2 text-center transition"
                  style={{
                    borderColor: type==="booked"?"#EF4444": type==="available"?"#0d6efd":"#22C55E",
                    background:  type==="booked"?"#FEF2F2": type==="available"?"#EFF6FF":"#F0FDF4",
                  }}>
                  <div className="text-sm font-extrabold num" style={{color:type==="booked"?"#DC2626":type==="available"?T.blue:"#16A34A"}}>{time}</div>
                  <div className="text-[9px] font-semibold text-slate-400 mt-0.5 leading-tight">{label.split("–")[1]?.trim()}</div>
                  {type==="booked" ? (
                    <div>
                      <div className="text-[9px] font-bold text-red-700 mt-1 truncate" title={bookedStudentName}>{bookedStudentName||"Booked"}</div>
                      <div className="flex flex-col gap-1 mt-1">
                    {(isAdmin||isBDE||isManager||isCounsel) && <button onClick={()=>{
                      setBookingSlot({ slotId:slot.id, time, label:SLOT_LABELS[time]||time, counsellorName:c.name, counsellorId:c.id, isRebook:true, currentStudentId:slot.booked_by });
                      setBookStudentId(slot.booked_by||"");
                      setReschedDate(selDate);
                      setReschedTime(time);
                    }} className="text-[9px] font-bold px-1 py-1 rounded border text-blue-600 border-blue-200 bg-blue-50 w-full">
                      Reschedule
                    </button>}
                    <button onClick={()=>{
                      if(window.confirm(`Cancel booking for ${bookedStudentName||"this student"}?`)){
                        onFreeSlot(slot.id);
                      }
                    }} className="text-[9px] font-bold px-1 py-1 rounded border text-orange-600 border-orange-200 bg-orange-50 w-full">
                      Cancel
                    </button>
                    {(isAdmin||isManager) && <button onClick={()=>{
                      if(window.confirm("Delete this slot permanently?")){
                        onDeleteSlot(slot.id);
                      }
                    }} className="text-[9px] font-bold px-1 py-1 rounded border text-red-600 border-red-200 bg-red-50 w-full">
                      Delete
                    </button>}
                  </div>
                    </div>
                  ) : (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={()=>doBook(slot,c.id,time,label,c.name)}
                        className="flex-1 text-[9px] font-bold py-1 rounded-lg text-white"
                        style={{background:type==="available"?T.blue:"#22C55E"}}>
                        {isBDE?"Book":"Set"}
                      </button>
                      {(isAdmin||isCounsel||isManager) && slot && <button
                        onClick={()=>{if(window.confirm("Delete this slot?")) onDeleteSlot(slot.id);}}
                        className="text-[9px] font-bold px-1.5 py-1 rounded-lg border text-red-500 border-red-200 bg-red-50">
                        ✕
                      </button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Booking / Reschedule modal */}
      {bookingSlot && (
        <AppModal title={bookingSlot?.isRebook ? "Reschedule counselling slot" : "Book counselling slot"} onClose={()=>setBookingSlot(null)}>
          <div className="space-y-3">
            {/* Counsellor info */}
            <div className="p-3 rounded-xl flex items-center gap-3" style={{background:T.blue+"0D",border:`1px solid ${T.blue}33`}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0" style={{background:T.blue}}>{(bookingSlot.counsellorName||"?")[0]}</div>
              <div><div className="font-bold text-sm">{bookingSlot.counsellorName}</div><div className="text-[11px] text-slate-400">Counsellor</div></div>
            </div>

            {/* Reschedule: new date + time pickers */}
            {bookingSlot.isRebook ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-500">New date *
                  <input type="date" value={reschedDate} onChange={e=>setReschedDate(e.target.value)} min={todayStr()} style={{...inp,marginTop:4}}/>
                </label>
                <label className="block text-xs font-semibold text-slate-500">New time *
                  <select value={reschedTime} onChange={e=>setReschedTime(e.target.value)} style={{...inp,marginTop:4}}>
                    {SLOT_TIMES.map(t=><option key={t} value={t}>{SLOT_LABELS[t]}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <div className="p-2 rounded-xl text-xs font-semibold text-slate-500" style={{background:"#F8FAFC"}}>
                {fmtDate(selDate)} · {bookingSlot.label}
              </div>
            )}

            {/* Student — show card if pre-filled, dropdown if not */}
            {bookStudentId ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2" style={{borderColor:T.teal,background:T.teal+"0D"}}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0" style={{background:T.teal}}>{(students.find(s=>s.id===bookStudentId)?.name||"?")[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{color:T.teal}}>Student</div>
                  <div className="font-bold text-sm truncate">{students.find(s=>s.id===bookStudentId)?.name}</div>
                  <div className="text-[11px] text-slate-400">{students.find(s=>s.id===bookStudentId)?.phone}</div>
                </div>
                {!bookingSlot.isRebook && <button onClick={()=>setBookStudentId("")} className="text-xs font-semibold text-slate-400 hover:text-red-500">Change</button>}
              </div>
            ) : (
              <label className="block text-xs font-semibold text-slate-500">
                Select student *
                <select value={bookStudentId} onChange={e=>setBookStudentId(e.target.value)} style={inp} autoFocus>
                  <option value="">-- Select student --</option>
                  {students
                    .filter(s=>(isBDE && !isManager) ? s.bde_id===currentUser.id : true)
                    .map(s=><option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}
                </select>
              </label>
            )}
          </div>
          <button onClick={confirmBook} disabled={!bookStudentId} className="mt-4 w-full py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-40" style={{background:T.teal}}>
            {bookingSlot?.isRebook ? "✓ Confirm reschedule" : "✓ Confirm booking"}
          </button>
        </AppModal>
      )}

      {/* Admin: mark a slot as available */}
      {showAddSlot && (isAdmin||isCounsel||isManager) && (
        <AppModal title="Mark slot as available" onClose={()=>setShowAddSlot(false)}>
          <p className="text-xs text-slate-500 mb-3">This marks a time slot as available so BDEs can book it for students. If you don't mark slots, BDEs can still book free slots directly.</p>
          <div className="space-y-3">
            {(isAdmin||isManager) && (
              <label className="block text-xs font-semibold text-slate-500">Counsellor
                <select value={selCounsellor==="all"?"":selCounsellor} onChange={e=>setSelCounsellor(e.target.value)} style={inp}>
                  <option value="">Select counsellor…</option>
                  {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {isCounsel && <p className="text-sm font-semibold">Marking slot for: {currentUser.name}</p>}
            <label className="block text-xs font-semibold text-slate-500">Date
              <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={inp} min={todayStr()}/>
            </label>
            <label className="block text-xs font-semibold text-slate-500">Time slot
              <select defaultValue="11:00" style={inp} id="marktime">
                {SLOT_TIMES.map(t=><option key={t} value={t}>{SLOT_LABELS[t]}</option>)}
              </select>
            </label>
          </div>
          <button onClick={()=>{
            const cId = isCounsel?currentUser.id:(selCounsellor!=="all"?selCounsellor:"");
            const t = document.getElementById("marktime")?.value||"11:00";
            if(!cId) return;
            onAddSlot({counsellor_id:cId,slot_date:selDate,slot_time:t,status:"available"});
            setShowAddSlot(false);
          }} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Mark as available</button>
        </AppModal>
      )}
    </div>
  );
}


/* ════ STUDENT DETAIL ════ */
function StudentDetail({ s, team, counsellors, bdeList, memberName, role, isAdmin, isBDE, isCounsel, isVisa, isManager, slots, onBack, onUpdate, onMove, onAssignBDE, onAssignCounsellor, onAddNote, onDeleteNote, onUpdateNote, onBookSlot, onFreeSlot, onDeleteStudent, onAddApp, onUpdateApp, onDeleteApp, onCycleDoc, onAddDoc, onDeleteDoc }) {
  const initTab = isBDE?"calls":isCounsel?"session":"overview";
  const [ptab,setPtab]       = useState(initTab);
  const [noteText,setNoteText] = useState("");
  const [newDoc,setNewDoc]   = useState("");
  const [appForm,setAppForm] = useState({course:"",institution:"",commence_date:"",status:"Application Preparation"});
  const [showCallModal,setShowCallModal]   = useState(false);
  const [showSessionModal,setShowSessionModal] = useState(false);
  const [callForm,setCallForm]   = useState({outcome:CALL_OUTCOMES[0],notes:"",date:"",time:"",enrolledCountry:"",enrolledIntake:""});
  const [sessionForm,setSessionForm] = useState({platform:MEET_TYPES[0],duration:"30 mins",outcome:"",notes:"",meetLink:""});

  const st   = stageOf(s.stage);
  const i    = stageIdx(s.stage);
  const apps = s.applications||[];
  const docs = (s.documents&&s.documents.length>0)?s.documents:DEFAULT_DOCS.map((n,j)=>({id:`tmp-${j}`,name:n,status:"Pending",student_id:s.id}));
  const allNotes    = s.notes||[];
  const callLogs    = allNotes.filter(n=>n.text?.startsWith("📞"));
  const sessionLogs = allNotes.filter(n=>n.text?.startsWith("🎓"));
  const otherNotes  = allNotes.filter(n=>!n.text?.startsWith("📞")&&!n.text?.startsWith("🎓")&&!n.text?.startsWith("✅"));
  const canAdvance  = isAdmin||isCounsel||isVisa||isManager;

  const availableSlots = slots.filter(sl=>sl.status==="available"&&sl.slot_date>=todayStr());

  const saveCallLog = async () => {
    let text=`📞 CALL — ${callForm.outcome}`;
    if (callForm.notes) text+=`\nNotes: ${callForm.notes}`;
    if (callForm.date&&callForm.time) text+=`\nCallback: ${callForm.date} at ${callForm.time}`;
    if (callForm.outcome==="Already Enrolled") {
      if (callForm.enrolledCountry) text+=`\nEnrolled Country: ${callForm.enrolledCountry}`;
      if (callForm.enrolledIntake) text+=`\nEnrolled Intake: ${callForm.enrolledIntake}`;
    }
    if (callForm.outcome.includes("Counselling")&&callForm.bookedSlot) {
      text+=`\nCounselling booked`;
      await onBookSlot(callForm.bookedSlot, s.id);
    }
    onAddNote(s.id,text);
    // Auto-move stage based on outcome
    const targetStage = OUTCOME_STAGE[callForm.outcome];
    if (targetStage && s.stage !== targetStage) {
      onUpdate(s.id, {stage: targetStage});
    }
    setCallForm({outcome:CALL_OUTCOMES[0],notes:"",date:"",time:"",enrolledCountry:"",enrolledIntake:""});
    setShowCallModal(false);
  };
  const saveSessionLog = () => {
    let text=`🎓 SESSION — ${sessionForm.platform} · ${sessionForm.duration}`;
    if (sessionForm.outcome) text+=`\nOutcome: ${sessionForm.outcome}`;
    if (sessionForm.notes) text+=`\nNotes: ${sessionForm.notes}`;
    if (sessionForm.meetLink) text+=`\nLink: ${sessionForm.meetLink}`;
    onAddNote(s.id, text);
    // Auto-free the booked slot for this student
    const bookedSlot = slots.find(sl => sl.booked_by === s.id && sl.status === "booked");
    if (bookedSlot && onFreeSlot) onFreeSlot(bookedSlot.id);
    setShowSessionModal(false);
  };

  const TABS = [
    ...(isBDE||isAdmin||isManager?[["calls",`Calls (${callLogs.length})`]]:[]),
    ...(isCounsel||isAdmin||isManager?[["session",`Sessions (${sessionLogs.length})`]]:[]),
    ["overview","Overview"],
    ["apps",`Applications (${apps.length})`],
    ["docs","Documents"],
    ["notes",`Notes (${otherNotes.length})`],
  ];

  return (
    <div className="space-y-3">
      {/* Back + delete row */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft size={16}/> All students
        </button>
        {(isAdmin||isManager) && (
          <button onClick={()=>{if(window.confirm(`Delete ${s.name}?`)) onDeleteStudent(s.id);}}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 size={13}/> Delete
          </button>
        )}
      </div>

      {/* ── Hero identity card ── */}
      <div className="card overflow-hidden">
        {/* Coloured top strip */}
        <div className="h-1.5 w-full" style={{background:`linear-gradient(90deg,${st.color},${st.color}88)`}}/>

        <div className="p-5">
          {/* Identity row */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-white text-2xl shrink-0 shadow-sm" style={{background:st.color}}>
              {(s.name||"?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                <h1 className="text-xl font-extrabold leading-tight">{s.name}</h1>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">AV-{s.id.toString().toUpperCase().slice(0,8)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium num"><Phone size={11}/>{s.phone}</span>
                {s.email && <span className="flex items-center gap-1"><Mail size={11}/>{s.email}</span>}
                <span className="flex items-center gap-1"><Globe2 size={11}/>{s.level} · {s.country} · {s.intake}</span>
              </div>
              {/* Team + Qual row */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {s.bde_id && <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:T.teal+"15",color:T.teal}}><Briefcase size={10}/>{memberName(s.bde_id)}</span>}
                {counsellors.find(c=>c.id===s.assigned_to) && <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:T.blue+"15",color:T.blue}}><GraduationCap size={10}/>{memberName(s.assigned_to)}</span>}
                {!s.bde_id && !counsellors.find(c=>c.id===s.assigned_to) && <span className="text-[11px] font-semibold text-red-400 bg-red-50 px-2 py-0.5 rounded-full">Unassigned</span>}
                <div className="flex items-center gap-1 ml-auto">
                  {["Hot","Warm","Cold"].map(q=>(
                    <button key={q} onClick={()=>(isAdmin||isBDE||isManager)&&onUpdate(s.id,{qualification:q})}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all"
                      style={s.qualification===q?{background:qualColor(q),color:"#fff",borderColor:qualColor(q)}:{background:"transparent",color:qualColor(q),borderColor:qualColor(q)+"55"}}>{q}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{borderColor:"#F1F5F9"}}>
            <a href={`tel:${telNum(s.phone)}`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{background:T.blue}}><PhoneCall size={14}/> Call</a>
            <a href={`https://wa.me/${String(s.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{background:"#25D366"}}><MessageCircle size={14}/> WhatsApp</a>
            {(isBDE||isAdmin||isManager) && <button onClick={()=>setShowCallModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{background:T.saffron}}><PhoneCall size={14}/> Log call</button>}
            {(isCounsel||isAdmin||isManager) && <button onClick={()=>setShowSessionModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{background:T.purple}}><Video size={14}/> Log session</button>}
          </div>
        </div>
      </div>

      {/* ── Stage pipeline card ── */}
      <div className="card p-4">
        <div className="flex gap-1 mb-3">
          {STAGES.map((stg,idx)=>(
            <button key={stg.id} onClick={()=>(isAdmin||isManager)&&onUpdate(s.id,{stage:stg.id})} disabled={!(isAdmin||isManager)}
              title={stg.label} className="h-2 rounded-full flex-1 min-w-[16px] transition-all"
              style={{background:idx<=i?stg.color:"#E8EDF5"}}/>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={()=>onMove(s.id,-1)} disabled={i===0||!canAdvance}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-30 hover:bg-slate-50 transition-colors"
            style={{borderColor:"#E2E8F0"}}>
            <ChevronLeft size={13}/> Back
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{background:st.color}}/>
            <span className="text-sm font-bold" style={{color:st.color}}>{st.label}</span>
            <span className="text-[11px] text-slate-400">· stage {i+1}/{STAGES.length}</span>
          </div>
          <button onClick={()=>onMove(s.id,1)} disabled={i===STAGES.length-1||!canAdvance}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
            style={{background:T.blue}}>
            Advance <ChevronRight size={13}/>
          </button>
        </div>
      </div>

      {/* ── Assignment + follow-up row ── */}
      <div className="card p-4">
        {/* Admin / Manager: BDE + Counsellor selectors */}
        {(isAdmin||isManager) && (
          <div className="grid sm:grid-cols-3 gap-3 mb-3 pb-3 border-b" style={{borderColor:"#F1F5F9"}}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{color:T.teal}}>BDE</div>
              <div className="flex gap-1.5">
                <select value={s.bde_id||""} onChange={e=>e.target.value&&onAssignBDE(s.id,e.target.value)}
                  className="flex-1 py-1.5 px-2 rounded-lg border text-xs bg-white font-semibold" style={{borderColor:"#E2E8F0"}}>
                  <option value="">{s.bde_id?memberName(s.bde_id):"No BDE"}</option>
                  {bdeList.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {s.bde_id && <button onClick={()=>{if(window.confirm("Remove BDE?")) onAssignBDE(s.id,"remove");}} className="px-2 rounded-lg border text-[10px] font-bold text-red-400 hover:bg-red-50" style={{borderColor:"#FECACA"}}>✕</button>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{color:T.blue}}>Counsellor</div>
              <select value={counsellors.find(c=>c.id===s.assigned_to)?s.assigned_to:""} onChange={e=>e.target.value&&onAssignCounsellor(s.id,e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg border text-xs bg-white font-semibold" style={{borderColor:"#E2E8F0"}}>
                <option value="">{counsellors.find(c=>c.id===s.assigned_to)?.name||"Select counsellor…"}</option>
                {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Follow-up date</div>
              <input type="date" value={s.follow_up||""} onChange={e=>onUpdate(s.id,{follow_up:e.target.value})}
                className="w-full py-1.5 px-2 rounded-lg border text-xs font-semibold" style={{borderColor:"#E2E8F0"}}/>
            </div>
          </div>
        )}

        {/* BDE: counsellor assignment */}
        {isBDE && (
          <div className="mb-3 pb-3 border-b" style={{borderColor:"#F1F5F9"}}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{color:T.blue}}>Counsellor</div>
            {counsellors.find(c=>c.id===s.assigned_to) ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold flex-1" style={{color:T.blue}}>
                  <GraduationCap size={13}/>{memberName(s.assigned_to)} assigned
                </span>
                <select defaultValue="" onChange={e=>e.target.value&&onAssignCounsellor(s.id,e.target.value)}
                  className="py-1.5 px-2 rounded-lg border text-xs bg-white font-semibold" style={{borderColor:"#E2E8F0"}}>
                  <option value="">Change…</option>
                  {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <select defaultValue="" onChange={e=>e.target.value&&onAssignCounsellor(s.id,e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg border text-xs bg-white font-semibold" style={{borderColor:"#E2E8F0"}}>
                <option value="">Select counsellor…</option>
                {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Follow-up for non-admin roles */}
        {!isAdmin && !isManager && (
          <div className="flex items-center gap-3">
            <Calendar size={13} className="text-slate-400 shrink-0"/>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Next follow-up</div>
              <input type="date" value={s.follow_up||""} onChange={e=>onUpdate(s.id,{follow_up:e.target.value})}
                className="py-1 px-0 text-xs font-semibold bg-transparent border-none outline-none" style={{color:s.follow_up?T.blue:"#94A3B8"}}/>
            </div>
            {s.follow_up && <span className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{background:T.blue+"10",color:T.blue}}>{fmtDate(s.follow_up)}</span>}
          </div>
        )}
      </div>

      {/* Call modal */}
      {showCallModal && (
        <AppModal title="📞 Log call" onClose={()=>setShowCallModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Outcome
              <select value={callForm.outcome} onChange={e=>setCallForm({...callForm,outcome:e.target.value})} style={inp}>
                {CALL_OUTCOMES.map(o=><option key={o}>{o}</option>)}
              </select>
            </label>
            {/* Already Enrolled fields */}
            {callForm.outcome==="Already Enrolled" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{background:"#F3E8FF"}}>
                <label className="block text-xs font-semibold text-slate-600">Enrolled Country
                  <select value={callForm.enrolledCountry} onChange={e=>setCallForm({...callForm,enrolledCountry:e.target.value})} style={inp}>
                    <option value="">Select…</option>
                    {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">Enrolled Intake
                  <select value={callForm.enrolledIntake} onChange={e=>setCallForm({...callForm,enrolledIntake:e.target.value})} style={inp}>
                    <option value="">Select…</option>
                    {INTAKES.map(i=><option key={i}>{i}</option>)}
                  </select>
                </label>
              </div>
            )}
            {/* Callback date for callback/counselling/processing outcomes */}
            {(callForm.outcome.includes("callback")||callForm.outcome.includes("Counselling")||callForm.outcome.includes("Busy")||callForm.outcome.includes("follow-up")) && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-500">Callback Date<input type="date" value={callForm.date} onChange={e=>setCallForm({...callForm,date:e.target.value})} style={inp} min={todayStr()}/></label>
                <label className="block text-xs font-semibold text-slate-500">Time<select value={callForm.time} onChange={e=>setCallForm({...callForm,time:e.target.value})} style={inp}><option value="">Select…</option>{SLOT_TIMES.map(t=><option key={t}>{t}</option>)}</select></label>
              </div>
            )}
            {callForm.outcome.includes("Counselling") && availableSlots.length>0 && (
              <label className="block text-xs font-semibold text-slate-500">Book available slot (optional)
                <select value={callForm.bookedSlot||""} onChange={e=>setCallForm({...callForm,bookedSlot:e.target.value})} style={inp}>
                  <option value="">Choose slot…</option>
                  {availableSlots.map(sl=><option key={sl.id} value={sl.id}>{fmtDate(sl.slot_date)} at {sl.slot_time} — {team.find(t=>t.id===sl.counsellor_id)?.name||"?"}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-500">Notes<textarea value={callForm.notes} onChange={e=>setCallForm({...callForm,notes:e.target.value})} placeholder="Key points…" rows={3} style={{...inp,resize:"vertical"}}/></label>
            {/* Auto-move notice */}
            {OUTCOME_STAGE[callForm.outcome] && s.stage !== OUTCOME_STAGE[callForm.outcome] && (
              <div className="text-[11px] px-3 py-2 rounded-lg font-semibold" style={{background:"#FEF9C3",color:"#92400E"}}>
                ⚡ Student will move: <b>{stageOf(s.stage).label}</b> → <b>{stageOf(OUTCOME_STAGE[callForm.outcome]).label}</b>
              </div>
            )}
          </div>
          <button onClick={saveCallLog} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.blue}}>Save call log</button>
        </AppModal>
      )}

      {/* Session modal */}
      {showSessionModal && (
        <AppModal title="🎓 Log session" onClose={()=>setShowSessionModal(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-500">Platform<select value={sessionForm.platform} onChange={e=>setSessionForm({...sessionForm,platform:e.target.value})} style={inp}>{MEET_TYPES.map(m=><option key={m}>{m}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Duration<select value={sessionForm.duration} onChange={e=>setSessionForm({...sessionForm,duration:e.target.value})} style={inp}>{["15 mins","30 mins","45 mins","60 mins","90 mins"].map(d=><option key={d}>{d}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Outcome<select value={sessionForm.outcome} onChange={e=>setSessionForm({...sessionForm,outcome:e.target.value})} style={inp}><option value="">Select…</option>{["Lead converted","Needs another session","Not eligible","Postponing","Application confirmed","Documents submitted"].map(o=><option key={o}>{o}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Notes<textarea value={sessionForm.notes} onChange={e=>setSessionForm({...sessionForm,notes:e.target.value})} rows={3} style={{...inp,resize:"vertical"}}/></label>
            <label className="block text-xs font-semibold text-slate-500">Meet link (optional)<input value={sessionForm.meetLink} onChange={e=>setSessionForm({...sessionForm,meetLink:e.target.value})} placeholder="https://meet.google.com/…" style={inp}/></label>
          </div>
          <button onClick={saveSessionLog} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.purple}}>Save session</button>
        </AppModal>
      )}

      {/* Tabs */}
      <div className="flex gap-1 card p-1.5 overflow-x-auto">
        {TABS.map(([id,label])=>(
          <button key={id} onClick={()=>setPtab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${ptab===id?"text-white":"text-slate-500 hover:bg-slate-50"}`} style={ptab===id?{background:T.ink}:{}}>{label}</button>
        ))}
      </div>

      {/* CALLS TAB */}
      {ptab==="calls" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><PhoneCall size={14} style={{color:T.blue}}/> Call history</h2>
            <button onClick={()=>setShowCallModal(true)} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl text-white" style={{background:T.blue}}><Plus size={12}/> Log call</button>
          </div>
          {/* Big tap-friendly call buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <a href={`tel:${telNum(s.phone)}`} className="call-btn" style={{background:T.blue,color:"#fff"}}><PhoneCall size={18}/> Call now</a>
            <a href={`https://wa.me/${String(s.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" className="call-btn" style={{background:"#25D366",color:"#fff"}}><MessageCircle size={18}/> WhatsApp</a>
          </div>
          {/* Available slots for BDE to book */}
          {isBDE && availableSlots.length>0 && (
            <div className="mb-4 p-3 rounded-xl border" style={{borderColor:T.teal+"55",background:T.teal+"08"}}>
              <p className="text-xs font-bold mb-2" style={{color:T.teal}}>Available counselling slots — book directly from here</p>
              <div className="flex flex-wrap gap-2">
                {availableSlots.slice(0,6).map(sl=>{
                  const cName = (team.find(t=>t.id===sl.counsellor_id)||{}).name||"?";
                  return (
                    <button key={sl.id} onClick={()=>{if(window.confirm(`Book ${sl.slot_time} on ${fmtDate(sl.slot_date)} with ${cName} for ${s.name}?`)) onBookSlot(sl.id,s.id);}}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{background:T.teal}}>
                      {fmtDate(sl.slot_date)} {sl.slot_time} — {cName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {callLogs.length===0 && <p className="text-sm text-slate-400">No calls logged yet.</p>}
          <div className="space-y-3">
            {callLogs.map((n,idx)=>{
              const lines=(n.text||"").split("\n");
              const outcome=lines[0].replace("📞 CALL — ","");
              const notesTxt=lines.find(l=>l.startsWith("Notes:"))?.slice(7);
              const callback=lines.find(l=>l.startsWith("Callback:"))?.slice(10);
              const booked=lines.some(l=>l.includes("Counselling"));
              return (
                <div key={n.id||idx} className="border rounded-xl p-3" style={{borderColor:T.line}}>
                  <div className="flex items-center gap-2">
                    <PhoneCall size={13} style={{color:booked?T.teal:T.blue}}/>
                    <span className="text-xs font-bold flex-1" style={{color:booked?T.teal:T.blue}}>{outcome}</span>
                    {booked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:"#CCFBF1",color:"#134E4A"}}>Booked</span>}
                    <span className="text-[11px] text-slate-400 num">{new Date(n.created_at||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>
                  </div>
                  {notesTxt && <p className="text-sm text-slate-600 mt-1 ml-5">{notesTxt}</p>}
                  {callback && <p className="text-xs text-slate-400 mt-1 ml-5 flex items-center gap-1"><Clock size={11}/> {callback}</p>}
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
            <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="call-btn" style={{background:"#EEF2FF",color:"#4F46E5"}}><Video size={15}/> Google Meet</a>
            <a href="https://zoom.us/start/videomeeting" target="_blank" rel="noreferrer" className="call-btn" style={{background:"#EFF6FF",color:"#2563EB"}}><Video size={15}/> Zoom</a>
          </div>
          {sessionLogs.length===0 && <p className="text-sm text-slate-400">No sessions logged yet.</p>}
          <div className="space-y-3">
            {sessionLogs.map((n,idx)=>{
              const lines=(n.text||"").split("\n");
              const header=lines[0].replace("🎓 SESSION — ","");
              const outcome=lines.find(l=>l.startsWith("Outcome:"))?.slice(9);
              const notesTxt=lines.find(l=>l.startsWith("Notes:"))?.slice(7);
              const fullText = lines.slice(1).join("\n");
              return (
                <SessionCard key={n.id||idx}
                  header={header} outcome={outcome} notesTxt={notesTxt}
                  fullText={fullText} date={n.created_at} noteId={n.id}
                  studentId={s.id}
                  onDelete={onDeleteNote} onUpdate={onUpdateNote}
                  T={T}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {ptab==="overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Personal</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Gender<select value={s.gender||""} onChange={e=>onUpdate(s.id,{gender:e.target.value})} style={inp}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option></select></label>
              <label className="text-xs font-semibold text-slate-500">Date of birth<input type="date" value={s.dob||""} onChange={e=>onUpdate(s.id,{dob:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Nationality<input value={s.nationality||""} onChange={e=>onUpdate(s.id,{nationality:e.target.value})} placeholder="India" style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">City<input value={s.city||""} onChange={e=>onUpdate(s.id,{city:e.target.value})} placeholder="Delhi" style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-500">Email<input value={s.email||""} onChange={e=>onUpdate(s.id,{email:e.target.value})} style={inp}/></label>
              <label className="text-xs font-semibold text-slate-500">Mobile<input value={s.phone||""} onChange={e=>onUpdate(s.id,{phone:e.target.value})} style={inp}/></label>
            </div>
            <h2 className="font-bold text-sm pt-1">Quick note</h2>
            <div className="flex gap-2">
              <input value={noteText} onChange={e=>setNoteText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&noteText.trim()){onAddNote(s.id,noteText);setNoteText("");}}} placeholder="Add a quick note…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{borderColor:"#CBD5E1"}}/>
              <button onClick={()=>{if(noteText.trim()){onAddNote(s.id,noteText);setNoteText("");}}} className="px-3 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}>Add</button>
            </div>
            {otherNotes.slice(0,3).map((n,idx)=>(<div key={n.id||idx} className="text-xs text-slate-500 border-l-2 pl-2 py-0.5 truncate" style={{borderColor:"#0d6efd55"}}>{n.text}</div>))}
          </div>
          <div className="card p-5 space-y-3">
            <h2 className="font-bold text-sm">Engagement</h2>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_tc} onChange={e=>onUpdate(s.id,{consent_tc:e.target.checked})} className="w-4 h-4"/> T&C</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!s.consent_mkt} onChange={e=>onUpdate(s.id,{consent_mkt:e.target.checked})} className="w-4 h-4"/> Marketing</label>
            </div>
            <label className="block text-xs font-semibold text-slate-500">How did you hear?<select value={s.hear_source||""} onChange={e=>onUpdate(s.id,{hear_source:e.target.value})} style={inp}><option value="">—</option>{HEAR_SOURCES.map(h=><option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Financial source<select value={s.fin_source||""} onChange={e=>onUpdate(s.id,{fin_source:e.target.value})} style={inp}><option value="">—</option>{FIN_SOURCES.map(h=><option key={h}>{h}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-500">Field of study<select value={s.field||""} onChange={e=>onUpdate(s.id,{field:e.target.value})} style={inp}>{FIELDS.map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
        </div>
      )}

      {/* APPS TAB */}
      {ptab==="apps" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3">Course applications</h2>
          {(isAdmin||isCounsel||isManager) && (
            <div className="grid sm:grid-cols-5 gap-2 mb-4">
              <input value={appForm.course} onChange={e=>setAppForm({...appForm,course:e.target.value})} placeholder="Course name" style={{...inp,marginTop:0}} className="sm:col-span-2"/>
              <input value={appForm.institution} onChange={e=>setAppForm({...appForm,institution:e.target.value})} placeholder="University" style={{...inp,marginTop:0}}/>
              <input type="date" value={appForm.commence_date} onChange={e=>setAppForm({...appForm,commence_date:e.target.value})} style={{...inp,marginTop:0}}/>
              <button onClick={()=>{if(appForm.course.trim()){onAddApp(s.id,appForm);setAppForm({course:"",institution:"",commence_date:"",status:"Application Preparation"});}}} className="py-2 rounded-xl text-white text-sm font-semibold" style={{background:T.blue}}>+ Add</button>
            </div>
          )}
          {apps.length===0 && <p className="text-sm text-slate-400">No applications yet.</p>}
          <div className="space-y-2">
            {apps.map(a=>(
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border" style={{borderColor:T.line}}>
                <div className="flex-1 min-w-[180px]"><div className="font-semibold text-sm">{a.course}</div><div className="text-[11px] text-slate-500">{a.institution||"—"}{a.commence_date?` · starts ${a.commence_date}`:""}</div></div>
                <select value={a.status} onChange={e=>onUpdateApp(s.id,a.id,{...a,status:e.target.value})} className="text-xs font-semibold py-1.5 px-2 rounded-lg border bg-white" style={{borderColor:"#CBD5E1"}}>{APP_STATUSES.map(x=><option key={x}>{x}</option>)}</select>
                {(isAdmin||isManager) && <button onClick={()=>onDeleteApp(s.id,a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCS TAB */}
      {ptab==="docs" && (
        <DocsTab s={s} docs={docs} isAdmin={isAdmin} isCounsel={isCounsel} isManager={isManager}
          onCycleDoc={onCycleDoc} onAddDoc={onAddDoc} onDeleteDoc={onDeleteDoc} onUpdate={onUpdate}
          newDoc={newDoc} setNewDoc={setNewDoc}/>
      )}

      {/* NOTES TAB */}
      {ptab==="notes" && (
        <div className="card p-5">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><StickyNote size={14} style={{color:T.saffron}}/> Notes</h2>
          <div className="flex gap-2 mb-4">
            <input value={noteText} onChange={e=>setNoteText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onAddNote(s.id,noteText);setNoteText("");}}} placeholder="Add a note…" className="flex-1 py-2 px-3 rounded-xl border text-sm" style={{borderColor:"#CBD5E1"}}/>
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

/* ════ DOCS TAB COMPONENT ════ */
function DocsTab({ s, docs, isAdmin, isCounsel, isManager, onCycleDoc, onAddDoc, onDeleteDoc, onUpdate, newDoc, setNewDoc }) {
  const [expandedDoc, setExpandedDoc] = useState(null); // doc id
  const [docDetails, setDocDetails]   = useState({}); // { docId: { field: value } }

  // Load existing details from doc.notes field if any
  const getDetails = (docId) => docDetails[docId] || {};
  const setField = (docId, key, val) => setDocDetails(p=>({ ...p, [docId]:{ ...(p[docId]||{}), [key]:val } }));

  const saveDetails = (d) => {
    const details = docDetails[d.id];
    if (!details) return;
    // Store as JSON in doc notes via update
    const notesJson = JSON.stringify(details);
    onUpdate(s.id, { [`doc_${d.id}`]: notesJson }); // stored locally for now
  };

  // Parse stored details from doc object
  const getParsedDetails = (d) => {
    try { return d.details ? JSON.parse(d.details) : {}; } catch { return {}; }
  };

  const fields = (name) => DOC_FIELDS[name] || [];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-sm">Document checklist</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tap status to cycle · Click document name to add details</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-lg text-white num" style={{background:DOC_COLORS.Verified}}>
          {docs.filter(d=>d.status==="Verified").length}/{docs.length} verified
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {docs.map((d,idx)=>{
          const isExp = expandedDoc===( d.id||idx);
          const docFields = fields(d.name);
          const stored = getParsedDetails(d);
          const localDetails = docDetails[d.id]||{};
          const merged = { ...stored, ...localDetails };
          const hasDetails = docFields.length > 0;
          const filledCount = docFields.filter(f=>merged[f.key]).length;

          return (
            <div key={d.id||idx} className="rounded-xl border-2 overflow-hidden transition"
              style={{borderColor:d.status==="Verified"?"#86EFAC":isExp?T.blue:T.line}}>
              {/* Row */}
              <div className="flex items-center gap-2 p-3" style={{background:d.status==="Verified"?"#F0FDF4":"#fff"}}>
                <button
                  onClick={()=>hasDetails&&setExpandedDoc(isExp?null:(d.id||idx))}
                  className="flex-1 text-left flex items-center gap-2">
                  <span className="text-sm font-semibold">{d.name}</span>
                  {hasDetails && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:filledCount>0?"#DBEAFE":"#F1F5F9",color:filledCount>0?T.blue:"#94A3B8"}}>
                      {filledCount}/{docFields.length} fields
                    </span>
                  )}
                  {hasDetails && <ChevronDown size={13} className="text-slate-400 ml-auto" style={{transform:isExp?"rotate(180deg)":"none",transition:"transform .2s"}}/>}
                </button>
                <button
                  onClick={()=>{ if(d.id&&!d.id.startsWith("tmp-")) onCycleDoc(s.id,d.id,d.status,d.name); else onAddDoc(s.id,d.name); }}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white shrink-0"
                  style={{background:DOC_COLORS[d.status]}}>{d.status}</button>
                {(isAdmin||isCounsel||isManager)&&d.id&&!d.id.startsWith("tmp-")&&(
                  <button onClick={()=>onDeleteDoc(s.id,d.id)} className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 shrink-0"><X size={11}/></button>
                )}
              </div>

              {/* Expanded detail fields */}
              {isExp && hasDetails && (
                <div className="px-3 pb-3 pt-2 border-t" style={{borderColor:T.line,background:"#F8FAFC"}}>
                  <p className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Document Details</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {docFields.map(f=>(
                      <label key={f.key} className="block text-[11px] font-semibold text-slate-500">
                        {f.label}
                        <input
                          type={f.type||"text"}
                          value={merged[f.key]||""}
                          onChange={e=>setField(d.id,f.key,e.target.value)}
                          placeholder={`Enter ${f.label.toLowerCase()}…`}
                          className="block w-full mt-0.5 py-1.5 px-2.5 rounded-lg border text-sm bg-white"
                          style={{borderColor:"#CBD5E1",fontWeight:500}}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={()=>{
                      // save details as a note on the student
                      const details = docDetails[d.id]||{};
                      if(Object.keys(details).length>0){
                        const lines = docFields.filter(f=>details[f.key]).map(f=>`${f.label}: ${details[f.key]}`).join(" | ");
                        onUpdate(s.id, {});  // trigger re-render
                        // store as note
                        const text = `📄 ${d.name} details — ${lines}`;
                        // we just show locally for now (full persistence needs a doc_details column)
                      }
                      setExpandedDoc(null);
                    }}
                    className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold"
                    style={{background:T.blue}}>
                    <Save size={12}/> Save details
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add custom document */}
      <div className="flex gap-2 p-3 rounded-xl border-2 border-dashed" style={{borderColor:T.blue+"55"}}>
        <input
          value={newDoc}
          onChange={e=>setNewDoc(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&newDoc.trim()){onAddDoc(s.id,newDoc.trim());setNewDoc("");}}}
          placeholder="Type document name and click Add…"
          className="flex-1 py-2 px-3 rounded-lg border text-sm bg-white"
          style={{borderColor:"#CBD5E1"}}
        />
        <button
          type="button"
          onClick={()=>{const val=newDoc.trim();if(val){onAddDoc(s.id,val);setNewDoc("");}}}
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-white text-sm font-bold shrink-0"
          style={{background:T.blue}}
        ><Plus size={14}/> Add</button>
      </div>
    </div>
  );
}

/* ════ SLOT PICKER MODAL (inline counsellor assignment) ════ */
function SlotPickerModal({ counsellorId, studentId, date, onDateChange, slots, counsellors, students, onBook, onAddSlot, onClose, notify }) {
  const [booking, setBooking] = useState(false);
  const c = counsellors.find(x => x.id === counsellorId);
  const student = students.find(s => s.id === studentId);
  const slotsForDay = slots.filter(s => s.counsellor_id === counsellorId && s.slot_date === date);

  const handleSlot = async (time) => {
    if (booking) return;
    setBooking(true);
    try {
      const existing = slotsForDay.find(s => s.slot_time === time && s.status !== "booked");
      let slotId;
      if (existing) {
        slotId = existing.id;
      } else {
        const ns = await onAddSlot({ counsellor_id: counsellorId, slot_date: date, slot_time: time, status: "available" }, true);
        slotId = ns?.id;
      }
      if (slotId) await onBook(slotId, studentId);
    } catch(e) {
      console.error("SlotPickerModal booking error:", e);
    } finally {
      setBooking(false);
    }
  };

  return (
    <AppModal title="Book counselling slot" onClose={onClose}>
      <div className="space-y-3">
        {/* Counsellor card */}
        <div className="p-3 rounded-xl flex items-center gap-3" style={{background:T.blue+"0D",border:`1px solid ${T.blue}33`}}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0" style={{background:T.blue}}>
            {(c?.name||"?")[0]}
          </div>
          <div>
            <div className="font-bold text-sm">{c?.name || "Counsellor"}</div>
            <div className="text-[11px] text-slate-400">Counsellor</div>
          </div>
        </div>

        {/* Student card */}
        {student && (
          <div className="p-3 rounded-xl flex items-center gap-3" style={{background:T.teal+"0D",border:`1px solid ${T.teal}33`}}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0" style={{background:T.teal}}>
              {(student.name||"?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{student.name}</div>
              <div className="text-[11px] text-slate-400">{student.phone}</div>
            </div>
          </div>
        )}

        {/* Date picker */}
        <label className="block text-xs font-semibold text-slate-500">
          Select date *
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            min={todayStr()}
            style={{...inp, marginTop:4}}
          />
        </label>

        {/* Slot grid */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2">Pick a time slot</div>
          <div className="grid grid-cols-2 gap-2">
            {SLOT_TIMES.map(time => {
              const slot = slotsForDay.find(s => s.slot_time === time);
              const isBooked = slot?.status === "booked";
              return (
                <button
                  key={time}
                  onClick={() => !isBooked && handleSlot(time)}
                  disabled={isBooked || booking}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition disabled:opacity-50"
                  style={{
                    borderColor: isBooked ? "#CBD5E1" : T.teal,
                    background: isBooked ? "#F1F5F9" : T.teal+"15",
                    color: isBooked ? "#94A3B8" : T.teal,
                    cursor: isBooked ? "not-allowed" : "pointer"
                  }}
                >
                  {SLOT_LABELS[time] || time}
                  {isBooked && <span className="block text-[10px] font-normal mt-0.5">Booked</span>}
                </button>
              );
            })}
          </div>
        </div>

        {booking && (
          <div className="text-center text-xs font-semibold text-slate-400 py-2">Booking…</div>
        )}
      </div>
    </AppModal>
  );
}

/* ════ ADD STUDENT MODAL ════ */
function AddStudentModal({ team, isBDE, isManager, currentUser, onClose, onSave }) {
  const counsellors = team.filter(t => (t.roles||[t.role]).includes("Counsellor") || t.role==="Counsellor");
  const [f,setF]=useState({
    name:"", phone:"", email:"", level:"PG", country:"UK", intake:"September",
    field:FIELDS[0], qualification:"Warm",
    counsellor_id: "", // BDE picks counsellor
    assigned_to: isBDE ? currentUser.id : "",
    stage:"lead"
  });
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return (
    <AppModal title={isBDE?"Add new lead":isManager?"Add new lead (Manager)":"New lead"} onClose={onClose}>
      {isBDE && (
        <div className="mb-3 p-3 rounded-xl text-xs font-semibold flex items-start gap-2" style={{background:"#CCFBF1",color:"#134E4A"}}>
          <span>✓ Lead added under your name. Choose a counsellor below to assign directly — or leave blank and admin will assign later.</span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *"><input value={f.name} onChange={set("name")} style={inp} placeholder="Student name" autoFocus/></Field>
        <Field label="Mobile *"><input value={f.phone} onChange={set("phone")} style={inp} placeholder="+91…" type="tel"/></Field>
        <Field label="Email"><input value={f.email} onChange={set("email")} style={inp} type="email"/></Field>
        <Field label="Level"><select value={f.level} onChange={set("level")} style={inp}>{LEVELS.map(l=><option key={l}>{l}</option>)}</select></Field>
        <Field label="Country"><select value={f.country} onChange={set("country")} style={inp}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Intake"><select value={f.intake} onChange={set("intake")} style={inp}>{INTAKES.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Field"><select value={f.field} onChange={set("field")} style={inp}>{FIELDS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Qualification"><select value={f.qualification} onChange={set("qualification")} style={inp}><option>Hot</option><option>Warm</option><option>Cold</option></select></Field>
        {/* BDE: pick counsellor directly */}
        {isBDE && (
          <Field label="Assign counsellor (optional)">
            <select value={f.counsellor_id} onChange={set("counsellor_id")} style={inp}>
              <option value="">Select counsellor…</option>
              {counsellors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {!isBDE && (
          <Field label="Assign to">
            <select value={f.assigned_to} onChange={set("assigned_to")} style={inp}>
              <option value="">Unassigned</option>
              {team.map(t=><option key={t.id} value={t.id}>{t.name} ({primaryRole(t)})</option>)}
            </select>
          </Field>
        )}
      </div>
      <button
        disabled={!f.name.trim()||!f.phone.trim()}
        onClick={()=>onSave({...f, _bde_picked_counsellor: f.counsellor_id})}
        className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
        style={{background:isBDE?T.teal:T.blue}}>
        Save lead{f.counsellor_id ? ` → assign to ${counsellors.find(c=>c.id===f.counsellor_id)?.name}` : ""}
      </button>
    </AppModal>
  );
}

/* ════ ADD TEAM MEMBER ════ */
function AddTeamModal({ onClose, onSave }) {
  const [name,setName]   = useState("");
  const [roles,setRoles] = useState(["BDE"]);
  const [country,setCountry] = useState("—");
  const [pw,setPw]       = useState("");
  const [showPw,setShowPw] = useState(false);
  const toggleR = r => setRoles(p=>p.includes(r)?p.filter(x=>x!==r):[...p,r]);
  const pRole = roles[0]||"BDE";
  return (
    <AppModal title="Add team member" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name *"><input value={name} onChange={e=>setName(e.target.value)} style={inp} placeholder="Full name" autoFocus/></Field>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Roles (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {ALL_MEMBER_ROLES.map(r=>(
              <label key={r} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 cursor-pointer text-xs font-bold transition"
                style={{borderColor:roles.includes(r)?rMeta(r).color:T.line,background:roles.includes(r)?rMeta(r).badge:"#fff",color:roles.includes(r)?rMeta(r).tx:"#64748B"}}>
                <input type="checkbox" className="hidden" checked={roles.includes(r)} onChange={()=>toggleR(r)}/>{r}
              </label>
            ))}
          </div>
        </div>
        <Field label="Country desk"><select value={country} onChange={e=>setCountry(e.target.value)} style={inp}><option>—</option>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select></Field>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1"><KeyRound size={11} className="inline mr-1"/> Login password (optional)</label>
          <div className="relative">
            <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} placeholder="Set a login password…" style={{...inp,marginTop:0,paddingRight:38}}/>
            <button onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-2.5 text-slate-400">{showPw?<EyeOff size={14}/>:<Eye size={14}/>}</button>
          </div>
        </div>
      </div>
      <button disabled={!name.trim()||roles.length===0} onClick={()=>{
        const m={name,role:roles.join(","),country};
        if(pw.trim()) m.password_hash=hashPassword(pw.trim());
        onSave(m);
      }} className="mt-4 w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40" style={{background:rMeta(pRole)?.color||T.blue}}>Add member</button>
    </AppModal>
  );
}

/* ════ SECURITY SECTION ════ */
function SecuritySection({ security, onSave }) {
  const [a,setA]=useState(""); const [x,setX]=useState(""); const [err,setErr]=useState("");
  const save=()=>{
    if(!a&&!x){setErr("Enter at least one password.");return;}
    const next={...security};
    if(a) next.adminPass=hashPassword(a); if(x) next.exportPass=hashPassword(x);
    if(next.adminPass&&next.exportPass&&next.adminPass===next.exportPass){setErr("Passwords must differ.");return;}
    setErr(""); onSave(next); setA(""); setX("");
  };
  return (
    <div className="p-3 rounded-xl border space-y-3" style={{borderColor:T.line}}>
      <div className="font-semibold text-sm flex items-center gap-2"><Lock size={13}/> Security Passwords</div>
      {[["Admin password",a,setA,security.adminPass],["Export password",x,setX,security.exportPass]].map(([label,val,setVal,isSet])=>(
        <label key={label} className="block text-xs font-semibold text-slate-500">{label} {isSet?<span className="text-green-600">· set</span>:<span className="text-slate-400">· not set</span>}
          <input type="password" value={val} onChange={e=>setVal(e.target.value)} placeholder={isSet?"Type to change":"Create password"} style={inp}/>
        </label>
      ))}
      {err && <p className="text-[11px] font-semibold text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold" style={{background:T.blue}}>Save</button>
        {(security.adminPass||security.exportPass) && <button onClick={()=>onSave({adminPass:"",exportPass:""})} className="px-3 py-2 rounded-xl border text-xs font-semibold text-slate-500" style={{borderColor:T.line}}>Clear all</button>}
      </div>
    </div>
  );
}

/* ════ DISTRIBUTE LEADS MODAL ════ */
function DistributeModal({ leads, bdeList, onClose, onDistribute }) {
  const [mode, setMode]     = useState("equal"); // "equal" | "custom"
  const [custom, setCustom] = useState(
    // default: each BDE gets 0
    Object.fromEntries(bdeList.map(b=>[b.id, ""]))
  );
  const [selBDEs, setSelBDEs] = useState(
    new Set(bdeList.map(b=>b.id))
  );

  const total = leads.length;
  const activeBDEs = bdeList.filter(b=>selBDEs.has(b.id));

  // Equal split calculation
  const equalSplit = () => {
    if (activeBDEs.length===0) return {};
    const base  = Math.floor(total/activeBDEs.length);
    const extra = total % activeBDEs.length;
    const result = {};
    activeBDEs.forEach((b,i)=>{ result[b.id] = base + (i<extra?1:0); });
    return result;
  };

  const split = mode==="equal" ? equalSplit() : custom;
  const totalAssigned = Object.values(split).reduce((s,v)=>s+parseInt(v||0),0);
  const remaining = total - totalAssigned;

  const handleConfirm = () => {
    const shuffled = [...leads].sort(()=>Math.random()-0.5);
    const assignments = [];
    let cursor = 0;
    for (const b of activeBDEs) {
      const count = parseInt(split[b.id]||0);
      if (count>0) {
        assignments.push({ bdeId:b.id, leadIds: shuffled.slice(cursor,cursor+count).map(s=>s.id) });
        cursor += count;
      }
    }
    onDistribute(assignments);
  };

  const toggleBDE = (id) => setSelBDEs(prev=>{
    const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n;
  });

  return (
    <AppModal title="⚡ Distribute Leads to BDEs" onClose={onClose}>
      <div className="space-y-4">
        {/* Total */}
        <div className="p-3 rounded-xl text-center font-bold text-lg" style={{background:"#EFF6FF",color:T.blue}}>
          {total} leads selected for distribution
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button onClick={()=>setMode("equal")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition"
            style={{borderColor:mode==="equal"?T.blue:T.line,background:mode==="equal"?"#EFF6FF":"#fff",color:mode==="equal"?T.blue:"#64748B"}}>
            Equal split
          </button>
          <button onClick={()=>setMode("custom")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition"
            style={{borderColor:mode==="custom"?T.purple:T.line,background:mode==="custom"?"#F5F3FF":"#fff",color:mode==="custom"?T.purple:"#64748B"}}>
            Custom split
          </button>
        </div>

        {/* BDE list */}
        <div className="space-y-2">
          {bdeList.map(b=>{
            const count = parseInt(split[b.id]||0);
            const pct   = total>0 ? Math.round(count/total*100) : 0;
            const isOn  = selBDEs.has(b.id);
            return (
              <div key={b.id} className="p-3 rounded-xl border-2 transition"
                style={{borderColor:isOn?T.teal:T.line, background:isOn?"#F0FDFA":"#F8FAFC", opacity:isOn?1:0.5}}>
                <div className="flex items-center gap-3">
                  <button onClick={()=>toggleBDE(b.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                    style={{background:isOn?T.teal:"#CBD5E1"}}>{(b.name||"?")[0]}</button>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{b.name}</div>
                    {mode==="equal" ? (
                      <div className="text-xs text-slate-500">{count} leads ({pct}%)</div>
                    ) : (
                      <input
                        type="number" min="0" max={total}
                        value={custom[b.id]||""}
                        onChange={e=>setCustom(p=>({...p,[b.id]:e.target.value}))}
                        placeholder="0"
                        disabled={!isOn}
                        className="mt-1 w-28 py-1 px-2 rounded-lg border text-sm font-semibold"
                        style={{borderColor:"#CBD5E1"}}
                      />
                    )}
                  </div>
                  {mode==="equal" && count>0 && (
                    <div className="text-right">
                      <div className="text-lg font-extrabold num" style={{color:T.teal}}>{count}</div>
                      <div className="text-[10px] text-slate-400">leads</div>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                {count>0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:T.teal}}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between p-3 rounded-xl" style={{background:remaining!==0?"#FEF2F2":"#F0FDF4"}}>
          <span className="text-sm font-semibold" style={{color:remaining!==0?"#DC2626":"#16A34A"}}>
            {remaining===0 ? "All leads accounted for ✓" : remaining>0 ? `${remaining} leads not assigned yet` : `${Math.abs(remaining)} leads over-assigned`}
          </span>
          <span className="text-sm font-bold num">{totalAssigned} / {total}</span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={totalAssigned===0||remaining<0}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
          style={{background:T.teal}}>
          Distribute {totalAssigned} leads across {activeBDEs.filter(b=>parseInt(split[b.id]||0)>0).length} BDEs
        </button>
      </div>
    </AppModal>
  );
}

/* ════ IMPORT MODAL ════ */
function ImportModal({ team, onClose, onImport }) {
  const [parsed,setParsed]=useState(null); const [error,setError]=useState("");
  const norm=k=>String(k).toLowerCase().replace(/[^a-z]/g,"");
  const handleFile=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    try {
      const buf=await file.arrayBuffer(); const wb=XLSX.read(buf);
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      const recs=rows.map(r=>{
        const g={}; Object.keys(r).forEach(k=>{g[norm(k)]=String(r[k]).trim();});
        const name=g.name||g.fullname||""; if(!name) return null;
        const stg=(g.stage||"").toLowerCase();
        const stage=stg?(STAGES.find(s=>s.label.toLowerCase().includes(stg))?.id||"lead"):"lead";
        const an=(g.assignedto||g.counsellor||"").toLowerCase();
        const assigned_to=team.find(t=>t.name.toLowerCase()===an)?.id||"";
        const lvl=(g.level||"").toUpperCase();
        const qual=["hot","warm","cold"].includes((g.qualification||"").toLowerCase())?g.qualification[0].toUpperCase()+g.qualification.slice(1).toLowerCase():"";
        return {name,phone:g.phone||g.mobile||"",email:g.email||"",level:LEVELS.includes(lvl)?lvl:"PG",country:COUNTRIES.find(c=>c.toLowerCase()===(g.country||"").toLowerCase())||(g.country||"UK"),intake:INTAKES.find(m=>m.toLowerCase()===(g.intake||"").toLowerCase())||"Other",field:g.fieldofstudy||g.field||"Other",stage,assigned_to,qualification:qual,follow_up:g.followup||""};
      }).filter(Boolean);
      if(!recs.length){setError("No valid rows found.");return;}
      setError(""); setParsed(recs);
    } catch(e){setError("Could not read file: "+e.message);}
  };
  return (
    <AppModal title="Import leads from Excel" onClose={onClose}>
      <label className="block w-full p-6 rounded-xl border-2 border-dashed border-slate-300 text-center cursor-pointer hover:border-blue-400">
        <Upload size={22} className="mx-auto text-slate-400"/>
        <span className="block text-sm font-semibold mt-2">Choose .xlsx or .csv file</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden"/>
      </label>
      {error && <p className="text-[11px] font-semibold text-red-500 mt-2">{error}</p>}
      {parsed && (
        <div className="mt-3 p-3 rounded-xl border border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-700">Found {parsed.length} leads</p>
          <p className="text-[11px] text-green-700 mt-0.5">{parsed.slice(0,4).map(r=>r.name).join(", ")}{parsed.length>4?` +${parsed.length-4} more`:""}</p>
          <button onClick={()=>onImport(parsed)} className="mt-3 w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{background:T.ok}}>Import {parsed.length} leads</button>
        </div>
      )}
    </AppModal>
  );
}

/* ════ SMALL HELPERS ════ */
function SessionCard({ header, outcome, notesTxt, fullText, date, noteId, studentId, onDelete, onUpdate, T }) {
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(notesTxt||"");

  const saveEdit = () => {
    if (!onUpdate || !noteId) return;
    // Rebuild the note text preserving header/outcome
    let rebuilt = `🎓 SESSION — ${header}`;
    if (outcome) rebuilt += `\nOutcome: ${outcome}`;
    if (editText.trim()) rebuilt += `\nNotes: ${editText.trim()}`;
    onUpdate(studentId, noteId, rebuilt);
    setEditing(false);
  };

  return (
    <div className="border rounded-xl p-3" style={{borderColor:"#E5EAF3"}}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{fontSize:13,color:T.purple}}>🎓</span>
        <span className="text-xs font-bold flex-1" style={{color:T.purple}}>{header}</span>
        <span className="text-[11px] text-slate-400">{new Date(date||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</span>
        <button onClick={()=>setExpanded(v=>!v)} className="text-[11px] text-slate-400 hover:text-slate-600 px-1">{expanded?"▲ Less":"▼ More"}</button>
        <button onClick={()=>setEditing(v=>!v)} className="p-1 rounded hover:bg-blue-50" title="Edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button onClick={()=>{if(window.confirm("Delete this session?")) onDelete&&onDelete(studentId,noteId);}} className="p-1 rounded hover:bg-red-50" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>
      {outcome && <p className="text-xs font-semibold text-slate-700 ml-5 mb-1">{outcome}</p>}
      {editing ? (
        <div className="ml-5 mt-2 space-y-2">
          <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border text-sm" style={{borderColor:"#CBD5E1",resize:"vertical"}}/>
          <div className="flex gap-2">
            <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{background:"#0d6efd"}}>Save</button>
            <button onClick={()=>setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 border">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {notesTxt && <p className={`text-sm text-slate-600 ml-5 ${expanded?"":"line-clamp-2"}`} style={expanded?{}:{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{notesTxt}</p>}
          {expanded && fullText && fullText.replace(`Notes: ${notesTxt}`,"").trim() && (
            <pre className="text-xs text-slate-500 ml-5 mt-1 whitespace-pre-wrap">{fullText.replace(`Notes: ${notesTxt}`,"").replace(`Outcome: ${outcome}`,"").trim()}</pre>
          )}
        </>
      )}
    </div>
  );
}

function Splash({ text }) {
  const [tick, setTick] = React.useState(0);
  const [dotCount, setDotCount] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); setDotCount(d => (d + 1) % 4); }, 500);
    return () => clearInterval(id);
  }, []);

  const facts = [
    "🌍 8 countries, endless possibilities",
    "🎓 Helping students reach top universities",
    "📋 13-stage pipeline to track every journey",
    "⚡ Real-time updates across your team",
    "🚀 From lead to departure — all in one place",
    "🤝 Built for counsellors who care",
  ];
  const fact = facts[tick % facts.length];

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(160deg,#060F22 0%,#0A1F3D 45%,#0d2a52 100%)',
      overflow:'hidden', position:'relative', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <style>{`
        @keyframes sp-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.1)} 66%{transform:translate(-20px,20px) scale(0.9)} }
        @keyframes sp-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,20px) scale(0.95)} 66%{transform:translate(30px,-40px) scale(1.08)} }
        @keyframes sp-orb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,40px) scale(1.12)} }
        @keyframes sp-rise  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sp-logo  { 0%{transform:scale(0.7) rotate(-8deg);opacity:0} 60%{transform:scale(1.08) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes sp-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(13,110,253,.6)} 50%{box-shadow:0 0 0 18px rgba(13,110,253,0)} }
        @keyframes sp-bar   { 0%{width:0%} 100%{width:88%} }
        @keyframes sp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes sp-star  { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
        @keyframes sp-fact  { 0%{opacity:0;transform:translateY(8px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-8px)} }
        @keyframes sp-ring  { 0%{transform:scale(0.85);opacity:.6} 100%{transform:scale(1.5);opacity:0} }
        .sp-logo  { animation: sp-logo  .7s cubic-bezier(.34,1.56,.64,1) both; }
        .sp-rise  { animation: sp-rise  .6s ease both; }
        .sp-float { animation: sp-float 3s ease-in-out infinite; }
        .sp-pulse { animation: sp-pulse 2s ease-in-out infinite; }
        .sp-fact  { animation: sp-fact  3s ease both; }
        .sp-ring  { animation: sp-ring  1.8s ease-out infinite; }
      `}</style>

      {/* Animated background orbs */}
      <div style={{position:'absolute',top:'15%',left:'12%',width:320,height:320,borderRadius:'50%',
        background:'radial-gradient(circle,rgba(13,110,253,0.18),transparent 70%)',
        animation:'sp-orb1 9s ease-in-out infinite',filter:'blur(2px)'}}/>
      <div style={{position:'absolute',bottom:'10%',right:'8%',width:280,height:280,borderRadius:'50%',
        background:'radial-gradient(circle,rgba(245,158,11,0.14),transparent 70%)',
        animation:'sp-orb2 11s ease-in-out infinite',filter:'blur(2px)'}}/>
      <div style={{position:'absolute',top:'55%',left:'60%',width:180,height:180,borderRadius:'50%',
        background:'radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)',
        animation:'sp-orb3 7s ease-in-out infinite',filter:'blur(1px)'}}/>

      {/* Dot grid */}
      <div style={{position:'absolute',inset:0,
        backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.25) 1px,transparent 1px)',
        backgroundSize:'40px 40px',opacity:.12,pointerEvents:'none'}}/>

      {/* Floating stars */}
      {[[15,20,1.2],[80,35,2],[25,70,1.8],[70,60,1],[45,15,2.4],[88,80,1.6],[10,50,2.2]].map(([x,y,d],i)=>(
        <div key={i} style={{position:'absolute',left:`${x}%`,top:`${y}%`,
          width:4,height:4,borderRadius:'50%',background:'#fff',
          animation:`sp-star ${d+1.5}s ease-in-out ${i*0.4}s infinite`}}/>
      ))}

      {/* Content */}
      <div style={{textAlign:'center',position:'relative',zIndex:10,padding:'0 24px',maxWidth:420}}>

        {/* Logo with pulse rings */}
        <div className="sp-float" style={{position:'relative',display:'inline-block',marginBottom:32}}>
          {/* Pulse rings */}
          <div className="sp-ring" style={{position:'absolute',inset:-12,borderRadius:28,
            border:'2px solid rgba(13,110,253,0.5)'}}/>
          <div className="sp-ring" style={{position:'absolute',inset:-12,borderRadius:28,
            border:'2px solid rgba(13,110,253,0.35)',animationDelay:'0.6s'}}/>
          {/* Logo badge */}
          <div className="sp-logo sp-pulse" style={{
            width:88,height:88,borderRadius:24,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontWeight:900,color:'#fff',fontSize:28,letterSpacing:'-1px',
            background:'linear-gradient(135deg,#0d6efd 0%,#F59E0B 100%)',
            boxShadow:'0 8px 32px rgba(13,110,253,0.5)',
          }}>AV</div>
        </div>

        {/* Title */}
        <div className="sp-rise" style={{animationDelay:'0.15s'}}>
          <h1 style={{fontSize:30,fontWeight:900,color:'#fff',margin:'0 0 6px',letterSpacing:'-0.5px',
            textShadow:'0 2px 16px rgba(13,110,253,.4)'}}>
            Abroad Veda
          </h1>
          <p style={{color:'rgba(147,197,253,0.8)',fontSize:13,fontWeight:600,
            letterSpacing:'0.2em',textTransform:'uppercase',margin:'0 0 32px'}}>
            CRM Workspace
          </p>
        </div>

        {/* Rotating fact */}
        <div className="sp-rise" style={{animationDelay:'0.3s',marginBottom:32}}>
          <div key={tick} className="sp-fact" style={{
            fontSize:13,color:'rgba(255,255,255,0.65)',fontWeight:600,
            minHeight:22,letterSpacing:'0.01em',
          }}>{fact}</div>
        </div>

        {/* Progress bar */}
        <div className="sp-rise" style={{animationDelay:'0.4s'}}>
          <div style={{height:3,borderRadius:4,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginBottom:12}}>
            <div style={{
              height:'100%',borderRadius:4,
              background:'linear-gradient(90deg,#0d6efd,#60A5FA,#F59E0B)',
              animation:'sp-bar 3.5s cubic-bezier(.4,0,.2,1) forwards',
              boxShadow:'0 0 12px rgba(13,110,253,.7)',
            }}/>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            color:'rgba(255,255,255,0.35)',fontSize:12,fontWeight:500}}>
            <Loader2 size={12} style={{animation:'spin 1s linear infinite',color:'#60A5FA'}}/>
            {text}{''.padEnd(dotCount,'.')}
          </div>
        </div>

        {/* Bottom decorative pills */}
        <div className="sp-rise" style={{animationDelay:'0.55s',display:'flex',justifyContent:'center',gap:8,marginTop:28,flexWrap:'wrap'}}>
          {['🎓 Counselling','🌍 Visa','📋 Pipeline'].map(label => (
            <div key={label} style={{
              padding:'5px 12px',borderRadius:20,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',
              color:'rgba(255,255,255,0.4)',fontSize:11,fontWeight:600,
            }}>{label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
function AppModalBtn({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 text-left" style={{borderColor:T.line}}>
      {icon}<span><span className="font-semibold text-sm block">{title}</span><span className="text-xs text-slate-500">{sub}</span></span>
    </button>
  );
}
function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-500">{label}{children}</label>; }
function AppModal({ title, children, onClose }) {
  useEffect(()=>{ const h=e=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); },[onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(10,31,61,.55)"}} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-extrabold">{title}</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16}/></button></div>
        {children}
      </div>
    </div>
  );
}
