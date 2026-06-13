import { supabase } from './supabase'

/* ── STUDENTS ── */
export async function getStudents() {
  // Supabase default limit is 1000 rows — fetch all pages
  const PAGE = 1000
  let allData = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('students')
      .select(`*, notes(id,text,created_at), applications(id,course,institution,commence_date,status), documents(id,name,status)`)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length < PAGE) break   // last page
    from += PAGE
  }
  return allData
}
export async function createStudent(s) {
  const allowed = ['name','phone','email','level','country','intake','field','stage','qualification','assigned_to','bde_id','follow_up','gender','dob','nationality','city','consent_tc','consent_mkt','hear_source','fin_source']
  const clean = {}
  for (const k of allowed) if (s[k] !== undefined && s[k] !== '') clean[k] = s[k]
  const { data, error } = await supabase.from('students').insert([clean]).select().single()
  if (error) throw error
  return data
}
export async function updateStudent(id, patch) {
  const { data, error } = await supabase.from('students').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteStudent(id) {
  // Delete related records first to avoid FK constraint errors
  await supabase.from('notes').delete().eq('student_id', id)
  await supabase.from('applications').delete().eq('student_id', id)
  await supabase.from('documents').delete().eq('student_id', id)
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}
export async function bulkDeleteStudents(ids) {
  if (!ids || ids.length === 0) return
  // Delete in batches of 50 to avoid URL length limits
  const batches = []
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50))
  for (const batch of batches) {
    // Delete related records first
    await supabase.from('notes').delete().in('student_id', batch)
    await supabase.from('applications').delete().in('student_id', batch)
    await supabase.from('documents').delete().in('student_id', batch)
    const { error } = await supabase.from('students').delete().in('id', batch)
    if (error) throw error
  }
}

/* ── NOTES ── */
export async function addNote(studentId, text) {
  const { data, error } = await supabase.from('notes').insert([{ student_id: studentId, text }]).select().single()
  if (error) throw error
  return data
}

/* ── APPLICATIONS ── */
export async function upsertApplication(app) {
  const { data, error } = await supabase.from('applications').upsert([app]).select().single()
  if (error) throw error
  return data
}
export async function deleteApplication(id) {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) throw error
}

/* ── DOCUMENTS ── */
export async function upsertDocument(doc) {
  const { data, error } = await supabase.from('documents').upsert([doc]).select().single()
  if (error) throw error
  return data
}
export async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

/* ── TEAM ── */
export async function getTeam() {
  const { data, error } = await supabase.from('team_members').select('*').order('name')
  if (error) throw error
  return data || []
}
export async function createTeamMember(m) {
  const { data, error } = await supabase.from('team_members').insert([m]).select().single()
  if (error) throw error
  return data
}
export async function updateTeamMember(id, patch) {
  const { data, error } = await supabase.from('team_members').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteTeamMember(id) {
  const { error } = await supabase.from('team_members').delete().eq('id', id)
  if (error) throw error
}

/* ── SLOTS ── */
export async function getSlots() {
  const { data, error } = await supabase.from('counselling_slots').select('*').order('slot_date').order('slot_time')
  if (error) return []
  return data || []
}
export async function createSlot(slot) {
  const { data, error } = await supabase.from('counselling_slots').insert([slot]).select().single()
  if (error) throw error
  return data
}
export async function bookSlot(slotId, studentId) {
  const { data, error } = await supabase.from('counselling_slots').update({ booked_by: studentId, status: 'booked' }).eq('id', slotId).select().single()
  if (error) throw error
  return data
}
export async function freeSlot(slotId) {
  const { data, error } = await supabase.from('counselling_slots').update({ booked_by: null, status: 'available' }).eq('id', slotId).select().single()
  if (error) throw error
  return data
}
export async function deleteSlot(slotId) {
  const { error } = await supabase.from('counselling_slots').delete().eq('id', slotId)
  if (error) throw error
}

/* ── BULK ── */
export async function bulkInsertStudents(rows) {
  const allowed = ['name','phone','email','level','country','intake','field','stage','qualification','assigned_to','bde_id','follow_up']
  const clean = rows.map((r) => { const o={}; for(const k of allowed) if(r[k]!==undefined&&r[k]!=='') o[k]=r[k]; return o; })
  // Insert in batches of 500 to avoid Supabase payload limits
  const BATCH = 500
  let allData = []
  for (let i = 0; i < clean.length; i += BATCH) {
    const batch = clean.slice(i, i + BATCH)
    const { data, error } = await supabase.from('students').insert(batch).select()
    if (error) throw error
    if (data) allData = allData.concat(data)
  }
  return allData
}

/* ── SETTINGS ── */
export async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}
export async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert([{ key, value }])
  if (error) throw error
}

/* ── DB HEALTH ── */
export async function checkDbHealth() {
  try {
    const start = Date.now()
    const { data, error } = await supabase.from('students').select('id', { count: 'exact', head: true })
    if (error) return { ok: false, ms: null }
    return { ok: true, ms: Date.now() - start }
  } catch { return { ok: false, ms: null } }
}
