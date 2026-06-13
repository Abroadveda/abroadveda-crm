import { supabase } from './supabase'

export async function getStudents() {
  const { data, error } = await supabase
    .from('students')
    .select(`*, notes(id,text,created_at), applications(id,course,institution,commence_date,status), documents(id,name,status)`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function createStudent(student) {
  const { data, error } = await supabase.from('students').insert([student]).select().single()
  if (error) throw error; return data
}
export async function updateStudent(id, patch) {
  const { data, error } = await supabase.from('students').update(patch).eq('id', id).select().single()
  if (error) throw error; return data
}
export async function deleteStudent(id) {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}
export async function addNote(studentId, text) {
  const { data, error } = await supabase.from('notes').insert([{ student_id: studentId, text }]).select().single()
  if (error) throw error; return data
}
export async function upsertApplication(app) {
  const { data, error } = await supabase.from('applications').upsert([app]).select().single()
  if (error) throw error; return data
}
export async function deleteApplication(id) {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) throw error
}
export async function upsertDocument(doc) {
  const { data, error } = await supabase.from('documents').upsert([doc]).select().single()
  if (error) throw error; return data
}
export async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}
export async function getTeam() {
  const { data, error } = await supabase.from('team_members').select('*').order('name')
  if (error) throw error; return data
}
export async function createTeamMember(member) {
  const { data, error } = await supabase.from('team_members').insert([member]).select().single()
  if (error) throw error; return data
}
export async function deleteTeamMember(id) {
  const { error } = await supabase.from('team_members').delete().eq('id', id)
  if (error) throw error
}
export async function bulkInsertStudents(students) {
  const { data, error } = await supabase.from('students').insert(students).select()
  if (error) throw error; return data
}
export async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}
export async function setSetting(key, value) {
  const { error } = await supabase.from('settings').upsert([{ key, value }])
  if (error) throw error
}
