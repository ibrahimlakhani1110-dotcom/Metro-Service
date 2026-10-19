import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const TYPES = [['car','Car'],['motorcycle','Motorcycle'],['truck','Truck / pickup'],['generator','Generator'],['tractor','Tractor'],['other','Other']]
const STATUS = { healthy: 'Healthy', due_soon: 'Due soon', overdue: 'Overdue' }

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="center">Loading…</div>
  return session ? <Garage session={session} /> : <Auth />
}

function Auth() {
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const { data, error } = mode === 'up'
      ? await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (mode === 'up' && !data.session) setMsg('Account created. Confirm your email, then sign in.')
  }

  return (
    <main className="auth">
      <h1 className="brand">Metro Service</h1>
      <p className="tag">Never lose track of a machine's maintenance, paperwork, or cost again.</p>
      <form onSubmit={submit}>
        {mode === 'up' && <label>Your name<input value={f.name} onChange={set('name')} required /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>
        {msg && <p className="msg" role="alert">{msg}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setMsg('') }}>
        {mode === 'up' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </main>
  )
}

function Garage({ session }) {
  const [machines, setMachines] = useState(null)
  const [status, setStatus] = useState({})
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([
      supabase.from('machines').select('*').is('archived_at', null).order('created_at', { ascending: false }),
      supabase.from('machine_status').select('*'),
    ])
    if (m.error) return setErr('Could not load your garage. Check your connection and try again.')
    setErr(''); setMachines(m.data)
    setStatus(Object.fromEntries((s.data || []).map((r) => [r.machine_id, r.status])))
  }, [])

  useEffect(() => {
    load()
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) supabase.from('profiles').update({ timezone: tz }).eq('id', session.user.id).eq('timezone', 'UTC')
  }, [load, session.user.id])

  return (
    <>
      <header className="bar">
        <span className="brand sm">Metro Service</span>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <main className="wrap">
        <div className="row">
          <h2>My Garage</h2>
          <button className="primary" onClick={() => setAdding(true)}>Add machine</button>
        </div>
        {err && <p className="msg" role="alert">{err} <button className="link" onClick={load}>Retry</button></p>}
        {machines === null && !err && <p className="muted">Loading your machines…</p>}
        {machines && machines.length === 0 && (
          <div className="empty">
            <h3>No machines yet</h3>
            <p>Add your first machine to start tracking its service history, reminders and paperwork.</p>
          </div>
        )}
        <ul className="list">
          {(machines || []).map((m) => {
            const st = status[m.id] || 'healthy'
            return (
              <li key={m.id} className={'card ' + st}>
                <div>
                  <strong>{m.name}</strong>
                  <div className="muted">{[m.year, m.make, m.model].filter(Boolean).join(' ') || TYPES.find((t) => t[0] === m.type)?.[1]}</div>
                  <div className="muted">{Number(m.meter_value).toLocaleString()} {m.meter_unit === 'hours' ? 'hrs' : m.meter_unit}</div>
                </div>
                <span className={'badge ' + st}>{STATUS[st]}</span>
              </li>
            )
          })}
        </ul>
      </main>
      {adding && <AddMachine uid={session.user.id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </>
  )
}

function AddMachine({ uid, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', type: 'car', make: '', model: '', year: '', registration_number: '', meter_value: '0', meter_unit: 'km', fuel_type: '', notes: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pickType = (e) => setF({ ...f, type: e.target.value, meter_unit: ['generator', 'tractor'].includes(e.target.value) ? 'hours' : f.meter_unit === 'hours' ? 'km' : f.meter_unit })

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const row = { ...f, user_id: uid, year: f.year ? Number(f.year) : null, meter_value: Number(f.meter_value) || 0 }
    Object.keys(row).forEach((k) => row[k] === '' && (row[k] = null))
    const { error } = await supabase.from('machines').insert(row)
    setBusy(false)
    if (error) return setMsg('Could not save the machine. ' + error.message)
    onSaved()
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true">
      <form className="panel" onSubmit={save}>
        <h2>Add machine</h2>
        <label>Name<input value={f.name} onChange={set('name')} placeholder="e.g. Family Corolla" required /></label>
        <label>Type<select value={f.type} onChange={pickType}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <div className="two"><label>Make<input value={f.make} onChange={set('make')} /></label><label>Model<input value={f.model} onChange={set('model')} /></label></div>
        <div className="two"><label>Year<input type="number" value={f.year} onChange={set('year')} min="1900" max="2100" /></label><label>Registration / serial<input value={f.registration_number} onChange={set('registration_number')} /></label></div>
        <div className="two">
          <label>Current reading<input type="number" min="0" step="any" value={f.meter_value} onChange={set('meter_value')} /></label>
          <label>Unit<select value={f.meter_unit} onChange={set('meter_unit')}><option value="km">Kilometres</option><option value="mi">Miles</option><option value="hours">Engine hours</option></select></label>
        </div>
        <label>Fuel type<input value={f.fuel_type} onChange={set('fuel_type')} placeholder="Petrol, diesel, electric…" /></label>
        <label>Notes<textarea rows="2" value={f.notes} onChange={set('notes')} /></label>
        {msg && <p className="msg" role="alert">{msg}</p>}
        <div className="row"><button type="button" className="ghost dark" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save machine'}</button></div>
      </form>
    </div>
  )
}
