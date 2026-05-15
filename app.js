// ===== SUPABASE ERROR SUPPRESSOR =====
// Suppress Supabase BroadcastChannel errors
(function(){try{if(typeof BroadcastChannel==='undefined')return;const O=BroadcastChannel;function S(n){const b=new O(n);b.postMessage=function(m){try{O.prototype.postMessage.call(b,JSON.parse(JSON.stringify(m)));}catch(e){}};return b;}S.prototype=O.prototype;window.BroadcastChannel=S;}catch(e){}})();
(function(){const w=console.warn.bind(console);console.warn=function(...a){const s=a.join(' ');if(s.includes('BroadcastChannel')||s.includes('DataCloneError')||s.includes('postMessage'))return;w(...a);};const e=console.error.bind(console);console.error=function(...a){const s=a.join(' ');if(s.includes('DataCloneError')||s.includes('postMessage')&&s.includes('Headers'))return;e(...a);};})();

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION A: CONSTANTS & CONFIGURATION               ║
// ╚══════════════════════════════════════════════════════╝
const SUPER_ADMIN_PW = null; // ย้ายไป Supabase แล้ว  //
const ADMIN_PW = 'teacher123';  // เหลือไว้ compatibility (ไม่ใช้แล้ว)

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION B: SUPABASE + LOCAL STORAGE LAYER          ║
// ╚══════════════════════════════════════════════════════╝
// ============================================================
//  SUPABASE + LOCAL FALLBACK LAYER
// ============================================================
let SB = null;          // Supabase client
let USE_SUPABASE = false;
let realtimeChannel = null;
let CURRENT_TEACHER = null;  // { id, display_name } or null if superadmin

// LocalStorage helpers (fallback)
function lsGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

// ---- ค่า Supabase ที่ฝังไว้ในไฟล์ ----
const FIXED_SB_URL = 'https://yfglsapfxtredrypqjda.supabase.co';
const FIXED_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZ2xzYXBmeHRyZWRyeXBxamRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODE1NDcsImV4cCI6MjA5MzQ1NzU0N30.OJaG2eZwznl17EtObNAKfqQ2h712UmMLZIWw9jJJNzo';

  // ---- ชำระเงิน ----
  async function savePaymentInfo(){
  const info = {
    bank: document.getElementById('pay-bank').value.trim(),
    account: document.getElementById('pay-account').value.trim(),
    name: document.getElementById('pay-name').value.trim(),
    amount: document.getElementById('pay-amount').value.trim()
  };
  await SB.from('settings').upsert({key:'payment_info',value:info},{onConflict:'key'});
  toast2('บันทึกข้อมูลการชำระเงินแล้ว ✅');
}

async function loadPaymentSettings(){
  if(!USE_SUPABASE||!SB) return;
  const {data} = await SB.from('settings').select('value').eq('key','payment_info').maybeSingle();
  if(data&&data.value){
    const p = data.value;
    if(p.bank) document.getElementById('pay-bank').value=p.bank;
    if(p.account) document.getElementById('pay-account').value=p.account;
    if(p.name) document.getElementById('pay-name').value=p.name;
    if(p.amount) document.getElementById('pay-amount').value=p.amount;
  }
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION C: PLAN & SUBSCRIPTION MANAGEMENT          ║
// ╚══════════════════════════════════════════════════════╝
// ===== PLAN MANAGEMENT =====
let _cachedPlans = null;

async function loadPlansSettings() {
  if(!USE_SUPABASE||!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','plans').maybeSingle();
    _cachedPlans = (data&&data.value&&data.value.length) ? data.value : [
      {name:'รายเดือน', days:30, price:'199'},
      {name:'รายปี', days:365, price:'1,490'},
      {name:'2 ปี', days:730, price:'2,490'},
    ];
    renderPlansList();
    loadPricingToRegister();
  } catch(e) {}
}

function renderPlansList() {
  const el = document.getElementById('plans-list');
  if(!el || !_cachedPlans) return;
  if(!_cachedPlans.length) { el.innerHTML='<div style="font-size:13px;color:var(--text3);text-align:center;padding:8px;">ยังไม่มีแผน</div>'; return; }
  el.innerHTML = _cachedPlans.map((p,i) => `
    <div style="background:#fff;border-radius:12px;border:1.5px solid var(--border);padding:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--text);flex:1;">${p.name}</span>
        <span style="font-size:13px;font-weight:800;color:var(--green-dark);">฿${p.price}</span>
        <span style="font-size:12px;color:var(--text2);">${p.days} วัน</span>
        <button onclick="deletePlan(${i})" style="padding:4px 8px;font-size:11px;border-radius:6px;border:1.5px solid var(--red-light);background:var(--red-light);color:var(--red);cursor:pointer;font-family:Sarabun,sans-serif;">ลบ</button>
      </div>
      <div style="display:flex;gap:6px;">
        <input type="text" value="${p.name}" placeholder="ชื่อแผน"
          style="flex:2;font-size:12px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--border);font-family:Sarabun,sans-serif;"
          onchange="_cachedPlans[${i}].name=this.value">
        <input type="number" value="${p.days}" placeholder="วัน" min="1"
          style="flex:1;font-size:12px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--border);text-align:center;font-family:Sarabun,sans-serif;"
          onchange="_cachedPlans[${i}].days=parseInt(this.value)||30">
        <input type="text" value="${p.price}" placeholder="ราคา"
          style="flex:1;font-size:12px;padding:6px 8px;border-radius:8px;border:1.5px solid var(--border);text-align:center;font-family:Sarabun,sans-serif;"
          onchange="_cachedPlans[${i}].price=this.value">
        <button onclick="savePlans()" style="padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-dark));color:#fff;cursor:pointer;white-space:nowrap;font-family:Sarabun,sans-serif;">&#x1F4BE; บันทึก</button>
      </div>
    </div>`).join('');
}

async function addPlan() {
  const name = document.getElementById('plan-name-input').value.trim();
  const days = parseInt(document.getElementById('plan-days-input').value);
  const price = document.getElementById('plan-price-input').value.trim();
  if(!name||!days||!price) { toast2('กรอกให้ครบ','warn'); return; }
  if(!_cachedPlans) _cachedPlans = [];
  _cachedPlans.push({name, days, price});
  await savePlans();
  document.getElementById('plan-name-input').value='';
  document.getElementById('plan-days-input').value='';
  document.getElementById('plan-price-input').value='';
}

async function deletePlan(idx) {
  if(!confirm('ลบแผนนี้?')) return;
  _cachedPlans.splice(idx,1);
  await savePlans();
}

async function savePlans() {
  await SB.from('settings').upsert({key:'plans',value:_cachedPlans},{onConflict:'key'});
  renderPlansList();
  loadPricingToRegister();
  toast2('บันทึกแผนแล้ว ✅');
}

async function loadPricingToRegister() {
  // โหลด pricing ไปแสดงในหน้าสมัคร
  const el = document.getElementById('plan-price-display');
  const el2 = document.getElementById('plan-period-display');
  if(!el) return;
  let plans = _cachedPlans;
  if(!plans) {
    try {
      const {data} = await SB.from('settings').select('value').eq('key','plans').maybeSingle();
      plans = (data&&data.value&&data.value.length) ? data.value : [{name:'รายปี',days:365,price:'1,490'}];
    } catch(e) { plans = [{name:'รายปี',days:365,price:'1,490'}]; }
  }
  if(plans.length) {
    const cheapest = plans.reduce((a,b) => parseInt(a.price.replace(/,/g,'')) < parseInt(b.price.replace(/,/g,'')) ? a : b);
    el.textContent = '฿'+cheapest.price;
    el2.textContent = cheapest.name + ' ('+cheapest.days+' วัน)';
    const featEl = document.getElementById('reg-features-list');
    if(featEl && plans.length > 1) {
      featEl.innerHTML = plans.map(p=>`<span style="display:inline-block;background:#fff;border:1.5px solid var(--border);border-radius:8px;padding:3px 10px;font-size:12px;font-weight:700;color:var(--text);margin:2px;">฿${p.price} / ${p.name}</span>`).join('');
    }
  }
}

// ---- ตรวจว่าเคย setup ไว้แล้วหรือยัง ----
function checkSetupOnLoad() {
  // ลอง restore saved config ก่อน, ใช้ FIXED ถ้าไม่มี
  const saved = lsGet('sb_config');
  const url = (saved && saved.url) || FIXED_SB_URL;
  const key = (saved && saved.key) || FIXED_SB_KEY;
  document.getElementById('sb-url').value = url;
  document.getElementById('sb-key').value = key;
  connectSupabase(true); // auto-connect silently
}

// Auto restore session หลัง page reload (ถ้าครูเคย login อยู่)
async function tryRestoreSession(){
  if(!USE_SUPABASE||!SB) return false;
  try{
    let session = null;
    try {
      const {data, error} = await SB.auth.getSession();
      if(error || !data || !data.session) return false;
      session = data.session;
    } catch(lockErr) { return false; }
    const uid = session.user.id;
    const {data:teacher, error:tErr} = await SB.from('teachers').select('*').eq('id',uid).single();
    if(tErr || !teacher) { 
      // teacher table might not exist yet — don't sign out, just return false
      if(tErr && (tErr.code === '42P01' || (tErr.message||'').includes('does not exist'))) return false;
      await SB.auth.signOut(); 
      return false; 
    }
    if(teacher.status !== 'approved') { await SB.auth.signOut(); return false; }
    CURRENT_TEACHER={id:uid,display_name:teacher.display_name,email:teacher.email,
      username:teacher.username||'',first_name:teacher.first_name||'',last_name:teacher.last_name||'',
      plan:teacher.plan||'free',plan_expires_at:teacher.plan_expires_at||null};
    await loadFromSupabase();
    await loadGlobalBypassIds(); // โหลด bypass IDs ก่อน render เพื่อให้ isPremium() ถูกต้องทันที
    setTimeout(()=>setupRealtime(),500);
    document.getElementById('teacher-topbar-name').textContent=teacher.display_name;if(teacher.avatar_url) updateTopbarAvatar(teacher.avatar_url);
    document.getElementById('teacher-topbar-email').textContent=teacher.email||'';
    // เช็คและแจ้งเตือนอายุการใช้งาน
await checkAndNotifyExpiry(teacher);
    showScreen('s-admin');
    populateScanSelects();
    await checkAndDowngradePremium();
    checkLockedDataOnLoad();
    renderDashboard();
    await checkAndNotifyExpiry(teacher);
    return true;
  }catch(e){ 
    console.error('[tryRestoreSession]', e);
    return false; 
  }
}

async function connectSupabase(silent = false) {
  const url = document.getElementById('sb-url').value.trim();
  const key = document.getElementById('sb-key').value.trim();
  const errEl = document.getElementById('setup-err');
  const statusEl = document.getElementById('setup-status');
  const statusText = document.getElementById('setup-status-text');
  const btn = document.getElementById('setup-connect-btn');

  errEl.textContent = '';
  if(!url || !key) { errEl.textContent = 'กรุณากรอก URL และ Key ให้ครบ'; return; }
  if(!url.startsWith('https://')) { errEl.textContent = 'URL ต้องขึ้นต้นด้วย https://'; return; }

  statusEl.style.display = 'flex';
  statusEl.className = 'setup-status loading';
  statusText.textContent = 'กำลังเชื่อมต่อ...';
  btn.disabled = true;

  try {
    // สร้าง Supabase client
    SB = supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'sb-session'
      }
    });

    // ทดสอบ DB connectivity ด้วย REST API โดยตรง (ไม่ใช้ auth lock)
    const { error: dbErr } = await SB.from('teachers').select('id').limit(1);
    if(dbErr) {
      const code = dbErr.code || '';
      const msg = dbErr.message || '';
      // ยอมรับ: table ยังไม่มี หรือ permission denied (RLS) — แสดงว่า DB เชื่อมต่อได้
      const isOk = code === '42P01' || msg.includes('does not exist') || msg.includes('relation')
                || code === 'PGRST116' || code === '42501' || msg.includes('permission');
      if(!isOk) throw new Error(msg || 'Database error: ' + code);
    }

    // เชื่อมต่อสำเร็จ
    USE_SUPABASE = true;
    lsSet('sb_config', {url, key});
    statusEl.className = 'setup-status ok';
    statusText.textContent = '✅ เชื่อมต่อสำเร็จ!';

    const restored = await tryRestoreSession();
    if(!restored) setTimeout(() => setupRealtime(), 500);
    setTimeout(()=>loadTeacherListForStudent(), 200);
    setTimeout(()=>loadContactLinksForLogin(), 400);setTimeout(()=>checkMaintenanceMode(), 600);
    setTimeout(()=>checkAnnouncement(), 800);
    setTimeout(()=>loadFeatureFlags(), 900);
    // loadGlobalBypassIds จะถูกเรียกใน loginTeacher/tryRestoreSession/activateFreeTeacher แทน
    // เพื่อป้องกัน race condition ที่ bypass IDs โหลดทีหลัง render → กลายเป็น premium เมื่อคลิ้ก
    setTimeout(() => {
      document.getElementById('setup-overlay').style.display = 'none';
    }, silent ? 0 : 600);

  } catch(e) {
    const msg = e.message || String(e);
    // DataCloneError = BroadcastChannel issue but connection may still work
    if(e.name === 'DataCloneError' || msg.includes('postMessage') || msg.includes('DataCloneError')) {
      // Connection likely succeeded — ignore this non-critical error
      // DataCloneError suppressed — non-fatal, session works via localStorage
      USE_SUPABASE = true;
      lsSet('sb_config', {url, key});
      statusEl.className = 'setup-status ok';
      statusText.textContent = '✅ เชื่อมต่อสำเร็จ!';
      const restored = await tryRestoreSession();
      if(!restored) setTimeout(() => setupRealtime(), 500);
      setTimeout(()=>loadTeacherListForStudent(), 200);
      setTimeout(()=>loadContactLinksForLogin(), 400);setTimeout(()=>checkMaintenanceMode(), 600);
      setTimeout(()=>checkAnnouncement(), 800);
      setTimeout(() => { document.getElementById('setup-overlay').style.display = 'none'; }, silent ? 0 : 600);
      return;
    }
    SB = null;
    USE_SUPABASE = false;
    statusEl.className = 'setup-status err';
    statusText.textContent = '❌ เชื่อมต่อไม่ได้';
    let thMsg = msg;
    if(msg.includes('Invalid API key') || msg.includes('invalid_api_key') || msg.includes('401'))
      thMsg = '🔑 API Key ไม่ถูกต้อง — ตรวจสอบ anon key ใหม่';
    else if(msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch'))
      thMsg = '🌐 ไม่สามารถเชื่อมต่อได้ — ตรวจสอบ URL และอินเตอร์เน็ต';
    else if(msg.includes('404') || msg.includes('not found'))
      thMsg = '🔗 URL ไม่ถูกต้อง — ตรวจสอบ Project URL';
    else if(msg.includes('CORS'))
      thMsg = '⚠️ CORS error — ตรวจสอบ Site URL ใน Supabase Authentication';
    errEl.textContent = thMsg;
    console.error('[Supabase connect error]', msg);
    btn.disabled = false;
  }
}

function skipToAdminLogin(){
  // ปิด setup overlay แล้วเปิดหน้า login ปกติ
  document.getElementById('setup-overlay').style.display='none';
  showScreen('s-login');
  // scroll ลงไปที่ admin bar
  setTimeout(()=>{
    const btn=document.getElementById('admin-bar-btn');
    if(btn){btn.scrollIntoView({behavior:'smooth'});setTimeout(()=>toggleAdminBar(),300);}
  },400);
}

function useLocalMode() {
  USE_SUPABASE = false;
  loadDB();
  document.getElementById('setup-overlay').style.display = 'none';
  toast('โหมดออฟไลน์ (localStorage)', 'warn');
}

function copySQL() {
  const sql = document.getElementById('sql-block').textContent;
  navigator.clipboard.writeText(sql).then(() => {
    toast('คัดลอก SQL แล้ว ✅');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = sql;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('คัดลอก SQL แล้ว ✅');
  });
}

// ============================================================
//  DATA LAYER — อ่าน/เขียนผ่าน Supabase หรือ localStorage
// ============================================================
let DB = {
  rooms: [],
  subjects: [
    {name:'คณิตศาสตร์',total:100,hwCount:10},
    {name:'วิทยาศาสตร์',total:100,hwCount:10},
    {name:'ภาษาไทย',total:100,hwCount:10},
    {name:'ภาษาอังกฤษ',total:100,hwCount:10},
    {name:'สังคมศึกษา',total:100,hwCount:10}
  ],
  students: [],
  homeworks: [],
  submissions: {}
};

function loadDB(){const d=lsGet('hwdb5');if(d)DB=d;}
function saveDB(){if(!USE_SUPABASE)lsSet('hwdb5',DB);}

async function loadFromSupabase() {
  if(!SB) return;
  // filter by teacher_id if logged in as teacher
  const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : null;
  let stuQ = SB.from('students').select('*');
  let hwQ = SB.from('homeworks').select('*').order('num');
  let subQ = SB.from('submissions').select('*');
  if(tid) { stuQ=stuQ.eq('teacher_id',tid); hwQ=hwQ.eq('teacher_id',tid); subQ=subQ.eq('teacher_id',tid); }

  const [stuRes, hwRes, subRes, setRes] = await Promise.all([stuQ, hwQ, subQ, SB.from('settings').select('*')]);

  DB.students = (stuRes.data || []).map(r => ({id: r.id, name: r.name, room: r.room}));
  DB.rooms = [...new Set(DB.students.map(s => s.room))].sort();
  DB.homeworks = (hwRes.data || []).map(r => ({num: r.num, title: r.title, subject: r.subject||'', maxScore: r.max_score||100, deadline: r.deadline||'', fileUrl: r.file_url||'', fileName: r.file_name||''}));

  const subs = {};
  (subRes.data || []).forEach(r => {
    const key = r.student_id + '_' + r.hw_num;
    subs[key] = {
      sid: r.student_id, hwNum: r.hw_num, hwTitle: r.hw_title,
      room: r.room, score: r.score, maxScore: r.max_score||100,
      ts: r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : ''
    };
  });
  DB.submissions = subs;

  // settings: subjects, rooms (per teacher or global)
  const settingsKey = tid ? 'subjects_'+tid : 'subjects';
  const roomsKey = tid ? 'rooms_'+tid : 'rooms';
  const settingsMap = {};
  (setRes.data || []).forEach(r => { settingsMap[r.key] = r.value; });
  if(settingsMap[settingsKey]) {
    DB.subjects = settingsMap[settingsKey];
  } else if(settingsMap['subjects']) {
    DB.subjects = settingsMap['subjects'];
  }
  // migrate string array to object array
  if(DB.subjects.length > 0 && typeof DB.subjects[0] === 'string') {
    DB.subjects = DB.subjects.map(s => ({name:s,total:100,hwCount:10}));
  }
  if(settingsMap[roomsKey]) DB.rooms = settingsMap[roomsKey];
}

// ---- Realtime subscription ----
function setupRealtime() {
  if(!SB) return;
  if(realtimeChannel) { try{SB.removeChannel(realtimeChannel);}catch(e){} realtimeChannel=null; }
  // ถ้ายังไม่มี CURRENT_TEACHER → รอจนกว่าจะล็อกอิน setupRealtime จะถูกเรียกใหม่
  if(!CURRENT_TEACHER) return;
  const channelName = 'db-changes-'+CURRENT_TEACHER.id;
  realtimeChannel = SB.channel(channelName)
   .on('postgres_changes', {event:'*', schema:'public', table:'submissions'}, async () => {
  await reloadSubmissions();
  if(document.getElementById('s-admin')?.classList.contains('on')) {
    renderDashboard();
    renderStudentIfOpen();
  }
  if(document.getElementById('s-stu')?.classList.contains('on') && _currentStuId) {
    await refreshStudentView();
  }
})
    .on('postgres_changes', {event:'*', schema:'public', table:'students'}, async () => {
      await reloadStudents();
      if(document.getElementById('s-admin')?.classList.contains('on')) { renderDashboard(); if(document.getElementById('ap-manage')?.classList.contains('on')) renderManage(); }
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'homeworks'}, async () => {
      await reloadHomeworks();
      if(document.getElementById('s-admin')?.classList.contains('on')) renderDashboard();
    })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'teachers', filter:`id=eq.${CURRENT_TEACHER?.id || '00000000-0000-0000-0000-000000000000'}`}, async (payload) => {
      // super admin เปลี่ยน plan — อัปเดต CURRENT_TEACHER และ UI ทันที
      if(!CURRENT_TEACHER) return;
      // 🔒 guard: ตรวจว่า event นี้เป็นของ CURRENT_TEACHER จริง ๆ
      // ถ้า id ไม่มีหรือไม่ตรงกัน → return ทันที (ป้องกัน event ของครูคนอื่น)
      if(!payload.new?.id || payload.new.id !== CURRENT_TEACHER.id) return;
      const newRecord = payload.new;
      const oldPlan = CURRENT_TEACHER.plan;
      // อัพเดต plan — ถ้า field ไม่มีใน payload ให้ใช้ค่าเดิม
      CURRENT_TEACHER.plan = ('plan' in newRecord) ? (newRecord.plan || 'free') : CURRENT_TEACHER.plan;
      CURRENT_TEACHER.plan_expires_at = ('plan_expires_at' in newRecord) ? newRecord.plan_expires_at : CURRENT_TEACHER.plan_expires_at;
      renderPlanBanner();
      // แจ้งเตือนถ้า plan เปลี่ยน
      if(oldPlan !== CURRENT_TEACHER.plan) {
        if(CURRENT_TEACHER.plan === 'premium') {
          toast('🎉 อัปเกรดเป็น Premium แล้ว! ปลดล็อคทุกฟีเจอร์', 'ok');
        } else {
          toast('ℹ️ Plan เปลี่ยนเป็น Free', 'warn');
        }
      }
    })
    .subscribe();
  showRealtimeDot();
}

function showRealtimeDot() {
  const tb = document.getElementById('teacher-topbar-name');
  if(tb && !document.getElementById('rt-dot')) {
    const dot = document.createElement('span');
    dot.id = 'rt-dot';
    dot.title = 'Realtime เชื่อมต่ออยู่';
    dot.innerHTML = ' <span class="realtime-dot"></span>';
    tb.parentNode.insertBefore(dot, tb.nextSibling);
  }
}

async function reloadSubmissions() {
  if(!SB) return;
  const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : null;
  let q = SB.from('submissions').select('*');
  if(tid) q = q.eq('teacher_id', tid);
  const {data} = await q;
  const subs = {};
  (data||[]).forEach(r => {
    const key = r.student_id + '_' + r.hw_num;
    subs[key] = {sid:r.student_id,hwNum:r.hw_num,hwTitle:r.hw_title,room:r.room,
      score: r.score !== null && r.score !== undefined ? Number(r.score) : null ,maxScore:r.max_score||100,
      ts:r.submitted_at?new Date(r.submitted_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):''};
  });
  DB.submissions = subs;
}

async function reloadStudents() {
  if(!SB) return;
  const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : null;
  let q = SB.from('students').select('*');
  if(tid) q = q.eq('teacher_id', tid);
  const {data} = await q;
  DB.students = (data||[]).map(r=>({id:r.id,name:r.name,room:r.room}));
  DB.rooms = [...new Set(DB.students.map(s=>s.room))].sort();
}

async function reloadHomeworks() {
  if(!SB) return;
  const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : null;
  let q = SB.from('homeworks').select('*').order('num');
  if(tid) q = q.eq('teacher_id', tid);
  const {data} = await q;
  DB.homeworks = (data||[]).map(r=>({num:r.num,title:r.title,subject:r.subject||'',maxScore:r.max_score||100,deadline:r.deadline||'',fileUrl:r.file_url||'',fileName:r.file_name||''}));
  // อัพเดต UI และ dropdown
  renderManage();
  populateHWDropdown();
}

let _currentStuId = null; // track which student is viewing

function renderStudentIfOpen() {
  if(_currentStuId) {
    const s = (_currentStuDB&&_currentStuDB.student) || DB.students.find(x => x.id === _currentStuId);
    if(s) renderStudentView(s, _currentStuDB||null);
  }
}

// ============================================================
//  CRUD helpers — Supabase or localStorage
// ============================================================
async function sbAddStudent(stu) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    const {error} = await SB.from('students').insert({id:stu.id,name:stu.name,room:stu.room,teacher_id:tid});
    if(error) throw error;
    await reloadStudents();
  } else {
    DB.students.push(stu);
    if(!DB.rooms.includes(stu.room)) DB.rooms.push(stu.room);
    saveDB();
  }
}

async function sbUpdateStudent(oldId, stu) {
  if(USE_SUPABASE) {
    const {error} = await SB.from('students').update({id:stu.id,name:stu.name,room:stu.room}).eq('id', oldId);
    if(error) throw error;
    // ถ้า id เปลี่ยน ต้องย้าย submissions
    if(oldId !== stu.id) {
      const tid2 = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
      let subQ = SB.from('submissions').select('*').eq('student_id', oldId);
      if(tid2) subQ = subQ.eq('teacher_id', tid2);
      const {data: subs} = await subQ;
      for(const s of (subs||[])) {
        await SB.from('submissions').update({student_id: stu.id}).eq('id', s.id);
      }
    }
    await reloadStudents();
  } else {
    const s = DB.students.find(x => x.id === oldId);
    if(s) { s.id=stu.id; s.name=stu.name; s.room=stu.room; }
    if(oldId !== stu.id) {
      const newSubs = {};
      Object.entries(DB.submissions).forEach(([k,v]) => {
        if(k.startsWith(oldId+'_')) { const hw=k.split('_')[1]; newSubs[stu.id+'_'+hw]={...v,sid:stu.id}; }
        else newSubs[k]=v;
      });
      DB.submissions = newSubs;
    }
    saveDB();
  }
}
function updateTopbarAvatar(url) {
  const el = document.getElementById('teacher-topbar-avatar');
  if(!el) return;
  if(url) {
    el.innerHTML = `<img src="${url}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;">`;
  }
}
async function sbDeleteStudent(id) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    await SB.from('submissions').delete().eq('student_id', id).eq('teacher_id', tid);
    const {error} = await SB.from('students').delete().eq('id', id);
    if(error) throw error;
    await reloadStudents();
  } else {
    DB.students = DB.students.filter(s => s.id !== id);
    saveDB();
  }
}

async function sbAddHomework(hw) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    await SB.from('homeworks').delete().eq('num',hw.num).eq('teacher_id',tid);
    const {error} = await SB.from('homeworks').insert({
      num: hw.num,
      title: hw.title,
      subject: hw.subject||'',
      max_score: hw.maxScore||100,
      teacher_id: tid,
      deadline: hw.deadline && hw.deadline.trim() !== '' ? hw.deadline : null,
      file_url: hw.fileUrl||null,
      file_name: hw.fileName||null
    });
    if(error) throw error;
    await reloadHomeworks();
  } else {
    const existing = DB.homeworks.find(h => h.num === hw.num);
    if(existing) { existing.title=hw.title; existing.subject=hw.subject; existing.maxScore=hw.maxScore; existing.deadline=hw.deadline||null; existing.fileUrl=hw.fileUrl||''; existing.fileName=hw.fileName||''; }
    else { DB.homeworks.push(hw); DB.homeworks.sort((a,b)=>a.num-b.num); }
    saveDB();
    renderManage();
    populateHWDropdown();
    renderSubjectsFull();
  }
}

async function sbDeleteHomework(num) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    const {error} = await SB.from('homeworks').delete().eq('num', num).eq('teacher_id', tid);
    if(error) throw error;
    await reloadHomeworks();
  } else {
    DB.homeworks = DB.homeworks.filter(h => h.num !== num);
    saveDB();
  }
}

async function sbRecordSubmission(sub) {
  // sub = {sid, hwNum, hwTitle, room, score, maxScore}
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    await SB.from('submissions').delete().eq('student_id',sub.sid).eq('hw_num',sub.hwNum).eq('teacher_id',tid);
    const {error} = await SB.from('submissions').insert({
      student_id: sub.sid, hw_num: sub.hwNum, hw_title: sub.hwTitle,
      room: sub.room, score: sub.score, max_score: sub.maxScore, teacher_id: tid
    });
    if(error) throw error;
await reloadSubmissions();
renderDashboard();
  } else {
    const key = sub.sid + '_' + sub.hwNum;
    DB.submissions[key] = {...sub, ts: ts()};
    saveDB();
    // อัพเดต UI ทันที
    renderDashboard();
  }
}

async function sbUpdateScore(sid, hwNum, score) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    let q = SB.from('submissions').update({score}).eq('student_id', sid).eq('hw_num', hwNum);
    if(tid) q = q.eq('teacher_id', tid);
    const {error} = await q;
    if(error) throw error;
    await reloadSubmissions();
  } else {
    const key = sid + '_' + hwNum;
    if(DB.submissions[key]) DB.submissions[key].score = score;
    saveDB();
  }
}

async function sbSaveSettings(key, value) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    const scopedKey = tid ? key+'_'+tid : key;
    const {error} = await SB.from('settings').upsert({key:scopedKey, value}, {onConflict: 'key'});
    if(error) throw error;
  } else {
    saveDB();
    // re-render subjects ถ้า tab subjects เปิดอยู่
    if(document.getElementById('subj-full-list')) renderSubjectsFull();
  }
}

async function sbImportStudents(students) {
  if(USE_SUPABASE) {
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    const rows = students.map(s => ({id:s.id, name:s.name, room:s.room, teacher_id:tid}));
    const CHUNK = 50;
    for(let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);

      // ลอง upsert ด้วย composite constraint ก่อน
      let {error} = await SB.from('students').upsert(chunk, {onConflict:'id,teacher_id', ignoreDuplicates:true});

      if(error) {
        // Fallback: ถ้า constraint ไม่มีใน DB → insert ทีละแถว ข้าม duplicate
        let anyFail = null;
        for(const row of chunk) {
          const {error: e2} = await SB.from('students').insert(row);
          if(e2) {
            if(e2.code === '23505' || (e2.message||'').includes('duplicate')) continue;
            anyFail = e2;
          }
        }
        if(anyFail) throw anyFail;
      }

      const pct = Math.round(Math.min((i + CHUNK) / rows.length * 100, 100));
      const bar = document.getElementById('ap-bar');
      const sub = document.getElementById('ap-sub');
      if(bar) bar.style.width = pct + '%';
      if(sub) sub.textContent = 'บันทึกแล้ว ' + Math.min(i + CHUNK, rows.length) + ' / ' + rows.length + ' คน...';
    }
    await reloadStudents();
  } else {
    let added = 0;
    students.forEach(s => {
      if(!DB.students.find(x=>x.id===s.id)) {
        DB.students.push(s);
        if(!DB.rooms.includes(s.room)) DB.rooms.push(s.room);
        added++;
      }
    });
    saveDB();
    return added;
  }
  return students.length;
}

// ============================================================
//  APP LOGIC (same as before, now async where needed)
// ============================================================
let qr = null, scanning = false, curRoom = 'all';

function toggleAdminBar(forceClose){
  const panel = document.getElementById('admin-login-panel');
  const btn = document.getElementById('admin-bar-btn');
  const isOpen = panel.style.display !== 'none';
  if(isOpen || forceClose){
    panel.style.display = 'none';
    btn.textContent = '⬡ ผู้ดูแลระบบ';
    document.getElementById('admin-pw').value = '';
    document.getElementById('admin-err').textContent = '';
  } else {
    panel.style.display = 'block';
    btn.textContent = '✕ ปิด';
    setTimeout(()=>{
      document.getElementById('admin-pw').focus();
      panel.scrollIntoView({behavior:'smooth', block:'nearest'});
    }, 100);
  }
}

function togglePw(id,btn){const el=document.getElementById(id);if(el.type==='password'){el.type='text';btn.textContent='ซ่อน';}else{el.type='password';btn.textContent='แสดง';}}

function toast(msg,type='ok'){
  // Route to whichever toast bar is in the active screen
  const screenOn = document.querySelector('.screen.on');
  const t = screenOn ? screenOn.querySelector('.tbar') : null;
  if(!t)return;
  t.textContent=msg;
  t.className='tbar on t-'+type;
  clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.remove('on'),2800);
}

function showScreen(id){
  if('scrollRestoration' in history) history.scrollRestoration='manual';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
}

async function loginAdmin(){
  const input = document.getElementById('admin-pw');
  const pw = input ? input.value.trim() : '';
  const errEl = document.getElementById('admin-err');
  if(errEl) errEl.textContent = '';
  if(!pw){ if(errEl) errEl.textContent='กรุณากรอกรหัสผ่าน'; return; }

  // ปิดปุ่มระหว่างตรวจสอบ
  const btn = document.querySelector('#admin-login-panel button[onclick="loginAdmin()"]');
  if(btn){ btn.textContent='⏳ กำลังตรวจสอบ...'; btn.disabled=true; }

  try {
    if(USE_SUPABASE && SB) {
      // ดึงรหัสจาก Supabase
      const {data, error} = await SB.from('settings')
        .select('value')
        .eq('key','superadmin_pw')
        .maybeSingle();

      if(error || !data) {
        if(errEl) errEl.textContent='ไม่สามารถตรวจสอบรหัสได้';
        return;
      }

      const correctPw = typeof data.value === 'string'
        ? data.value
        : JSON.stringify(data.value).replace(/"/g,'');

      if(pw === correctPw) {
      // ปิด maintenance ตรงๆ โดยไม่ผ่าน toggleMaintenanceMode
      try {
        await SB.from('settings').upsert(
          {key:'maintenance_mode', value:{enabled:false}},
          {onConflict:'key'}
        );
      } catch(e) {}
      document.getElementById('maintenance-overlay').style.display = 'none';
      CURRENT_TEACHER = null;
      showScreen('s-superadmin');
      loadSuperAdminPanel();
      loadAnthropicKey();
      } else {
        if(errEl) errEl.textContent = 'รหัสผ่านไม่ถูกต้อง';
        if(input) input.select();
      }
    } else {
      // Fallback ถ้าไม่ได้เชื่อมต่อ Supabase
      if(errEl) errEl.textContent='ต้องเชื่อมต่อ Supabase ก่อน';
    }
  } catch(e) {
    if(errEl) errEl.textContent='เกิดข้อผิดพลาด: '+e.message;
  } finally {
    if(btn){ btn.textContent='🔐 เข้าสู่ระบบแอดมิน'; btn.disabled=false; }
  }
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION D: AUTHENTICATION & LOGIN                  ║
// ╚══════════════════════════════════════════════════════╝
// ===== SUPABASE AUTH — Email-based login =====

async function loginTeacher(){
  const email=document.getElementById('teacher-email-input').value.trim();
  const pw=document.getElementById('teacher-pw-input').value;
  const errEl=document.getElementById('teacher-err');
  errEl.textContent='';
  if(!email||!pw){errEl.textContent='กรุณากรอกอีเมลและรหัสผ่าน';return;}
  if(!USE_SUPABASE){errEl.textContent='ต้องเชื่อมต่อ Supabase';return;}
  try{
    const {data:authData,error:authErr}=await SB.auth.signInWithPassword({email,password:pw});
    if(authErr){
      if(authErr.message.includes('Invalid login')||authErr.message.includes('invalid_credentials'))
        errEl.textContent='อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      else if(authErr.message.includes('Email not confirmed'))
        errEl.textContent='กรุณายืนยันอีเมลก่อน (ตรวจสอบกล่องจดหมาย)';
      else errEl.textContent='เกิดข้อผิดพลาด: '+authErr.message;
      return;
    }
    const uid=authData.user.id;
    // ดึงข้อมูลครูจาก teachers table
    const {data:teacher,error:tErr}=await SB.from('teachers').select('*').eq('id',uid).single();
    if(tErr||!teacher){errEl.textContent='ไม่พบข้อมูลครูในระบบ กรุณาติดต่อแอดมิน';await SB.auth.signOut();return;}
    // rejected → แจ้งให้สมัครใหม่ (ใช้อีเมลเดิมได้)
    if(teacher.status==='rejected'){
      errEl.textContent='บัญชีนี้ถูกปฏิเสธ — คุณสามารถสมัครใหม่ด้วยอีเมลเดิมได้';
      await SB.auth.signOut();return;
    }
    // plan_expires_at หมดอายุ → downgrade เป็น free แต่ยังเข้าได้ปกติ
    if(teacher.plan_expires_at && new Date(teacher.plan_expires_at) < new Date()){
      const {error: downErr} = await SB.from('teachers').update({plan:'free', plan_expires_at:null}).eq('id',uid);
      if(!downErr) {
        // DB update สำเร็จ → อัพเดต local ด้วย
        teacher.plan = 'free'; teacher.plan_expires_at = null;
        toast('แพลน Premium หมดอายุแล้ว — ดาวน์เกรดเป็น Free อัตโนมัติ','warn');
      }
      // ถ้า DB update ล้มเหลว → ไม่แก้ local, getTeacherPlan() จะ return 'free' เองเพราะ expires_at หมดแล้ว
    }
    // expires_at (legacy) หมดอายุ → downgrade แต่ไม่บล็อก
    if(teacher.expires_at && new Date(teacher.expires_at) < new Date()){
      const {error: legacyDownErr} = await SB.from('teachers').update({status:'approved', plan:'free', expires_at:null}).eq('id',uid);
      if(!legacyDownErr) { teacher.plan = 'free'; teacher.expires_at = null; }
    }
    // เข้าสู่ระบบสำเร็จ
    // เช็ค maintenance mode — bypass accounts ผ่านได้
    const {data:maintData} = await SB.from('settings').select('value').eq('key','maintenance_mode').maybeSingle();
    const maintOn = maintData && maintData.value && maintData.value.enabled === true;
    if(maintOn) {
      const bypass = await checkIdInBypassList(email) || await checkIdInBypassList(uid);
      if(!bypass) {
        await SB.auth.signOut();
        errEl.textContent='ระบบอยู่ในโหมดปรับปรุง กรุณาลองใหม่ภายหลัง';
        // แสดง maintenance overlay
        showMaintenancePage(maintData.value);
        return;
      }
      // bypass account — แสดง badge แจ้งเตือน
      toast('🔓 เข้าระบบสำเร็จ (โหมดทดสอบ)','warn');
    }
    await loadGlobalBypassIds(); // โหลด bypass IDs ก่อน render เพื่อให้ isPremium() ถูกต้องทันที
    CURRENT_TEACHER={id:uid,display_name:teacher.display_name,email:teacher.email,username:teacher.username||'',first_name:teacher.first_name||'',last_name:teacher.last_name||'',plan:teacher.plan||'free',plan_expires_at:teacher.plan_expires_at||null};
    await loadFromSupabase();
    setTimeout(()=>setupRealtime(),500);
    document.getElementById('teacher-topbar-name').textContent=teacher.display_name;if(teacher.avatar_url) updateTopbarAvatar(teacher.avatar_url);
    document.getElementById('teacher-topbar-email').textContent=teacher.email||'';
    document.getElementById('teacher-email-input').value='';
    document.getElementById('teacher-pw-input').value='';
    showScreen('s-admin');
    populateScanSelects();
    renderDashboard();
    renderPlanBanner();
    startExpiryCountdown(teacher.expires_at);
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

async function registerTeacher(){
  const firstName=document.getElementById('reg-first-name').value.trim();
  const lastName=document.getElementById('reg-last-name').value.trim();
  const username=document.getElementById('reg-username').value.trim();
  const email=document.getElementById('reg-teacher-email').value.trim();
  const pw=document.getElementById('reg-teacher-pw').value;
  const pw2=document.getElementById('reg-teacher-pw2').value;
  const errEl=document.getElementById('reg-err');
  errEl.textContent='';
  if(!firstName||!lastName||!username||!email||!pw){errEl.textContent='กรอกให้ครบทุกช่อง';return;}
  if(username.length<3){errEl.textContent='Username ต้องมีอย่างน้อย 3 ตัวอักษร';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){errEl.textContent='รูปแบบอีเมลไม่ถูกต้อง';return;}
  if(pw!==pw2){errEl.textContent='รหัสผ่านไม่ตรงกัน';return;}
  if(pw.length<6){errEl.textContent='รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';return;}
  if(!USE_SUPABASE){errEl.textContent='ต้องเชื่อมต่อ Supabase';return;}

  const displayName='ครู'+firstName+' '+lastName;

  try{
    // ตรวจ username ซ้ำกับคนอื่น (ไม่นับอีเมลเดิมของตัวเอง)
    const {data:uCheck}=await SB.from('teachers').select('id,email').eq('username',username);
    if(uCheck&&uCheck.length>0&&uCheck[0].email!==email){
      errEl.textContent='Username นี้ถูกใช้แล้ว';return;
    }

    // --- ลองสมัครใหม่ผ่าน Supabase Auth ---
    const {data:authData,error:authErr}=await SB.auth.signUp({
      email, password:pw,
      options:{data:{display_name:displayName,username,first_name:firstName,last_name:lastName}}
    });

    let uid = authData?.user?.id;

    if(authErr){
      // อีเมลมีอยู่แล้วใน Auth → ลอง signIn เพื่อดู status ในตาราง teachers
      if(authErr.message.includes('already registered') || authErr.message.includes('User already registered')){
        const {data:signInData,error:signInErr}=await SB.auth.signInWithPassword({email,password:pw});
        if(signInErr){
          // password ผิด → อีเมลถูกใช้โดยคนอื่นจริง
          errEl.textContent='อีเมลนี้ถูกใช้แล้ว หากเป็นบัญชีของคุณ กรุณาเข้าสู่ระบบ';return;
        }
        uid = signInData.user.id;
        // ดูสถานะในตาราง teachers
        const {data:oldTeacher}=await SB.from('teachers').select('id,status').eq('id',uid).maybeSingle();
        if(oldTeacher && oldTeacher.status !== 'rejected'){
          // บัญชีปกติอยู่ → ไม่ให้สมัครซ้ำ
          errEl.textContent='อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ';
          await SB.auth.signOut();return;
        }
        // status=rejected หรือไม่มีใน teachers → ล้างข้อมูลเดิมแล้วสมัครใหม่
        await SB.from('teachers').delete().eq('id',uid);
        // อัปเดต password ใหม่ (user กำลัง sign in อยู่)
        await SB.auth.updateUser({password:pw});
      } else {
        errEl.textContent='เกิดข้อผิดพลาด: '+authErr.message;return;
      }
    }

    // บันทึกลง teachers table — status='approved', plan='free' ใช้งานได้ทันที
    const {error:upsertErr}=await SB.from('teachers').upsert({
      id:uid, email, username, first_name:firstName, last_name:lastName,
      display_name:displayName, status:'approved', plan:'free',
      plan_expires_at:null, expires_at:null, slip_url:null, slip_uploaded_at:null
    },{onConflict:'id'});
    if(upsertErr) throw upsertErr;

    // อัพโหลดรูปโปรไฟล์ถ้ามี
    const avatarFile = document.getElementById('reg-avatar-input').files[0];
    if(avatarFile){
      const avatarUrl = await uploadAvatar(avatarFile, uid);
      if(avatarUrl) await SB.from('teachers').update({avatar_url:avatarUrl}).eq('id',uid);
    }

    // เข้าสู่ระบบได้เลย
    CURRENT_TEACHER={
      id:uid, display_name:displayName, email, username,
      status:'approved', plan:'free', plan_expires_at:null
    };
    await loadFromSupabase();
    setTimeout(()=>setupRealtime(),500);
    document.getElementById('teacher-topbar-name').textContent=displayName;
    document.getElementById('teacher-topbar-email').textContent=email;
    document.getElementById('teacher-email-input').value='';
    document.getElementById('teacher-pw-input').value='';
    showScreen('s-admin');
    populateScanSelects();
    renderDashboard();
    renderPlanBanner();

  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

async function sendResetPassword(){
  const email=document.getElementById('forgot-email').value.trim();
  const errEl=document.getElementById('forgot-err');
  errEl.textContent='';
  if(!email){errEl.textContent='กรุณากรอกอีเมล';return;}
  if(!USE_SUPABASE){errEl.textContent='ต้องเชื่อมต่อ Supabase';return;}
  try{
    const {error}=await SB.auth.resetPasswordForEmail(email,{
      redirectTo: window.location.href.split('?')[0]+'?reset=1'
    });
    if(error)throw error;
    document.getElementById('forgot-success').style.display='block';
    document.getElementById('forgot-email').value='';
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

// ตรวจสอบ password reset redirect
async function checkResetRedirect(){
  // Supabase v2: ตรวจสอบ URL hash หรือ query param สำหรับ password reset
  const hash=window.location.hash;
  const params=new URLSearchParams(window.location.search);
  const isReset=(hash&&hash.includes('type=recovery'))||(params.get('type')==='recovery');
  if(isReset){
    // รอให้ Supabase Auth โหลด session จาก hash ก่อน
    setTimeout(async()=>{
      const {data:{session}}=await SB.auth.getSession();
      if(session) showResetPasswordModal();
    }, 1000);
  }
}

function showResetPasswordModal(){
  document.getElementById('reset-pw-modal').style.display='flex';
}
function closeResetPwModal(){
  document.getElementById('reset-pw-modal').style.display='none';
  // clear hash
  history.replaceState(null,'',window.location.pathname);
}
async function doResetPassword(){
  const pw=document.getElementById('reset-new-pw').value;
  const pw2=document.getElementById('reset-new-pw2').value;
  const errEl=document.getElementById('reset-pw-err');
  errEl.textContent='';
  if(pw!==pw2){errEl.textContent='รหัสผ่านไม่ตรงกัน';return;}
  if(pw.length<6){errEl.textContent='อย่างน้อย 6 ตัวอักษร';return;}
  try{
    const {error}=await SB.auth.updateUser({password:pw});
    if(error)throw error;
    document.getElementById('reset-pw-success').style.display='block';
    document.getElementById('reset-new-pw').value='';
    document.getElementById('reset-new-pw2').value='';
    await SB.auth.signOut();
    setTimeout(()=>closeResetPwModal(),2000);
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

function showProfileModal(){
  if(!CURRENT_TEACHER||!USE_SUPABASE) return;
  SB.from('teachers').select('*').eq('id',CURRENT_TEACHER.id).single().then(({data})=>{
    if(!data) return;
    document.getElementById('profile-first-name').value=data.first_name||'';
    document.getElementById('profile-last-name').value=data.last_name||'';
    document.getElementById('profile-username').value=data.username||'';
    document.getElementById('profile-display-name').value=data.display_name||'';
    document.getElementById('profile-email').value=data.email||'';
    // โหลดรูปโปรไฟล์
const prev = document.getElementById('profile-avatar-preview');
if(data.avatar_url) {
  prev.innerHTML = `<img src="${data.avatar_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
}
    document.getElementById('profile-err').textContent='';
    document.getElementById('profile-success').style.display='none';
    document.getElementById('teacher-profile-modal').style.display='flex';
    // auto-update display name preview
    const fn=document.getElementById('profile-first-name');
    const ln=document.getElementById('profile-last-name');
    const dn=document.getElementById('profile-display-name');
    const updateDN=()=>{if(fn.value.trim()||ln.value.trim())dn.value='ครู'+fn.value.trim()+' '+ln.value.trim();};
    fn.oninput=updateDN; ln.oninput=updateDN;
  });
}

function closeProfileModal(){
  document.getElementById('teacher-profile-modal').style.display='none';
}

async function saveProfile(){
  const firstName=document.getElementById('profile-first-name').value.trim();
  const lastName=document.getElementById('profile-last-name').value.trim();
  const username=document.getElementById('profile-username').value.trim();
  const errEl=document.getElementById('profile-err');
  errEl.textContent='';
  if(!firstName||!lastName){errEl.textContent='กรุณากรอกชื่อและนามสกุล';return;}
  if(!username||username.length<3){errEl.textContent='Username ต้องมีอย่างน้อย 3 ตัวอักษร';return;}
  try{
    // ตรวจ username ซ้ำ (ยกเว้นของตัวเอง)
    const {data:existing}=await SB.from('teachers').select('id').eq('username',username).neq('id',CURRENT_TEACHER.id);
    if(existing&&existing.length>0){errEl.textContent='Username นี้ถูกใช้แล้ว';return;}
    const displayName='ครู'+firstName+' '+lastName;
    const {error}=await SB.from('teachers').update({
      first_name:firstName, last_name:lastName, username, display_name:displayName
    }).eq('id',CURRENT_TEACHER.id);
    if(error)throw error;
    // อัปเดต local state
    // อัพโหลดรูปถ้ามีการเลือกใหม่
const avatarFile = document.getElementById('profile-avatar-input').files[0];
if(avatarFile) {
  const avatarUrl = await uploadAvatar(avatarFile, CURRENT_TEACHER.id);
  if(avatarUrl) {
    await SB.from('teachers').update({avatar_url: avatarUrl}).eq('id', CURRENT_TEACHER.id);
    CURRENT_TEACHER.avatar_url = avatarUrl;
    updateTopbarAvatar(avatarUrl);
  }
}
    CURRENT_TEACHER.display_name=displayName;
    document.getElementById('teacher-topbar-name').textContent=displayName;
    document.getElementById('profile-display-name').value=displayName;
    document.getElementById('profile-success').style.display='block';
    setTimeout(()=>{document.getElementById('profile-success').style.display='none';},2000);
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

function showChangePwModal(){
  if(!CURRENT_TEACHER){return;}
  document.getElementById('change-pw-email-display').textContent=CURRENT_TEACHER.email||'';
  document.getElementById('change-current-pw').value='';
  document.getElementById('change-new-pw').value='';
  document.getElementById('change-new-pw2').value='';
  document.getElementById('change-pw-err').textContent='';
  document.getElementById('change-pw-success').style.display='none';
  document.getElementById('change-pw-modal').style.display='flex';
}

function closeChangePwModal(){
  document.getElementById('change-pw-modal').style.display='none';
}

async function doChangePassword(){
  const currentPw=document.getElementById('change-current-pw').value;
  const newPw=document.getElementById('change-new-pw').value;
  const newPw2=document.getElementById('change-new-pw2').value;
  const errEl=document.getElementById('change-pw-err');
  errEl.textContent='';
  if(!currentPw||!newPw){errEl.textContent='กรอกให้ครบทุกช่อง';return;}
  if(newPw!==newPw2){errEl.textContent='รหัสผ่านใหม่ไม่ตรงกัน';return;}
  if(newPw.length<6){errEl.textContent='รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';return;}
  if(!USE_SUPABASE||!CURRENT_TEACHER){errEl.textContent='ไม่ได้เชื่อมต่อ';return;}
  try{
    // Re-authenticate ด้วย current password ก่อน
    const {error:signInErr}=await SB.auth.signInWithPassword({
      email:CURRENT_TEACHER.email, password:currentPw
    });
    if(signInErr){errEl.textContent='รหัสผ่านปัจจุบันไม่ถูกต้อง';return;}
    // เปลี่ยนรหัสผ่าน
    const {error:updateErr}=await SB.auth.updateUser({password:newPw});
    if(updateErr)throw updateErr;
    document.getElementById('change-pw-success').style.display='block';
    document.getElementById('change-current-pw').value='';
    document.getElementById('change-new-pw').value='';
    document.getElementById('change-new-pw2').value='';
    setTimeout(()=>closeChangePwModal(),2000);
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

function showRegForm(show){
  if(show) loadPricingToRegister();
  document.getElementById('teacher-login-form').style.display=show?'none':'block';
  document.getElementById('teacher-reg-form').style.display=show?'block':'none';
  document.getElementById('teacher-forgot-form').style.display='none';
  document.getElementById('reg-success').style.display='none';
  document.getElementById('reg-err').textContent='';
}

function showForgotForm(show){
  document.getElementById('teacher-login-form').style.display=show?'none':'block';
  document.getElementById('teacher-reg-form').style.display='none';
  document.getElementById('teacher-forgot-form').style.display=show?'block':'none';
  document.getElementById('forgot-success').style.display='none';
  document.getElementById('forgot-err').textContent='';
}

// ===== CONTACT ADMIN MANAGEMENT =====
const CONTACT_ICONS = {
  line: '💬', facebook: '📘', email: '📧', phone: '📞', other: '🔗'
};

async function loadContactLinksForLogin(){
  if(!USE_SUPABASE||!SB) return;
  try{
    const {data} = await SB.from('settings').select('value').eq('key','admin_contacts').single();
    const contacts = (data&&data.value) ? data.value : [];
    renderContactAdminLinks(contacts);
  }catch(e){ /* silently fail */ }
}

async function loadContactSettings(){
  loadPaymentSettings();
  loadPlansSettings(); // โหลด plans ด้วย
  loadBypassIds();     // โหลด bypass ids ด้วย
  if(!USE_SUPABASE) return;
  const {data} = await SB.from('settings').select('value').eq('key','admin_contacts').single();
  const contacts = (data&&data.value) ? data.value : [];
  renderContactSettingsList(contacts);
  renderContactAdminLinks(contacts);
}

function renderContactSettingsList(contacts){
  const el = document.getElementById('contact-settings-list');
  if(!el) return;
  if(!contacts.length){
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:8px;">ยังไม่มีข้อมูลติดต่อ</div>';
    return;
  }
  el.innerHTML = contacts.map((c,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:18px;">${CONTACT_ICONS[c.type]||'🔗'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.label}</div>
        <div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.value}</div>
      </div>
      <button onclick="removeContact(${i})" style="padding:4px 10px;font-size:12px;font-weight:600;border-radius:8px;border:1.5px solid var(--red-light);background:var(--red-light);color:var(--red);cursor:pointer;flex-shrink:0;">ลบ</button>
    </div>`).join('');
}

function renderContactAdminLinks(contacts){
  const el = document.getElementById('contact-admin-links');
  if(!el) return;
  if(!contacts||!contacts.length){
    el.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);text-align:center;">ยังไม่มีข้อมูลติดต่อ</div>';
    return;
  }
  el.innerHTML = contacts.map(c => {
    const icon = CONTACT_ICONS[c.type]||'🔗';
    const isLink = c.value.startsWith('http')||c.value.startsWith('mailto:')||c.value.startsWith('tel:');
    const href = isLink ? c.value : (c.type==='email'?'mailto:'+c.value : c.type==='phone'?'tel:'+c.value : c.value);
    return isLink || c.type==='email' || c.type==='phone'
      ? `<a href="${href}" target="_blank" rel="noopener"
           style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:10px 14px;text-decoration:none;transition:all .2s;"
           onmouseover="this.style.background='rgba(255,255,255,0.22)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
          <span style="font-size:20px;">${icon}</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;">${c.label}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);">${c.type==='email'||c.type==='phone'?c.value:'กดเพื่อเปิด'}</div>
          </div>
          <svg style="margin-left:auto;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>`
      : `<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:10px 14px;">
          <span style="font-size:20px;">${icon}</span>
          <div><div style="font-size:14px;font-weight:700;color:#fff;">${c.label}</div><div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${c.value}</div></div>
        </div>`;
  }).join('');
}

async function addContactChannel(){
  const type = document.getElementById('contact-type').value;
  const label = document.getElementById('contact-label').value.trim();
  const value = document.getElementById('contact-value').value.trim();
  if(!label||!value){toast2('กรอกชื่อและข้อมูลติดต่อด้วย','warn');return;}
  const {data} = await SB.from('settings').select('value').eq('key','admin_contacts').maybeSingle();
const contacts = (data&&data.value) ? data.value : [];
  contacts.push({type,label,value});
  const {error} = await SB.from('settings').upsert({key:'admin_contacts',value:contacts},{onConflict:'key'});
  if(error){toast2('บันทึกไม่สำเร็จ: '+error.message,'err');return;}
  document.getElementById('contact-label').value='';
  document.getElementById('contact-value').value='';
  renderContactSettingsList(contacts);
  renderContactAdminLinks(contacts);
  toast2('เพิ่มช่องทางติดต่อแล้ว ✅');
}

async function removeContact(idx){
  const {data} = await SB.from('settings').select('value').eq('key','admin_contacts').maybeSingle();
const contacts = (data&&data.value) ? data.value : [];
  contacts.splice(idx,1);
  await SB.from('settings').upsert({key:'admin_contacts',value:contacts},{onConflict:'key'});
  renderContactSettingsList(contacts);
  renderContactAdminLinks(contacts);
  toast2('ลบแล้ว','warn');
}

// Super Admin functions
async function loadSuperAdminPanel(){
  if(!USE_SUPABASE||!SB){
    const notConn = '<div style="background:#FEF3C7;border-radius:12px;padding:20px;text-align:center;margin-bottom:12px;">'
      +'<div style="font-size:32px;margin-bottom:8px;">⚠️</div>'
      +'<div style="font-size:15px;font-weight:700;color:#92400E;margin-bottom:4px;">ยังไม่ได้เชื่อมต่อ Supabase</div>'
      +'<div style="font-size:13px;color:#B45309;">กรุณากลับไปตั้งค่าก่อน หรือรีโหลดหน้าเว็บ</div>'
      +'<button onclick="logout()" style="margin-top:12px;padding:8px 20px;border-radius:20px;border:1.5px solid #B45309;background:#FEF3C7;color:#92400E;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;">← กลับหน้าหลัก</button>'
      +'</div>';
    document.getElementById('sa-pending-list').innerHTML = notConn;
    document.getElementById('sa-approved-list').innerHTML = '';
    document.getElementById('sa-rejected-list').innerHTML = '';
    document.getElementById('sa-pending-badge').style.display = 'none';
    return;
  }
  try{
    // แสดง loading
    document.getElementById('sa-pending-list').innerHTML='<div style="text-align:center;padding:16px;color:var(--text3);">⏳ กำลังโหลด...</div>';
    const {data,error}=await SB.from('teachers').select('id,email,username,first_name,last_name,display_name,status,created_at,expires_at,slip_url,slip_uploaded_at,plan,plan_expires_at').order('created_at');
    if(error)throw error;
    renderTeacherList(data||[]);
    loadContactSettings();
    loadMaintenanceStatus();
    loadAnnouncementSettings();
    loadFeatureFlags(true);
  }catch(e){
    const msg = e.message||String(e);
    const isNoTable = msg.includes('does not exist')||msg.includes('relation');
    const errHtml = isNoTable
      ? '<div style="background:#FEE2E2;border-radius:12px;padding:20px;text-align:center;">'
        +'<div style="font-size:28px;margin-bottom:8px;">📋</div>'
        +'<div style="font-size:15px;font-weight:700;color:#B91C1C;margin-bottom:4px;">ยังไม่ได้สร้าง Tables</div>'
        +'<div style="font-size:13px;color:#991B1B;">กรุณาไปรัน SQL ใน Supabase SQL Editor ก่อน</div></div>'
      : '<div style="background:#FEE2E2;border-radius:12px;padding:16px;text-align:center;font-size:13px;color:#B91C1C;">❌ '+msg+'</div>';
    document.getElementById('sa-pending-list').innerHTML = errHtml;
    document.getElementById('sa-approved-list').innerHTML = '';
    document.getElementById('sa-rejected-list').innerHTML = '';
  }
}

function toast2(msg,type='ok'){
  const t=document.getElementById('toast-sa');
  if(!t)return;
  t.textContent=msg;
  t.className='tbar on t-'+type;
  clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.remove('on'),2800);
}

let _teacherSearchQuery = '';
let _cachedTeachers = [];

function filterTeachers(q) {
  _teacherSearchQuery = q.toLowerCase();
  renderTeacherList(_cachedTeachers || []);
}

// ============================================================
// SA UNIFIED TEACHER LIST — filter + detail sheet
// ============================================================
let _saStatusFilter = 'pending';

function setSAFilter(status, btn) {
  _saStatusFilter = status;
  // tab highlight
  ['pending','active','expired','all'].forEach(k => {
    const el = document.getElementById('sa-tab-' + k);
    if(!el) return;
    const isActive = k === status;
    el.style.borderBottom = isActive ? '3px solid var(--blue)' : '3px solid transparent';
    el.style.color = isActive ? 'var(--blue-dark)' : 'var(--text2)';
    el.style.background = isActive ? 'var(--blue-light)' : '#fff';
    if(k === 'pending') {
      el.style.background = isActive ? '#FEF3C7' : '#fff';
      el.style.borderBottom = isActive ? '3px solid #F59E0B' : '3px solid transparent';
      el.style.color = isActive ? '#B45309' : 'var(--text2)';
    }
  });
  renderTeacherList(_cachedTeachers);
}

function _filterByTab(teachers) {
  const now = new Date();
  switch(_saStatusFilter) {
    case 'pending':
      return teachers.filter(t => t.status === 'pending' || t.status === 'slip_uploaded');
    case 'active':
      return teachers.filter(t => {
        if(t.status !== 'approved') return false;
        if(t.expires_at && new Date(t.expires_at) < now) return false;
        return true;
      });
    case 'expired':
      return teachers.filter(t =>
        t.status === 'expired' ||
        t.status === 'rejected' ||
        (t.status === 'approved' && t.expires_at && new Date(t.expires_at) < now) ||
        (t.plan === 'premium' && t.plan_expires_at && new Date(t.plan_expires_at) < now)
      );
    default:
      return teachers;
  }
}

function _isPlanExpired(t) {
  if(t.plan !== 'premium') return false;
  return t.plan_expires_at && new Date(t.plan_expires_at) < new Date();
}

function renderTeacherList(teachers) {
  _cachedTeachers = teachers;
  renderSAStats(teachers);

  // Update pending badge
  const pendingCount = teachers.filter(t => t.status === 'pending' || t.status === 'slip_uploaded').length;
  const pb = document.getElementById('sa-pending-badge');
  if(pb) { pb.textContent = pendingCount || ''; pb.style.display = pendingCount ? '' : 'none'; }

  // Apply search + tab filter
  const q = _teacherSearchQuery;
  let list = q
    ? teachers.filter(t =>
        (t.display_name || '').toLowerCase().includes(q) ||
        (t.username || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q))
    : teachers;
  list = _filterByTab(list);

  // Sort: slip_uploaded first, then pending, then by name
  const order = { slip_uploaded:0, pending:1, approved:2, expired:3, rejected:4 };
  list = [...list].sort((a,b) => (order[a.status]||9)-(order[b.status]||9) || (a.display_name||'').localeCompare(b.display_name||''));

  const allEl = document.getElementById('sa-all-list');
  if(!allEl) return;

  if(!list.length) {
    allEl.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--text3);font-size:14px;">ไม่พบผู้ใช้งาน</div>';
    return;
  }

  allEl.innerHTML = list.map(t => {
    const isPrem = t.plan === 'premium';
    const planExpired = _isPlanExpired(t);
    const now = new Date();
    const accExpired = t.expires_at && new Date(t.expires_at) < now;

    // Status badge config
    const statusCfg = {
      pending:       { bg:'#FEF3C7', color:'#B45309', label:'⏳ รออนุมัติ' },
      slip_uploaded: { bg:'#DBEAFE', color:'#1D4ED8', label:'💳 ส่งสลิปแล้ว' },
      approved:      { bg:'#DCFCE7', color:'#15803D', label:'✅ ใช้งาน' },
      expired:       { bg:'#F1F5F9', color:'#64748B', label:'🔒 หมดอายุ' },
      rejected:      { bg:'#FEE2E2', color:'#B91C1C', label:'❌ ปฏิเสธ' },
    };
    const sCfg = (accExpired && t.status === 'approved')
      ? { bg:'#F1F5F9', color:'#64748B', label:'🔒 บัญชีหมดอายุ' }
      : (statusCfg[t.status] || statusCfg.pending);

    // Plan badge
    let planBadge = '';
    if(t.status === 'approved' && !accExpired) {
      if(isPrem && !planExpired) {
        const daysLeft = t.plan_expires_at ? Math.ceil((new Date(t.plan_expires_at)-now)/86400000) : null;
        planBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:linear-gradient(135deg,#EDE9FE,#DDD6FE);color:#6D28D9;border:1px solid #C4B5FD;white-space:nowrap;">💎 Premium${daysLeft!==null?' ('+daysLeft+'ว.)':''}</span>`;
      } else if(isPrem && planExpired) {
        planBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5;white-space:nowrap;">💎 Premium หมดอายุ</span>`;
      } else {
        planBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;white-space:nowrap;">🎁 Free</span>`;
      }
    }

    // Avatar
    const avatarBg = isPrem ? 'linear-gradient(135deg,#EDE9FE,#DDD6FE)' : 'linear-gradient(135deg,#DBEAFE,#BFDBFE)';
    const avatarColor = isPrem ? '#6D28D9' : '#1D4ED8';
    const avatarHtml = t.avatar_url
      ? `<img src="${t.avatar_url}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:42px;height:42px;border-radius:50%;background:${avatarBg};color:${avatarColor};font-weight:800;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${(t.display_name||'?').substring(0,2)}</div>`;

    return `<div onclick="openSADetail('${t.id}')"
      style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1.5px solid #EFF1F5;transition:box-shadow .15s;"
      onmouseover="this.style.boxShadow='0 2px 12px rgba(37,99,235,0.1)';this.style.borderColor='var(--blue)'"
      onmouseout="this.style.boxShadow='';this.style.borderColor='#EFF1F5'">
      ${avatarHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.display_name||'-'}</div>
        <div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.username?'@'+t.username+' · ':''}${t.email||''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${sCfg.bg};color:${sCfg.color};white-space:nowrap;">${sCfg.label}</span>
        ${planBadge}
      </div>
      <span style="font-size:16px;color:#CBD5E1;flex-shrink:0;">›</span>
    </div>`;
  }).join('');
}

function openSADetail(tid) {
  const t = (_cachedTeachers || []).find(x => x.id === tid);
  if(!t) return;
  const overlay = document.getElementById('sa-detail-overlay');
  const content = document.getElementById('sa-detail-content');
  if(!overlay || !content) return;

  const now = new Date();
  const isPrem = t.plan === 'premium';
  const planExpired = _isPlanExpired(t);
  const accExpired = t.expires_at && new Date(t.expires_at) < now;
  const expInfo = getExpiryInfo(t.expires_at);
  const planExpInfo = getExpiryInfo(t.plan_expires_at);

  const statusLabel = accExpired && t.status==='approved' ? '🔒 บัญชีหมดอายุ'
    : t.status==='pending' ? '⏳ รออนุมัติ'
    : t.status==='slip_uploaded' ? '💳 ส่งสลิปแล้ว'
    : t.status==='approved' ? '✅ ใช้งาน'
    : t.status==='expired' ? '🔒 หมดอายุ' : '❌ ปฏิเสธ';

  const avatarHtml = t.avatar_url
    ? `<img src="${t.avatar_url}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:3px solid ${isPrem?'#A78BFA':'#BFDBFE'};">`
    : `<div style="width:56px;height:56px;border-radius:50%;background:${isPrem?'linear-gradient(135deg,#EDE9FE,#DDD6FE)':'linear-gradient(135deg,#DBEAFE,#BFDBFE)'};color:${isPrem?'#6D28D9':'#1D4ED8'};font-weight:800;display:flex;align-items:center;justify-content:center;font-size:18px;">${(t.display_name||'?').substring(0,2)}</div>`;

  content.innerHTML = `
    <!-- Profile row -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
      ${avatarHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-size:17px;font-weight:800;color:var(--text);">${t.display_name||'-'}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px;">${t.username?'@'+t.username+' · ':''}${t.email||''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${
            t.status==='approved'?'#DCFCE7':t.status==='pending'||t.status==='slip_uploaded'?'#FEF3C7':'#FEE2E2'
          };color:${
            t.status==='approved'?'#15803D':t.status==='pending'||t.status==='slip_uploaded'?'#B45309':'#B91C1C'
          };">${statusLabel}</span>
          ${isPrem && !planExpired
            ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:linear-gradient(135deg,#EDE9FE,#DDD6FE);color:#6D28D9;border:1px solid #C4B5FD;">💎 Premium</span>`
            : isPrem && planExpired
            ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#FEE2E2;color:#B91C1C;">💎 Premium หมดอายุ</span>`
            : `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#F1F5F9;color:#64748B;">🎁 Free</span>`
          }
        </div>
      </div>
    </div>

    <!-- Info rows -->
    <div style="background:#F8FAFC;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px;">
        <span style="color:var(--text3);white-space:nowrap;">อายุบัญชี</span>
        <span style="font-weight:600;">${renderExpireBadge(t.expires_at)}</span>
        ${isPrem ? `<span style="color:var(--text3);white-space:nowrap;">Premium</span>
        <span style="font-weight:600;">${renderExpireBadge(t.plan_expires_at)}</span>` : ''}
        ${t.slip_url ? `<span style="color:var(--text3);">สลิป</span><a href="${t.slip_url}" target="_blank" style="color:var(--blue);font-weight:600;">💳 ดูสลิป</a>` : ''}
        <span style="color:var(--text3);">สมัครเมื่อ</span>
        <span>${t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) : '-'}</span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">การดำเนินการ</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      ${t.status!=='approved'
        ? `<button onclick="approveTeacher('${t.id}');closeSADetail()" style="padding:11px;font-size:13px;font-weight:700;border-radius:10px;border:none;background:linear-gradient(135deg,var(--green),var(--green-dark));color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;">✅ อนุมัติ</button>`
        : `<button onclick="openSetExpiry('${t.id}','${t.expires_at||''}');closeSADetail()" style="padding:11px;font-size:13px;font-weight:700;border-radius:10px;border:1.5px solid var(--yellow);background:var(--yellow-light);color:#B45309;cursor:pointer;font-family:Sarabun,sans-serif;">⏱ ต่ออายุ</button>`
      }
      <button onclick="openSetPlan('${t.id}','${t.plan||'free'}');closeSADetail()" style="padding:11px;font-size:13px;font-weight:700;border-radius:10px;border:1.5px solid #C4B5FD;background:linear-gradient(135deg,#FAF5FF,#EDE9FE);color:#6D28D9;cursor:pointer;font-family:Sarabun,sans-serif;">💎 เปลี่ยน Plan</button>
      <button onclick="viewTeacherData('${t.id}','${t.display_name}');closeSADetail()" style="padding:11px;font-size:13px;font-weight:700;border-radius:10px;border:1.5px solid var(--blue);background:var(--blue-light);color:var(--blue-dark);cursor:pointer;font-family:Sarabun,sans-serif;">👁 ดูข้อมูล</button>
      ${t.status!=='rejected'
        ? `<button onclick="rejectTeacher('${t.id}');closeSADetail()" style="padding:11px;font-size:13px;font-weight:700;border-radius:10px;border:1.5px solid #FCA5A5;background:#FFF5F5;color:#B91C1C;cursor:pointer;font-family:Sarabun,sans-serif;">✕ ปฏิเสธ</button>`
        : '<div></div>'
      }
    </div>
    <button onclick="deleteTeacher('${t.id}');closeSADetail()" style="width:100%;padding:10px;font-size:13px;font-weight:700;border-radius:10px;border:none;background:#FEE2E2;color:#B91C1C;cursor:pointer;font-family:Sarabun,sans-serif;">🗑 ลบบัญชีนี้</button>
  `;

  overlay.style.display = 'flex';
}

function closeSADetail() {
  const overlay = document.getElementById('sa-detail-overlay');
  if(overlay) overlay.style.display = 'none';
}

function toggleTeacherDetail(id) {
  const el = document.getElementById(id);
  if(!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  const btn = el.previousElementSibling.querySelector('button[onclick*="toggleTeacherDetail"]');
  if(btn) btn.textContent = isHidden ? '▴ ซ่อน' : '▾ ดู';
}

function approveTeacher(tid) {
  // โหลด payment_info เพื่อดึงราคา
  const modal = document.getElementById('approve-modal');
  document.getElementById('approve-tid').value = tid;

  // โหลด plans จาก settings
  loadPlansIntoModal();
  modal.style.display = 'flex';
}

async function loadPlansIntoModal() {
  try {
    const {data} = await SB.from('settings').select('value').eq('key','plans').maybeSingle();
    const plans = (data && data.value && data.value.length) ? data.value : [
      {name:'รายเดือน', days:30, price:'199'},
      {name:'รายปี', days:365, price:'1,490'},
      {name:'2 ปี', days:730, price:'2,490'},
    ];
    const container = document.getElementById('approve-plans');
    container.innerHTML = plans.map((p,i) => `
      <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);cursor:pointer;background:#fff;margin-bottom:6px;transition:all .15s;" 
        onclick="selectPlan(this,${p.days})">
        <input type="radio" name="approve-plan" value="${p.days}" ${i===0?'checked':''} style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0;">
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--text);">${p.name}</div>
          <div style="font-size:12px;color:var(--text2);">${p.days} วัน</div>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--green-dark);">฿${p.price}</div>
      </label>`).join('');
    // เลือก default
    const firstLabel = container.querySelector('label');
    if(firstLabel) firstLabel.style.borderColor = 'var(--blue)';
  } catch(e) {}
}

function selectPlan(el, days) {
  document.querySelectorAll('#approve-plans label').forEach(l => l.style.borderColor = 'var(--border)');
  el.style.borderColor = 'var(--blue)';
  el.style.background = 'var(--blue-light)';
}

async function confirmApproveTeacher() {
  const tid = document.getElementById('approve-tid').value;
  const checked = document.querySelector('input[name="approve-plan"]:checked');
  const days = checked ? parseInt(checked.value) : 365;
  const note = document.getElementById('approve-note').value.trim();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const {error} = await SB.from('teachers').update({
    status: 'approved',
    expires_at: expiresAt.toISOString(),
    approved_note: note || null
  }).eq('id', tid);

  if(error){toast2('ไม่สำเร็จ: '+error.message,'err');return;}
  closeApproveModal();
  toast2('✅ อนุมัติแล้ว · ใช้งานได้ '+days+' วัน');
  loadSuperAdminPanel();
}

function closeApproveModal() {
  document.getElementById('approve-modal').style.display = 'none';
}

async function rejectTeacher(tid){
  if(!confirm('ยืนยันปฏิเสธการเข้าถึงของครูคนนี้?\n\nครูจะสามารถสมัครใหม่ด้วยอีเมลเดิมได้'))return;
  try {
    // ดึงอีเมลของครูคนนี้ก่อน
    const {data:teacher} = await SB.from('teachers').select('email,id').eq('id',tid).single();
    if(!teacher) throw new Error('ไม่พบข้อมูลครู');

    // อัพเดต status เป็น rejected
    const {error} = await SB.from('teachers').update({status:'rejected'}).eq('id',tid);
    if(error) throw error;

    // ลบออกจาก teachers table เพื่อปลดล็อกอีเมล
    // (Supabase Auth จะยังอยู่แต่ไม่มีผลเพราะระบบเช็ค teachers table)
    // แนะนำให้รัน SQL นี้ใน Supabase เพื่อลบ Auth user:
    // DELETE FROM auth.users WHERE id = 'tid';

    toast2('ปฏิเสธการเข้าถึงแล้ว — ครูสามารถสมัครใหม่ได้','warn');
    loadSuperAdminPanel();
  } catch(e) {
    toast2('ไม่สำเร็จ: '+e.message,'err');
  }
}

async function deleteTeacher(tid){
  if(!confirm('ยืนยันลบบัญชีครูนี้? (ข้อมูลนักเรียนและงานของครูจะยังอยู่)'))return;
  const {error}=await SB.from('teachers').delete().eq('id',tid);
  if(error){toast2('ไม่สำเร็จ: '+error.message,'err');return;}
  toast2('ลบบัญชีแล้ว','warn');loadSuperAdminPanel();
}

async function viewTeacherData(tid,tname){
  if(!USE_SUPABASE)return;
  // Switch to teacher view mode inside superadmin
  CURRENT_TEACHER={id:tid,display_name:tname};
  await loadFromSupabase();
  document.getElementById('sa-teacher-view-name').textContent='ดูข้อมูลของ: '+tname;
  document.getElementById('sa-teacher-view-panel').style.display='block';
  renderSATeacherData();
}

function closeSATeacherView(){
  CURRENT_TEACHER=null;
  document.getElementById('sa-teacher-view-panel').style.display='none';
}

function renderSATeacherData(){
  const rooms=[...new Set(DB.students.map(s=>s.room))].sort();
  document.getElementById('sa-tv-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <div style="background:var(--blue-light);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;">${DB.students.length}</div><div style="font-size:12px;color:var(--text2);">นักเรียน</div></div>
      <div style="background:var(--green-light);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;">${DB.homeworks.length}</div><div style="font-size:12px;color:var(--text2);">ชิ้นงาน</div></div>
      <div style="background:var(--purple-light);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;">${Object.keys(DB.submissions).length}</div><div style="font-size:12px;color:var(--text2);">การส่งงาน</div></div>
      <div style="background:var(--yellow-light);border-radius:12px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;">${rooms.length}</div><div style="font-size:12px;color:var(--text2);">ห้องเรียน</div></div>
    </div>`;

  document.getElementById('sa-tv-students').innerHTML=DB.students.length?
    `<table class="mini-tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ห้อง</th><th>ส่งงาน</th></tr></thead><tbody>`+
    DB.students.map(s=>{
      const done=DB.homeworks.filter(h=>DB.submissions[s.id+'_'+h.num]).length;
      return `<tr><td style="font-size:12px;">${s.id}</td><td style="font-size:13px;">${s.name}</td><td style="font-size:12px;">${s.room}</td><td style="text-align:center;font-weight:700;color:var(--green-dark);">${done}/${DB.homeworks.length}</td></tr>`;
    }).join('')+`</tbody></table>`
    :'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px;">ยังไม่มีนักเรียน</div>';
}

// ครูที่ถูกเลือกโดยนักเรียน (สำหรับการเข้าดูงาน)


let _allTeachers = [];

async function loadTeacherListForStudent(){
  if(!USE_SUPABASE||!SB){return;}
  try{
    const {data,error}=await SB.from('teachers').select('id,display_name,username,first_name,last_name,avatar_url').eq('status','approved').order('display_name');
    if(error||!data||!data.length){
      document.getElementById('stu-teacher-search').placeholder='— ยังไม่มีครูในระบบ —';
      return;
    }
    _allTeachers = data;
    renderTeacherDropdown(data);
  }catch(e){
    document.getElementById('stu-teacher-search').placeholder='— โหลดไม่สำเร็จ —';
  }
}

function renderTeacherDropdown(teachers){
  const dd = document.getElementById('teacher-dropdown');
  if(!teachers.length){
    dd.innerHTML='<div style="padding:12px;font-size:13px;color:var(--text3);text-align:center;">ไม่พบครู</div>';
    return;
  }
  dd.innerHTML = '';
  teachers.forEach(function(t){
    const div = document.createElement('div');
    div.style.cssText='padding:12px 14px;font-size:14px;font-weight:600;color:var(--text);cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;';
    div.style.display = 'flex';
div.style.alignItems = 'center';
div.style.gap = '10px';
const avatarEl = document.createElement('div');
if(t.avatar_url) {
  avatarEl.innerHTML = `<img src="${t.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">`;
} else {
  avatarEl.style.cssText = 'width:36px;height:36px;border-radius:50%;background:var(--blue-light);color:var(--blue-dark);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;';
  avatarEl.textContent = (t.display_name||'?').substring(0,2);
}
const nameEl = document.createElement('div');
nameEl.innerHTML = `<div style="font-size:14px;font-weight:700;color:var(--text);">${t.display_name}</div>${t.username?`<div style="font-size:12px;color:var(--text3);">@${t.username}</div>`:''}`;
div.appendChild(avatarEl);
div.appendChild(nameEl);
    div.addEventListener('mouseover', function(){ this.style.background='var(--bg)'; });
    div.addEventListener('mouseout', function(){ this.style.background='#fff'; });
    div.addEventListener('click', function(){
      selectTeacher(t.id, t.display_name, t.username||'');
    });
    dd.appendChild(div);
  });
}

function filterTeacherList(q){
  const dd = document.getElementById('teacher-dropdown');
  dd.style.display = 'block';
  if(!q.trim()){renderTeacherDropdown(_allTeachers);return;}
  const filtered = _allTeachers.filter(t=>
    t.display_name.toLowerCase().includes(q.toLowerCase()) ||
    (t.username||'').toLowerCase().includes(q.toLowerCase())
  );
  renderTeacherDropdown(filtered);
}

function selectTeacher(id, name, username){
  STU_SELECTED_TEACHER = {id, display_name:name, username};
  document.getElementById('stu-teacher-search').value = name;
  document.getElementById('stu-teacher-select').value = id;
  document.getElementById('teacher-dropdown').style.display = 'none';
}

async function loginStudent(){
  const sid=document.getElementById('stu-id').value.trim();
  const errEl=document.getElementById('stu-err');
  errEl.textContent='';
  if(!sid){errEl.textContent='กรุณากรอกเลขประจำตัว';return;}
  if(!STU_SELECTED_TEACHER){errEl.textContent='กรุณาเลือกครูผู้สอนก่อน';return;}
  if(!USE_SUPABASE){errEl.textContent='ต้องเชื่อมต่อ Supabase';return;}
  try{
    // โหลดข้อมูลของครูคนที่เลือก
    const tid=STU_SELECTED_TEACHER.id;
    const {data:stuData,error:stuErr}=await SB.from('students').select('*').eq('id',sid).eq('teacher_id',tid).single();
    if(stuErr||!stuData){errEl.textContent='ไม่พบรหัสนักเรียนนี้ในรายชื่อของ'+STU_SELECTED_TEACHER.display_name;return;}
    // โหลด submissions ของนักเรียนคนนี้จากครูคนนี้
    const {data:subData}=await SB.from('submissions').select('*').eq('student_id',sid).eq('teacher_id',tid);
    const {data:hwData}=await SB.from('homeworks').select('*').eq('teacher_id',tid).order('num');
    // สร้าง DB ชั่วคราวสำหรับแสดงผลนักเรียน
    const stuDB={
      student:{id:stuData.id,name:stuData.name,room:stuData.room},
      homeworks:(hwData||[]).map(r=>({num:r.num,title:r.title,subject:r.subject||'',maxScore:r.max_score||100,deadline:r.deadline||'',fileUrl:r.file_url||'',fileName:r.file_name||''})),
      submissions:{}
    };
    (subData||[]).forEach(r=>{
      stuDB.submissions[r.student_id+'_'+r.hw_num]={
        sid:r.student_id,hwNum:r.hw_num,hwTitle:r.hw_title,room:r.room,
        score:r.score,maxScore:r.max_score||100,
        ts:r.submitted_at?new Date(r.submitted_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):''
      };
    });
    _currentStuId=sid;
    _currentStuDB=stuDB;
    _currentStuTeacher=STU_SELECTED_TEACHER;
    showScreen('s-stu');
    document.getElementById('stu-id').value='';
    renderStudentView(stuDB.student,stuDB);
  }catch(e){errEl.textContent='เกิดข้อผิดพลาด: '+e.message;}
}

function logout(){
  if(scanning)stopScan();
  _currentStuId=null;
  _currentStuDB=null;
  _currentStuTeacher=null;
  STU_SELECTED_TEACHER=null;
  CURRENT_TEACHER=null;
  if(USE_SUPABASE&&SB){SB.auth.signOut().catch(()=>{});}
  showScreen('s-login');
  // Reset student teacher dropdown on logout
  setTimeout(()=>{
    if(USE_SUPABASE) loadTeacherListForStudent();
  }, 300);
}

let _currentStuDB = null;   // temp DB for student view
let _currentStuTeacher = null; // teacher info for student view

function renderStudentView(s, stuDB){
  const db = stuDB || {student:s, homeworks:db.homeworks, submissions:db.submissions};
  const teacher = _currentStuTeacher;
  document.getElementById('stu-avatar').textContent=s.name.substring(0,2);
  document.getElementById('stu-display-name').textContent=s.name;
  document.getElementById('stu-display-room').textContent='ห้อง '+s.room+' · รหัส '+s.id+(teacher?' · ครู: '+teacher.display_name:'');
  const done=db.homeworks.filter(h=>db.submissions[s.id+'_'+h.num]);
  const miss=db.homeworks.filter(h=>!db.submissions[s.id+'_'+h.num]);
  const pct=db.homeworks.length?Math.round(done.length/db.homeworks.length*100):0;
  let html=`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
    <div class="scard" style="background:linear-gradient(135deg,#DCFCE7,#BBF7D0);border:1.5px solid #86EFAC;"><div class="snum" style="color:#16A34A;">${done.length}</div><div class="slbl">✅ ส่งแล้ว</div></div>
    <div class="scard" style="background:linear-gradient(135deg,#FEE2E2,#FECACA);border:1.5px solid #FCA5A5;"><div class="snum" style="color:#B91C1C;">${miss.length}</div><div class="slbl">❌ ยังไม่ส่ง</div></div>
  </div>
  <div class="card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:14px;color:var(--text2);font-weight:600;">ความคืบหน้า</span><span style="font-size:16px;font-weight:700;color:${pct===100?'var(--green-dark)':'var(--blue)'};">${pct}%</span></div><div class="prog-bar" style="height:10px;"><div class="prog-fill" style="width:${pct}%;"></div></div></div>`;
  if(!db.homeworks.length){html+='<div class="empty">ยังไม่มีรายการงาน</div>';}
  else{
  // จัดกลุ่มตามวิชา
  const subjects = {};
  db.homeworks.forEach(h => {
    const subj = h.subject || 'ไม่ระบุวิชา';
    if(!subjects[subj]) subjects[subj] = [];
    subjects[subj].push(h);
  });

  Object.entries(subjects).forEach(([subj, hws]) => {
    const doneInSubj = hws.filter(h => db.submissions[s.id+'_'+h.num]).length;
    const pctSubj = Math.round(doneInSubj/hws.length*100);
    const pctColor = pctSubj===100?'var(--green-dark)':pctSubj>=60?'var(--blue)':'var(--red)';

    html += `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:800;color:var(--purple);background:var(--purple-light);padding:4px 12px;border-radius:20px;">📚 ${subj}</span>
        </div>
        <span style="font-size:13px;font-weight:700;color:${pctColor};">${doneInSubj}/${hws.length} (${pctSubj}%)</span>
      </div>
      <div style="height:4px;background:var(--bg);border-radius:2px;margin-bottom:10px;overflow:hidden;">
        <div style="height:100%;width:${pctSubj}%;background:${pctColor};border-radius:2px;transition:width .5s;"></div>
      </div>
      <div class="my-hw-card" style="margin-bottom:0;">`;

    hws.forEach(h => {
      const sub = db.submissions[s.id+'_'+h.num];
      html += `<div class="my-hw-row" style="flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;color:var(--text);">ชิ้นที่ ${h.num}: ${h.title}</div>
          ${h.deadline?`<div style="font-size:11px;color:var(--text3);margin-top:2px;">กำหนดส่ง: ${new Date(h.deadline).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})}</div>`:''}
          ${h.fileUrl?`<a href="${h.fileUrl}" target="_blank" download="${h.fileName||'homework'}" style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:5px 12px;background:linear-gradient(135deg,var(--blue),var(--purple));color:#fff;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(79,142,247,0.3);">⬇️ ดาวน์โหลดไฟล์งาน</a>`:''}
        </div>
        ${sub
          ? `<div class="hw-status-ok">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
              ${sub.score!==null&&sub.score!==undefined
                ? sub.score+'/'+(sub.maxScore||h.maxScore||100)+' คะแนน'
                : '✓ ส่งแล้ว'}
            </div>`
          : `<div class="hw-status-no">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
              ยังไม่ส่ง
            </div>`
        }
      </div>`;
    });

    html += `</div></div>`;
  });
}
      
  document.getElementById('stu-content').innerHTML=html;
}
async function refreshStudentView(){
  if(!_currentStuId || !_currentStuTeacher) return;
  const tid = _currentStuTeacher.id;
  
  // โหลดทั้ง submissions และ homeworks
  const [subRes, hwRes] = await Promise.all([
    SB.from('submissions').select('*').eq('student_id', _currentStuId).eq('teacher_id', tid),
    SB.from('homeworks').select('*').eq('teacher_id', tid).order('num')
  ]);

  // อัพเดต homeworks
  _currentStuDB.homeworks = (hwRes.data||[]).map(r=>({
    num:r.num, title:r.title, subject:r.subject||'', maxScore:r.max_score||100,
    deadline:r.deadline||'', fileUrl:r.file_url||'', fileName:r.file_name||''
  }));

  // อัพเดต submissions
  const subs = {};
  (subRes.data||[]).forEach(r => {
    subs[r.student_id+'_'+r.hw_num] = {
      sid:r.student_id, hwNum:r.hw_num, hwTitle:r.hw_title,
      room:r.room, score: r.score !== null && r.score !== undefined ? Number(r.score) : null, maxScore:r.max_score||100,
      ts:r.submitted_at ? new Date(r.submitted_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : ''
    };
  });
  _currentStuDB.submissions = subs;

  renderStudentView(_currentStuDB.student, _currentStuDB);
}
function showAP(id,btn){
  // Feature flag gate
  if(id==='attend') {
    if(!checkFeatureGate('attendance','เช็คชื่อ')) return;
    if(!isPremium()) { showUpgradeModal('🔒 ฟีเจอร์เช็คชื่อสำหรับ Premium เท่านั้น'); return; }
  }
  // sync sidebar nav items
  ['scan','dash','manage','attend'].forEach(function(p){
    var sn = document.getElementById('snav-'+p);
    if(sn) sn.classList.toggle('on', p===id);
  });
  document.querySelectorAll('#s-admin .page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('on'));
  document.getElementById('ap-'+id).classList.add('on');
  btn.classList.add('on');
  if(id==='dash') renderDashboard();
  if(id==='manage') renderManage();
  if(id==='attend') initAttendanceTab();
}

function ts(){return new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});}

let hwAutoSaveTimer=null;

function populateScanSelects(){
  populateHWDropdown();
  const ss=document.getElementById('hw-subj-input');
  if(ss)ss.innerHTML=getSubjectNames().map(n=>`<option>${n}</option>`).join('');
  const saved=lsGet('hw_current');
  if(saved){
    if(document.getElementById('hw-num-input'))document.getElementById('hw-num-input').value=saved.num||'';
    if(document.getElementById('hw-title-input'))document.getElementById('hw-title-input').value=saved.title||'';
    if(ss&&saved.subject)ss.value=saved.subject;
    const msEl=document.getElementById('hw-maxscore-input');
    if(msEl&&saved.maxScore)msEl.value=saved.maxScore;
  } else if(DB.homeworks.length){
    const h=DB.homeworks[0];
    if(document.getElementById('hw-num-input'))document.getElementById('hw-num-input').value=h.num;
    if(document.getElementById('hw-title-input'))document.getElementById('hw-title-input').value=h.title;
    if(ss)ss.value=h.subject;
    const msEl2=document.getElementById('hw-maxscore-input');
    if(msEl2)msEl2.value=h.maxScore||100;
  }
  updateConflictWarn();
}

async function onHWFieldChange(){
  const badge=document.getElementById('hw-save-badge');
  if(badge)badge.style.display='none';
  clearTimeout(hwAutoSaveTimer);
  hwAutoSaveTimer=setTimeout(async()=>{
    const num=parseInt(document.getElementById('hw-num-input').value);
    const title=document.getElementById('hw-title-input').value.trim();
    const subject=document.getElementById('hw-subj-input').value;
    const maxScore=parseInt(document.getElementById('hw-maxscore-input').value)||100;
    if(!num||!title)return;
    // ตรวจ plan limit ถ้าเป็นงานใหม่
    const isNewHWAutoSave = !DB.homeworks.find(h => h.num === num);
    if(isNewHWAutoSave) {
      const autoSaveLimit = checkPlanLimit('homework');
      if(!autoSaveLimit.ok) { toast(autoSaveLimit.msg, 'warn'); return; }
    }
    await sbAddHomework({num,title,subject,maxScore});
    lsSet('hw_current',{num,title,subject,maxScore});
    if(badge){badge.style.display='';setTimeout(()=>badge.style.display='none',2000);}
    updateConflictWarn();
  },600);
}

function updateConflictWarn(){
  const num=parseInt(document.getElementById('hw-num-input')?.value);
  const title=document.getElementById('hw-title-input')?.value.trim();
  const warn=document.getElementById('hw-conflict-warn');
  if(!warn)return;
  const existing=num&&DB.homeworks.find(h=>h.num===num);
  if(existing&&title&&existing.title!==title){warn.textContent=`⚠️ งานครั้งที่ ${num} มีอยู่แล้ว: "${existing.title}" — จะถูกแทนที่เมื่อบันทึก`;warn.style.display='block';}
  else{warn.style.display='none';}
}

async function recordScan(sid, scoreOverride){
  if(!checkFeatureGate('barcode_scan','สแกนบาร์โค้ด', false)) return;
  sid=sid.trim();
  const hwNum=parseInt(document.getElementById('hw-num-input').value)||1;
  const hwTitle=document.getElementById('hw-title-input').value.trim()||'ชิ้นที่ '+hwNum;
  const maxScore=parseInt(document.getElementById('hw-maxscore-input')?.value)||100;
  let score=null;
  if(scoreOverride!==undefined&&scoreOverride!==null&&scoreOverride!==''){
    score=parseFloat(scoreOverride);
  } else {
    // อ่านจาก scan-score-input ก่อน (UI ใหม่)
    const scanScoreEl=document.getElementById('scan-score-input');
    if(scanScoreEl&&scanScoreEl.value!==''){
      score=parseFloat(scanScoreEl.value);
    } else {
      // fallback: manual-score เดิม
      const scoreEl=document.getElementById('manual-score');
      if(scoreEl&&scoreEl.value!==''){score=parseFloat(scoreEl.value);scoreEl.value='';}
    }
  }
  const stu=DB.students.find(s=>s.id===sid);
  const key=sid+'_'+hwNum;
  const log=document.getElementById('scan-log');
  const empty=log.querySelector('.empty');
  if(empty)empty.remove();
  const item=document.createElement('div');
  item.className='log-item';

  if(!stu){
    item.innerHTML=`<div class="log-main"><div>รหัส <b>${sid}</b></div><div class="log-sub">ไม่พบในระบบ</div></div><span class="badge b-err">ไม่พบ</span>`;
    log.prepend(item);
    toast('ไม่พบรหัส '+sid,'err');
  } else if(DB.submissions[key]&&scoreOverride===undefined){
    item.innerHTML=`<div class="log-main"><div style="font-weight:700;">${stu.name}</div><div class="log-sub">งานชิ้นที่ ${hwNum} ส่งซ้ำ</div></div><span class="badge b-dup">ซ้ำ</span>`;
    log.prepend(item);
    toast(stu.name+' ส่งงานนี้แล้ว','warn');
  } else {
    const now=ts();
    const scoreText=score!==null&&!isNaN(score)?score:null;
    try {
      await sbRecordSubmission({sid,hwNum,hwTitle,room:stu.room,score:scoreText,maxScore});
      const scoreBadge=scoreText!==null?` · <b style="color:var(--purple);">${scoreText}/${maxScore||100}</b>`:'';
      item.innerHTML=`<div class="log-main"><div style="font-weight:700;">${stu.name} <span class="room-pill">${stu.room}</span></div><div class="log-sub">ชิ้นที่ ${hwNum}: ${hwTitle}${scoreBadge} · ${now}</div></div><span class="badge b-ok">✓ บันทึก</span>`;
      log.prepend(item);
      toast('บันทึก '+stu.name+(scoreText!==null?' ('+scoreText+'/'+maxScore+')':'')+'✅');
playScanSuccess();
      showScanSuccessPopup(stu.name, hwNum, hwTitle, scoreText, maxScore);
      stopScan();
    } catch(e) {
      item.innerHTML=`<div class="log-main"><div style="font-weight:700;">${stu.name}</div><div class="log-sub">บันทึกไม่สำเร็จ: ${e.message}</div></div><span class="badge b-err">Error</span>`;
      log.prepend(item);
      toast('บันทึกไม่สำเร็จ: '+e.message,'err');
    }
  }
  document.getElementById('scan-count').textContent=log.querySelectorAll('.log-item').length+' รายการ';
}

function submitManual(){const v=document.getElementById('manual-id').value.trim();if(v){recordScan(v);document.getElementById('manual-id').value='';}}

// ===== MOBILE UX HELPERS =====
function dismissKeyboard(){
  // Blur active input to dismiss mobile keyboard
  if(document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
}

// Auto-dismiss keyboard when scrolling starts
let _touchStartY = 0;
document.addEventListener('touchstart', e => { _touchStartY = e.touches[0].clientY; }, {passive:true});
document.addEventListener('touchmove', e => {
  if(Math.abs(e.touches[0].clientY - _touchStartY) > 10) dismissKeyboard();
}, {passive:true});

// Prevent double-tap zoom on buttons
document.addEventListener('dblclick', e => {
  if(e.target.tagName === 'BUTTON' || e.target.closest('button')) e.preventDefault();
});

function toggleScan(){if(!scanning)startScan();else stopScan();}

let _scanCooldown=false;
let _scanCooldownTimer=null;
const SCAN_COOLDOWN_MS=2500;

function startScan(){
  const ph=document.getElementById('scan-ph');
  if(ph)ph.style.display='none';
  _scanCooldown=false;
  qr=new Html5Qrcode('reader');
  qr.start(
    {facingMode:'environment'},
    {fps:5,qrbox:{width:200,height:200}},
    t=>{
      if(_scanCooldown)return;
      _scanCooldown=true;
      recordScan(t);
      showScanCooldown();
      clearTimeout(_scanCooldownTimer);
      _scanCooldownTimer=setTimeout(()=>{_scanCooldown=false;hideScanCooldown();},SCAN_COOLDOWN_MS);
    },
    ()=>{}
  ).then(()=>{
    scanning=true;
    const b=document.getElementById('scan-toggle');
    b.textContent='⏹ หยุดสแกน';
    b.className='btn-lg btn-scan-stop';
  }).catch(()=>{
    toast('ไม่สามารถเปิดกล้องได้','err');
    if(ph)ph.style.display='';
  });
}

function showScanCooldown(){
  let el=document.getElementById('scan-cooldown-overlay');
  if(!el){
    el=document.createElement('div');
    el.id='scan-cooldown-overlay';
    el.style.cssText='position:absolute;inset:0;background:rgba(34,197,94,0.25);display:flex;align-items:center;justify-content:center;border-radius:12px;pointer-events:none;';
    el.innerHTML='<div style="background:#fff;border-radius:12px;padding:8px 18px;font-size:15px;font-weight:700;color:var(--green-dark);box-shadow:0 2px 8px rgba(0,0,0,0.15);">✅ บันทึกแล้ว — รอสแกนครั้งถัดไป</div>';
    const wrap=document.getElementById('scanner-wrap');
    if(wrap){wrap.style.position='relative';wrap.appendChild(el);}
  }
  el.style.display='flex';
}
function hideScanCooldown(){const el=document.getElementById('scan-cooldown-overlay');if(el)el.style.display='none';}

function playScanSuccess(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [880,1320].forEach((freq,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type='sine';osc.frequency.value=freq;
      const t=ctx.currentTime+i*0.15;
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(0.4,t+0.02);gain.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      osc.start(t);osc.stop(t+0.25);
    });
  }catch(e){}
}
function showScanSuccessPopup(stuName,hwNum,hwTitle,score,maxScore){
  document.getElementById('popup-stu-name').textContent=stuName;
  document.getElementById('popup-hw-detail').textContent=`งานครั้งที่ ${hwNum}: ${hwTitle}`;
  const scoreEl=document.getElementById('popup-score');
  if(score!==null&&score!==undefined){scoreEl.textContent=`คะแนน: ${score} / ${maxScore}`;scoreEl.style.display='';}
  else{scoreEl.textContent='';scoreEl.style.display='none';}
  document.getElementById('scan-success-overlay').classList.add('on');
}
function closeScanSuccess(){document.getElementById('scan-success-overlay').classList.remove('on');}

function stopScan(){
  if(qr){
    clearTimeout(_scanCooldownTimer);
    _scanCooldown=false;
    hideScanCooldown();
    qr.stop().then(()=>{
      scanning=false;
      const b=document.getElementById('scan-toggle');
      b.textContent='📷 เปิดกล้องสแกน';
      b.className='btn-lg btn-scan-go';
      const ph=document.getElementById('scan-ph');
      if(ph)ph.style.display='';
    });
  }
}

function renderDashboard(){
  renderPlanBanner();
  const rooms=[...new Set(DB.students.map(s=>s.room))].sort();
  const totalSubs=Object.keys(DB.submissions).length;
  document.getElementById('stats-grid').innerHTML=`
    <div class="scard"><div class="snum">${DB.students.length}</div><div class="slbl">👨‍🎓 นักเรียนทั้งหมด</div></div>
    <div class="scard"><div class="snum" style="color:var(--green-dark);">${totalSubs}</div><div class="slbl">✅ ส่งงานแล้ว (ครั้ง)</div></div>
    <div class="scard"><div class="snum" style="color:var(--purple);">${DB.homeworks.length}</div><div class="slbl">📝 งานทั้งหมด</div></div>
    <div class="scard"><div class="snum" style="color:#B45309;">${rooms.length}</div><div class="slbl">🏫 ห้องเรียน</div></div>`;
  document.getElementById('room-tabs').innerHTML=
    `<button class="rtab ${curRoom==='all'?'on':''}" onclick="setRoom('all')">ทุกห้อง</button>`+
    rooms.map(r=>`<button class="rtab ${curRoom===r?'on':''}" onclick="setRoom('${r}')">${r}</button>`).join('');
  renderTable();
}

function setRoom(r){curRoom=r;renderDashboard();}

function renderTable(){
  const q=(document.getElementById('srch').value||'').toLowerCase();
  const sl=document.getElementById('stu-list');
  // ซ่อนรายชื่อถ้าไม่ได้พิมพ์ค้นหา
  if(!q){
    sl.innerHTML='<div class="empty" style="padding:24px 0;">🔍 พิมพ์ชื่อหรือรหัสนักเรียนเพื่อค้นหา</div>';
    return;
  }
  let list=DB.students;
  if(curRoom!=='all')list=list.filter(s=>s.room===curRoom);
  if(q)list=list.filter(s=>s.id.includes(q)||s.name.toLowerCase().includes(q));
  if(!list.length){sl.innerHTML='<div class="empty">ไม่พบนักเรียน</div>';return;}
  sl.innerHTML=list.map(s=>{
    const done=DB.homeworks.filter(h=>DB.submissions[s.id+'_'+h.num]).length;
    const pct=DB.homeworks.length?Math.round(done/DB.homeworks.length*100):0;
    const dots = DB.homeworks.map(h => {
  const sub = DB.submissions[s.id+'_'+h.num];
  const scoreLabel = (sub && sub.score !== null && sub.score !== undefined) ? sub.score : '';
  const onclick = sub ? `openEditScore('${s.id}',${h.num})` : '';
  return `<div class="hw-dot ${sub?'dot-ok':'dot-no'}"
    style="cursor:${sub?'pointer':'default'};"
    onclick="${onclick}">
    ${scoreLabel!==''?`<span style="font-size:10px;">${scoreLabel}</span>`:h.num}
  </div>`;
}).join('');
    return `<div class="stu-row" onclick="showDetail('${s.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div class="stu-name">${s.name}</div><div class="stu-meta">${s.id} · <span class="room-pill">${s.room}</span></div></div>
        <div style="text-align:right;font-size:14px;margin-top:2px;">
          <span style="font-weight:700;color:var(--green-dark);font-size:16px;">${done}</span>
          <span style="color:var(--text3);">/${DB.homeworks.length}</span>
          ${(()=>{let sc=0,mx=0;DB.homeworks.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub){const ms=sub.maxScore||h.maxScore||100;sc+=(sub.score!==null&&sub.score!==undefined?sub.score:ms);mx+=ms;}else{mx+=h.maxScore||100;}});return mx>0?`<span style="font-size:12px;color:var(--purple);font-weight:700;margin-left:4px;">${sc}/${mx}</span>`:'';})()}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin:8px 0 4px;">
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;"></div></div>
        <span style="font-size:12px;color:var(--text2);min-width:32px;text-align:right;font-weight:600;">${pct}%</span>
      </div>
      <div class="dots-row">${dots}</div>
    </div>`;
  }).join('');
}

function showDetail(sid){
  const s=DB.students.find(x=>x.id===sid);
  if(!s)return;
  const done=DB.homeworks.filter(h=>DB.submissions[s.id+'_'+h.num]);
  const miss=DB.homeworks.filter(h=>!DB.submissions[s.id+'_'+h.num]);
  const p=document.getElementById('detail-panel');
  p.style.display='block';
  p.innerHTML=`<div class="detail-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div><div style="font-size:16px;font-weight:700;">${s.name}</div><div style="font-size:13px;color:var(--text2);margin-top:2px;">${s.id} · <span class="room-pill">${s.room}</span></div></div>
      <button onclick="document.getElementById('detail-panel').style.display='none'" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:#fff;cursor:pointer;font-size:16px;color:var(--text2);display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:6px;">✅ ส่งแล้ว (${done.length})</div>
    ${done.map(h=>{const sub=DB.submissions[s.id+'_'+h.num];const scoreStr=(sub.score!==null&&sub.score!==undefined)?`<span style="font-size:12px;font-weight:700;color:var(--purple);background:var(--purple-light);padding:2px 8px;border-radius:10px;">${sub.score}/${sub.maxScore||h.maxScore||100}</span>`:'';;return `<div class="ds-row"><span>${h.title} ${scoreStr}</span><span style="font-size:12px;color:var(--text3);">${sub.ts}</span></div>`;}).join('')||'<div style="font-size:13px;color:var(--text3);padding:6px 0;">ยังไม่มี</div>'}
    <div style="font-size:13px;font-weight:700;color:var(--red);margin:12px 0 6px;">❌ ยังไม่ส่ง (${miss.length})</div>
    ${miss.map(h=>`<div class="ds-row"><span>${h.title}</span><span style="font-size:12px;color:var(--text2);">${h.subject}</span></div>`).join('')||'<div style="font-size:13px;color:var(--green-dark);padding:6px 0;">🎉 ส่งครบทุกชิ้น!</div>'}
  </div>`;
  p.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function openEditStu(id){
  const s=DB.students.find(x=>x.id===id);if(!s)return;
  // รวมห้องจาก DB.rooms + ห้องจากนักเรียนทั้งหมด เผื่อ settings ยังไม่โหลด
  const allRooms=[...new Set([...DB.rooms,...DB.students.map(x=>x.room)])].filter(Boolean).sort();
  // ถ้าห้องของนักเรียนคนนี้ไม่อยู่ใน list ให้เพิ่มเข้าไปด้วย
  if(s.room&&!allRooms.includes(s.room))allRooms.push(s.room);
  document.getElementById('edit-stu-old-id').value=s.id;
  document.getElementById('edit-stu-id').value=s.id;
  document.getElementById('edit-stu-name').value=s.name;
  document.getElementById('edit-stu-room').innerHTML=allRooms.length
    ?allRooms.map(r=>`<option ${r===s.room?'selected':''}>${r}</option>`).join('')
    :`<option>${s.room||'ไม่มีห้อง'}</option>`;
  document.getElementById('edit-stu-modal').style.display='flex';
}
function closeEditStu(){document.getElementById('edit-stu-modal').style.display='none';}
async function saveEditStu(){
  showActionPopup('กำลังบันทึกข้อมูล','แก้ไขข้อมูลนักเรียน','edit');
  const oldId=document.getElementById('edit-stu-old-id').value;
  const newId=document.getElementById('edit-stu-id').value.trim();
  const newName=document.getElementById('edit-stu-name').value.trim();
  const newRoom=document.getElementById('edit-stu-room').value;
  if(!newId||!newName){toast('กรอกให้ครบ','warn');return;}
  if(newId!==oldId&&DB.students.find(x=>x.id===newId)){toast('รหัสนี้มีอยู่แล้ว','warn');return;}
  try {
    await sbUpdateStudent(oldId,{id:newId,name:newName,room:newRoom});
    renderManage();closeEditStu();toast('แก้ไข '+newName+' เรียบร้อย ✅');
  } catch(e){toast('แก้ไขไม่สำเร็จ: '+e.message,'err');}
}

async function openEditScore(sid,hwNum){
  const key=sid+'_'+hwNum;
  const sub=DB.submissions[key];
  const hw=DB.homeworks.find(h=>h.num===parseInt(hwNum));
  if(!sub)return;
  const cur=(sub.score!==null&&sub.score!==undefined)?sub.score:'';
  const max=sub.maxScore||hw?.maxScore||100;
  const newScore=prompt(`แก้ไขคะแนน ${DB.students.find(s=>s.id===sid)?.name||sid}\nงานครั้งที่ ${hwNum} (เต็ม ${max})\nคะแนนปัจจุบัน: ${cur!==''?cur:'ยังไม่ได้กรอก'}`,cur);
  if(newScore===null)return;
  const parsed=newScore.trim()===''?null:parseFloat(newScore);
  if(newScore.trim()!==''&&isNaN(parsed)){toast('กรุณากรอกตัวเลข','warn');return;}
  try {
    await sbUpdateScore(sid,parseInt(hwNum),parsed);
    renderDashboard();toast('บันทึกคะแนนแล้ว ✅');
  } catch(e){toast('บันทึกคะแนนไม่สำเร็จ: '+e.message,'err');}
}

let xlImportData=[];
function downloadTemplate(){
  const wb=XLSX.utils.book_new();
  const wsData=[['เลขประจำตัว','ชื่อ-สกุล','ห้อง'],['67001','สมชาย ใจดี','ม.1/1'],['67002','สมหญิง แสนสวย','ม.1/1'],['67003','วิทย์ รู้มาก','ม.1/2']];
  const ws=XLSX.utils.aoa_to_sheet(wsData);ws['!cols']=[{wch:16},{wch:28},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,'รายชื่อนักเรียน');XLSX.writeFile(wb,'template_รายชื่อนักเรียน.xlsx');
  toast('ดาวน์โหลด Template แล้ว ✅');
}

function handleXLUpload(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const data=new Uint8Array(ev.target.result);
      const wb=XLSX.read(data,{type:'array'});
      const validSheets=wb.SheetNames.filter(n=>{const ws=wb.Sheets[n];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});return rows.length>3;});
      if(validSheets.length>1){parseMultiSheet(wb,validSheets,file.name);}
      else{const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});parseXLRows(rows,file.name);}
    }catch(err){toast('อ่านไฟล์ไม่ได้: '+err.message,'err');}
  };
  reader.readAsArrayBuffer(file);e.target.value='';
}

function parseMultiSheet(wb,sheetNames,filename){
  xlImportData=[];
  sheetNames.forEach(sheetName=>{
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(!rows.length)return;
    const r0=String(rows[0]?.[0]||'');
    const isBanchang=r0.includes('รายชื่อนักเรียน')||r0.includes('มัธยม')||r0.includes('ประถม');
    let roomFromTitle='';
    if(isBanchang){const m=r0.match(/ที่\s*(\d+\/\d+)/);if(m)roomFromTitle='ม.'+m[1];else{const m2=r0.match(/(\d+\/\d+)/);if(m2)roomFromTitle='ม.'+m2[1];}}
    if(!roomFromTitle)roomFromTitle=sheetName;
    let headerIdx=2;
    for(let i=0;i<Math.min(6,rows.length);i++){const cells=(rows[i]||[]).map(c=>String(c));if(cells.some(c=>c.includes('เลขที่'))&&cells.some(c=>c.includes('เลขประจำตัว'))){headerIdx=i;break;}}
    const hdr=(rows[headerIdx]||[]).map(c=>String(c).trim());
    let colId=1,colTitle=3,colFirst=4,colLast=5;
    hdr.forEach((h,i)=>{if((h.includes('เลขประจำตัวนร')||(h.includes('เลขประจำตัว')&&!h.includes('ประชาชน')))&&i>0)colId=i;if(h.includes('ชื่อ')&&!h.includes('สกุล')&&!h.includes('โรงเรียน')&&i>colId)colFirst=i;if(h.includes('สกุล')&&!h.includes('ชื่อ'))colLast=i;});
    if(colFirst===colLast||colFirst===colTitle){colFirst=colTitle+1;colLast=colTitle+2;}
    rows.slice(headerIdx+1).forEach(r=>{
      if(!r||r.every(c=>c===null||c===undefined||String(c).trim()===''))return;
      const rawId=String(r[colId]||'').trim().replace(/\.0+$/,'');
      if(!rawId||!/^\d+$/.test(rawId))return;
      const prefix=String(r[colTitle]||'').trim();
      const firstName=String(r[colFirst]||'').trim();
      const lastName=String(r[colLast]||'').trim();
      const fullName=[prefix,firstName,lastName].filter(Boolean).join(' ');
      if(!fullName)return;
      xlImportData.push({id:rawId,name:fullName,room:roomFromTitle});
    });
  });
  if(!xlImportData.length){toast('ไม่พบข้อมูลในไฟล์','warn');return;}
  renderXLPreview(`${filename} (${sheetNames.length} ห้อง)`);
}

function parseXLRows(rows,filename){
  if(!rows.length){toast('ไฟล์ว่างเปล่า','warn');return;}
  function detectBanchang(rows){const r0=String(rows[0]?.[0]||'');const r2=rows[2]||[];const isTitleRow=r0.includes('รายชื่อนักเรียน')||r0.includes('มัธยม')||r0.includes('ประถม');const hasHeader=r2.some(c=>String(c).includes('เลขที่')||String(c).includes('เลขประจำตัว'));return isTitleRow||hasHeader;}
  function extractRoomFromTitle(titleStr){const m=titleStr.match(/ชั้น([^\s]+(?:\s*\d+\/\d+)?)|ที่\s*(\d+\/\d+)|(\d+\/\d+)/);if(m){const raw=(m[1]||m[2]||m[3]||'').trim();const m2=raw.match(/มัธยมศึกษาปีที่\s*(\d+\/\d+)/i);if(m2)return 'ม.'+m2[1];const m3=raw.match(/ประถมศึกษาปีที่\s*(\d+\/\d+)/i);if(m3)return 'ป.'+m3[1];if(/^\d+\/\d+$/.test(raw))return 'ม.'+raw;return raw;}return '';}
  const isBanchang=detectBanchang(rows);
  if(isBanchang){
    const title0=String(rows[0]?.[0]||'');const roomFromTitle=extractRoomFromTitle(title0);
    let headerIdx=2;
    for(let i=0;i<Math.min(6,rows.length);i++){const cells=(rows[i]||[]).map(c=>String(c));if(cells.some(c=>c.includes('เลขที่'))&&cells.some(c=>c.includes('เลขประจำตัว'))){headerIdx=i;break;}}
    const hdr=(rows[headerIdx]||[]).map(c=>String(c).trim());
    let colNum=-1,colId=-1,colTitle=-1,colFirst=-1,colLast=-1;
    hdr.forEach((h,i)=>{if(h.includes('เลขที่')&&colNum<0)colNum=i;if((h.includes('เลขประจำตัวนร')||h.includes('รหัส'))&&colId<0)colId=i;if(h.includes('ชื่อ')&&!h.includes('สกุล')&&!h.includes('โรงเรียน')&&colFirst<0)colFirst=i;if(h.includes('สกุล')&&!h.includes('ชื่อ')&&colLast<0)colLast=i;if(h.includes('คำนำหน้า')||h==='นาย'||h==='น.ส.'||h==='นาง')colTitle=i;});
    if(colNum<0)colNum=0;if(colId<0)colId=1;if(colTitle<0)colTitle=3;if(colFirst<0)colFirst=4;if(colLast<0)colLast=5;if(colFirst===colLast){colFirst=colTitle+1;colLast=colTitle+2;}
    xlImportData=[];
    rows.slice(headerIdx+1).forEach(r=>{
      if(!r||r.every(c=>c===null||c===undefined||String(c).trim()===''))return;
      const rawId=String(r[colId]||'').trim().replace(/\.0+$/,'');
      if(!rawId||!/^\d+$/.test(rawId))return;
      const prefix=String(r[colTitle]||'').trim();const firstName=String(r[colFirst]||'').trim();const lastName=String(r[colLast]||'').trim();
      const fullName=[prefix,firstName,lastName].filter(Boolean).join(' ');
      const room=roomFromTitle||DB.rooms[0]||'';if(!fullName)return;
      xlImportData.push({id:rawId,name:fullName,room});
    });
    renderXLPreview(filename+' (รูปแบบรายชื่อ รร.)');return;
  }
  let headerIdx=0,colMap={id:-1,name:-1,room:-1};
  for(let r=0;r<Math.min(5,rows.length);r++){const row=rows[r].map(c=>String(c).trim().toLowerCase());row.forEach((cell,ci)=>{if(cell.includes('เลข')&&(cell.includes('ประจำ')||cell.includes('id')))colMap.id=ci;else if(cell==='id'||cell==='student_id'||cell==='รหัส')colMap.id=ci;if(cell.includes('ชื่อ')||cell.includes('name'))colMap.name=ci;if(cell.includes('ห้อง')||cell.includes('room')||cell.includes('class'))colMap.room=ci;});if(colMap.id>=0&&colMap.name>=0){headerIdx=r;break;}}
  if(colMap.id<0)colMap.id=0;if(colMap.name<0)colMap.name=1;if(colMap.room<0)colMap.room=2;
  const dataRows=rows.slice(headerIdx+1).filter(r=>String(r[colMap.id]).trim());
  if(!dataRows.length){toast('ไม่พบข้อมูลในไฟล์','warn');return;}
  xlImportData=dataRows.map(r=>({id:String(r[colMap.id]).trim(),name:String(r[colMap.name]).trim(),room:String(r[colMap.room]||'').trim()})).filter(r=>r.id&&r.name);
  renderXLPreview(filename);
}

function renderXLPreview(filename){
  const preview=document.getElementById('xl-preview');
  const infoEl=document.getElementById('xl-preview-info');
  const warnEl=document.getElementById('xl-preview-warn');
  const tbody=document.getElementById('xl-preview-body');
  let dupCount=0,noRoomCount=0,warnings=[];
  const rows=xlImportData.map(s=>{
    const isDup=!!DB.students.find(x=>x.id===s.id);const noRoom=!s.room;
    if(isDup)dupCount++;if(noRoom)noRoomCount++;
    let badge='';
    if(isDup)badge='<span style="font-size:11px;background:#FEF3C7;color:#B45309;padding:2px 6px;border-radius:6px;font-weight:700;">ซ้ำ</span>';
    else if(noRoom)badge='<span style="font-size:11px;background:#FEE2E2;color:#B91C1C;padding:2px 6px;border-radius:6px;font-weight:700;">ไม่มีห้อง</span>';
    else badge='<span style="font-size:11px;background:#DCFCE7;color:#16A34A;padding:2px 6px;border-radius:6px;font-weight:700;">✓</span>';
    return `<tr><td style="font-size:12px;">${s.id}</td><td>${s.name}</td><td style="font-size:12px;">${s.room||'—'}</td><td>${badge}</td></tr>`;
  }).join('');
  tbody.innerHTML=rows;
  const newCount=xlImportData.length-dupCount;
  infoEl.textContent=`📂 ${filename} · พบ ${xlImportData.length} รายการ · ใหม่ ${newCount} · ซ้ำ ${dupCount}`;
  if(dupCount>0||noRoomCount>0){warnings=[];if(dupCount>0)warnings.push(`⚠️ พบรหัสซ้ำ ${dupCount} คน`);if(noRoomCount>0)warnings.push(`⚠️ ไม่มีห้อง ${noRoomCount} คน`);warnEl.innerHTML=warnings.join('<br>');warnEl.style.display='block';}
  else warnEl.style.display='none';
  const confirmBtn=document.getElementById('xl-confirm-btn');
  confirmBtn.textContent=`✅ นำเข้า ${newCount} รายการ`;confirmBtn.disabled=newCount===0;
  confirmBtn.style.opacity=newCount===0?'0.5':'1';
  preview.style.display='block';
}


function cancelXLImport(){xlImportData=[];document.getElementById('xl-preview').style.display='none';document.getElementById('xl-file').value='';document.getElementById('xl-preview-body').innerHTML='';}

async function addRoom(){
  const n=document.getElementById('n-room').value.trim();
  if(!n){toast('กรอกชื่อห้อง','warn');return;}
  if(DB.rooms.includes(n)){toast('ห้องนี้มีอยู่แล้ว','warn');return;}
  const limit = checkPlanLimit('room');
  if(!limit.ok){ showUpgradeModal(limit.msg); return; }
  showActionPopup('กำลังเพิ่มห้อง '+n,'','add');
  DB.rooms=[...DB.rooms,n].sort();
  await sbSaveSettings('rooms',DB.rooms);
  renderManage();actionPopupDone('เพิ่มห้อง '+n+' แล้ว','','add');
  document.getElementById('n-room').value='';
  //toast('เพิ่มห้อง '+n+' แล้ว');
  document.getElementById('n-room').value='';
}

async function delRoom(n){
  showActionPopup('กำลังลบห้อง',n,'delete');
  const stuInRoom=DB.students.filter(s=>s.room===n).length;
  const msg = stuInRoom>0
    ? 'ลบห้อง "'+n+'" และนักเรียน '+stuInRoom+' คนในห้องนี้?\n(ข้อมูลการส่งงานของนักเรียนในห้องนี้จะถูกลบด้วย)'
    : 'ยืนยันลบห้อง "'+n+'"?';
  if(!confirm(msg)) return;

  // ลบนักเรียนในห้องนี้ออกทั้งหมด (ทำให้ห้องหายจาก derived list)
  if(stuInRoom>0){
    const stusInRoom = DB.students.filter(s=>s.room===n).map(s=>s.id);
    if(USE_SUPABASE){
      const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
      // ลบ submissions ของนักเรียนในห้องนี้
      for(const sid of stusInRoom){
        await SB.from('submissions').delete().eq('student_id',sid).eq('teacher_id',tid);
        await SB.from('students').delete().eq('id',sid).eq('teacher_id',tid);
      }
      await reloadStudents();
      await reloadSubmissions();
    } else {
      DB.students = DB.students.filter(s=>s.room!==n);
      // ลบ submissions
      Object.keys(DB.submissions).forEach(k=>{
        if(stusInRoom.includes(k.split('_')[0])) delete DB.submissions[k];
      });
      saveDB();
    }
  }

  // ลบออกจาก DB.rooms settings
  DB.rooms = DB.rooms.filter(r=>r!==n);
  await sbSaveSettings('rooms', DB.rooms);
  actionPopupDone('ลบห้อง '+n+' แล้ว','','delete');
  renderManage();
  renderDashboard();
}

async function addStudent(){
  const id=document.getElementById('ns-id').value.trim();
  const name=document.getElementById('ns-name').value.trim();
  const room=document.getElementById('ns-room').value;
  if(!id||!name){toast('กรอกให้ครบ','warn');return;}
  if(DB.students.find(s=>s.id===id)){toast('รหัสนี้มีแล้ว','warn');return;}
  const limit = checkPlanLimit('student', room);
  if(!limit.ok){ showUpgradeModal(limit.msg); return; }
  showActionPopup('กำลังเพิ่มนักเรียน','รหัส '+id+' · '+name,'add');
  try{await sbAddStudent({id,name,room});renderManage();document.getElementById('ns-id').value='';document.getElementById('ns-name').value='';actionPopupDone('เพิ่มนักเรียนแล้ว ✅',name+' · '+room,'add');}
  catch(e){actionPopupError('เพิ่มไม่สำเร็จ: '+e.message);}
}

async function delStu(id){
  const s=DB.students.find(x=>x.id===id);
  if(!confirm('ลบนักเรียน '+(s?s.name:id)+'?'))return;
  showActionPopup('กำลังลบนักเรียน',s?s.name:id,'delete');
  try{await sbDeleteStudent(id);actionPopupDone('ลบนักเรียนแล้ว',s?s.name:id,'delete');renderManage();}
  catch(e){actionPopupError('ลบไม่สำเร็จ: '+e.message);}
}

async function addSubject(){
  const n=document.getElementById('n-subj').value.trim();
  if(!n||DB.subjects.includes(n)){toast('ชื่อซ้ำหรือว่าง','warn');return;}
  DB.subjects.push(n);
  await sbSaveSettings('subjects',DB.subjects);
  renderManage();toast('เพิ่มวิชา '+n);
  document.getElementById('n-subj').value='';
}

async function delSubj(n){
  DB.subjects=DB.subjects.filter(s=>s!==n);
  await sbSaveSettings('subjects',DB.subjects);
  renderManage();
}

async function addHW(){
  const num=parseInt(document.getElementById('n-hwnum').value);
  const title=document.getElementById('n-hwtitle').value.trim();
  const subject=document.getElementById('n-hwsubj').value;
  const maxScore=parseInt(document.getElementById('n-hwmaxscore')?.value)||100;
  if(!num||!title){toast('กรอกให้ครบ','warn');return;}
  if(DB.homeworks.find(h=>h.num===num)){toast('งานชิ้นที่ '+num+' มีแล้ว','warn');return;}
  const limit = checkPlanLimit('homework');
  if(!limit.ok){ showUpgradeModal(limit.msg); return; }
  try{await sbAddHomework({num,title,subject,maxScore});renderManage();toast('เพิ่มงานชิ้นที่ '+num);document.getElementById('n-hwnum').value='';document.getElementById('n-hwtitle').value='';}
  catch(e){toast('เพิ่มไม่สำเร็จ: '+e.message,'err');}
}

async function delHW(num){
  const h=DB.homeworks.find(x=>x.num===num);
  if(!confirm('ลบงานชิ้นที่ '+num+(h?' ('+h.title+')':'')+'?'))return;
  showActionPopup('กำลังลบชิ้นงาน','ครั้งที่ '+num+(h?' · '+h.title:''),'delete');
  try{await sbDeleteHomework(num);actionPopupDone('ลบชิ้นงานแล้ว','ครั้งที่ '+num+(h?' · '+h.title:''),'delete');renderManage();}
  catch(e){actionPopupError('ลบไม่สำเร็จ: '+e.message);}
}

async function clearScans(){
  if(!confirm('ล้างข้อมูลการส่งงานทั้งหมด?'))return;
  showActionPopup('กำลังล้างข้อมูล','ข้อมูลการส่งงานทั้งหมด','delete');
  if(USE_SUPABASE){
    const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    let delQ = SB.from('submissions').delete();
    if(tid) delQ=delQ.eq('teacher_id',tid); else delQ=delQ.neq('id','00000000-0000-0000-0000-000000000000');
    const {error}=await delQ;
    if(error){toast('ล้างไม่สำเร็จ: '+error.message,'err');return;}
    await reloadSubmissions();
  } else {
    DB.submissions={};saveDB();
  }
  actionPopupDone('ล้างข้อมูลสำเร็จ','ข้อมูลการส่งงานถูกล้างแล้ว','warn');
}

async function clearAllStudents(){
  const count=DB.students.length;
  if(!confirm(`ยืนยันลบรายชื่อนักเรียนทั้งหมด ${count} คน?\n\nข้อมูลการส่งงานทั้งหมดจะถูกลบด้วย`))return;
  if(USE_SUPABASE){
    const tid2 = CURRENT_TEACHER ? CURRENT_TEACHER.id : '';
    let dq1 = SB.from('submissions').delete();
    let dq2 = SB.from('students').delete();
    if(tid2){dq1=dq1.eq('teacher_id',tid2);dq2=dq2.eq('teacher_id',tid2);}
    else{dq1=dq1.neq('id','00000000-0000-0000-0000-000000000000');dq2=dq2.neq('id','');}
    await dq1;
    const {error}=await dq2;
    if(error){toast('ลบไม่สำเร็จ: '+error.message,'err');return;}
    await reloadStudents();await reloadSubmissions();
  } else {
    DB.students=[];DB.submissions=[];saveDB();
  }
  renderManage();actionPopupDone('ลบรายชื่อนักเรียนแล้ว','ลบ '+count+' คนสำเร็จ','delete');
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION I: EXPORT (PDF / EXCEL)                   ║
// ╚══════════════════════════════════════════════════════╝
// ===== EXPORT =====
let exportType='pdf',exportRoomSel=new Set(),exportHWSel=new Set();
function openExportModal(type){
  if(type==='excel' && !checkFeatureGate('export_excel','Export Excel')) return;
  if(type==='excel' && !isPremium()) { showUpgradeModal('Export Excel เฉพาะแพลน Premium 🔒'); return; }
  if(type==='pdf'   && !checkFeatureGate('export_pdf','Export PDF'))   return;
  exportType=type;
  document.getElementById('export-modal-title').textContent=type==='pdf'?'📄 Export PDF':'📊 Export Excel';
  document.getElementById('export-go-label').textContent=type==='pdf'?'ดาวน์โหลด PDF':'ดาวน์โหลด Excel';
  document.getElementById('export-go-icon').textContent=type==='pdf'?'📄':'📊';
  const rooms=[...new Set(DB.students.map(s=>s.room))].sort();
  exportRoomSel=new Set(rooms);
  const rg=document.getElementById('export-room-grid');
  rg.innerHTML=rooms.map(r=>`<button class="room-cb checked" data-room="${r}" onclick="toggleExportRoom(this,'${r}')"><span>✓</span> ${r}</button>`).join('');

  // Subject filter dropdown
  const subjSel = document.getElementById('export-subj-filter');
  if(subjSel) {
    subjSel.innerHTML = '<option value="">— ทุกวิชา —</option>' + getSubjectNames().map(n=>`<option value="${n}">${n}</option>`).join('');
    subjSel.value = '';
  }

  exportHWSel=new Set(DB.homeworks.map(h=>h.num));
  _renderExportHWList('');
  document.getElementById('export-progress-bar').classList.remove('on');
  document.getElementById('export-progress-fill').style.width='0%';
  document.getElementById('export-go-btn').disabled=false;
  document.getElementById('export-modal').classList.add('on');
  updateExportScorePreview();
}

function _renderExportHWList(subjFilter) {
  const hws = subjFilter
    ? DB.homeworks.filter(h=>h.subject===subjFilter)
    : DB.homeworks;
  exportHWSel = new Set(hws.map(h=>h.num));
  const hf=document.getElementById('export-hw-filter');
  hf.innerHTML=`<button class="hw-cb checked" data-hw="all" onclick="toggleAllHW(this)">ทุกชิ้น</button>`
    +hws.map(h=>`<button class="hw-cb checked" data-hw="${h.num}" onclick="toggleExportHW(this,${h.num})">ชิ้นที่ ${h.num} <span style="font-size:10px;opacity:.7;">/${h.maxScore||100}</span></button>`).join('');
  updateExportScorePreview();
}

function filterExportBySubject(val) {
  _renderExportHWList(val);
  // auto-fill คะแนนเก็บ from subject settings
  if(val) {
    const subj = DB.subjects.find(s=>(typeof s==='string'?s:s.name)===val);
    const collect = subj && typeof subj==='object' ? (subj.total||0) : 0;
    const inp = document.getElementById('export-collect-score');
    if(inp && collect) inp.value = collect;
    updateExportScorePreview();
  }
}

function updateExportScorePreview() {
  const selectedHWs = DB.homeworks.filter(h=>exportHWSel.has(h.num));
  const totalMax = selectedHWs.reduce((s,h)=>s+(h.maxScore||100),0);
  const maxEl = document.getElementById('export-total-max');
  if(maxEl) maxEl.textContent = totalMax;
  const maxEl2 = document.getElementById('export-total-max-2');
  if(maxEl2) maxEl2.textContent = totalMax;
  const collectInp = document.getElementById('export-collect-score');
  const collectScore = collectInp ? (parseFloat(collectInp.value)||0) : 0;
  const ratioEl = document.getElementById('export-score-ratio');
  if(ratioEl) {
    if(totalMax>0 && collectScore>0) {
      const ratio = Math.round(collectScore/totalMax*1000)/1000;
      ratioEl.textContent = `(raw × ${ratio})`;
      ratioEl.style.color = 'var(--green-dark)';
    } else {
      ratioEl.textContent = 'กรอกคะแนนเก็บ';
      ratioEl.style.color = 'var(--text3)';
    }
  }
}
function closeExportModal(){document.getElementById('export-modal').classList.remove('on');}
function toggleExportRoom(btn,room){if(exportRoomSel.has(room)){exportRoomSel.delete(room);btn.classList.remove('checked');btn.querySelector('span').textContent='';}else{exportRoomSel.add(room);btn.classList.add('checked');btn.querySelector('span').textContent='✓';}}
function toggleExportHW(btn,num){if(exportHWSel.has(num)){exportHWSel.delete(num);btn.classList.remove('checked');}else{exportHWSel.add(num);btn.classList.add('checked');}const allBtn=document.querySelector('#export-hw-filter [data-hw="all"]');if(allBtn)allBtn.classList.toggle('checked',exportHWSel.size===DB.homeworks.length);updateExportScorePreview();}
function toggleAllHW(btn){const allSelected=exportHWSel.size===DB.homeworks.length;document.querySelectorAll('#export-hw-filter [data-hw]:not([data-hw="all"])').forEach(b=>{const n=parseInt(b.dataset.hw);if(allSelected){exportHWSel.delete(n);b.classList.remove('checked');}else{exportHWSel.add(n);b.classList.add('checked');}});btn.classList.toggle('checked',!allSelected);updateExportScorePreview();}
function exportSelectAll(sel){document.querySelectorAll('#export-room-grid .room-cb').forEach(btn=>{const room=btn.dataset.room;if(sel){exportRoomSel.add(room);btn.classList.add('checked');btn.querySelector('span').textContent='✓';}else{exportRoomSel.delete(room);btn.classList.remove('checked');btn.querySelector('span').textContent='';}}); }
function getStudentNum(student, room) {
  const roomStudents = DB.students.filter(s => s.room === room).sort((a,b) => a.id.localeCompare(b.id));
  return roomStudents.findIndex(s => s.id === student.id) + 1;
}
function buildExportData(){
  const selectedRooms=[...exportRoomSel].sort();
  const selectedHWs=DB.homeworks.filter(h=>exportHWSel.has(h.num)).sort((a,b)=>a.num-b.num);
  const collectInp = document.getElementById('export-collect-score');
  const collectScore = collectInp ? (parseFloat(collectInp.value)||0) : 0;
  const hwTotalMax = selectedHWs.reduce((s,h)=>s+(h.maxScore||100),0);
  return selectedRooms.map(room=>{
    const students=DB.students.filter(s=>s.room===room).sort((a,b)=>a.id.localeCompare(b.id));
    const rows=students.map((s,idx)=>{
      const row={เลขที่:idx+1,เลขประจำตัว:s.id,'ชื่อ-นามสกุล':s.name,ห้อง:s.room};
      let totalScore=0,totalMax=0,doneCount=0;
      selectedHWs.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];const maxScore=sub?.maxScore||h.maxScore||100;if(sub){doneCount++;const sc=(sub.score!==null&&sub.score!==undefined)?sub.score:maxScore;totalScore+=sc;totalMax+=maxScore;row['งานครั้งที่ '+h.num]=(sub.score!==null&&sub.score!==undefined)?sub.score:'✓';}else{totalMax+=maxScore;row['งานครั้งที่ '+h.num]='—';}});
      row['ส่งแล้ว']=doneCount+'/'+selectedHWs.length;
      row['คะแนนรวม']=totalScore;
      row['คะแนนเต็มรวม']=hwTotalMax;
      row['%คะแนน']=totalMax>0?Math.round(totalScore/totalMax*100)+'%':'0%';
      if(collectScore>0 && hwTotalMax>0) {
        row['คะแนนเก็บ']=collectScore;
        row['คะแนนที่ได้']=Math.round(totalScore/hwTotalMax*collectScore*100)/100;
      }
      return row;
    });
    return{room,students,rows,homeworks:selectedHWs,collectScore,hwTotalMax};
  });
}
async function doExport(){
  if(exportRoomSel.size===0){toast('เลือกห้องอย่างน้อย 1 ห้อง','warn');return;}
  if(exportHWSel.size===0){toast('เลือกงานอย่างน้อย 1 ชิ้น','warn');return;}
  // ตรวจสอบ Plan สำหรับ Excel
  if(exportType==='excel'){
    const limit = checkPlanLimit('excel');
    if(!limit.ok){ showUpgradeModal(limit.msg); return; }
  }
  const btn=document.getElementById('export-go-btn');const pb=document.getElementById('export-progress-bar');const pf=document.getElementById('export-progress-fill');
  btn.disabled=true;pb.classList.add('on');pf.style.width='10%';
  try{
    const data=buildExportData();pf.style.width='40%';
    if(exportType==='excel'){
      const xlCheck = checkPlanLimit('excel');
      if(!xlCheck.ok){ btn.disabled=false;pb.classList.remove('on');pf.style.width='0%';showUpgradeModal(xlCheck.msg);return;}
      await exportExcel(data,pf);
    }else{await exportPDF(data,pf);}
    pf.style.width='100%';setTimeout(()=>{pb.classList.remove('on');pf.style.width='0%';closeExportModal();},800);
    toast('ดาวน์โหลดเสร็จแล้ว ✅');
  }catch(e){console.error(e);toast('เกิดข้อผิดพลาด: '+e.message,'err');}
  btn.disabled=false;
}
function exportExcel(data,pf){return new Promise(resolve=>{const wb=XLSX.utils.book_new();data.forEach((roomData,i)=>{const{room,rows,homeworks,collectScore,hwTotalMax}=roomData;const sheetName=room.replace(/[\\\/\?\*\[\]]/g,'').substring(0,31);const wsData=[];wsData.push([`รายงานการส่งงาน - ${room}`]);wsData.push([`งานที่รายงาน: ${homeworks.map(h=>'ครั้งที่ '+h.num+' '+h.title).join(', ')}`]);wsData.push([`วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}`]);wsData.push([]);const header=['เลขที่','เลขประจำตัว','ชื่อ-นามสกุล'];homeworks.forEach(h=>header.push('งานครั้งที่ '+h.num+'\n'+h.title.substring(0,15)+'\n(เต็ม '+(h.maxScore||100)+')'));const hasCollect = collectScore>0;
      header.push('ส่งแล้ว','คะแนนรวม',`คะแนนเต็ม(/${hwTotalMax})`,'%คะแนน');
      if(hasCollect) header.push(`คะแนนที่ได้(/${collectScore})`);
      wsData.push(header);rows.forEach(r=>{const row=[r['เลขที่'],r['เลขประจำตัว'],r['ชื่อ-นามสกุล']];homeworks.forEach(h=>row.push(r['งานครั้งที่ '+h.num]));row.push(r['ส่งแล้ว'],r['คะแนนรวม'],r['คะแนนเต็มรวม'],r['%คะแนน']);if(hasCollect)row.push(r['คะแนนที่ได้']??'');wsData.push(row);});const ws=XLSX.utils.aoa_to_sheet(wsData);ws['!cols']=[{wch:6},{wch:14},{wch:26},...homeworks.map(()=>({wch:14})),{wch:10},{wch:10},{wch:10},{wch:8},...(hasCollect?[{wch:14}]:[])];const totalCols=3+homeworks.length+(hasCollect?5:4)-1;ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:totalCols}},{s:{r:1,c:0},e:{r:1,c:totalCols}},{s:{r:2,c:0},e:{r:2,c:totalCols}}];XLSX.utils.book_append_sheet(wb,ws,sheetName);pf.style.width=(40+(i+1)/data.length*50)+'%';});const date=new Date().toISOString().slice(0,10);XLSX.writeFile(wb,`รายงานส่งงาน_${date}.xlsx`);resolve();});}
async function exportPDF(data,pf){const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});let html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet"><style>*{font-family:Sarabun,sans-serif;box-sizing:border-box;margin:0;padding:0;}body{font-size:11pt;color:#1E293B;}.page{padding:12mm 15mm;page-break-after:always;}.page:last-child{page-break-after:avoid;}.page-title{font-size:16pt;font-weight:700;color:#2563EB;margin-bottom:4px;}.page-meta{font-size:9pt;color:#64748B;margin-bottom:12px;border-bottom:2px solid #E2E8F0;padding-bottom:8px;}table{width:100%;border-collapse:collapse;font-size:10pt;}th{background:linear-gradient(135deg,#EBF2FF,#DBEAFE);color:#1E40AF;font-weight:700;padding:7px 6px;border:1px solid #BFDBFE;font-size:9pt;text-align:center;}td{padding:6px;border:1px solid #E2E8F0;vertical-align:middle;}tr:nth-child(even) td{background:#F8FAFF;}.num{text-align:center;color:#64748B;}.ok{text-align:center;color:#16A34A;font-weight:700;background:#DCFCE7!important;font-size:9pt;}.no{text-align:center;color:#94A3B8;font-size:9pt;}.pct-col{text-align:center;font-weight:700;}.footer{margin-top:8px;font-size:8pt;color:#94A3B8;text-align:right;}</style></head><body>`;data.forEach((roomData,i)=>{const{room,rows,homeworks,collectScore,hwTotalMax}=roomData;const dateStr=new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});html+=`<div class="page"><div class="page-title">📋 รายงานการส่งงาน — ${room}</div><div class="page-meta">งานที่รายงาน: ${homeworks.map(h=>'ครั้งที่ '+h.num+' ('+h.title+')').join(' · ')} &nbsp;|&nbsp; วันที่พิมพ์: ${dateStr} &nbsp;|&nbsp; นักเรียน ${rows.length} คน</div><table><thead><tr><th style="width:40px;">เลขที่</th><th style="width:90px;">เลขประจำตัว</th><th>ชื่อ-นามสกุล</th>${homeworks.map(h=>`<th style="width:65px;">งานครั้งที่ ${h.num}<br><span style="font-size:8pt;font-weight:400;">(/${h.maxScore||100})</span></th>`).join('')}<th style="width:50px;">ส่งแล้ว</th><th style="width:55px;">คะแนนรวม</th><th style="width:40px;">%</th>${collectScore>0?`<th style="width:60px;background:linear-gradient(135deg,#DCFCE7,#BBF7D0);color:#15803D;">คะแนนที่ได้<br><span style="font-size:7pt;font-weight:400;">(/${collectScore})</span></th>`:''}</tr></thead><tbody>${rows.map(r=>{const hwCells=homeworks.map(h=>{const v=r['งานครั้งที่ '+h.num];const isOk=v!==undefined&&v!=='—';const display=isOk?(typeof v==='number'?v:'✓'):'—';return `<td class="${isOk?'ok':'no'}">${display}</td>`;}).join('');const pct=parseInt(r['%คะแนน']);const pctColor=pct===100?'#16A34A':pct>=60?'#2563EB':'#EF4444';const totalScore=r['คะแนนรวม'];const totalMax=r['คะแนนเต็ม'];return `<tr><td class="num">${r['เลขที่']}</td><td class="num">${r['เลขประจำตัว']}</td><td>${r['ชื่อ-นามสกุล']}</td>${hwCells}<td class="pct-col">${r['ส่งแล้ว']}</td><td class="pct-col" style="color:#6D28D9;font-weight:700;">${totalScore}<span style="font-size:8pt;color:#94A3B8;">/${totalMax}</span></td><td class="pct-col" style="color:${pctColor};">${r['%คะแนน']}</td>${collectScore>0?`<td class="pct-col" style="color:#15803D;font-weight:800;background:#F0FDF4;">${r['คะแนนที่ได้']??'—'}</td>`:''}</tr>`;}).join('')}</tbody></table><div class="footer">TaskGenius · พิมพ์วันที่ ${dateStr}</div></div>`;pf.style.width=(40+(i+1)/data.length*50)+'%';});html+='</body></html>';const win=window.open('','_blank','width=900,height=700');if(!win){toast('กรุณาอนุญาต Popup เพื่อ Export PDF','warn');return;}win.document.write(html);win.document.close();win.onload=()=>{setTimeout(()=>{win.focus();win.print();},800);};}

// ---- INIT ----
// ╔══════════════════════════════════════════════════════╗
// ║  SECTION E: DASHBOARD & UI RENDERING                ║
// ╚══════════════════════════════════════════════════════╝
// ===== MANAGE TABS =====
function switchManageTab(tab, btn){
  document.querySelectorAll('.mtab-page').forEach(p=>p.style.display='none');
  document.querySelectorAll('.mtab').forEach(b=>b.classList.remove('on'));
  const el=document.getElementById('mtab-'+tab);
  if(el)el.style.display='';
  if(btn)btn.classList.add('on');
  if(tab==='subjects') renderSubjectsFull();
  if(tab==='homework') renderManage();
  if(tab==='grade') openGradeTab();
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION F: CRUD OPERATIONS (Add/Edit/Delete)       ║
// ╚══════════════════════════════════════════════════════╝
// ===== HW SAVE (supports edit+add) =====
async function saveHW(){
  const num=parseInt(document.getElementById('n-hwnum').value);
  const title=document.getElementById('n-hwtitle').value.trim();
  const subject=document.getElementById('n-hwsubj').value;
  const maxScore=parseInt(document.getElementById('n-hwmaxscore').value)||100;
  const deadlineRaw=document.getElementById('n-hwdeadline')?document.getElementById('n-hwdeadline').value:'';
  const deadline = deadlineRaw && deadlineRaw.trim() !== '' ? deadlineRaw : null;
  if(!num||!title){toast('กรอกให้ครบ','warn');return;}
  // เช็ค limit เฉพาะเพิ่มใหม่ (ไม่ใช่แก้ไขของเดิม)
  const isNew = !DB.homeworks.find(h => h.num === num);
  if(isNew){
    const limit = checkPlanLimit('homework');
    if(!limit.ok){ showUpgradeModal(limit.msg); return; }
  }
  showActionPopup('กำลังบันทึกชิ้นงาน','ครั้งที่ '+num+': '+title,'add');
  try{
    await sbAddHomework({num,title,subject,maxScore,deadline});
    renderManage();
    actionPopupDone('บันทึกงานแล้ว ✅','ครั้งที่ '+num+': '+title,'add');
    document.getElementById('n-hwnum').value='';
    document.getElementById('n-hwtitle').value='';
    if(document.getElementById('n-hwdeadline'))document.getElementById('n-hwdeadline').value='';
  }catch(e){actionPopupError('บันทึกไม่สำเร็จ: '+e.message);}
}

function openEditHW(num){
  const h=DB.homeworks.find(x=>x.num===num);
  if(!h)return;
  document.getElementById('n-hwnum').value=h.num;
  document.getElementById('n-hwtitle').value=h.title;
  document.getElementById('n-hwmaxscore').value=h.maxScore||100;
  const subj=document.getElementById('n-hwsubj');
  if(subj)subj.value=h.subject||'';
  if(document.getElementById('n-hwdeadline'))document.getElementById('n-hwdeadline').value=h.deadline||'';
  switchManageTab('homework',document.querySelectorAll('.mtab')[3]);
  document.getElementById('n-hwtitle').focus();
}

// ===== RENDER MANAGE EXTENSIONS =====
function renderManage(){
  renderPlanLimitBadges();
  renderSubjectsFull();
  // populate วิชาใน form เพิ่มงาน
  const nhSubj = document.getElementById('n-hwsubj');
  if(nhSubj) {
    const cur = nhSubj.value;
    nhSubj.innerHTML = '<option value="">— เลือกวิชา —</option>' + getSubjectNames().map(n=>`<option>${n}</option>`).join('');
    if(cur) nhSubj.value = cur;
  }
  // quick subject list in homework tab
  const ql = document.getElementById('subj-quick-list');
  if(ql) {
    const names = getSubjectNames();
    if(names.length) {
      ql.innerHTML = names.map(n => {
        const s = getSubjectObj(n);
        const per = s && s.hwCount > 0 ? Math.round((s.total/s.hwCount)*100)/100 : 100;
        const count = DB.homeworks.filter(h=>h.subject===n).length;
        return '<div style="background:#fff;border:1.5px solid #86EFAC;border-radius:10px;padding:6px 12px;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--green-dark);">' + n + '</div>' +
          '<div style="font-size:11px;color:var(--text2);">' + count + ' ชิ้น · ' + per + ' คะแนน/ชิ้น</div>' +
          '</div>';
      }).join('');
    } else {
      ql.innerHTML = '<div style="font-size:13px;color:var(--text3);">ยังไม่มีวิชา — ไปที่แท็บ 📚 วิชา</div>';
    }
  }
  const allRooms=[...new Set([...DB.rooms,...DB.students.map(x=>x.room)])].filter(Boolean).sort();
  const filterSel=document.getElementById('filter-room-manage');
  if(filterSel){
    const cur=filterSel.value;
    filterSel.innerHTML='<option value="">ทุกห้อง</option>'+allRooms.map(r=>`<option ${r===cur?'selected':''}>${r}</option>`).join('');
  }
  // Room cards
  const chips=document.getElementById('room-chips');
  if(chips)chips.innerHTML=allRooms.length
    ?allRooms.map(r=>{
        const cnt=DB.students.filter(s=>s.room===r).length;
        return `<div class="room-card" style="cursor:pointer;" onclick="viewRoomStudents('${r}')" title="ดูรายชื่อนักเรียน">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div class="room-card-name">${r}</div>
            <div class="room-card-count">${cnt} คน</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--purple);font-weight:600;">ดูรายชื่อ →</span>
            <button onclick="event.stopPropagation();delRoom(this.dataset.r)" data-r="${r}" style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px;border:none;background:var(--red-light);color:var(--red);cursor:pointer;">ลบ</button>
          </div>
        </div>`;
      }).join('')
    :'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px;grid-column:1/-1;">ยังไม่มีห้องเรียน</div>';
  // HW cards with deadline + edit button
  const hwList=document.getElementById('hw-card-list');
  if(hwList)hwList.innerHTML=DB.homeworks.length
    ?DB.homeworks.map(h=>{
        const locked = isHWLocked(h);
        const now=new Date();
        let dlBadge='<span class="deadline-badge dl-none">ไม่มีกำหนด</span>';
        if(h.deadline){
          const dl=new Date(h.deadline);
          const diff=Math.round((dl-now)/86400000);
          if(diff<0)dlBadge=`<span class="deadline-badge dl-late">เกิน ${Math.abs(diff)} วัน</span>`;
          else if(diff<=3)dlBadge=`<span class="deadline-badge dl-soon">เหลือ ${diff} วัน</span>`;
          else dlBadge=`<span class="deadline-badge dl-ok">${dl.toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</span>`;
        }
        const submitted=Object.keys(DB.submissions).filter(k=>k.endsWith('_'+h.num)).length;
        const lockedOverlay = locked ? `<div style="position:absolute;inset:0;background:rgba(239,68,68,0.08);border-radius:12px;display:flex;align-items:center;justify-content:flex-end;padding:0 10px;pointer-events:none;"><span style="font-size:11px;font-weight:700;color:var(--red);background:#FEE2E2;padding:3px 8px;border-radius:20px;border:1px solid #FCA5A5;">🔒 ล็อค</span></div>` : '';
        const wrapStyle = locked ? 'position:relative;opacity:0.7;' : 'position:relative;';
        return `<div class="hw-card-item" style="${wrapStyle}">${lockedOverlay}<div class="hw-card-num" style="${locked?'background:#FEE2E2;color:var(--red);':''}">
${h.num}</div><div class="hw-card-info"><div class="hw-card-title">${h.title}${locked?' <span style="font-size:11px;color:var(--red);">🔒</span>':''}</div><div class="hw-card-sub">${h.subject||''} · เต็ม ${h.maxScore||100} · ส่ง ${submitted}/${DB.students.length} · ${dlBadge}</div>${h.fileUrl?'<div style="margin-top:4px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">'+ getFileIcon(h.fileName)+'</span><span style="font-size:11px;color:var(--green-dark);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;">'+(h.fileName||'ไฟล์แนบ')+'</span><button onclick="removeHWFile('+ h.num+')" style="padding:2px 6px;font-size:10px;border-radius:6px;border:none;background:var(--red-light);color:var(--red);cursor:pointer;">ลบไฟล์</button></div>':''}</div>${locked
          ? `<button onclick="openRenewalFlow()" style="padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;border:none;background:#FEE2E2;color:var(--red);cursor:pointer;white-space:nowrap;">💳 ต่ออายุ</button>`
          : `<button onclick="openEditHW(${h.num})" style="padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;border:1.5px solid var(--blue);background:var(--blue-light);color:var(--blue-dark);cursor:pointer;margin-right:4px;white-space:nowrap;">แก้ไข</button><button onclick="delHW(${h.num})" style="padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;border:none;background:var(--red-light);color:var(--red);cursor:pointer;white-space:nowrap;">ลบ</button>`
        }</div>`;
      }).join('')
    :'<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px;">ยังไม่มีชิ้นงาน</div>';
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION G: QR / BARCODE SCANNER                   ║
// ╚══════════════════════════════════════════════════════╝
// ===== QR / BARCODE =====
let _codeType='qr',_modalCodeType='qr',_lastImportedStudents=[];

function setCodeType(type){
  _codeType=type;
  document.getElementById('codetype-qr').classList.toggle('on',type==='qr');
  document.getElementById('codetype-bar').classList.toggle('on',type==='barcode');
}
function setModalCodeType(type){
  _modalCodeType=type;
  document.getElementById('modal-codetype-qr').classList.toggle('on',type==='qr');
  document.getElementById('modal-codetype-bar').classList.toggle('on',type==='barcode');
}

function generateCodeEl(value,type,label,size){
  size=size||80;
  const wrap=document.createElement('div');
  wrap.style.cssText='text-align:center;padding:6px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;';
  if(type==='qr'){
    const canvas=document.createElement('canvas');
    wrap.appendChild(canvas);
    try{QRCode.toCanvas(canvas,value,{width:size,margin:1,errorCorrectionLevel:'M'},function(){});}catch(e){}
  }else{
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.width=size+'px';
    wrap.appendChild(svg);
    try{JsBarcode(svg,value,{format:'CODE128',width:1.5,height:Math.round(size*0.5),displayValue:false,margin:2});}catch(e){}
  }
  const lbl=document.createElement('div');
  lbl.style.cssText='font-size:11px;margin-top:4px;font-weight:700;color:#1e293b;word-break:break-all;';
  lbl.textContent=label;
  wrap.appendChild(lbl);
  return wrap;
}

function previewCodes(){
  const students=_lastImportedStudents.length?_lastImportedStudents:DB.students;
  const area=document.getElementById('code-preview-area');
  if(!students.length){toast('ไม่มีนักเรียน','warn');return;}
  area.style.display='block';area.innerHTML='';
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';
  students.slice(0,9).forEach(function(s){grid.appendChild(generateCodeEl(s.id,_codeType,s.name.substring(0,10),72));});
  area.appendChild(grid);
  if(students.length>9){const more=document.createElement('div');more.style.cssText='text-align:center;font-size:12px;color:var(--text3);margin-top:8px;';more.textContent='+ '+(students.length-9)+' คนอื่น (แสดงใน PDF)';area.appendChild(more);}
  document.getElementById('qr-gen-card').style.display='';
}

function previewModalCodes(){
  const roomFilter=document.getElementById('code-room-filter').value;
  const students=DB.students.filter(function(s){return !roomFilter||s.room===roomFilter;});
  const grid=document.getElementById('modal-code-grid');
  const preview=document.getElementById('modal-code-preview');
  if(!students.length){toast('ไม่มีนักเรียน','warn');return;}
  grid.innerHTML='';
  students.slice(0,12).forEach(function(s){grid.appendChild(generateCodeEl(s.id,_modalCodeType,s.name.substring(0,12),72));});
  preview.style.display='block';
}

function openCodeModal(){
  _modalCodeType='barcode'; 
  const allRooms=[...new Set(DB.students.map(s=>s.room))].filter(Boolean).sort();
  const sel=document.getElementById('code-room-filter');
  if(!sel){ toast('เกิดข้อผิดพลาด: modal ไม่พบ','err'); return; } 
  sel.innerHTML='<option value="">ทุกห้อง</option>'+allRooms.map(r=>`<option>${r}</option>`).join('');
  document.getElementById('modal-code-preview').style.display='none';
  document.getElementById('modal-code-grid').innerHTML='';
  document.getElementById('code-modal').classList.add('on');
}
function closeCodeModal(){document.getElementById('code-modal').classList.remove('on');}

async function downloadCodesPDF(){
  const students=_lastImportedStudents.length?_lastImportedStudents:DB.students;
  await _generateCodesPDF(students,_codeType,'codes');
}
async function downloadModalCodesPDF(){
  const roomFilter=document.getElementById('code-room-filter').value;
  const students=DB.students.filter(function(s){return !roomFilter||s.room===roomFilter;});
  await _generateCodesPDF(students,_modalCodeType,'codes');
}

async function _generateCodesPDF(students,type,filename){
  if(!students.length){toast('ไม่มีนักเรียน','warn');return;}
  toast('กำลังสร้าง PDF...');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const perRow=type==='qr'?4:3;
  const cellW=type==='qr'?44:60;
  const cellH=type==='qr'?52:38;
  const marginX=(210-perRow*cellW)/2;
  let row=0,col=0;
  for(let i=0;i<students.length;i++){
    const s=students[i];
    const px=marginX+col*cellW;
    const py=20+row*cellH;
    if(type==='qr'){
      const canvas=document.createElement('canvas');
      await new Promise(function(res){QRCode.toCanvas(canvas,s.id,{width:120,margin:1,errorCorrectionLevel:'M'},res);});
      doc.addImage(canvas.toDataURL('image/png'),'PNG',px+2,py+1,cellW-8,cellW-8);
      doc.setFontSize(7);doc.setFont('helvetica','bold');
      doc.text(s.id,px+cellW/2,py+cellW-5,{align:'center'});
      doc.setFontSize(6);doc.setFont('helvetica','normal');
      doc.text(s.name.length>16?s.name.substring(0,16)+'...':s.name,px+cellW/2,py+cellW-1,{align:'center'});
    }else{
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      JsBarcode(svg,s.id,{format:'CODE128',width:1.5,height:35,displayValue:false,margin:2});
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      const canvas2=document.createElement('canvas');
      canvas2.width=200;canvas2.height=60;
      const ctx=canvas2.getContext('2d');
      const img2=new Image();
      await new Promise(function(res){img2.onload=res;img2.src=url;});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,200,60);ctx.drawImage(img2,0,0,200,60);
      URL.revokeObjectURL(url);
      doc.addImage(canvas2.toDataURL('image/png'),'PNG',px+2,py+2,cellW-4,cellH-12);
      doc.setFontSize(6);doc.setFont('helvetica','bold');
      doc.text(s.id,px+cellW/2,py+cellH-7,{align:'center'});
      doc.setFontSize(5.5);doc.setFont('helvetica','normal');
      doc.text(s.name.length>18?s.name.substring(0,18)+'...':s.name,px+cellW/2,py+cellH-3,{align:'center'});
    }
    doc.setDrawColor(220,220,220);doc.rect(px,py,cellW,cellH);
    col++;
    if(col>=perRow){col=0;row++;if(py+cellH+cellH>275&&i<students.length-1){doc.addPage();row=0;}}
  }
  doc.save(filename+'_'+type+'_'+new Date().toISOString().slice(0,10)+'.pdf');
  toast('ดาวน์โหลด PDF แล้ว');
}

function printCodes(){_printCodesWindow(_lastImportedStudents.length?_lastImportedStudents:DB.students,_codeType);}
function printModalCodes(){
  const roomFilter=document.getElementById('code-room-filter').value;
  _printCodesWindow(DB.students.filter(function(s){return !roomFilter||s.room===roomFilter;}),_modalCodeType);
}

function _printCodesWindow(students,type){
  if(!students.length){toast('ไม่มีนักเรียน','warn');return;}
  const itemW=type==='qr'?'23%':'30%';
  let html='';
  students.forEach(function(s){
    if(type==='qr'){
      const canvas=document.createElement('canvas');
      QRCode.toCanvas(canvas,s.id,{width:100,margin:1},function(){});
      html+='<div style="display:inline-block;width:'+itemW+';text-align:center;padding:6px;border:1px solid #ccc;box-sizing:border-box;margin:2px;vertical-align:top;"><img src="'+canvas.toDataURL()+'" style="width:80px;height:80px;"><br><b style="font-size:9pt;">'+s.id+'</b><br><span style="font-size:7pt;">'+s.name+'</span></div>';
    }else{
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      JsBarcode(svg,s.id,{format:'CODE128',width:1.5,height:40,displayValue:false,margin:2});
      html+='<div style="display:inline-block;width:'+itemW+';text-align:center;padding:6px;border:1px solid #ccc;box-sizing:border-box;margin:2px;vertical-align:top;"><img src="data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(svg))+'" style="width:100%;height:36px;"><br><b style="font-size:9pt;">'+s.id+'</b><br><span style="font-size:7pt;">'+s.name+'</span></div>';
    }
  });
  const win=window.open('','_blank','width=800,height=600');
  if(!win){toast('กรุณาอนุญาต Popup','warn');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Codes</title><style>@page{size:A4;margin:10mm}body{font-family:sans-serif;padding:0;margin:0}</style></head><body><div style="padding:4px;">'+html+'</div><scr'+'ipt>window.onload=function(){window.print();}<\/scr'+'ipt></body></html>');
  win.document.close();
}

// Patch confirmXLImport to show QR card after import
async function confirmXLImport(){
  _lastImportedStudents=[...xlImportData];
  const newStudents=xlImportData.filter(s=>!DB.students.find(x=>x.id===s.id)).map(s=>({...s,room:s.room||DB.rooms[0]||''}));
  const skipped=xlImportData.length-newStudents.length;

  // ตรวจ plan limit
  if(!isPremium()) {
    const newRoomsInImport = [...new Set(newStudents.map(s=>s.room))].filter(r=>!DB.rooms.includes(r));
    const totalRooms = DB.rooms.length + newRoomsInImport.length;
    if(totalRooms > FREE_LIMITS.rooms) {
      showUpgradeModal(`นำเข้าจะทำให้มี ${totalRooms} ห้อง เกินขีดจำกัด Free Plan (${FREE_LIMITS.rooms} ห้อง) 🔒`);
      return;
    }
  }

  // ตรวจ student per-room limit (free plan)
  if(!isPremium()) {
    const roomGroups = {};
    newStudents.forEach(s => { roomGroups[s.room] = (roomGroups[s.room]||0) + 1; });
    for(const [room, count] of Object.entries(roomGroups)) {
      const existing = DB.students.filter(s => s.room === room).length;
      if(existing + count > FREE_LIMITS.studentsPerRoom) {
        showUpgradeModal(`ห้อง ${room} จะมีนักเรียน ${existing+count} คน เกินขีดจำกัด Free Plan (${FREE_LIMITS.studentsPerRoom} คน/ห้อง) 🔒`);
        return;
      }
    }
  }

  if(!newStudents.length) { toast('ไม่มีรายการใหม่ให้นำเข้า','warn'); return; }

  showActionPopup('กำลังอัพโหลด...','เตรียมบันทึกรายชื่อ '+newStudents.length+' คน...','upload');
  try {
    await sbImportStudents(newStudents);
    const newRooms=[...new Set(newStudents.map(s=>s.room))].filter(r=>!DB.rooms.includes(r));
    if(newRooms.length){
      DB.rooms=[...new Set([...DB.rooms,...newRooms])].sort();
      await sbSaveSettings('rooms', DB.rooms);
    }
    cancelXLImport();renderManage();
    if(_lastImportedStudents.length>0)document.getElementById('qr-gen-card').style.display='';
    toast('✅ นำเข้าแล้ว '+newStudents.length+' คน'+(skipped?' (ข้าม '+skipped+' ซ้ำ)':''));
  } catch(e){
    const msg = e.message || String(e);
    if(msg.includes('constraint') || msg.includes('unique') || msg.includes('duplicate')) {
      toast('นำเข้าบางส่วนไม่สำเร็จ: รหัสนักเรียนซ้ำกับระบบ','warn');
    } else {
      toast('นำเข้าไม่สำเร็จ: '+msg,'err');
    }
  }
}
// ===== EXPIRY SYSTEM =====
function getExpiryInfo(expiresAt) {
  if(!expiresAt) return {status:'none', label:'ไม่มีกำหนด', daysLeft:null, pct:100};
  const now = new Date();
  const exp = new Date(expiresAt);
  const diffMs = exp - now;
  const daysLeft = Math.ceil(diffMs / 86400000);
  if(daysLeft < 0) return {status:'expired', label:'หมดอายุแล้ว', daysLeft, pct:0};
  if(daysLeft <= 7) return {status:'danger', label:'เหลือ '+daysLeft+' วัน', daysLeft, pct: Math.max(0,daysLeft/7*100)};
  if(daysLeft <= 30) return {status:'warn', label:'เหลือ '+daysLeft+' วัน', daysLeft, pct: Math.max(0,daysLeft/30*100)};
  return {status:'ok', label:'เหลือ '+daysLeft+' วัน', daysLeft, pct:100};
}

function renderExpireBadge(expiresAt) {
  const info = getExpiryInfo(expiresAt);
  const colorMap = {none:'expire-ok',ok:'expire-ok',warn:'expire-warn',danger:'expire-danger',expired:'expire-expired'};
  const barColor = {none:'var(--green)',ok:'var(--green)',warn:'var(--yellow)',danger:'var(--red)',expired:'#CBD5E1'};
  return `<div>
    <span class="expire-badge ${colorMap[info.status]}">⏱ ${info.label}</span>
    ${info.daysLeft!==null?`<div class="countdown-bar"><div class="countdown-fill" style="width:${info.pct}%;background:${barColor[info.status]};"></div></div>`:''}
  </div>`;
}

// Auto-check expiry เมื่อ login
async function checkTeacherExpiry(uid) {
  if(!USE_SUPABASE||!SB) return true;
  const {data} = await SB.from('teachers').select('expires_at,status').eq('id',uid).single();
  if(!data) return false;
  if(data.expires_at && new Date(data.expires_at) < new Date()) {
    await SB.from('teachers').update({status:'expired'}).eq('id',uid);
    return false;
  }
  return true;
}

// Countdown timer สำหรับครู (แสดงใน topbar)
let _expiryTimer = null;
function startExpiryCountdown(expiresAt) {
  const el = document.getElementById('teacher-expiry-display');
  if(!el || !expiresAt) return;
  if(_expiryTimer) clearInterval(_expiryTimer);
  function update() {
    const info = getExpiryInfo(expiresAt);
    const barColor = {ok:'var(--green)',warn:'var(--yellow)',danger:'var(--red)',expired:'#CBD5E1'};
    el.innerHTML = `<span class="expire-badge ${
      info.status==='ok'?'expire-ok':
      info.status==='warn'?'expire-warn':
      info.status==='danger'?'expire-danger':'expire-expired'
    }" style="font-size:11px;padding:2px 8px;">⏱ ${info.label}</span>`;
    if(info.status === 'expired') {
      clearInterval(_expiryTimer);
      toast('บัญชีของคุณหมดอายุแล้ว — กด ต่ออายุ ด้านบน', 'err');
      showLockedDataBanner(0);
      setTimeout(()=>logout(), 3000);
    }
  }
  update();
  _expiryTimer = setInterval(update, 60000);
}
  function openSetExpiry(tid, currentExpiry) {
  const current = currentExpiry ? new Date(currentExpiry).toISOString().slice(0,10) : '';
  const result = prompt(
    'ตั้งอายุการใช้งานสำหรับครูคนนี้\n\n' +
    'พิมพ์วันหมดอายุ (YYYY-MM-DD) หรือจำนวนวัน (เช่น 30, 90, 365)\n' +
    'พิมพ์ "ไม่มี" เพื่อล้างการกำหนด\n\n' +
    'ปัจจุบัน: ' + (current || 'ไม่มีกำหนด'),
    current
  );
  if(result === null) return;
  let expiresAt = null;
  if(result.trim() === 'ไม่มี' || result.trim() === '') {
    expiresAt = null;
  } else if(/^\d+$/.test(result.trim())) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(result.trim()));
    expiresAt = d.toISOString();
  } else if(/^\d{4}-\d{2}-\d{2}$/.test(result.trim())) {
    expiresAt = new Date(result.trim()).toISOString();
  } else {
    toast2('รูปแบบไม่ถูกต้อง','err'); return;
  }
  saveTeacherExpiry(tid, expiresAt);
}

async function saveTeacherExpiry(tid, expiresAt) {
  const {error} = await SB.from('teachers').update({
    expires_at: expiresAt,
    status: expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'approved'
  }).eq('id', tid);
  if(error){toast2('บันทึกไม่สำเร็จ: '+error.message,'err');return;}
  toast2('บันทึกอายุการใช้งานแล้ว ✅');
  loadSuperAdminPanel();
}

// ===== AVATAR UPLOAD =====
const AVATAR_MAX_MB = 2;
const AVATAR_ALLOWED = ['image/jpeg','image/png'];

async function uploadAvatar(file, teacherId) {
  if(!file) return null;
  if(!AVATAR_ALLOWED.includes(file.type)) {
    toast('อนุญาตเฉพาะ JPG/PNG เท่านั้น','err'); return null;
  }
  if(file.size > AVATAR_MAX_MB * 1024 * 1024) {
    toast('ไฟล์ใหญ่เกิน '+AVATAR_MAX_MB+'MB','err'); return null;
  }
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${teacherId}/avatar.${ext}`;
  const { error } = await SB.storage.from('avatars').upload(path, file, {
    upsert: true, contentType: file.type
  });
  if(error) { toast('อัพโหลดไม่สำเร็จ: '+error.message,'err'); return null; }
  const { data } = SB.storage.from('avatars').getPublicUrl(path);
  // เพิ่ม timestamp กัน cache
  return data.publicUrl + '?t=' + Date.now();
}

function getAvatarUrl(url, name) {
  if(url) return url;
  // Fallback: แสดงตัวอักษรแรก
  return null;
}

function avatarImgOrInitial(url, name, cls) {
  if(url) {
    return `<img src="${url}" class="${cls}" onerror="this.style.display='none';this.nextSibling.style.display='flex';">
    <div style="display:none;" class="${cls}" style="background:var(--blue-light);color:var(--blue-dark);font-weight:700;align-items:center;justify-content:center;font-size:16px;">${(name||'?').substring(0,2)}</div>`;
  }
  return `<div class="${cls}" style="background:var(--blue-light);color:var(--blue-dark);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px;">${(name||'?').substring(0,2)}</div>`;
}

function previewRegAvatar(e) {
  const file = e.target.files[0];
  if(!file) return;
  if(!AVATAR_ALLOWED.includes(file.type)){toast('อนุญาตเฉพาะ JPG/PNG','err');return;}
  if(file.size > AVATAR_MAX_MB*1024*1024){toast('ไฟล์ใหญ่เกิน 2MB','err');return;}
  const reader = new FileReader();
  reader.onload = ev => {
    const prev = document.getElementById('reg-avatar-preview');
    prev.innerHTML = `<img src="${ev.target.result}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}

  function previewProfileAvatar(e) {
  const file = e.target.files[0];
  if(!file) return;
  if(!AVATAR_ALLOWED.includes(file.type)){toast('อนุญาตเฉพาะ JPG/PNG','err');return;}
  if(file.size > AVATAR_MAX_MB*1024*1024){toast('ไฟล์ใหญ่เกิน 2MB','err');return;}
  const reader = new FileReader();
  reader.onload = ev => {
    const prev = document.getElementById('profile-avatar-preview');
    prev.innerHTML = `<img src="${ev.target.result}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}

  // ===== EXPIRY NOTIFICATION SYSTEM =====
function closeExpiryWarning(){
  document.getElementById('expiry-warning-modal').style.display='none';
}

async function checkAndNotifyExpiry(teacher) {
  if(!teacher.expires_at) return;
  const now = new Date();
  const exp = new Date(teacher.expires_at);
  const daysLeft = Math.ceil((exp - now) / 86400000);

  // ถ้าหมดอายุแล้ว
  if(daysLeft <= 0) {
    showExpiryModal('expired', daysLeft, teacher.expires_at);
    return;
  }

  // แจ้งเตือนถ้าเหลือ <= 7 วัน
  if(daysLeft <= 7) {
    showExpiryModal('warning', daysLeft, teacher.expires_at);
  }
}

function showExpiryModal(type, daysLeft, expiresAt) {
  const modal = document.getElementById('expiry-warning-modal');
  const icon = document.getElementById('expiry-warn-icon');
  const title = document.getElementById('expiry-warn-title');
  const body = document.getElementById('expiry-warn-body');
  const daysEl = document.getElementById('expiry-warn-days');
  const dateEl = document.getElementById('expiry-warn-date');

  const expDate = new Date(expiresAt).toLocaleDateString('th-TH', {
    year:'numeric', month:'long', day:'numeric'
  });

  if(type === 'expired') {
    icon.textContent = '🔒';
    title.textContent = 'บัญชีหมดอายุแล้ว';
    body.innerHTML = 'บัญชีของคุณหมดอายุแล้ว';
    body.innerHTML += '<br><button onclick="openRenewalFlow()" style="margin-top:10px;padding:8px 18px;font-size:14px;font-weight:700;border-radius:10px;border:none;background:linear-gradient(135deg,#7C3AED,#4F8EF7);color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;">💳 ต่ออายุ Premium</button>';
    daysEl.textContent = '';
    dateEl.textContent = 'หมดอายุเมื่อ: ' + expDate;
    // ล็อกบัญชีหลัง 5 วินาที
    setTimeout(()=>logout(), 5000);
  } else {
    const urgency = daysLeft <= 3 ? '🚨' : '⚠️';
    icon.textContent = urgency;
    title.textContent = daysLeft <= 3 ? 'บัญชีใกล้หมดอายุมาก!' : 'บัญชีใกล้หมดอายุ';
    body.innerHTML = `บัญชีของคุณจะหมดอายุในอีก <b style="color:var(--red);font-size:18px;">${daysLeft}</b> วัน<br><button onclick="openRenewalFlow()" style="margin-top:10px;padding:8px 18px;font-size:14px;font-weight:700;border-radius:10px;border:none;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;">💳 ต่ออายุ Premium</button>`;
    daysEl.textContent = '';
    dateEl.textContent = 'วันหมดอายุ: ' + expDate;
  }

  modal.style.display = 'flex';
}

// ===== SLIP PAYMENT SYSTEM =====
async function loadPaymentInfo() {
  if(!USE_SUPABASE||!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','payment_info').maybeSingle();
    if(data&&data.value) {
      const p = data.value;
      if(p.bank) document.getElementById('payment-bank').textContent = p.bank;
      if(p.account) document.getElementById('payment-account').textContent = p.account;
      if(p.name) document.getElementById('payment-name').textContent = p.name;
      if(p.amount) document.getElementById('payment-amount').textContent = p.amount;
    }
  } catch(e) {}
}

function previewSlip(e) {
  const file = e.target.files[0];
  if(!file) return;
  if(!['image/jpeg','image/png'].includes(file.type)) {
    document.getElementById('slip-err').textContent='อนุญาตเฉพาะ JPG/PNG เท่านั้น'; return;
  }
  if(file.size > 5*1024*1024) {
    document.getElementById('slip-err').textContent='ไฟล์ใหญ่เกิน 5MB'; return;
  }
  document.getElementById('slip-err').textContent='';
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('slip-preview-wrap').innerHTML =
      `<img src="${ev.target.result}" class="slip-preview-img">
       <div style="font-size:13px;color:var(--green-dark);font-weight:600;">✅ เลือกรูปแล้ว — กดปุ่มด้านล่างเพื่อส่ง</div>`;
    document.getElementById('slip-submit-btn').style.display='block';
  };
  reader.readAsDataURL(file);
}

async function uploadSlip() {
  const file = document.getElementById('slip-file-input').files[0];
  if(!file||!CURRENT_TEACHER) return;
  const selectedPlan = document.querySelector('input[name="slip-plan-radio"]:checked')?.value || 'free';
  // ถ้า free plan ไม่ต้องอัพโหลดสลิป
  if(selectedPlan === 'free') {
    await activateFreeTeacher();
    return;
  }
  const btn = document.getElementById('slip-submit-btn');
  btn.textContent='⏳ กำลังอัพโหลด...';
  btn.disabled=true;
  try {
    const ext = file.type==='image/png'?'png':'jpg';
    const path = `${CURRENT_TEACHER.id}/slip.${ext}`;
    const {error:upErr} = await SB.storage.from('slips').upload(path, file, {upsert:true, contentType:file.type});
    if(upErr) throw upErr;
    const {data} = SB.storage.from('slips').getPublicUrl(path);
    const slipUrl = data.publicUrl+'?t='+Date.now();
    const selectedPlan = document.querySelector('input[name="slip-plan-radio"]:checked')?.value || 'free';
    const {error:dbErr} = await SB.from('teachers').update({
      slip_url: slipUrl,
      slip_uploaded_at: new Date().toISOString(),
      status: 'slip_uploaded',
      plan_requested: selectedPlan
    }).eq('id', CURRENT_TEACHER.id);
    if(dbErr) throw dbErr;
    // แสดงหน้ารอการอนุมัติ
    document.getElementById('slip-upload-area').innerHTML=`
      <div class="slip-status-banner" style="background:#DCFCE7;border:1.5px solid #86EFAC;">
        <div style="font-size:24px;margin-bottom:8px;">✅</div>
        <div style="font-size:16px;font-weight:800;color:var(--green-dark);">ส่งสลิปสำเร็จ!</div>
        <div style="font-size:13px;color:#166534;margin-top:6px;font-weight:400;">กรุณารอแอดมินตรวจสอบและอนุมัติ<br>ปกติใช้เวลาไม่เกิน 24 ชั่วโมง</div>
      </div>`;
    toast('ส่งสลิปเรียบร้อยแล้ว รอการอนุมัติ ✅');
  } catch(e) {
    document.getElementById('slip-err').textContent='เกิดข้อผิดพลาด: '+e.message;
    btn.textContent='📤 ส่งสลิปการชำระเงิน';
    btn.disabled=false;
  }
}

function showSlipScreen(teacher) {
  CURRENT_TEACHER = teacher;
  showScreen('s-slip');
  loadPaymentInfo();
  // ถ้าส่งสลิปแล้ว แสดงสถานะ
  if(teacher.status==='slip_uploaded') {
    document.getElementById('slip-status-area').innerHTML=`
      <div class="slip-status-banner" style="background:#FEF3C7;border:1.5px solid #FCD34D;">
        <div style="font-size:14px;font-weight:700;color:#B45309;">⏳ รอการตรวจสอบจากแอดมิน</div>
        <div style="font-size:12px;color:#92400E;margin-top:4px;font-weight:400;">ส่งสลิปแล้วเมื่อ: ${new Date(teacher.slip_uploaded_at).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>`;
    if(teacher.slip_url) {
      document.getElementById('slip-preview-wrap').innerHTML=`<img src="${teacher.slip_url}" class="slip-preview-img">`;
    }
  }
}

// ===== ORPHAN DATA CLEANUP =====
async function checkOrphanData() {
  if(!USE_SUPABASE||!SB) return;
  const statsEl = document.getElementById('orphan-stats');
  statsEl.innerHTML = '<div style="font-size:13px;color:var(--text3);">⏳ กำลังตรวจสอบ...</div>';

  try {
    // ดึง teacher ids ที่มีอยู่
    const {data:teachers} = await SB.from('teachers').select('id');
    const teacherIds = (teachers||[]).map(t => t.id);

    // นับข้อมูลค้าง
    const {data:stuData} = await SB.from('students').select('teacher_id');
    const {data:hwData} = await SB.from('homeworks').select('teacher_id');
    const {data:subData} = await SB.from('submissions').select('teacher_id');

    const orphanStu = (stuData||[]).filter(r => !teacherIds.includes(r.teacher_id)).length;
    const orphanHw = (hwData||[]).filter(r => !teacherIds.includes(r.teacher_id)).length;
    const orphanSub = (subData||[]).filter(r => !teacherIds.includes(r.teacher_id)).length;
    const total = orphanStu + orphanHw + orphanSub;

    if(total === 0) {
      statsEl.innerHTML = `
        <div style="background:var(--green-light);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--green-dark);font-weight:600;">
          ✅ ไม่มีข้อมูลค้างในระบบ
        </div>`;
      document.getElementById('clean-orphan-btn').style.display='none';
    } else {
      statsEl.innerHTML = `
        <div style="background:var(--red-light);border-radius:10px;padding:12px 14px;">
          <div style="font-size:13px;font-weight:700;color:#B91C1C;margin-bottom:8px;">⚠️ พบข้อมูลค้าง ${total} รายการ</div>
          <div style="font-size:12px;color:#991B1B;line-height:2;">
            👤 นักเรียน: <b>${orphanStu} คน</b><br>
            📝 ชิ้นงาน: <b>${orphanHw} ชิ้น</b><br>
            ✅ การส่งงาน: <b>${orphanSub} รายการ</b>
          </div>
        </div>`;
      document.getElementById('clean-orphan-btn').style.display='block';
    }
  } catch(e) {
    statsEl.innerHTML = `<div style="font-size:13px;color:var(--red);">❌ เกิดข้อผิดพลาด: ${e.message}</div>`;
  }
}

async function cleanOrphanData() {
  if(!confirm('ยืนยันลบข้อมูลที่ไม่มีครูในระบบแล้ว?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;

  const statsEl = document.getElementById('orphan-stats');
  statsEl.innerHTML = '<div style="font-size:13px;color:var(--text3);">⏳ กำลังล้างข้อมูล...</div>';

  try {
    const {data:teachers} = await SB.from('teachers').select('id');
    const teacherIds = (teachers||[]).map(t => t.id);

    // ดึงข้อมูลค้างแล้วลบทีละตัว
    const {data:stuData} = await SB.from('students').select('id,teacher_id');
    const orphanStuIds = (stuData||[]).filter(r => !teacherIds.includes(r.teacher_id)).map(r => r.id);

    const {data:hwData} = await SB.from('homeworks').select('id,teacher_id');
    const orphanHwIds = (hwData||[]).filter(r => !teacherIds.includes(r.teacher_id)).map(r => r.id);

    const {data:subData} = await SB.from('submissions').select('id,teacher_id');
    const orphanSubIds = (subData||[]).filter(r => !teacherIds.includes(r.teacher_id)).map(r => r.id);

    // ลบข้อมูลค้าง
    if(orphanSubIds.length) await SB.from('submissions').delete().in('id', orphanSubIds);
    if(orphanHwIds.length) await SB.from('homeworks').delete().in('id', orphanHwIds);
    if(orphanStuIds.length) await SB.from('students').delete().in('id', orphanStuIds);

    statsEl.innerHTML = `
      <div style="background:var(--green-light);border-radius:10px;padding:12px 14px;">
        <div style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:6px;">✅ ล้างข้อมูลสำเร็จ</div>
        <div style="font-size:12px;color:#166534;line-height:2;">
          👤 นักเรียน: <b>${orphanStuIds.length} คน</b><br>
          📝 ชิ้นงาน: <b>${orphanHwIds.length} ชิ้น</b><br>
          ✅ การส่งงาน: <b>${orphanSubIds.length} รายการ</b>
        </div>
      </div>`;
    document.getElementById('clean-orphan-btn').style.display='none';
    toast2('ล้างข้อมูลสำเร็จ ✅');
  } catch(e) {
    statsEl.innerHTML = `<div style="font-size:13px;color:var(--red);">❌ เกิดข้อผิดพลาด: ${e.message}</div>`;
    toast2('เกิดข้อผิดพลาด: '+e.message,'err');
  }
}

// ===== MAINTENANCE MODE =====
// ===== BYPASS IDs (TEST ACCOUNTS FOR MAINTENANCE) =====
async function loadGlobalBypassIds() {
  if(!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','bypass_ids').maybeSingle();
    _globalBypassIds = Array.isArray(data?.value) ? data.value : [];
  } catch(e) { _globalBypassIds = []; }
}

async function loadBypassIds() {
  if(!USE_SUPABASE||!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','bypass_ids').maybeSingle();
    const ids = (data&&data.value) ? data.value : [];
    renderBypassList(ids);
  } catch(e) {}
}

function renderBypassList(ids) {
  const el = document.getElementById('bypass-ids-list');
  if(!el) return;
  if(!ids.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:8px;">ยังไม่มีบัญชีทดสอบ</div>';
    return;
  }
  el.innerHTML = ids.map((id,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fff;border-radius:10px;border:1.5px solid #C4B5FD;margin-bottom:6px;">
      <span style="font-size:16px;">🔓</span>
      <span style="flex:1;font-size:13px;font-weight:600;color:var(--purple);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${id}</span>
      <button onclick="removeBypassId(${i})"
        style="padding:4px 10px;font-size:12px;border-radius:8px;border:none;background:var(--red-light);color:var(--red);cursor:pointer;flex-shrink:0;font-family:Sarabun,sans-serif;">ลบ</button>
    </div>`).join('');
}

async function addBypassId() {
  const val = document.getElementById('bypass-id-input')?.value.trim();
  if(!val) { toast2('กรอก Email หรือ Teacher ID ด้วย','warn'); return; }
  const {data} = await SB.from('settings').select('value').eq('key','bypass_ids').maybeSingle();
  const ids = (data&&data.value) ? data.value : [];
  if(ids.includes(val)) { toast2('มีอยู่แล้ว','warn'); return; }
  ids.push(val);
  const {error} = await SB.from('settings').upsert({key:'bypass_ids',value:ids},{onConflict:'key'});
  if(error) { toast2('ไม่สำเร็จ: '+error.message,'err'); return; }
  renderBypassList(ids);
  document.getElementById('bypass-id-input').value = '';
  toast2('เพิ่มบัญชีทดสอบแล้ว ✅');
}

async function removeBypassId(idx) {
  const {data} = await SB.from('settings').select('value').eq('key','bypass_ids').maybeSingle();
  const ids = (data&&data.value) ? data.value : [];
  ids.splice(idx,1);
  await SB.from('settings').upsert({key:'bypass_ids',value:ids},{onConflict:'key'});
  renderBypassList(ids);
  toast2('ลบบัญชีทดสอบแล้ว','warn');
}

async function checkIdInBypassList(emailOrId) {
  if(!USE_SUPABASE||!SB) return false;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','bypass_ids').maybeSingle();
    const ids = (data&&data.value) ? data.value : [];
    return ids.some(v => v === emailOrId);
  } catch(e) { return false; }
}

async function checkMaintenanceMode() {
  if(!USE_SUPABASE||!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','maintenance_mode').maybeSingle();
    const isOn = data && data.value && data.value.enabled === true;
    if(isOn) {
      // ถ้ามี session อยู่แล้ว ให้เช็คว่าเป็น bypass account ไหม
      try {
        const {data:sess} = await SB.auth.getSession();
        if(sess&&sess.session) {
          const email = sess.session.user.email;
          const uid = sess.session.user.id;
          const bypass = await checkIdInBypassList(email) || await checkIdInBypassList(uid);
          if(bypass) return; // ข้ามผ่าน maintenance
        }
      } catch(e2) {}
      showMaintenancePage(data.value);
    }
  } catch(e) {}
}

function showMaintenancePage(config) {
  const overlay = document.getElementById('maintenance-overlay');
  if(!overlay) return;

  // โหลดข้อมูลติดต่อ
  loadContactLinksForLogin().then(() => {
    const links = document.getElementById('contact-admin-links');
    const mLinks = document.getElementById('maintenance-contact-links');
    if(links && mLinks) mLinks.innerHTML = links.innerHTML;
  });

  // แสดงเวลาเริ่มปรับปรุง
  const timeEl = document.getElementById('maintenance-time');
  if(timeEl && config.started_at) {
    timeEl.textContent = 'เริ่มปรับปรุงตั้งแต่: ' +
      new Date(config.started_at).toLocaleString('th-TH');
  }

  // เพิ่มปุ่มลับสำหรับแอดมิน (กดไอคอน 5 ครั้ง)
  const icon = overlay.querySelector('.maintenance-icon');
  if(icon) {
    let tapCount = 0, tapTimer = null;
    icon.style.cursor = 'pointer';
    icon.addEventListener('click', () => {
      tapCount++;
      clearTimeout(tapTimer);
      if(tapCount >= 5) {
        tapCount = 0;
        showAdminBypass();
      }
      tapTimer = setTimeout(() => tapCount = 0, 2000);
    });
  }

  overlay.style.display = 'flex';
}

function showAdminBypass() {
  const overlay = document.getElementById('maintenance-overlay');
  const box = overlay.querySelector('.maintenance-box');
  
  // เพิ่ม input รหัสแอดมิน
  if(document.getElementById('admin-bypass-area')) return;
  
  const bypassDiv = document.createElement('div');
  bypassDiv.id = 'admin-bypass-area';
  bypassDiv.style.cssText = 'margin-top:16px;background:rgba(255,255,255,0.1);border-radius:14px;padding:16px;';
  bypassDiv.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:10px;font-weight:600;">🔐 Super Admin เท่านั้น</div>
    <input type="password" id="bypass-pw" placeholder="รหัส Super Admin..." 
      style="width:100%;padding:12px 14px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:15px;font-family:Sarabun,sans-serif;outline:none;margin-bottom:8px;"
      onkeydown="if(event.key==='Enter')bypassMaintenance()">
    <div id="bypass-err" style="font-size:12px;color:#FCA5A5;min-height:16px;margin-bottom:8px;"></div>
    <button onclick="bypassMaintenance()" style="width:100%;padding:12px;font-size:15px;font-weight:700;border-radius:10px;border:none;background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;">
      🔐 เข้าสู่ระบบแอดมิน
    </button>
  `;
  box.appendChild(bypassDiv);
  setTimeout(() => document.getElementById('bypass-pw')?.focus(), 100);
}

async function bypassMaintenance() {
  const pw = document.getElementById('bypass-pw')?.value.trim();
  const errEl = document.getElementById('bypass-err');
  if(!pw) return;
  
  try {
    const {data} = await SB.from('settings').select('value').eq('key','superadmin_pw').maybeSingle();
    const correctPw = data ? (typeof data.value === 'string' ? data.value : JSON.stringify(data.value).replace(/"/g,'')) : 'superadmin999';
    
    if(pw === correctPw) {
      // ปิด maintenance แล้วเข้าหน้าแอดมิน
      try {
        await SB.from('settings').upsert({key:'maintenance_mode',value:{enabled:false}},{onConflict:'key'});
      } catch(e2) {}
      document.getElementById('maintenance-overlay').style.display = 'none';
      updateMaintenanceBtn(false);
      CURRENT_TEACHER = null;
      showScreen('s-superadmin');
      loadSuperAdminPanel();
    } else {
      if(errEl) errEl.textContent = 'รหัสผ่านไม่ถูกต้อง';
    }
  } catch(e) {
    if(errEl) errEl.textContent = 'เกิดข้อผิดพลาด: ' + e.message;
  }
}
function updateMaintenanceBtn(isOn) {
  const btn = document.getElementById('maintenance-toggle-btn');
  if(!btn) return;
  if(isOn) {
    btn.textContent = '✅ ปิดโหมดปรับปรุง';
    btn.style.background = 'linear-gradient(135deg,var(--green),var(--green-dark))';
  } else {
    btn.textContent = '⚙️ เปิดโหมดปรับปรุง';
    btn.style.background = 'linear-gradient(135deg,var(--yellow),#D97706)';
  }
}

async function loadMaintenanceStatus() {
  if(!USE_SUPABASE||!SB) return;
  try {
    const {data} = await SB.from('settings').select('value').eq('key','maintenance_mode').maybeSingle();
    const isOn = data && data.value && data.value.enabled === true;
    updateMaintenanceBtn(isOn);
  } catch(e) {}
}

async function toggleMaintenanceMode(enable) {
  if(!USE_SUPABASE||!SB) return;
  const value = enable ? {
    enabled: true,
    started_at: new Date().toISOString()
  } : { enabled: false };
  const {error} = await SB.from('settings').upsert(
    {key:'maintenance_mode', value},
    {onConflict:'key'}
  );
  if(error) { toast2('ไม่สำเร็จ: '+error.message,'err'); return; }
  if(enable) {
    toast2('เปิดโหมดปรับปรุงระบบแล้ว ⚙️','warn');
  } else {
    toast2('ปิดโหมดปรับปรุงระบบแล้ว ✅');
    const ov = document.getElementById('maintenance-overlay');
    if(ov) ov.style.display='none';
  }
  updateMaintenanceBtn(enable);
}

if('scrollRestoration' in history) history.scrollRestoration='manual';

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION H: SUBJECT & GRADE MANAGEMENT             ║
// ╚══════════════════════════════════════════════════════╝
// ===== SUBJECT MANAGEMENT (FULL) =====

function getSubjectObj(name) {
  if(!Array.isArray(DB.subjects)) return null;
  if(typeof DB.subjects[0] === 'string') return null;
  return DB.subjects.find(s => s.name === name) || null;
}

function getSubjectNames() {
  if(!Array.isArray(DB.subjects)) return [];
  if(typeof DB.subjects[0] === 'string') return DB.subjects;
  return DB.subjects.map(s => s.name);
}

// calcSubjScorePerHW removed — ไม่ใช้แล้ว

// อัพเดต total เมื่อเปลี่ยนวิชาใน form เพิ่มงาน
function onSubjChangeInHW() {
  const subjName = document.getElementById('n-hwsubj')?.value;
  if(!subjName) return;
  const subj = getSubjectObj(subjName);
  if(!subj) return;
  const maxEl = document.getElementById('n-hwmaxscore');
  if(!maxEl || maxEl.value == subj.scorePerHW) return;
  // คำนวณ scorePerHW
  const per = subj.hwCount > 0 ? Math.round((subj.total / subj.hwCount) * 100) / 100 : subj.total;
  if(maxEl) maxEl.value = per;
}

async function addSubjectFull() {
  const name = document.getElementById('ns-subj-name')?.value.trim();
  if(!name) { toast('กรอกชื่อวิชาด้วย','warn'); return; }

  // ตรวจซ้ำ
  const names = getSubjectNames();
  if(names.includes(name)) { toast('วิชานี้มีอยู่แล้ว','warn'); return; }

  const subjObj = { name };

  // migrate: ถ้า subjects ยังเป็น string array ให้แปลงเป็น objects
  if(DB.subjects.length > 0 && typeof DB.subjects[0] === 'string') {
    DB.subjects = DB.subjects.map(s => ({name:s}));
  }

  showActionPopup('กำลังเพิ่มวิชา',name,'add');
  DB.subjects.push(subjObj);
  try {
    await sbSaveSettings('subjects', DB.subjects);
    document.getElementById('ns-subj-name').value = '';
    renderSubjectsFull();
    renderManage();
    populateHWDropdown();
    actionPopupDone('เพิ่มวิชาแล้ว ✅',name,'add');
  } catch(e) {
    DB.subjects.pop(); // rollback
    actionPopupError('บันทึกวิชาไม่สำเร็จ: '+e.message);
  }
}

async function deleteSubjectFull(name) {
  if(!confirm('ลบวิชา "' + name + '"?')) return;
  const backup = [...DB.subjects];
  showActionPopup('กำลังลบวิชา',name,'delete');
  DB.subjects = DB.subjects.filter(s => (typeof s === 'string' ? s : s.name) !== name);
  try {
    await sbSaveSettings('subjects', DB.subjects);
    actionPopupDone('ลบวิชาแล้ว',name,'delete');
    renderSubjectsFull();
    renderManage();
  } catch(e) {
    DB.subjects = backup; // rollback
    actionPopupError('ลบวิชาไม่สำเร็จ: '+e.message);
  }
}

async function updateSubjectScore(name, total, hwCount) {
  // hwCount param kept for backward compat but ignored
  const subj = DB.subjects.find(s => (typeof s === 'string' ? s : s.name) === name);
  if(!subj) return;
  if(typeof subj === 'object') {
    subj.total = parseFloat(total) || 100;
    subj.hwCount = parseInt(hwCount) || 10;
  }
  await sbSaveSettings('subjects', DB.subjects);
  renderSubjectsFull();
  actionPopupDone('อัพเดต ' + name + ' แล้ว ✅','','edit');
}

function renderSubjectsFull() {
  const el = document.getElementById('subj-full-list');
  if(!el) return;
  
  // migrate string to object
  if(DB.subjects.length > 0 && typeof DB.subjects[0] === 'string') {
    DB.subjects = DB.subjects.map(s => ({name:s, total:100, hwCount:10}));
  }

  if(!DB.subjects.length) {
    el.innerHTML = '<div class="empty">ยังไม่มีวิชา</div>';
    return;
  }

  el.innerHTML = DB.subjects.map(s => {
    const name = typeof s === 'string' ? s : s.name;
    const hwsInSubj = DB.homeworks.filter(h=>h.subject===name);
    const actualMaxSum = hwsInSubj.reduce((sum,h)=>sum+(h.maxScore||100),0);
    return `<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:15px;font-weight:700;color:var(--text);">${name}</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;background:var(--blue-light);color:var(--blue-dark);padding:2px 8px;border-radius:20px;font-weight:700;">รวม ${actualMaxSum} คะแนน</span>
          <span style="font-size:11px;background:var(--green-light);color:var(--green-dark);padding:2px 8px;border-radius:20px;font-weight:700;">${hwsInSubj.length} ชิ้นงาน</span>
          <button onclick="deleteSubjectFull('${name}')" style="padding:4px 10px;font-size:12px;border-radius:8px;border:1.5px solid var(--red-light);background:var(--red-light);color:var(--red);cursor:pointer;">ลบ</button>
        </div>
      </div>
      ${hwsInSubj.length > 0 ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px;">${hwsInSubj.sort((a,b)=>a.num-b.num).map(h=>`<span style="font-size:11px;padding:2px 8px;background:#F8FAFC;border:1px solid var(--border);border-radius:8px;color:var(--text2);">ชิ้นที่${h.num} <b style="color:var(--text);">${h.title.substring(0,10)}</b> <span style="color:var(--green-dark);font-weight:700;">/${h.maxScore||100}</span></span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

// ===== DROPDOWN SCAN WITH SUBJECT FILTER =====

function populateHWDropdown() {
  const subjFilter = document.getElementById('hw-subj-filter');
  const hwDd = document.getElementById('hw-select-dropdown');
  if(!hwDd) return;

  // populate subject filter
  if(subjFilter) {
    const curSubj = subjFilter.value;
    subjFilter.innerHTML = '<option value="">— ทุกวิชา —</option>';
    getSubjectNames().forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      subjFilter.appendChild(opt);
    });
    if(curSubj) subjFilter.value = curSubj;
  }

  // populate hw dropdown (filter by subject)
  const filterVal = subjFilter ? subjFilter.value : '';
  const cur = hwDd.value;
  hwDd.innerHTML = '<option value="">— เลือกชิ้นงาน —</option>';
  
  DB.homeworks
    .filter(h => (!filterVal || h.subject === filterVal) && !isHWLocked(h))
    .forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.num;
      const perHW = h.maxScore || 100;
      const dl = h.deadline ? ' · ส่ง ' + new Date(h.deadline).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
      opt.textContent = 'ครั้งที่ ' + h.num + ' — ' + h.title + ' (เต็ม ' + perHW + ')' + dl;
      hwDd.appendChild(opt);
    });
  
  if(cur) hwDd.value = cur;
}

function filterHWBySubject() {
  populateHWDropdown();
  // clear selection
  document.getElementById('hw-selected-detail').style.display = 'none';
  const dd = document.getElementById('hw-select-dropdown');
  if(dd) dd.value = '';
  document.getElementById('hw-num-input').value = '';
  document.getElementById('hw-title-input').value = '';
  document.getElementById('hw-maxscore-input').value = '';
}

function selectHWFromDropdown(numStr) {
  if(!numStr) {
    document.getElementById('hw-selected-detail').style.display = 'none';
    document.getElementById('hw-num-input').value = '';
    document.getElementById('hw-title-input').value = '';
    document.getElementById('hw-maxscore-input').value = '';
    return;
  }
  const num = parseInt(numStr);
  const hw = DB.homeworks.find(h => h.num === num);
  if(!hw) return;

  // ใช้ maxScore ของชิ้นงานโดยตรง (ระบบใหม่กำหนดคะแนนต่อชิ้นงาน)
  const scorePerHW = hw.maxScore || 100;

  // set inputs
  document.getElementById('hw-num-input').value = hw.num;
  document.getElementById('hw-title-input').value = hw.title;
  document.getElementById('hw-maxscore-input').value = scorePerHW;
  const subj = document.getElementById('hw-subj-input');
  if(subj && hw.subject) subj.value = hw.subject;

  // show detail
  document.getElementById('hw-detail-num').textContent = hw.num;
  document.getElementById('hw-detail-title').textContent = hw.title;
  const subLabel = hw.subject || 'ไม่ระบุวิชา';
  const dlLabel = hw.deadline ? ' · ส่ง ' + new Date(hw.deadline).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) : '';
  document.getElementById('hw-detail-sub').textContent = subLabel + dlLabel;
  document.getElementById('hw-detail-max').textContent = scorePerHW;
  document.getElementById('hw-selected-detail').style.display = 'block';

  lsSet('hw_current',{num:hw.num,title:hw.title,subject:hw.subject,maxScore:scorePerHW});
  const badge = document.getElementById('hw-save-badge');
  if(badge){badge.style.display='';setTimeout(()=>badge.style.display='none',1500);}
}


function syncManualFields() {
  const num = document.getElementById('hw-num-manual')?.value;
  const title = document.getElementById('hw-title-manual')?.value;
  const max = document.getElementById('hw-maxscore-manual')?.value;
  if(num) { const el = document.getElementById('hw-num-input'); if(el) el.value = num; }
  if(title) { const el = document.getElementById('hw-title-input'); if(el) el.value = title; }
  if(max) { const el = document.getElementById('hw-maxscore-input'); if(el) el.value = max; }
  onHWFieldChange();
}

function toggleHWManual() {
  const manual = document.getElementById('hw-manual-fields');
  const btn = document.getElementById('hw-manual-toggle-btn');
  if(!manual||!btn) return;
  const isOpen = manual.style.display !== 'none';
  manual.style.display = isOpen ? 'none' : 'block';
  btn.textContent = isOpen ? '✏️ กรอกงานใหม่ด้วยตัวเอง' : '✕ ปิด';
  if(!isOpen) {
    const dd = document.getElementById('hw-select-dropdown');
    if(dd) dd.value = '';
    document.getElementById('hw-selected-detail').style.display = 'none';
  }
}


// ===== ROOM STUDENTS MODAL =====
function viewRoomStudents(room) {
  const students = DB.students.filter(s => s.room === room);
  document.getElementById('room-stu-modal-title').textContent = '🏫 ' + room;
  document.getElementById('room-stu-modal-count').textContent = students.length + ' คน';
  document.getElementById('room-stu-search').value = '';
  renderRoomModal(students);
  document.getElementById('room-stu-modal').style.display = 'flex';
}

function filterRoomModal() {
  const q = (document.getElementById('room-stu-search').value || '').toLowerCase();
  const title = document.getElementById('room-stu-modal-title').textContent.replace('🏫 ','');
  const all = DB.students.filter(s => s.room === title);
  const filtered = q ? all.filter(s => s.id.includes(q) || s.name.toLowerCase().includes(q)) : all;
  renderRoomModal(filtered);
}

function renderRoomModal(students) {
  const el = document.getElementById('room-stu-list');
  if(!students.length) {
    el.innerHTML = '<div class="empty">ไม่พบนักเรียน</div>';
    return;
  }
  el.innerHTML = students.map((s, i) => {
    const hwCount = DB.homeworks.length;
    const doneCount = DB.homeworks.filter(h => DB.submissions[s.id + '_' + h.num]).length;
    const pct = hwCount > 0 ? Math.round(doneCount/hwCount*100) : 0;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--purple-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--purple);flex-shrink:0;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:var(--text);">${s.name}</div>
        <div style="font-size:12px;color:var(--text2);">รหัส ${s.id}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:700;color:${pct>=80?'var(--green-dark)':pct>=50?'#B45309':'var(--red)'};">${doneCount}/${hwCount}</div>
        <div style="font-size:11px;color:var(--text3);">${pct}%</div>
      </div>
    </div>`;
  }).join('');
}

function closeRoomModal() {
  document.getElementById('room-stu-modal').style.display = 'none';
}


// ╔══════════════════════════════════════════════════════╗
// ║  SECTION K: UI UTILITIES & POPUPS                  ║
// ╚══════════════════════════════════════════════════════╝
// ===== ACTION POPUP =====
let _apTimer = null;
function showActionPopup(title, sub, type) {
  // type: 'loading' | 'add' | 'delete' | 'edit' | 'upload'
  const icons = {loading:'⏳', add:'💾', delete:'🗑️', edit:'✏️', upload:'📤', success:'✅', error:'❌', warn:'⚠️'};
  const colors = {add:'linear-gradient(90deg,var(--green),var(--green-dark))', delete:'linear-gradient(90deg,var(--red),#DC2626)', edit:'linear-gradient(90deg,var(--blue),var(--purple))', upload:'linear-gradient(90deg,var(--blue),var(--purple))', loading:'linear-gradient(90deg,var(--blue),var(--purple))'};
  document.getElementById('ap-icon').textContent = icons[type]||'⏳';
  document.getElementById('ap-title').textContent = title||'กำลังดำเนินการ...';
  document.getElementById('ap-sub').textContent = sub||'';
  document.getElementById('ap-bar').style.width = '0%';
  document.getElementById('ap-bar').style.background = colors[type]||colors.loading;
  document.getElementById('ap-btn').style.display = 'none';
  document.getElementById('ap-btn').style.background = 'linear-gradient(135deg,var(--green),var(--green-dark))';
  document.getElementById('ap-btn').textContent = '✅ เรียบร้อย';
  document.getElementById('action-popup').style.display = 'flex';
  clearTimeout(_apTimer);
  _apTimer = setTimeout(()=>{ document.getElementById('ap-bar').style.width='70%'; }, 100);
}
function actionPopupDone(title, sub, type) {
  const icons = {add:'✅', delete:'✅', edit:'✅', upload:'🎉', success:'✅', warn:'⚠️'};
  const btnColors = {delete:'linear-gradient(135deg,var(--red),#DC2626)', warn:'linear-gradient(135deg,var(--yellow),#D97706)'};
  document.getElementById('ap-icon').textContent = icons[type]||'✅';
  document.getElementById('ap-title').textContent = title||'เสร็จสิ้น!';
  document.getElementById('ap-sub').textContent = sub||'';
  document.getElementById('ap-bar').style.width = '100%';
  if(type==='delete'||type==='warn') document.getElementById('ap-bar').style.background = type==='delete'?'linear-gradient(90deg,var(--red),#DC2626)':'linear-gradient(90deg,var(--yellow),#D97706)';
  const btn = document.getElementById('ap-btn');
  btn.style.background = btnColors[type]||'linear-gradient(135deg,var(--green),var(--green-dark))';
  btn.textContent = type==='delete'?'✅ ลบเสร็จสิ้น':type==='warn'?'⚠️ รับทราบ':'✅ เรียบร้อย';
  btn.style.display = 'block';
  // auto close after 2s
  clearTimeout(_apTimer);
  _apTimer = setTimeout(closeActionPopup, 2500);
}
function actionPopupError(msg) {
  document.getElementById('ap-icon').textContent = '❌';
  document.getElementById('ap-title').textContent = 'เกิดข้อผิดพลาด';
  document.getElementById('ap-sub').textContent = msg||'';
  document.getElementById('ap-bar').style.width = '100%';
  document.getElementById('ap-bar').style.background = 'var(--red)';
  const btn = document.getElementById('ap-btn');
  btn.style.display = 'block';
  btn.style.background = 'linear-gradient(135deg,var(--red),#DC2626)';
  btn.textContent = '✕ ปิด';
  clearTimeout(_apTimer);
}
function closeActionPopup() {
  clearTimeout(_apTimer);
  document.getElementById('action-popup').style.display = 'none';
}

// ===== HOMEWORK FILE UPLOAD =====

async function uploadHWFile(file, hwNum) {
  if(!SB || !file) return null;
  const tid = CURRENT_TEACHER ? CURRENT_TEACHER.id : 'local';
  const ext = file.name.split('.').pop();
  const path = `hw_files/${tid}/hw_${hwNum}_${Date.now()}.${ext}`;

  // ลอง upload ก่อน ถ้า Bucket not found → สร้าง bucket แล้ว retry
  let uploadResult = await SB.storage.from('homeworks').upload(path, file, { upsert: true });

  if(uploadResult.error) {
    const errMsg = uploadResult.error.message || '';
    if(errMsg.toLowerCase().includes('bucket') || errMsg.toLowerCase().includes('not found')) {
      // สร้าง bucket อัตโนมัติ
      const { error: bucketErr } = await SB.storage.createBucket('homeworks', { public: true });
      if(bucketErr && !bucketErr.message.toLowerCase().includes('already exists')) {
        throw new Error('สร้าง Storage Bucket ไม่สำเร็จ: ' + bucketErr.message + '\n\nกรุณาสร้าง Bucket ชื่อ "homeworks" ใน Supabase Dashboard → Storage ด้วยตนเอง');
      }
      // retry upload
      uploadResult = await SB.storage.from('homeworks').upload(path, file, { upsert: true });
    }
    if(uploadResult.error) throw uploadResult.error;
  }

  const { data: urlData } = SB.storage.from('homeworks').getPublicUrl(path);
  return { url: urlData.publicUrl, name: file.name };
}

async function saveHWWithFile() {
  const num = parseInt(document.getElementById('n-hwnum').value);
  const title = document.getElementById('n-hwtitle').value.trim();
  const subject = document.getElementById('n-hwsubj').value;
  const maxScore = parseInt(document.getElementById('n-hwmaxscore')?.value) || 100;
  const deadlineRaw = document.getElementById('n-hwdeadline')?.value || '';
  const deadline = deadlineRaw.trim() !== '' ? deadlineRaw : null;
  const fileInput = document.getElementById('hw-file-input');
  const file = fileInput?.files[0];

  if(!num || !title) { toast('กรอกให้ครบ','warn'); return; }

  // ตรวจ plan limit (เฉพาะงานใหม่ ไม่ใช่ update)
  const isNewHW = !DB.homeworks.find(h => h.num === num);
  if(isNewHW) {
    const hwLimit = checkPlanLimit('homework');
    if(!hwLimit.ok) { showUpgradeModal(hwLimit.msg); return; }
  }

  showActionPopup('กำลังบันทึกชิ้นงาน','ครั้งที่ '+num+': '+title, 'add');

  let fileUrl = '';
  let fileName = '';

  // ถ้ามีไฟล์ใหม่ → อัพโหลดก่อน
  if(file) {
    try {
      document.getElementById('ap-sub').textContent = 'กำลังอัพโหลดไฟล์: '+file.name;
      const result = await uploadHWFile(file, num);
      if(result) { fileUrl = result.url; fileName = result.name; }
    } catch(e) {
      actionPopupError('อัพโหลดไฟล์ไม่สำเร็จ: '+e.message);
      return;
    }
  } else {
    // ใช้ไฟล์เดิมถ้ามี
    const existing = DB.homeworks.find(h => h.num === num);
    if(existing) { fileUrl = existing.fileUrl||''; fileName = existing.fileName||''; }
  }

  try {
    await sbAddHomework({num, title, subject, maxScore, deadline, fileUrl, fileName});
    if(fileInput) fileInput.value = '';
    updateHWFilePreview(num);
    setTimeout(() => actionPopupDone('บันทึกงานแล้ว ✅','ครั้งที่ '+num+': '+title,'add'), 100);
  } catch(e) {
    actionPopupError('ไม่สำเร็จ: '+e.message);
  }
}

async function removeHWFile(hwNum) {
  if(!confirm('ลบไฟล์แนบของงานชิ้นที่ '+hwNum+'?')) return;
  const h = DB.homeworks.find(x => x.num === hwNum);
  if(!h) return;
  h.fileUrl = ''; h.fileName = '';
  await sbAddHomework({num:h.num,title:h.title,subject:h.subject,maxScore:h.maxScore,deadline:h.deadline,fileUrl:'',fileName:''});
  updateHWFilePreview(hwNum);
  toast('ลบไฟล์แนบแล้ว','warn');
}

function updateHWFilePreview(hwNum) {
  const el = document.getElementById('hw-file-preview-'+hwNum);
  if(!el) return;
  const h = DB.homeworks.find(x => x.num === hwNum);
  if(h && h.fileUrl) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:var(--green-light);border:1.5px solid #86EFAC;border-radius:10px;padding:8px 12px;margin-top:8px;">
      <span style="font-size:18px;">${getFileIcon(h.fileName)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--green-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.fileName||'ไฟล์แนบ'}</div>
        <div style="font-size:11px;color:var(--text2);">ไฟล์แนบสำหรับชิ้นงานนี้</div>
      </div>
      <button onclick="removeHWFile(${hwNum})" style="padding:4px 8px;font-size:11px;border-radius:8px;border:none;background:var(--red-light);color:var(--red);cursor:pointer;flex-shrink:0;">ลบ</button>
    </div>`;
  } else {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);margin-top:4px;">ยังไม่มีไฟล์แนบ</div>';
  }
}

function getFileIcon(name) {
  if(!name) return '📎';
  const ext = name.split('.').pop().toLowerCase();
  const icons = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📑',pptx:'📑',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',zip:'🗜️',rar:'🗜️'};
  return icons[ext]||'📎';
}


function previewSelectedFile(input) {
  const file = input?.files[0];
  const label = document.getElementById('hw-file-label');
  const preview = document.getElementById('hw-file-preview-new');
  if(!label) return;
  if(file) {
    label.innerHTML = getFileIcon(file.name)+' <b>'+file.name+'</b> <span style="color:var(--text3);">('+Math.round(file.size/1024)+' KB)</span>';
    if(preview) preview.innerHTML = '<div style="font-size:11px;color:var(--green-dark);font-weight:600;">✅ เลือกไฟล์แล้ว — จะอัพโหลดเมื่อกดบันทึก</div>';
  } else {
    label.innerHTML = '📂 คลิกเพื่อเลือกไฟล์ (PDF, Word, Excel, รูปภาพ)';
    if(preview) preview.innerHTML = '';
  }
}
// ============================================================
//  PLAN SYSTEM
// ============================================================

const FREE_LIMITS = {
  rooms: 5,
  studentsPerRoom: 40,
  homeworks: 9,
  exportExcel: false,
  ai: false,
  parentReport: false,
  gradeTemplate: false,
};

function getTeacherPlan() {
  if (!CURRENT_TEACHER) return 'free';
  const plan = CURRENT_TEACHER.plan || 'free';
  // ถ้าเป็น premium แต่ plan_expires_at หมดอายุแล้ว → ถือว่า free เสมอ
  // (ป้องกันกรณี DB update ล้มเหลว แต่ realtime ยังส่ง plan='premium' มา)
  if (plan === 'premium' && CURRENT_TEACHER.plan_expires_at) {
    if (new Date(CURRENT_TEACHER.plan_expires_at) < new Date()) {
      return 'free';
    }
  }
  return plan;
}

function isPremium() {
  if(isBypassAccount()) return true; // bypass accounts = premium
  return getTeacherPlan() === 'premium';
}

function checkPlanLimit(type, extra) {
  if (isPremium()) return { ok: true };
  switch(type) {
    case 'room':
      if (DB.rooms.length >= FREE_LIMITS.rooms)
        return { ok: false, msg: `แพลน Free จำกัด ${FREE_LIMITS.rooms} ห้องเรียน 🔒`, upgrade: true };
      return { ok: true };
    case 'student': {
      const room = extra;
      const count = DB.students.filter(s => s.room === room).length;
      if (count >= FREE_LIMITS.studentsPerRoom)
        return { ok: false, msg: `แพลน Free จำกัดนักเรียน ${FREE_LIMITS.studentsPerRoom} คน/ห้อง 🔒`, upgrade: true };
      return { ok: true };
    }
    case 'homework':
      if (DB.homeworks.length >= FREE_LIMITS.homeworks)
        return { ok: false, msg: `แพลน Free จำกัด ${FREE_LIMITS.homeworks} ชิ้นงาน 🔒`, upgrade: true };
      return { ok: true };
    case 'excel':
      return { ok: false, msg: 'Export Excel เฉพาะแพลน Premium 🔒', upgrade: true };
    default:
      return { ok: true };
  }
}

function showPlanLimitToast(msg) {
  showUpgradeModal(msg);
}

function showUpgradeModal(reason) {
  const existing = document.getElementById('upgrade-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'upgrade-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
  const features = [
    ['🏫','ห้องเรียนและนักเรียนไม่จำกัด'],
    ['📝','ชิ้นงานไม่จำกัด'],
    ['📊','Export Excel + PDF ครบชุด'],
    ['🤖','AI สรุปรายงานห้องเรียน (เร็วๆ นี้)'],
    ['📄','รายงานผู้ปกครองอัตโนมัติ (เร็วๆ นี้)'],
    ['📐','Template คำนวณเกรดรายเทอม (เร็วๆ นี้)'],
  ];
  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:28px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-size:44px;margin-bottom:12px;">💎</div>
      <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px;">อัปเกรดเป็น Premium</div>
      ${reason ? '<div style="font-size:13px;color:#B45309;background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:10px;padding:8px 12px;margin-bottom:16px;">'+reason+'</div>' : ''}
      <div style="text-align:left;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">สิทธิ์ Premium ครู</div>
        ${features.map(([icon,text])=>'<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);"><span style="font-size:16px;width:24px;text-align:center;">'+icon+'</span><span style="font-size:14px;color:var(--text);">'+text+'</span></div>').join('')}
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px;">ราคาเริ่มต้น <b style="color:var(--purple);font-size:16px;">฿99</b> / เดือน</div>
      <button onclick="document.getElementById('upgrade-modal').remove();openRenewalFlow()" style="width:100%;padding:14px;font-size:16px;font-weight:700;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#7C3AED,#4F8EF7);color:#fff;box-shadow:0 4px 16px rgba(124,58,237,0.35);font-family:Sarabun,sans-serif;">💳 อัพเกรดพรีเมี่ยม</button>
      <button onclick="document.getElementById('upgrade-modal').remove()" style="width:100%;padding:10px;font-size:14px;font-weight:600;border-radius:10px;border:none;cursor:pointer;background:none;color:var(--text3);margin-top:8px;font-family:Sarabun,sans-serif;">ยังไม่สนใจ</button>
    </div>`;
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function showUpgradeInfo() { showUpgradeModal(); }

function renderPlanBanner() {
  // ===== Topbar badge =====
  const topbarBadge = document.getElementById('topbar-plan-badge');
  if(topbarBadge) {
    if(isPremium()) {
      const exp = CURRENT_TEACHER && CURRENT_TEACHER.plan_expires_at;
      const expStr = exp ? new Date(exp).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}) : '';
      topbarBadge.style.display = '';
      topbarBadge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:linear-gradient(135deg,#FDE68A,#FCD34D);color:#78350F;white-space:nowrap;">💎 Premium${expStr?' · '+expStr:''}</span>`;
    } else {
      topbarBadge.style.display = '';
      topbarBadge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(255,255,255,0.2);color:rgba(255,255,255,0.9);white-space:nowrap;cursor:pointer;" onclick="showUpgradeModal()">🎁 Free ⬆️</span>`;
    }
  }

  // ===== Excel lock icon =====
  const lockIcon = document.getElementById('excel-lock-icon');
  if(lockIcon) lockIcon.textContent = isPremium() ? '' : '🔒';

  // ===== Dashboard plan banner =====
  const el = document.getElementById('plan-banner');
  if (!el) return;
  if (isPremium()) {
    const exp = CURRENT_TEACHER && CURRENT_TEACHER.plan_expires_at;
    const expStr = exp ? new Date(exp).toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'2-digit'}) : 'ไม่มีกำหนด';
    const daysLeft = exp ? Math.ceil((new Date(exp) - new Date()) / 86400000) : null;
    const urgentStyle = daysLeft !== null && daysLeft <= 7 ? 'border-color:#FCD34D;background:linear-gradient(135deg,#FFFBEB,#FEF3C7);' : 'border-color:#C4B5FD;background:linear-gradient(135deg,#FAF5FF,#EDE9FE);';
    el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;${urgentStyle}border:1.5px solid;border-radius:12px;margin-bottom:10px;">
      <span style="font-size:24px;">💎</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#6D28D9;">Premium Plan</div>
        <div style="font-size:11px;color:#7C3AED;">หมดอายุ: ${expStr}${daysLeft!==null?' · เหลือ '+daysLeft+' วัน':''}</div>
      </div>
      ${daysLeft !== null && daysLeft <= 7 ? '<span style="font-size:11px;font-weight:700;background:#FCD34D;color:#78350F;padding:3px 8px;border-radius:20px;">ใกล้หมดอายุ!</span>' : ''}
    </div>`;
  } else {
    const roomsUsed = DB.rooms.length;
    const hwUsed = DB.homeworks.length;
    const roomPct = Math.min(100, roomsUsed / FREE_LIMITS.rooms * 100);
    const hwPct = Math.min(100, hwUsed / FREE_LIMITS.homeworks * 100);
    const roomWarn = roomPct >= 80;
    const hwWarn = hwPct >= 80;
    el.innerHTML = `<div style="background:#fff;border:1.5px solid ${roomWarn||hwWarn?'#FCD34D':'#CBD5E1'};border-radius:12px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span class="plan-badge-free">🎁 Free Plan</span>
        <button onclick="showUpgradeModal()" style="padding:5px 14px;font-size:12px;font-weight:700;border-radius:20px;border:none;background:linear-gradient(135deg,#7C3AED,#4F8EF7);color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;">⬆️ อัปเกรด</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span style="color:var(--text2);">🏫 ห้องเรียน</span>
            <span style="font-weight:700;color:${roomWarn?'#B45309':'var(--text)'};">${roomsUsed}/${FREE_LIMITS.rooms}</span>
          </div>
          <div class="plan-limit-bar"><div class="plan-limit-fill ${roomWarn?'warn':'ok'}" style="width:${roomPct}%;"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span style="color:var(--text2);">📝 ชิ้นงาน</span>
            <span style="font-weight:700;color:${hwWarn?'#B45309':'var(--text)'};">${hwUsed}/${FREE_LIMITS.homeworks}</span>
          </div>
          <div class="plan-limit-bar"><div class="plan-limit-fill ${hwWarn?'warn':'ok'}" style="width:${hwPct}%;"></div></div>
        </div>
      </div>
      ${roomWarn||hwWarn?`<div style="margin-top:8px;font-size:11px;font-weight:600;color:#B45309;background:#FEF3C7;border-radius:8px;padding:5px 10px;">⚠️ ${roomPct>=100||hwPct>=100?'ถึงขีดจำกัดแล้ว — อัปเกรดเพื่อเพิ่มต่อ':'ใกล้ถึงขีดจำกัด — พิจารณาอัปเกรด'}</div>`:''}
    </div>`;
  }
}

// ===== SUPER ADMIN: SET PLAN MODAL =====
function openSetPlan(tid, currentPlan) {
  document.getElementById('set-plan-tid').value = tid;
  const teacher = (_cachedTeachers || []).find(t => t.id === tid);
  document.getElementById('set-plan-teacher-name').textContent = teacher ? teacher.display_name : '';
  // set radio
  document.querySelectorAll('input[name="set-plan-radio"]').forEach(r => {
    r.checked = r.value === (currentPlan || 'free');
  });
  selectPlanOption(currentPlan || 'free');
  // set expiry date
  const expDate = teacher && teacher.plan_expires_at ? teacher.plan_expires_at.slice(0,10) : '';
  document.getElementById('set-plan-expiry-date').value = expDate;
  // show/hide expiry row
  document.getElementById('set-plan-expiry-row').style.display = (currentPlan === 'premium') ? '' : 'none';
  // clear error
  const errEl = document.getElementById('set-plan-error');
  if(errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  document.getElementById('set-plan-modal').style.display = 'flex';
}

function closeSetPlanModal() {
  document.getElementById('set-plan-modal').style.display = 'none';
}

function selectPlanOption(plan) {
  document.getElementById('plan-option-free').style.borderColor = plan === 'free' ? 'var(--blue)' : 'var(--border)';
  document.getElementById('plan-option-free').style.background = plan === 'free' ? 'var(--blue-light)' : '#fff';
  document.getElementById('plan-option-premium').style.borderColor = plan === 'premium' ? 'var(--purple)' : 'var(--border)';
  document.getElementById('plan-option-premium').style.background = plan === 'premium' ? 'var(--purple-light)' : '#fff';
  const radio = document.querySelector(`input[name="set-plan-radio"][value="${plan}"]`);
  if (radio) radio.checked = true;
  const expiryRow = document.getElementById('set-plan-expiry-row');
  if (expiryRow) expiryRow.style.display = plan === 'premium' ? '' : 'none';
}

async function confirmSetPlan() {
  const tid = document.getElementById('set-plan-tid').value;
  if(!tid){ toast2('ไม่พบ ID ครู','err'); return; }
  if(!USE_SUPABASE || !SB){ toast2('ต้องเชื่อมต่อ Supabase ก่อน','err'); return; }

  const plan = document.querySelector('input[name="set-plan-radio"]:checked')?.value || 'free';
  const expiryVal = document.getElementById('set-plan-expiry-date').value;
  const planExpiresAt = (plan === 'premium' && expiryVal) ? new Date(expiryVal).toISOString() : null;

  const btn = document.querySelector('#set-plan-modal button[onclick="confirmSetPlan()"]');
  if(btn){ btn.textContent = '⏳ กำลังบันทึก...'; btn.disabled = true; }

  try {
    // ตรวจสอบก่อนว่า teacher มีอยู่จริง
    const { data: existing, error: fetchErr } = await SB.from('teachers').select('id,plan').eq('id', tid).single();
    if(fetchErr) throw new Error('ไม่พบข้อมูลครู: ' + fetchErr.message);

    const updateData = { plan };
    if(plan === 'premium') {
      updateData.plan_expires_at = planExpiresAt;
    } else {
      updateData.plan_expires_at = null;
    }

    // ถ้าไอดีนี้ status=expired ให้ reactivate เป็น approved ด้วย
    const teacher = (_cachedTeachers || []).find(t => t.id === tid);
    const isExpiredAcc = teacher && (
      teacher.status === 'expired' ||
      (teacher.status === 'approved' && teacher.expires_at && new Date(teacher.expires_at) < new Date())
    );
    if(isExpiredAcc) {
      updateData.status = 'approved';
      // ต่ออายุบัญชี: ใช้ plan_expires_at ถ้าเป็น premium ไม่งั้นให้ 365 วัน
      const newExpiry = planExpiresAt
        ? new Date(planExpiresAt)
        : new Date(Date.now() + 365 * 86400000);
      updateData.expires_at = newExpiry.toISOString();
    }

    const { data, error } = await SB.from('teachers').update(updateData).eq('id', tid).select();
    if(error) throw error;

    // อัปเดต cache ทันที
    if(_cachedTeachers) {
      const idx = _cachedTeachers.findIndex(t => t.id === tid);
      if(idx >= 0) {
        _cachedTeachers[idx].plan = plan;
        _cachedTeachers[idx].plan_expires_at = updateData.plan_expires_at;
        if(updateData.status) _cachedTeachers[idx].status = updateData.status;
        if(updateData.expires_at) _cachedTeachers[idx].expires_at = updateData.expires_at;
      }
    }

    closeSetPlanModal();
    const reactivated = isExpiredAcc ? ' · เปิดใช้งานอีกครั้งแล้ว ✨' : '';
    toast2(`✅ เปลี่ยน Plan เป็น ${plan === 'premium' ? '💎 Premium' : '🎁 Free'} แล้ว${reactivated}`);
    // ถ้า reactivate → สลับ tab ไปหา "ผู้ใช้งาน" เพื่อให้เห็นการเปลี่ยนแปลง
    if(isExpiredAcc) {
      _saStatusFilter = 'active';
      const activeBtn = document.getElementById('sa-tab-active');
      if(activeBtn) setSAFilter('active', activeBtn);
    }
    await loadSuperAdminPanel();
  } catch(e) {
    console.error('[confirmSetPlan] error:', e);
    const errMsg = e.message || JSON.stringify(e);
    toast2('บันทึกไม่สำเร็จ: ' + errMsg, 'err');
    // แสดง error ในตัว modal ด้วย เผื่อ toast ไม่เห็น
    const errEl = document.getElementById('set-plan-error');
    if(errEl) { errEl.textContent = '❌ ' + errMsg; errEl.style.display = ''; }
  } finally {
    if(btn){ btn.textContent = '💾 บันทึก'; btn.disabled = false; }
  }
}


// ===== SLIP PLAN SELECTOR =====

let _selectedSlipPlan = 'free';

function selectSlipPlan(plan) {
  _selectedSlipPlan = plan;
  const freeLabel = document.getElementById('plan-sel-free');
  const premLabel = document.getElementById('plan-sel-premium');
  const note = document.getElementById('slip-plan-note');
  const payAmt = document.getElementById('payment-amount');
  const submitBtn = document.getElementById('slip-submit-btn');
  const uploadArea = document.getElementById('slip-upload-area');

  if(freeLabel) {
    freeLabel.style.borderColor = plan==='free' ? 'var(--blue)' : 'var(--border)';
    freeLabel.style.background = plan==='free' ? 'var(--blue-light)' : '#fff';
  }
  if(premLabel) {
    premLabel.style.borderColor = plan==='premium' ? 'var(--purple)' : 'var(--border)';
    premLabel.style.background = plan==='premium' ? 'linear-gradient(135deg,#FAFAFF,#F5F0FF)' : '#fff';
    premLabel.style.boxShadow = plan==='premium' ? '0 2px 12px rgba(124,58,237,0.15)' : 'none';
  }

  if(plan === 'free') {
    if(payAmt) payAmt.textContent = 'ฟรี (ไม่ต้องชำระ)';
    if(payAmt) payAmt.style.color = 'var(--green-dark)';
    if(note) note.textContent = '✅ แพลนฟรี — กดปุ่มด้านล่างเพื่อเริ่มใช้งานได้เลย';
    if(note) note.style.color = 'var(--green-dark)';
    // ซ่อน upload area แสดงปุ่มเริ่มใช้งานฟรีแทน
    if(uploadArea) uploadArea.style.display = 'none';
    // แสดงปุ่มฟรี
    let freeBtn = document.getElementById('free-plan-btn');
    if(!freeBtn) {
      freeBtn = document.createElement('button');
      freeBtn.id = 'free-plan-btn';
      freeBtn.onclick = uploadSlip;
      freeBtn.style.cssText = 'width:100%;padding:16px;font-size:17px;font-weight:700;border-radius:14px;border:none;background:linear-gradient(135deg,var(--blue),var(--purple));color:#fff;cursor:pointer;font-family:Sarabun,sans-serif;margin-top:8px;';
      freeBtn.textContent = '🚀 เริ่มใช้งาน Free Plan';
      uploadArea.parentNode.insertBefore(freeBtn, uploadArea.nextSibling);
    }
    freeBtn.style.display = 'block';
    // ซ่อน payment info
    const payInfo = document.querySelector('[style*="payment-bank"]');
    const payBlock = document.getElementById('payment-bank')?.closest('[style*="blue-light"]');
    if(payBlock) payBlock.style.display = 'none';
  } else {
    // premium
    if(payAmt) payAmt.textContent = '฿99-149 / เดือน';
    if(payAmt) payAmt.style.color = 'var(--purple)';
    if(note) note.textContent = '💎 Premium — โอนเงินแล้วส่งสลิปด้านล่าง';
    if(note) note.style.color = 'var(--purple)';
    if(uploadArea) uploadArea.style.display = '';
    const freeBtn = document.getElementById('free-plan-btn');
    if(freeBtn) freeBtn.style.display = 'none';
    const payBlock = document.getElementById('payment-bank')?.closest('[style*="blue-light"]') ||
                     document.querySelector('#s-slip [style*="blue-light"]');
    if(payBlock) payBlock.style.display = '';
  }
}

async function activateFreeTeacher() {
  if(!SB || !CURRENT_TEACHER) return;
  try {
    const {error} = await SB.from('teachers').update({
      status: 'approved',
      plan: 'free',
      plan_requested: 'free',
      expires_at: null
    }).eq('id', CURRENT_TEACHER.id);
    if(error) throw error;
    CURRENT_TEACHER.status = 'approved';
    CURRENT_TEACHER.plan = 'free';
    toast('เริ่มใช้งาน Free Plan แล้ว ✅');
    // โหลดข้อมูลและเข้าระบบ
    await loadFromSupabase();
    await loadGlobalBypassIds(); // โหลด bypass IDs ก่อน render เพื่อให้ isPremium() ถูกต้องทันที
    await loadAnthropicKey();
    setTimeout(()=>setupRealtime(),500);
    showScreen('s-admin');
    renderDashboard();
  } catch(e) {
    toast('เกิดข้อผิดพลาด: '+e.message, 'err');
  }
}


function renderPlanRequestedBadge(plan) {
  if(!plan) return '';
  if(plan === 'free') {
    return '<span style="font-size:11px;font-weight:700;background:#F1F5F9;color:#64748B;padding:3px 10px;border-radius:20px;border:1.5px solid #E2E8F0;">🎁 ขอ Free Plan</span>';
  }
  if(plan === 'premium') {
    return '<span style="font-size:11px;font-weight:700;background:var(--purple-light);color:var(--purple);padding:3px 10px;border-radius:20px;border:1.5px solid #C4B5FD;">💎 ขอ Premium Plan</span>';
  }
  return '';
}

// เพิ่ม plan badge ใน topbar ของครู
function renderTeacherPlanBadge() {
  const plan = CURRENT_TEACHER?.plan || 'free';
  const badge = plan === 'premium'
    ? '<span style="font-size:10px;font-weight:700;background:linear-gradient(135deg,var(--purple),#7C3AED);color:#fff;padding:2px 8px;border-radius:20px;margin-left:4px;">💎 Premium</span>'
    : '<span style="font-size:10px;font-weight:700;background:rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:2px 8px;border-radius:20px;margin-left:4px;">🎁 Free</span>';
  const roleEl = document.getElementById('teacher-topbar-role');
  if(roleEl && !roleEl.querySelector('.plan-badge')) {
    const span = document.createElement('span');
    span.className = 'plan-badge';
    span.innerHTML = badge;
    roleEl.appendChild(span);
  }
}

function renderPlanLimitBadges() {
  // แสดง badge ขีดจำกัดใน header ของแต่ละ section
  const plan = getTeacherPlan();

  // ลบ badges เก่าก่อนเสมอ (เพื่อให้ตัวเลขอัพเดตถูกต้อง)
  document.querySelectorAll('.limit-badge').forEach(b => b.remove());

  if(plan === 'premium') return; // premium ไม่แสดง limit

  // Room limit badge
  const roomCard = document.querySelector('#mtab-rooms .card-title');
  if(roomCard) {
    const used = DB.rooms.length;
    const max = FREE_LIMITS.rooms;
    const pct = used/max;
    const color = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? '#B45309' : 'var(--text2)';
    const badge = document.createElement('span');
    badge.className = 'limit-badge';
    badge.style.cssText = 'font-size:11px;font-weight:700;margin-left:8px;padding:2px 8px;border-radius:20px;background:'+(pct>=1?'var(--red-light)':'var(--bg)')+';color:'+color+';';
    badge.textContent = used+'/'+max+' ห้อง';
    roomCard.appendChild(badge);
  }

  // HW limit badge
  const hwCard = document.querySelector('#mtab-homework .card-title');
  if(hwCard) {
    const used = DB.homeworks.length;
    const max = FREE_LIMITS.homeworks;
    const pct = used/max;
    const color = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? '#B45309' : 'var(--text2)';
    const badge = document.createElement('span');
    badge.className = 'limit-badge';
    badge.style.cssText = 'font-size:11px;font-weight:700;margin-left:8px;padding:2px 8px;border-radius:20px;background:'+(pct>=1?'var(--red-light)':'var(--bg)')+';color:'+color+';';
    badge.textContent = used+'/'+max+' ชิ้น';
    hwCard.appendChild(badge);
  }
}

// ╔══════════════════════════════════════════════════════╗
// ║  SECTION J: PREMIUM FEATURES (AI / GRADE)          ║
// ╚══════════════════════════════════════════════════════╝
// ╔══════════════════════════════════════════════════════╗
// ║  SECTION H: SUBJECT & GRADE MANAGEMENT             ║
// ╚══════════════════════════════════════════════════════╝
// ===== GRADE TEMPLATE SYSTEM =====

const DEFAULT_GRADE_CRITERIA = [
  {grade:'A', min:80, gpa:4.0},
  {grade:'B+',min:75, gpa:3.5},
  {grade:'B', min:70, gpa:3.0},
  {grade:'C+',min:65, gpa:2.5},
  {grade:'C', min:60, gpa:2.0},
  {grade:'D+',min:55, gpa:1.5},
  {grade:'D', min:50, gpa:1.0},
  {grade:'F', min:0,  gpa:0.0},
];

let gradeCriteria = JSON.parse(localStorage.getItem('grade_criteria')||'null') || [...DEFAULT_GRADE_CRITERIA];

// ข้อมูลคะแนนสอบที่ import มา
let _priExamScores = {};   // {ชื่อนักเรียน: คะแนน}
let _secMidScores = {};    // {ชื่อนักเรียน: คะแนน}
let _secFinalScores = {};  // {ชื่อนักเรียน: คะแนน}
let _currentSecTerm = 1;

// ==================== NAVIGATION ====================

function isGradeAllowed() {
  return CURRENT_TEACHER?.username === 'test';
}

function openGradeTab() {
  if(!checkFeatureGate('grade','จัดการเกรด')) return;
  const gate = document.getElementById('grade-premium-gate');
  const content = document.getElementById('grade-content');

  // 🔒 ล็อกชั่วคราว — เฉพาะ username 'test' เท่านั้น
  if(!isGradeAllowed()) {
    if(gate) gate.style.display = 'none';
    if(content) {
      content.style.display = 'block';
      content.innerHTML = `
        <div style="text-align:center;padding:48px 24px;color:var(--text2);">
          <div style="font-size:48px;margin-bottom:16px;">🚧</div>
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:8px;">กำลังพัฒนา</div>
          <div style="font-size:14px;color:var(--text3);">ระบบเกรดอยู่ระหว่างการพัฒนา<br>จะเปิดให้ใช้งานเร็วๆ นี้</div>
        </div>`;
    }
    return;
  }

  if(gate && content) {
    const isPrem = isPremium();
    gate.style.display = isPrem ? 'none' : 'block';
    content.style.display = isPrem ? 'block' : 'none';
    if(!isPrem) return;
  }
  // แสดง level selector
  showGradeView('level-selector');
  renderGradeCriteria('grade-criteria-list');
  renderGradeCriteria('grade-criteria-list-sec');
}

function showGradeView(view) {
  ['grade-level-selector','grade-primary-section','grade-secondary-section'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  if(view === 'level-selector') {
    document.getElementById('grade-level-selector').style.display = 'block';
  } else if(view === 'primary') {
    document.getElementById('grade-primary-section').style.display = 'block';
    populatePrimarySelects();
    renderPrimaryGrade();
  } else if(view === 'secondary') {
    document.getElementById('grade-secondary-section').style.display = 'block';
    document.getElementById('sec-term-selector').style.display = 'grid';
    document.getElementById('sec-term-detail').style.display = 'none';
  }
}

function selectGradeLevel(level) {
  showGradeView(level);
}

function backToLevelSelector() {
  showGradeView('level-selector');
}

function selectSecTerm(term) {
  _currentSecTerm = term;
  document.getElementById('sec-term-selector').style.display = 'none';
  document.getElementById('sec-term-detail').style.display = 'block';
  document.getElementById('sec-term-title').textContent = '🏛️ มัธยมศึกษา — เทอม ' + term;
  populateSecSelects();
  renderSecGrade();
  renderGradeCriteria('grade-criteria-list-sec');
}

function backToTermSelector() {
  document.getElementById('sec-term-selector').style.display = 'grid';
  document.getElementById('sec-term-detail').style.display = 'none';
}

// ==================== GRADE CRITERIA ====================

function resetGradeCriteria() {
  gradeCriteria = [...DEFAULT_GRADE_CRITERIA];
  localStorage.setItem('grade_criteria', JSON.stringify(gradeCriteria));
  renderGradeCriteria('grade-criteria-list');
  renderGradeCriteria('grade-criteria-list-sec');
}

function getGradeColor(grade) {
  const colors = {A:'#16A34A','B+':'#2563EB',B:'#3B82F6','C+':'#7C3AED',C:'#8B5CF6','D+':'#F59E0B',D:'#D97706',F:'#EF4444'};
  return colors[grade] || 'var(--text)';
}

function calculateGrade(score100) {
  const sorted = [...gradeCriteria].sort((a,b)=>b.min-a.min);
  for(const c of sorted) { if(score100 >= c.min) return c; }
  return {grade:'F', gpa:0.0};
}

function renderGradeCriteria(elId) {
  const el = document.getElementById(elId||'grade-criteria-list');
  if(!el) return;
  el.innerHTML = gradeCriteria.map((c,i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="width:34px;text-align:center;font-size:14px;font-weight:800;color:${getGradeColor(c.grade)};flex-shrink:0;">${c.grade}</div>
      <div style="font-size:12px;color:var(--text2);flex-shrink:0;">คะแนน ≥</div>
      <input type="number" value="${c.min}" min="0" max="100"
        style="width:64px;text-align:center;font-weight:700;padding:5px;font-size:13px;border-radius:8px;"
        onchange="gradeCriteria[${i}].min=parseFloat(this.value);gradeCriteria.sort((a,b)=>b.min-a.min);localStorage.setItem('grade_criteria',JSON.stringify(gradeCriteria));renderGradeCriteria('${elId||'grade-criteria-list'}');renderPrimaryGrade();renderSecGrade();">
      <div style="font-size:12px;color:var(--text2);flex-shrink:0;margin-left:4px;">GPA</div>
      <input type="number" value="${c.gpa}" min="0" max="4" step="0.5"
        style="width:56px;text-align:center;font-weight:700;padding:5px;font-size:13px;border-radius:8px;"
        onchange="gradeCriteria[${i}].gpa=parseFloat(this.value);localStorage.setItem('grade_criteria',JSON.stringify(gradeCriteria));">
    </div>
  `).join('');
}

// ==================== EXCEL IMPORT SCORES ====================

function parseScoreExcel(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      const result = {};
      rows.forEach((row, ri) => {
        if(ri === 0) return; // skip header
        const cols = row.map(c => String(c).trim());
        if(cols.length < 2) return;
        let name = '', score = null;
        // auto-detect: 2 cols = name|score, 3 cols = id|name|score
        if(cols.length >= 3 && !isNaN(parseFloat(cols[2]))) {
          name = cols[1]; score = parseFloat(cols[2]);
        } else if(!isNaN(parseFloat(cols[1]))) {
          name = cols[0]; score = parseFloat(cols[1]);
        }
        if(name && score !== null && !isNaN(score)) result[name] = score;
      });
      callback(result, Object.keys(result).length);
    } catch(e) { toast('อ่านไฟล์ไม่สำเร็จ: '+e.message, 'err'); }
  };
  reader.readAsArrayBuffer(file);
}

function matchScoreToStudents(students, scoreMap) {
  // จับคู่ชื่อ (ตรง + trimmed + partial)
  const matched = {};
  students.forEach(s => {
    const sName = s.name.trim();
    if(scoreMap[sName] !== undefined) {
      matched[s.id] = scoreMap[sName]; return;
    }
    // ลอง partial match
    const key = Object.keys(scoreMap).find(k =>
      k.includes(sName) || sName.includes(k) ||
      k.replace(/s/g,'') === sName.replace(/s/g,'')
    );
    if(key) matched[s.id] = scoreMap[key];
  });
  return matched;
}

function importPrimaryScores(input) {
  const file = input.files[0];
  if(!file) return;
  parseScoreExcel(file, (scores, count) => {
    _priExamScores = scores;
    const label = document.getElementById('pri-score-label');
    const result = document.getElementById('pri-import-result');
    if(label) label.innerHTML = '✅ ' + file.name + ' (' + count + ' รายการ)';
    if(result) {
      const students = getFilteredStudentsPri();
      const matched = matchScoreToStudents(students, scores);
      result.innerHTML = '<span style="color:var(--green-dark);font-weight:700;">✅ จับคู่ได้ ' + Object.keys(matched).length + '/' + students.length + ' คน</span>';
    }
    renderPrimaryGrade();
  });
}

function importSecScores(input, type) {
  const file = input.files[0];
  if(!file) return;
  parseScoreExcel(file, (scores, count) => {
    const label = document.getElementById('sec-'+type+'-label');
    const result = document.getElementById('sec-'+type+'-result');
    if(type === 'mid') _secMidScores = scores;
    else _secFinalScores = scores;
    if(label) label.innerHTML = '✅ ' + file.name + ' (' + count + ')';
    const students = getFilteredStudentsSec();
    const matched = matchScoreToStudents(students, scores);
    if(result) result.innerHTML = '<span style="color:var(--green-dark);font-weight:700;">✅ จับคู่ ' + Object.keys(matched).length + '/' + students.length + ' คน</span>';
    renderSecGrade();
  });
}

// ==================== ประถมศึกษา ====================

function populatePrimarySelects() {
  const roomSel = document.getElementById('pri-room-sel');
  const subjSel = document.getElementById('pri-subj-sel');
  if(roomSel) { const c=roomSel.value; roomSel.innerHTML='<option value="">ทุกห้อง</option>'+DB.rooms.map(r=>`<option>${r}</option>`).join(''); if(c)roomSel.value=c; }
  if(subjSel) { const c=subjSel.value; subjSel.innerHTML='<option value="">ทุกวิชา</option>'+getSubjectNames().map(n=>`<option>${n}</option>`).join(''); if(c)subjSel.value=c; }
}

function getFilteredStudentsPri() {
  const room = document.getElementById('pri-room-sel')?.value||'';
  return DB.students.filter(s=>!room||s.room===room);
}

function renderPrimaryGrade() {
  const el = document.getElementById('pri-grade-table');
  if(!el) return;
  const filterSubj = document.getElementById('pri-subj-sel')?.value||'';
  const students = getFilteredStudentsPri();
  if(!students.length) { el.innerHTML='<div class="empty">ไม่พบนักเรียน</div>'; return; }

  const hws = (DB.homeworks||[]).filter(h=>!filterSubj||h.subject===filterSubj);
  const examMatched = matchScoreToStudents(students, _priExamScores);

  const rows = students.map(s => {
    // คะแนนชิ้นงาน
    let hwTotal=0, hwMax=0;
    hws.forEach(h => {
      const sub = DB.submissions[s.id+'_'+h.num];
      if(sub?.score!=null){hwTotal+=parseFloat(sub.score)||0;hwMax+=parseFloat(sub.maxScore||h.maxScore||100);}
      else hwMax+=parseFloat(h.maxScore||100);
    });
    const hwPct = hwMax>0?(hwTotal/hwMax)*100:0;
    const examScore = examMatched[s.id]??null;

    // รวมคะแนน: ถ้ามีคะแนนสอบ ใช้เฉลี่ย 50:50
    let total;
    if(examScore!==null) total = (hwPct*0.5) + (examScore*0.5);
    else total = hwPct;

    const grade = calculateGrade(total);
    return {s, hwPct, examScore, total, grade};
  }).sort((a,b)=>b.total-a.total);

  const gradeSummary = {};
  gradeCriteria.forEach(c=>gradeSummary[c.grade]=0);
  rows.forEach(r=>{ if(gradeSummary[r.grade.grade]!==undefined) gradeSummary[r.grade.grade]++; });
  const avg = rows.reduce((s,r)=>s+r.total,0)/rows.length;

  el.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
      ${gradeCriteria.map(c=>`<div style="text-align:center;background:#fff;border-radius:8px;padding:5px 10px;border:1.5px solid var(--border);">
        <div style="font-size:13px;font-weight:800;color:${getGradeColor(c.grade)};">${c.grade}</div>
        <div style="font-size:15px;font-weight:700;">${gradeSummary[c.grade]||0}</div>
      </div>`).join('')}
      <div style="text-align:center;background:var(--blue-light);border-radius:8px;padding:5px 10px;border:1.5px solid #BFDBFE;margin-left:auto;">
        <div style="font-size:11px;color:var(--blue-dark);font-weight:600;">เฉลี่ย</div>
        <div style="font-size:15px;font-weight:700;color:var(--blue-dark);">${avg.toFixed(1)}</div>
      </div>
    </div>
    <div style="overflow-x:auto;border-radius:10px;border:1.5px solid var(--border);">
      <table class="mini-tbl" style="min-width:420px;">
        <thead><tr>
          <th>#</th><th>ชื่อ</th><th>ห้อง</th>
          <th>งาน%</th><th>สอบ</th><th>รวม</th><th>เกรด</th><th>GPA</th>
        </tr></thead>
        <tbody>
          ${rows.map((r,i)=>`<tr style="background:${i%2===0?'#fff':'#FAFAFA'};">
            <td style="color:var(--text3);">${i+1}</td>
            <td style="font-weight:600;">${r.s.name}</td>
            <td><span class="room-pill">${r.s.room}</span></td>
            <td style="text-align:center;color:var(--purple);font-weight:700;">${r.hwPct.toFixed(1)}</td>
            <td style="text-align:center;color:var(--blue);font-weight:700;">${r.examScore!==null?r.examScore.toFixed(1):'—'}</td>
            <td style="text-align:center;font-weight:800;color:${r.total>=80?'var(--green-dark)':r.total>=60?'var(--blue)':'var(--red)'};">${r.total.toFixed(1)}</td>
            <td style="text-align:center;font-size:14px;font-weight:800;color:${getGradeColor(r.grade.grade)};">${r.grade.grade}</td>
            <td style="text-align:center;font-weight:700;">${r.grade.gpa.toFixed(1)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function exportPrimaryGradeExcel() {
  if(!isPremium()){showUpgradeModal('Export Excel เฉพาะ Premium 🔒');return;}
  const filterSubj=document.getElementById('pri-subj-sel')?.value||'ทุกวิชา';
  const students=getFilteredStudentsPri();
  const hws=(DB.homeworks||[]).filter(h=>!filterSubj||filterSubj==='ทุกวิชา'||h.subject===filterSubj);
  const examMatched=matchScoreToStudents(students,_priExamScores);
  const wb=XLSX.utils.book_new();
  const wsData=[['ลำดับ','รหัส','ชื่อ','ห้อง','คะแนนงาน%','คะแนนสอบ','รวม','เกรด','GPA'],
    ...students.map((s,i)=>{
      let hwTotal=0,hwMax=0;
      hws.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub?.score!=null){hwTotal+=parseFloat(sub.score)||0;hwMax+=parseFloat(sub.maxScore||h.maxScore||100);}else hwMax+=parseFloat(h.maxScore||100);});
      const hwPct=hwMax>0?(hwTotal/hwMax)*100:0;
      const exam=examMatched[s.id]??null;
      const total=exam!==null?(hwPct*0.5+exam*0.5):hwPct;
      const grade=calculateGrade(total);
      return[i+1,s.id,s.name,s.room,hwPct.toFixed(1),exam??'',total.toFixed(1),grade.grade,grade.gpa];
    })
  ];
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb,ws,'เกรดประถม');
  XLSX.writeFile(wb,'เกรดประถม_'+new Date().toLocaleDateString('th-TH')+'.xlsx');
  toast('Export สำเร็จ ✅');
}

// ==================== มัธยมศึกษา ====================

function populateSecSelects() {
  const roomSel=document.getElementById('sec-room-sel');
  const subjSel=document.getElementById('sec-subj-sel');
  if(roomSel){const c=roomSel.value;roomSel.innerHTML='<option value="">ทุกห้อง</option>'+DB.rooms.map(r=>`<option>${r}</option>`).join('');if(c)roomSel.value=c;}
  if(subjSel){const c=subjSel.value;subjSel.innerHTML='<option value="">ทุกวิชา</option>'+getSubjectNames().map(n=>`<option>${n}</option>`).join('');if(c)subjSel.value=c;}
}

function getFilteredStudentsSec() {
  const room=document.getElementById('sec-room-sel')?.value||'';
  return DB.students.filter(s=>!room||s.room===room);
}

function updateSecWeights() {
  const pre=parseFloat(document.getElementById('sec-w-pre')?.value)||0;
  const mid=parseFloat(document.getElementById('sec-w-mid')?.value)||0;
  const post=parseFloat(document.getElementById('sec-w-post')?.value)||0;
  const fin=parseFloat(document.getElementById('sec-w-final')?.value)||0;
  const total=pre+mid+post+fin;
  const st=document.getElementById('sec-weight-status');
  if(st){
    if(Math.round(total)===100){st.style.background='var(--green-light)';st.style.color='var(--green-dark)';st.textContent='✅ 100%';}
    else{st.style.background='var(--red-light)';st.style.color='var(--red)';st.textContent='⚠️ '+total+'%';}
  }
  renderSecGrade();
}

function renderSecGrade() {
  const el=document.getElementById('sec-grade-table');
  if(!el) return;
  const filterSubj=document.getElementById('sec-subj-sel')?.value||'';
  const cutoff=parseInt(document.getElementById('sec-hw-mid-cutoff')?.value)||5;
  const wPre=(parseFloat(document.getElementById('sec-w-pre')?.value)||20)/100;
  const wMid=(parseFloat(document.getElementById('sec-w-mid')?.value)||30)/100;
  const wPost=(parseFloat(document.getElementById('sec-w-post')?.value)||20)/100;
  const wFin=(parseFloat(document.getElementById('sec-w-final')?.value)||30)/100;

  const students=getFilteredStudentsSec();
  if(!students.length){el.innerHTML='<div class="empty">ไม่พบนักเรียน</div>';return;}

  const allHws=(DB.homeworks||[]).filter(h=>!filterSubj||h.subject===filterSubj);
  const preHws=allHws.filter(h=>h.num<=cutoff);
  const postHws=allHws.filter(h=>h.num>cutoff);
  const midMatched=matchScoreToStudents(students,_secMidScores);
  const finMatched=matchScoreToStudents(students,_secFinalScores);

  const rows=students.map(s=>{
    // คะแนนก่อนกลาง
    let pre=0,preMax=0;
    preHws.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub?.score!=null){pre+=parseFloat(sub.score)||0;preMax+=parseFloat(sub.maxScore||h.maxScore||100);}else preMax+=parseFloat(h.maxScore||100);});
    const prePct=preMax>0?(pre/preMax)*100:0;

    // คะแนนหลังกลาง
    let post=0,postMax=0;
    postHws.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub?.score!=null){post+=parseFloat(sub.score)||0;postMax+=parseFloat(sub.maxScore||h.maxScore||100);}else postMax+=parseFloat(h.maxScore||100);});
    const postPct=postMax>0?(post/postMax)*100:0;

    const midScore=midMatched[s.id]??null;
    const finScore=finMatched[s.id]??null;

    let total=prePct*wPre+postPct*wPost;
    if(midScore!==null) total+=midScore*wMid;
    if(finScore!==null) total+=finScore*wFin;

    const grade=calculateGrade(total);
    return {s,prePct,midScore,postPct,finScore,total,grade};
  }).sort((a,b)=>b.total-a.total);

  const gradeSummary={};
  gradeCriteria.forEach(c=>gradeSummary[c.grade]=0);
  rows.forEach(r=>{if(gradeSummary[r.grade.grade]!==undefined)gradeSummary[r.grade.grade]++;});
  const avg=rows.reduce((s,r)=>s+r.total,0)/rows.length;

  el.innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
      ${gradeCriteria.map(c=>`<div style="text-align:center;background:#fff;border-radius:8px;padding:5px 10px;border:1.5px solid var(--border);">
        <div style="font-size:13px;font-weight:800;color:${getGradeColor(c.grade)};">${c.grade}</div>
        <div style="font-size:15px;font-weight:700;">${gradeSummary[c.grade]||0}</div>
      </div>`).join('')}
      <div style="text-align:center;background:var(--purple-light);border-radius:8px;padding:5px 10px;border:1.5px solid #C4B5FD;margin-left:auto;">
        <div style="font-size:11px;color:var(--purple);font-weight:600;">เฉลี่ย</div>
        <div style="font-size:15px;font-weight:700;color:var(--purple);">${avg.toFixed(1)}</div>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">
      สัดส่วน: ก่อนกลาง ${Math.round(wPre*100)}% · กลาง ${Math.round(wMid*100)}% · หลังกลาง ${Math.round(wPost*100)}% · ปลาย ${Math.round(wFin*100)}%
    </div>
    <div style="overflow-x:auto;border-radius:10px;border:1.5px solid var(--border);">
      <table class="mini-tbl" style="min-width:520px;">
        <thead><tr>
          <th>#</th><th>ชื่อ</th><th>ห้อง</th>
          <th>ก่อนกลาง</th><th>กลางภาค</th><th>หลังกลาง</th><th>ปลายภาค</th>
          <th>รวม</th><th>เกรด</th><th>GPA</th>
        </tr></thead>
        <tbody>
          ${rows.map((r,i)=>`<tr style="background:${i%2===0?'#fff':'#FAFAFA'};">
            <td style="color:var(--text3);">${i+1}</td>
            <td style="font-weight:600;">${r.s.name}</td>
            <td><span class="room-pill">${r.s.room}</span></td>
            <td style="text-align:center;color:var(--purple);font-weight:700;">${r.prePct.toFixed(1)}</td>
            <td style="text-align:center;color:var(--blue);font-weight:700;">${r.midScore!==null?r.midScore.toFixed(1):'—'}</td>
            <td style="text-align:center;color:var(--green-dark);font-weight:700;">${r.postPct.toFixed(1)}</td>
            <td style="text-align:center;color:var(--red);font-weight:700;">${r.finScore!==null?r.finScore.toFixed(1):'—'}</td>
            <td style="text-align:center;font-weight:800;color:${r.total>=80?'var(--green-dark)':r.total>=60?'var(--blue)':'var(--red)'};">${r.total.toFixed(1)}</td>
            <td style="text-align:center;font-size:14px;font-weight:800;color:${getGradeColor(r.grade.grade)};">${r.grade.grade}</td>
            <td style="text-align:center;font-weight:700;">${r.grade.gpa.toFixed(1)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function exportSecGradeExcel() {
  if(!isPremium()){showUpgradeModal('Export Excel เฉพาะ Premium 🔒');return;}
  const filterSubj=document.getElementById('sec-subj-sel')?.value||'ทุกวิชา';
  const cutoff=parseInt(document.getElementById('sec-hw-mid-cutoff')?.value)||5;
  const wPre=(parseFloat(document.getElementById('sec-w-pre')?.value)||20)/100;
  const wMid=(parseFloat(document.getElementById('sec-w-mid')?.value)||30)/100;
  const wPost=(parseFloat(document.getElementById('sec-w-post')?.value)||20)/100;
  const wFin=(parseFloat(document.getElementById('sec-w-final')?.value)||30)/100;
  const students=getFilteredStudentsSec();
  const allHws=(DB.homeworks||[]).filter(h=>!filterSubj||filterSubj==='ทุกวิชา'||h.subject===filterSubj);
  const preHws=allHws.filter(h=>h.num<=cutoff);
  const postHws=allHws.filter(h=>h.num>cutoff);
  const midMatched=matchScoreToStudents(students,_secMidScores);
  const finMatched=matchScoreToStudents(students,_secFinalScores);
  const wb=XLSX.utils.book_new();
  const wsData=[['ลำดับ','รหัส','ชื่อ','ห้อง','ก่อนกลาง%','กลางภาค','หลังกลาง%','ปลายภาค','รวม','เกรด','GPA'],
    ...students.map((s,i)=>{
      let pre=0,preMax=0; preHws.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub?.score!=null){pre+=parseFloat(sub.score)||0;preMax+=parseFloat(sub.maxScore||h.maxScore||100);}else preMax+=parseFloat(h.maxScore||100);});
      const prePct=preMax>0?(pre/preMax)*100:0;
      let post=0,postMax=0; postHws.forEach(h=>{const sub=DB.submissions[s.id+'_'+h.num];if(sub?.score!=null){post+=parseFloat(sub.score)||0;postMax+=parseFloat(sub.maxScore||h.maxScore||100);}else postMax+=parseFloat(h.maxScore||100);});
      const postPct=postMax>0?(post/postMax)*100:0;
      const mid=midMatched[s.id]??null; const fin=finMatched[s.id]??null;
      let total=prePct*wPre+postPct*wPost+(mid!==null?mid*wMid:0)+(fin!==null?fin*wFin:0);
      const grade=calculateGrade(total);
      return[i+1,s.id,s.name,s.room,prePct.toFixed(1),mid??'',postPct.toFixed(1),fin??'',total.toFixed(1),grade.grade,grade.gpa];
    })
  ];
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb,ws,'เกรดมัธยม เทอม'+_currentSecTerm);
  XLSX.writeFile(wb,'เกรดมัธยม_เทอม'+_currentSecTerm+'_'+new Date().toLocaleDateString('th-TH')+'.xlsx');
  toast('Export สำเร็จ ✅');
}


// ╔══════════════════════════════════════════════════════╗
// ║  SECTION L: APP INITIALIZATION                     ║
// ╚══════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════╗
// ║  SCAN HISTORY & EDIT SCORE                         ║
// ╚══════════════════════════════════════════════════════╝

let _editingSubmission = null; // { sid, hwNum, currentScore, maxScore, stuName }

// ===== OPEN / CLOSE =====
async function openScanHistory() {
  const modal = document.getElementById('scan-history-modal');
  if(!modal) return;
  modal.style.display = 'flex';

  // Populate HW filter
  const hwFilter = document.getElementById('sh-hw-filter');
  if(hwFilter) {
    hwFilter.innerHTML = '<option value="">ทุกชิ้นงาน</option>' +
      DB.homeworks.map(h => `<option value="${h.num}">ชิ้นที่ ${h.num}: ${h.title}</option>`).join('');
  }

  // Populate room filter
  const roomFilter = document.getElementById('sh-room-filter');
  if(roomFilter) {
    roomFilter.innerHTML = '<option value="">ทุกห้อง</option>' +
      DB.rooms.map(r => `<option>${r}</option>`).join('');
  }

  // โหลดข้อมูลล่าสุดจาก Supabase
  if(USE_SUPABASE && SB && CURRENT_TEACHER) {
    const subtitle = document.getElementById('sh-subtitle');
    if(subtitle) subtitle.textContent = 'กำลังโหลด...';
    try {
      await reloadSubmissions();
    } catch(e) {}
  }

  renderScanHistory();
}

function closeScanHistory() {
  const modal = document.getElementById('scan-history-modal');
  if(modal) modal.style.display = 'none';
}

// ===== RENDER LIST =====
function renderScanHistory() {
  const el = document.getElementById('sh-list');
  if(!el) return;

  const hwFilter = document.getElementById('sh-hw-filter')?.value || '';
  const roomFilter = document.getElementById('sh-room-filter')?.value || '';
  const q = (document.getElementById('sh-search')?.value || '').toLowerCase();

  // รวบรวม submissions ทั้งหมด
  const subs = Object.entries(DB.submissions).map(([key, sub]) => {
    const [sid, hwNum] = key.split('_');
    const stu = DB.students.find(s => s.id === sid);
    const hw = DB.homeworks.find(h => h.num === parseInt(hwNum));
    return { key, sid, hwNum: parseInt(hwNum), stu, hw, sub };
  }).filter(item => {
    if(!item.stu) return false;
    if(hwFilter && item.hwNum !== parseInt(hwFilter)) return false;
    if(roomFilter && item.stu.room !== roomFilter) return false;
    if(q && !item.stu.name.toLowerCase().includes(q) && !item.sid.includes(q)) return false;
    return true;
  }).sort((a, b) => {
    // เรียงตาม submitted_at ล่าสุดก่อน
    const ta = a.sub.submitted_at || a.sub.ts || '';
    const tb = b.sub.submitted_at || b.sub.ts || '';
    return tb.localeCompare(ta);
  });

  // อัพเดต subtitle
  const subtitle = document.getElementById('sh-subtitle');
  if(subtitle) subtitle.textContent = subs.length + ' รายการ';

  if(!subs.length) {
    el.innerHTML = '<div class="empty" style="padding:32px 0;">ไม่พบรายการ</div>';
    return;
  }

  el.innerHTML = subs.map(({sid, hwNum, stu, hw, sub, key}) => {
    const score = sub.score !== null && sub.score !== undefined ? sub.score : null;
    const maxScore = sub.maxScore || hw?.maxScore || 100;
    const pct = score !== null ? Math.round(score/maxScore*100) : null;
    const timeStr = sub.submitted_at
      ? new Date(sub.submitted_at).toLocaleString('th-TH', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
      : (sub.ts || '—');
    const scoreColor = pct >= 80 ? 'var(--green-dark)' : pct >= 60 ? 'var(--blue)' : 'var(--red)';

    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text);">${stu.name} <span class="room-pill">${stu.room}</span></div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px;">ชิ้นที่ ${hwNum}: ${hw?.title || sub.hwTitle || '—'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:1px;">🕐 ${timeStr}</div>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <div style="font-size:18px;font-weight:800;color:${score!==null?scoreColor:'var(--text3)'};">
          ${score !== null ? score : '—'}
        </div>
        <div style="font-size:10px;color:var(--text3);">/ ${maxScore}</div>
      </div>
<button onclick="openEditScoreById('${sid}',${hwNum})"
        style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px;border:1.5px solid var(--blue);background:var(--blue-light);color:var(--blue-dark);cursor:pointer;white-space:nowrap;flex-shrink:0;">
        ✏️ แก้ไข
      </button>
    </div>`;
  }).join('');
}

// ===== EDIT SCORE =====
function openEditScoreById(sid, hwNum) {
  const stu = DB.students.find(s => s.id === sid);
  const hw = DB.homeworks.find(h => h.num === hwNum);
  const sub = DB.submissions[sid + '_' + hwNum];
  if(!stu || !sub) return;
  openEditScore({
    sid, hwNum,
    currentScore: sub.score !== null && sub.score !== undefined ? sub.score : null,
    maxScore: sub.maxScore || hw?.maxScore || 100,
    stuName: stu.name,
    hwTitle: hw?.title || sub.hwTitle || ''
  });
}

function openEditScore(data) {
  _editingSubmission = data;
  const modal = document.getElementById('edit-score-modal');
  const info = document.getElementById('esm-info');
  const scoreInput = document.getElementById('esm-score');
  const maxInfo = document.getElementById('esm-max-info');
  if(!modal || !info || !scoreInput) return;

  info.innerHTML = `<b>${data.stuName}</b><br>ชิ้นที่ ${data.hwNum}: ${data.hwTitle}`;
  scoreInput.value = data.currentScore !== null ? data.currentScore : '';
  scoreInput.max = data.maxScore;
  if(maxInfo) maxInfo.textContent = 'คะแนนเต็ม: ' + data.maxScore;
  modal.style.display = 'flex';
}

function closeEditScoreModal() {
  const modal = document.getElementById('edit-score-modal');
  if(modal) modal.style.display = 'none';
  _editingSubmission = null;
}

function adjustEditScore(delta) {
  const input = document.getElementById('esm-score');
  if(!input || !_editingSubmission) return;
  const cur = parseFloat(input.value) || 0;
  const newVal = Math.min(_editingSubmission.maxScore, Math.max(0, cur + delta));
  input.value = newVal;
}

async function saveEditScore() {
  if(!_editingSubmission) return;
  const scoreInput = document.getElementById('esm-score');
  const newScore = scoreInput?.value !== '' ? parseFloat(scoreInput.value) : null;
  const {sid, hwNum, maxScore, hwTitle} = _editingSubmission;
  const stu = DB.students.find(s => s.id === sid);
  if(!stu) return;

  showActionPopup('กำลังบันทึกคะแนน', stu.name + ' · ชิ้นที่ ' + hwNum, 'edit');

  try {
    await sbRecordSubmission({
      sid, hwNum, hwTitle, room: stu.room,
      score: newScore, maxScore
    });
    closeEditScoreModal();
    renderScanHistory();
    setTimeout(() => actionPopupDone('บันทึกคะแนนแล้ว ✅', stu.name + ': ' + newScore + '/' + maxScore, 'edit'), 100);
  } catch(e) {
    actionPopupError('บันทึกไม่สำเร็จ: ' + e.message);
  }
}

async function deleteSubmission() {
  if(!_editingSubmission) return;
  const {sid, hwNum, stuName} = _editingSubmission;
  if(!confirm('ลบการสแกนของ ' + stuName + ' ชิ้นที่ ' + hwNum + '?')) return;

  showActionPopup('กำลังลบ', stuName + ' · ชิ้นที่ ' + hwNum, 'delete');

  try {
    if(USE_SUPABASE && SB && CURRENT_TEACHER) {
      const tid = CURRENT_TEACHER.id;
      const {error} = await SB.from('submissions')
        .delete()
        .eq('student_id', sid)
        .eq('hw_num', hwNum)
        .eq('teacher_id', tid);
      if(error) throw error;
      await reloadSubmissions();
    } else {
      const key = sid + '_' + hwNum;
      delete DB.submissions[key];
      saveDB();
    }
    renderDashboard();
    closeEditScoreModal();
    renderScanHistory();
    setTimeout(() => actionPopupDone('ลบการสแกนแล้ว', stuName, 'delete'), 100);
  } catch(e) {
    actionPopupError('ลบไม่สำเร็จ: ' + e.message);
  }
}

window.addEventListener('load', () => {
  checkSetupOnLoad();
  checkResetRedirect();
  initMobileModals();
  // ===== BARCODE SCANNER (USB/Bluetooth) =====
(function(){
  let barcodeBuffer = '';
  let barcodeTimer = null;
  const BARCODE_TIMEOUT = 50; // ms ระหว่างตัวอักษร
  const MIN_LENGTH = 3;

  document.addEventListener('keydown', function(e) {
    // ไม่รับถ้ากำลังพิมพ์ใน input หรือ textarea
    if(!document.activeElement) return;
    const tag = document.activeElement.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // ไม่รับถ้าหน้า admin ไม่ได้เปิดอยู่
    const adminScreen = document.getElementById('s-admin');
    if(!adminScreen || !adminScreen.classList.contains('on')) return;

    // ไม่รับถ้าไม่ได้อยู่หน้าสแกน
    const scanPage = document.getElementById('ap-scan');
    if(!scanPage || !scanPage.classList.contains('on')) return;

    if(e.key === 'Enter') {
      // Enter = จบการสแกน
      if(barcodeBuffer.length >= MIN_LENGTH) {
        const code = barcodeBuffer.trim();
        barcodeBuffer = '';
        clearTimeout(barcodeTimer);
        recordScan(code);
      }
      barcodeBuffer = '';
      return;
    }

    // รับเฉพาะตัวเลขและตัวอักษร
    if(e.key && e.key.length === 1) {
      barcodeBuffer += e.key;
      clearTimeout(barcodeTimer);
      // ถ้าไม่มี input ใหม่ใน 50ms ถือว่าสแกนเสร็จ
      barcodeTimer = setTimeout(() => {
        if(barcodeBuffer.length >= MIN_LENGTH) {
          const code = barcodeBuffer.trim();
          barcodeBuffer = '';
          recordScan(code);
        }
        barcodeBuffer = '';
      }, BARCODE_TIMEOUT);
    }
  });
})();
  document.addEventListener('click', e => {
    const search = document.getElementById('stu-teacher-search');
    const dd = document.getElementById('teacher-dropdown');
    if(dd && search && !search.contains(e.target) && !dd.contains(e.target)){
      dd.style.display = 'none';
    }
  });
});

function initMobileModals(){
  // Add pull-down-to-close for bottom sheet modals
  const sheets = document.querySelectorAll('.modal-sheet, .edit-modal-sheet');
  sheets.forEach(sheet => {
    let startY = 0;
    sheet.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive:true});
    sheet.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - startY;
      if(dy > 80) { // swipe down 80px to close
        const overlay = sheet.closest('.modal-overlay, .edit-modal-overlay');
        if(overlay) overlay.classList.remove('on');
        const editOverlay = document.getElementById('edit-stu-modal');
        if(sheet.closest('#edit-stu-modal')) closeEditStu();
        const exportOverlay = document.getElementById('export-modal');
        if(sheet.closest('#export-modal')) closeExportModal();
      }
    }, {passive:true});
  });
}
// ╔══════════════════════════════════════════════════════╗
// ║  SECTION J: AI REPORT (Premium)                     ║
// ╚══════════════════════════════════════════════════════╝

let ANTHROPIC_KEY = '';

async function loadAnthropicKey() {
  if(!SB) return;
  try {
    const { data } = await SB.from('settings').select('value').eq('key','anthropic_key').single();
    ANTHROPIC_KEY = data?.value || '';
  } catch(e) {
    ANTHROPIC_KEY = '';
  }
}

function openAIReport() {
  if(!checkFeatureGate('ai_report','AI สรุปรายงาน')) return;
  if(!isPremium()) {
    showUpgradeModal('ฟีเจอร์ AI สรุปรายงาน สำหรับ Premium เท่านั้น');
    return;
  }
  const modal = document.getElementById('ai-report-modal');
  if(!modal) return;
  modal.style.display = 'flex';

  // Populate room dropdown
  const roomSel = document.getElementById('ai-room-sel');
  if(roomSel) {
    roomSel.innerHTML = '<option value="">ทุกห้อง</option>';
    DB.rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      roomSel.appendChild(opt);
    });
  }

  // Populate subject dropdown
  const subjSel = document.getElementById('ai-subj-sel');
  if(subjSel) {
    subjSel.innerHTML = '<option value="">ทุกวิชา</option>';
    getSubjectNames().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      subjSel.appendChild(opt);
    });
  }

  // Reset content
  const content = document.getElementById('ai-report-content');
  if(content) {
    content.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--text3);"><div style="font-size:40px;margin-bottom:12px;">🤖</div><div style="font-size:14px;">กดปุ่ม "สร้างรายงาน AI" เพื่อวิเคราะห์ข้อมูลห้องเรียน</div></div>';
  }
}

function closeAIReport() {
  const modal = document.getElementById('ai-report-modal');
  if(modal) modal.style.display = 'none';
}

async function generateAIReport() {
  if(!isPremium()) { showUpgradeModal('ฟีเจอร์ AI สรุปรายงาน สำหรับ Premium เท่านั้น'); return; }
  if(!ANTHROPIC_KEY) {
    toast('ยังไม่ได้ตั้งค่า Anthropic API Key — ตั้งได้ที่ Super Admin', 'err');
    return;
  }

  const room = document.getElementById('ai-room-sel')?.value || '';
  const subj = document.getElementById('ai-subj-sel')?.value || '';
  const lang = document.getElementById('ai-lang-sel')?.value || 'th';

  const btn = document.getElementById('ai-generate-btn');
  const content = document.getElementById('ai-report-content');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ กำลังวิเคราะห์...'; }
  if(content) content.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);">⏳ AI กำลังวิเคราะห์ข้อมูล...</div>';

  try {
    // Build data
    let students = DB.students;
    if(room) students = students.filter(s => s.room === room);

    let homeworks = DB.homeworks;
    if(subj) homeworks = homeworks.filter(h => h.subject === subj);

    const hwNums = new Set(homeworks.map(h => h.num));
    const subs = Object.values(DB.submissions).filter(s =>
      hwNums.has(s.hwNum) && (!room || s.room === room)
    );

    // Stats per student
    const stuStats = students.map(stu => {
      const stuSubs = subs.filter(s => s.sid === stu.id);
      const submitted = stuSubs.length;
      const avgScore = submitted > 0
        ? Math.round(stuSubs.reduce((a,s) => a + (s.score/s.maxScore*100), 0) / submitted)
        : 0;
      return { name: stu.name, room: stu.room, submitted, total: homeworks.length, avgScore };
    });

    // Overall stats
    const totalStu = stuStats.length;
    const avgSubmit = totalStu > 0 ? (stuStats.reduce((a,s)=>a+s.submitted,0)/totalStu).toFixed(1) : 0;
    const avgScore = totalStu > 0 ? Math.round(stuStats.reduce((a,s)=>a+s.avgScore,0)/totalStu) : 0;
    const atRisk = stuStats.filter(s => s.submitted < homeworks.length * 0.5).length;

    const langPrompt = lang === 'th'
      ? 'ตอบเป็นภาษาไทย ใช้ภาษาที่เข้าใจง่าย เหมาะกับครูไทย'
      : 'Reply in English. Keep it clear and professional.';

    const prompt = `${langPrompt}

คุณเป็น AI ผู้ช่วยครู วิเคราะห์ข้อมูลการส่งงานนักเรียนต่อไปนี้และสร้างรายงานสรุปห้องเรียน:

**ข้อมูลภาพรวม:**
- ${room ? `ห้อง: ${room}` : 'ทุกห้อง'} | ${subj ? `วิชา: ${subj}` : 'ทุกวิชา'}
- จำนวนนักเรียน: ${totalStu} คน
- จำนวนงานทั้งหมด: ${homeworks.length} ชิ้น
- ส่งงานเฉลี่ย: ${avgSubmit} ชิ้น/คน
- คะแนนเฉลี่ย: ${avgScore}%
- นักเรียนเสี่ยง (ส่งงานน้อยกว่า 50%): ${atRisk} คน

**รายชื่อนักเรียนที่น่าเป็นห่วง (ส่งงานน้อยกว่า 50%):**
${stuStats.filter(s=>s.submitted < homeworks.length*0.5).map(s=>`- ${s.name} (${s.room}): ส่ง ${s.submitted}/${s.total} ชิ้น คะแนนเฉลี่ย ${s.avgScore}%`).join('\n') || 'ไม่มี'}

**สรุปภาพรวมนักเรียน (top 10 ตามคะแนน):**
${stuStats.sort((a,b)=>b.avgScore-a.avgScore).slice(0,10).map(s=>`- ${s.name}: ${s.submitted}/${s.total} ชิ้น (${s.avgScore}%)`).join('\n')}

กรุณาสร้างรายงานประกอบด้วย:
1. สรุปภาพรวมห้องเรียน
2. จุดเด่นและข้อดี
3. ปัญหาและจุดที่ต้องปรับปรุง
4. นักเรียนที่ต้องติดตามเป็นพิเศษ
5. ข้อเสนอแนะสำหรับครู

ใช้ emoji เพื่อให้อ่านง่าย ตอบในรูปแบบที่อ่านสบาย ไม่ต้องใช้ markdown heading`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if(!res.ok) throw new Error('API Error: ' + res.status);
    const data = await res.json();
    const text = data.content?.[0]?.text || 'ไม่สามารถสร้างรายงานได้';

    if(content) {
      content.innerHTML = `
        <div style="font-size:14px;line-height:1.8;color:var(--text);white-space:pre-wrap;font-family:Sarabun,sans-serif;">${text}</div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);text-align:center;">
          สร้างโดย Claude AI · ${new Date().toLocaleString('th-TH')}
        </div>`;
    }
  } catch(err) {
    if(content) content.innerHTML = `<div style="text-align:center;padding:24px;color:#EF4444;"><div style="font-size:24px;">⚠️</div><div style="margin-top:8px;">เกิดข้อผิดพลาด: ${err.message}</div></div>`;
  } finally {
    if(btn) { btn.disabled = false; btn.innerHTML = '✨ สร้างรายงาน AI'; }
  }
}

// ╔══════════════════════════════════════════════════════╗
// ║  PREMIUM EXPIRY & LOCKED DATA SYSTEM                ║
// ╚══════════════════════════════════════════════════════╝

async function checkAndDowngradePremium() {
  if(!CURRENT_TEACHER || !SB) return;
  if(CURRENT_TEACHER.plan !== 'premium') return;
  const exp = CURRENT_TEACHER.plan_expires_at;
  if(!exp || new Date(exp) > new Date()) return;

  // Downgrade to free
  try {
    await SB.from('teachers').update({plan:'free', plan_expires_at: null}).eq('id', CURRENT_TEACHER.id);
    CURRENT_TEACHER.plan = 'free';
    CURRENT_TEACHER.plan_expires_at = null;
    renderPlanBanner();
    // Check locked HWs
    const locked = getLockedHomeworks();
    if(locked.length > 0) {
      showLockedDataBanner(locked.length);
    } else {
      toast('แผน Premium หมดอายุแล้ว — เปลี่ยนเป็น Free Plan', 'warn');
    }
  } catch(e) { console.error('downgrade error', e); }
}

function isHWLocked(hw) {
  if(isPremium()) return false;
  const sorted = [...DB.homeworks].sort((a,b) => a.num - b.num);
  const idx = sorted.findIndex(h => h.num === hw.num);
  return idx >= FREE_LIMITS.homeworks;
}

function getLockedHomeworks() {
  if(isPremium()) return [];
  return DB.homeworks.filter(hw => isHWLocked(hw));
}

function checkLockedDataOnLoad() {
  if(isPremium()) return;
  const locked = getLockedHomeworks();
  if(locked.length > 0) showLockedDataBanner(locked.length);
}

function showLockedDataBanner(count) {
  const existing = document.getElementById('locked-data-banner');
  if(existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'locked-data-banner';
  banner.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9000;padding:10px 16px;background:linear-gradient(135deg,#EF4444,#B91C1C);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:Sarabun,sans-serif;box-shadow:0 4px 12px rgba(239,68,68,0.4);';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">🔒</span>
      <div>
        <div style="font-size:13px;font-weight:700;">ชิ้นงาน ${count} ชิ้นถูกล็อค</div>
        <div style="font-size:11px;opacity:0.85;">แผน Premium หมดอายุ — ชิ้นงานที่เกิน ${FREE_LIMITS.homeworks} ชิ้นถูกล็อคชั่วคราว</div>
      </div>
    </div>
    <button onclick="openRenewalFlow()" style="padding:7px 14px;font-size:12px;font-weight:700;border-radius:10px;border:none;background:#fff;color:#B91C1C;cursor:pointer;white-space:nowrap;font-family:Sarabun,sans-serif;">💳 อัพเกรดพรีเมี่ยม</button>`;
  document.body.appendChild(banner);
}

// ============================================================
//  RENEWAL FLOW
// ============================================================
let _renewalSlipFile = null;
let _renewalPayInfo = null;

async function openRenewalFlow() {
  if(!checkFeatureGate('renewal','ระบบชำระเงิน', false)) return;
  const modal = document.getElementById('renewal-modal');
  if(!modal) return;
  // Adjust title based on context
  const titleEl = document.getElementById('renewal-modal-title');
  const _lockedHWs = getLockedHomeworks();
  if(titleEl) titleEl.textContent = _lockedHWs.length > 0 ? 'ต่ออายุ Premium' : 'อัพเกรดพรีเมี่ยม';

  // Load payment info
  try {
    if(SB) {
      const {data} = await SB.from('settings').select('value').eq('key','payment_info').maybeSingle();
      _renewalPayInfo = data?.value || null;
    }
  } catch(e) {}

  // Render locked HWs
  const locked = getLockedHomeworks();
  const lockedEl = document.getElementById('renewal-locked-list');
  if(lockedEl) {
    lockedEl.innerHTML = locked.length
      ? locked.map(h => `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#FEE2E2;border-radius:8px;margin-bottom:4px;">
          <span style="font-size:16px;">🔒</span>
          <div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--text);">งานครั้งที่ ${h.num}: ${h.title}</div>
          <div style="font-size:11px;color:var(--text2);">${h.subject||'ไม่มีวิชา'} · เต็ม ${h.maxScore||100} คะแนน</div></div>
        </div>`).join('')
      : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px;">ไม่มีชิ้นงานที่ถูกล็อค</div>';
  }

  // Render payment info
  const payEl = document.getElementById('renewal-pay-info');
  if(payEl && _renewalPayInfo) {
    const p = _renewalPayInfo;
    const rawAmount = (p.amount || '').replace(/[^0-9.,]/g, '').replace(',','.');
    payEl.innerHTML = `
      <div style="background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:1.5px solid #86EFAC;border-radius:12px;padding:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--green-dark);margin-bottom:8px;">💳 ข้อมูลการชำระเงิน</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;">
          <span style="color:var(--text2);">ธนาคาร</span><span style="font-weight:600;">${p.bank||'-'}</span>
          <span style="color:var(--text2);">เลขบัญชี</span><span style="font-weight:700;font-size:15px;letter-spacing:1px;">${p.account||'-'}</span>
          <span style="color:var(--text2);">ชื่อบัญชี</span><span style="font-weight:600;">${p.name||'-'}</span>
          <span style="color:var(--text2);">ยอดชำระ</span><span style="font-weight:800;font-size:16px;color:var(--green-dark);">${p.amount||'-'}</span>
        </div>
      </div>`;
  } else if(payEl) {
    payEl.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px;">ยังไม่ได้ตั้งค่าข้อมูลการชำระเงิน</div>';
  }

  // Reset slip area
  _renewalSlipFile = null;
  const previewEl = document.getElementById('renewal-slip-preview');
  if(previewEl) previewEl.innerHTML = '';
  const statusEl = document.getElementById('renewal-verify-status');
  if(statusEl) statusEl.innerHTML = '';
  const submitBtn = document.getElementById('renewal-submit-btn');
  if(submitBtn) submitBtn.style.display = 'none';

  modal.style.display = 'flex';
}

function closeRenewalFlow() {
  const modal = document.getElementById('renewal-modal');
  if(modal) modal.style.display = 'none';
}

function handleRenewalSlipSelect(e) {
  const file = e.target.files[0];
  if(!file) return;
  _renewalSlipFile = file;
  const preview = document.getElementById('renewal-slip-preview');
  if(preview) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" style="width:100%;max-height:180px;object-fit:contain;border-radius:10px;border:1.5px solid var(--border);">
      <div style="font-size:12px;color:var(--text3);margin-top:4px;text-align:center;">${file.name}</div>`;
  }
  const submitBtn = document.getElementById('renewal-submit-btn');
  if(submitBtn) submitBtn.style.display = 'block';
  const statusEl = document.getElementById('renewal-verify-status');
  if(statusEl) statusEl.innerHTML = '';
}

async function submitRenewalSlip() {
  if(!_renewalSlipFile) { toast('กรุณาเลือกสลิปก่อน','err'); return; }
  if(!ANTHROPIC_KEY) { toast('ระบบยังไม่ได้ตั้งค่า API Key — กรุณาติดต่อแอดมิน','err'); return; }

  const btn = document.getElementById('renewal-submit-btn');
  const statusEl = document.getElementById('renewal-verify-status');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ กำลังตรวจสอบ...'; }
  if(statusEl) statusEl.innerHTML = '<div style="text-align:center;padding:8px;font-size:13px;color:var(--text2);">🤖 AI กำลังอ่านสลิป...</div>';

  try {
    // Read file as base64
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(_renewalSlipFile);
    });
    const mediaType = _renewalSlipFile.type || 'image/jpeg';

    // Parse required amount from payment info
    const rawAmount = (_renewalPayInfo?.amount || '').replace(/[^0-9.]/g, '');
    const requiredAmount = parseFloat(rawAmount) || 0;

    // AI verify slip
    const readAmount = await verifySlipAmountWithAI(base64, mediaType);

    const match = requiredAmount > 0 && readAmount > 0 && Math.abs(readAmount - requiredAmount) <= 10;

    if(statusEl) {
      statusEl.innerHTML = `
        <div style="padding:12px;border-radius:10px;text-align:center;background:${match?'#DCFCE7':'#FEE2E2'};border:1.5px solid ${match?'#86EFAC':'#FCA5A5'};">
          <div style="font-size:20px;margin-bottom:4px;">${match?'✅':'❌'}</div>
          <div style="font-size:13px;font-weight:700;color:${match?'var(--green-dark)':'var(--red)'};">
            ${match ? 'ยอดตรงกัน! กำลังปลดล็อค...' : `ยอดไม่ตรง (AI อ่านได้: ฿${readAmount} · ต้องการ: ฿${requiredAmount})`}
          </div>
        </div>`;
    }

    if(match) {
      // Upload slip & unlock premium
      await activatePremiumAfterPayment(base64, mediaType);
    } else {
      if(btn) { btn.disabled = false; btn.textContent = '🤖 ตรวจสอบสลิปอีกครั้ง'; }
    }
  } catch(err) {
    if(statusEl) statusEl.innerHTML = `<div style="padding:10px;border-radius:8px;background:#FEE2E2;color:var(--red);font-size:13px;text-align:center;">เกิดข้อผิดพลาด: ${err.message}</div>`;
    if(btn) { btn.disabled = false; btn.textContent = '🤖 ตรวจสอบสลิป'; }
  }
}

async function verifySlipAmountWithAI(base64, mediaType) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{role:'user', content:[
        {type:'image', source:{type:'base64', media_type: mediaType, data: base64}},
        {type:'text', text:'ดูสลิปการโอนเงินนี้ แล้วบอกยอดเงินที่โอน ตอบเฉพาะตัวเลขเป็นบาทเท่านั้น เช่น 299 หรือ 1490 ห้ามใส่ข้อความอื่นใด'}
      ]}]
    })
  });
  if(!res.ok) throw new Error('API Error '+res.status);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '0';
  return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
}

async function activatePremiumAfterPayment(base64, mediaType) {
  try {
    // Upload slip to storage
    const path = `slips/${CURRENT_TEACHER.id}_renewal_${Date.now()}.jpg`;
    let slipUrl = '';
    if(SB) {
      const blob = await (await fetch(`data:${mediaType};base64,${base64}`)).blob();
      const {data:upData} = await SB.storage.from('slips').upload(path, blob, {upsert:true, contentType:mediaType});
      if(upData) {
        const {data:urlData} = SB.storage.from('slips').getPublicUrl(path);
        slipUrl = urlData?.publicUrl || '';
      }
      // Set plan back to premium (30 days default)
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);
      await SB.from('teachers').update({
        plan: 'premium',
        plan_expires_at: newExpiry.toISOString(),
        plan_requested: null,
        slip_url: slipUrl || undefined,
        slip_uploaded_at: new Date().toISOString()
      }).eq('id', CURRENT_TEACHER.id);
      CURRENT_TEACHER.plan = 'premium';
      CURRENT_TEACHER.plan_expires_at = newExpiry.toISOString();
    }
    // Remove banner & close modal
    setTimeout(() => {
      const banner = document.getElementById('locked-data-banner');
      if(banner) banner.remove();
      closeRenewalFlow();
      renderPlanBanner();
      renderManage();
      populateHWDropdown();
      toast('🎉 ปลดล็อคสำเร็จ! ใช้งาน Premium ต่อได้เลย');
    }, 1500);
  } catch(err) {
    console.error('activate premium error', err);
    toast('เกิดข้อผิดพลาดในการปลดล็อค: '+err.message, 'err');
  }
}

// ============================================================
//  ADMIN UI STATS
// ============================================================
function renderSAStats(teachers) {
  const el = document.getElementById('sa-stats-row');
  if(!el) return;
  const total = teachers.length;
  const approved = teachers.filter(t=>t.status==='approved').length;
  const premium = teachers.filter(t=>t.plan==='premium').length;
  const pending = teachers.filter(t=>t.status==='pending'||t.status==='slip_uploaded').length;
  const expired = teachers.filter(t=>{
    if(t.plan!=='premium') return false;
    return t.plan_expires_at && new Date(t.plan_expires_at) < new Date();
  }).length;
  // Compact sidebar stats
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#fff;">${total}</div>
        <div style="font-size:10px;color:#64748B;">ทั้งหมด</div>
      </div>
      <div style="background:rgba(34,197,94,0.15);border-radius:10px;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#4ADE80;">${approved}</div>
        <div style="font-size:10px;color:#4ADE80;">อนุมัติ</div>
      </div>
      <div style="background:rgba(139,92,246,0.15);border-radius:10px;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#A78BFA;">${premium}</div>
        <div style="font-size:10px;color:#A78BFA;">Premium</div>
      </div>
      <div style="background:rgba(245,158,11,0.15);border-radius:10px;padding:8px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#FCD34D;">${pending}</div>
        <div style="font-size:10px;color:#FCD34D;">รอ</div>
      </div>
    </div>
    ${expired > 0 ? `<div style="margin-top:6px;background:rgba(239,68,68,0.2);border-radius:8px;padding:6px 8px;font-size:11px;color:#FCA5A5;font-weight:700;">⚠️ ${expired} Premium หมดอายุ</div>` : ''}`;
}

// ╔══════════════════════════════════════════════════════╗
// ║  ANNOUNCEMENT SYSTEM                                ║
// ╚══════════════════════════════════════════════════════╝

let _announceType = 'info';
let _announceData = null;

const ANNOUNCE_THEMES = {
  info:        { bg:'linear-gradient(135deg,#DBEAFE,#BFDBFE)', color:'#1D4ED8', icon:'ℹ️', label:'ประกาศข้อมูล',  btnBg:'#2563EB', title:'ประกาศจากแอดมิน' },
  update:      { bg:'linear-gradient(135deg,#DCFCE7,#BBF7D0)', color:'#15803D', icon:'🚀', label:'อัพเดตใหม่',    btnBg:'#16A34A', title:'มีการอัพเดต' },
  warning:     { bg:'linear-gradient(135deg,#FEF3C7,#FDE68A)', color:'#B45309', icon:'⚠️', label:'แจ้งเตือน',    btnBg:'#D97706', title:'แจ้งเตือนสำคัญ' },
  maintenance: { bg:'linear-gradient(135deg,#FEE2E2,#FECACA)', color:'#B91C1C', icon:'🔧', label:'ปิดปรับปรุง',  btnBg:'#DC2626', title:'แจ้งปิดปรับปรุงระบบ' },
};

function setAnnounceType(type, btn) {
  _announceType = type;
  document.querySelectorAll('.ann-type-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = '#fff';
    b.style.color = 'var(--text2)';
  });
  if(btn) {
    const th = ANNOUNCE_THEMES[type] || ANNOUNCE_THEMES.info;
    btn.style.borderColor = th.btnBg;
    btn.style.background = th.bg;
    btn.style.color = th.color;
  }
}

async function loadAnnouncementSettings() {
  if(!SB) return;
  try {
    const { data } = await SB.from('settings').select('value').eq('key','announcement').maybeSingle();
    _announceData = data?.value || null;
    if(_announceData) {
      const el = document.getElementById('announce-text');
      const cb = document.getElementById('announce-enabled');
      if(el) el.value = _announceData.text || '';
      if(cb) cb.checked = !!_announceData.enabled;
      if(_announceData.type) {
        _announceType = _announceData.type;
        const btn = document.getElementById('ann-type-' + _announceData.type);
        if(btn) setAnnounceType(_announceData.type, btn);
      }
    }
  } catch(e) {}
}

function toggleAnnouncementEnabled(checked) {
  // Auto-save toggle state
  saveAnnouncement(checked);
}

async function saveAnnouncement(overrideEnabled) {
  console.log('[saveAnnouncement] called, USE_SUPABASE=', USE_SUPABASE, 'SB=', !!SB);
  const btn = document.getElementById('announce-save-btn');
  const statusEl = document.getElementById('announce-status');
  const showStatus = (msg, ok) => {
    if(statusEl) {
      statusEl.textContent = msg;
      statusEl.style.display = 'block';
      statusEl.style.background = ok ? '#DCFCE7' : '#FEE2E2';
      statusEl.style.color = ok ? '#15803D' : '#B91C1C';
    }
    toast2(msg, ok ? 'ok' : 'err');
  };

  if(!USE_SUPABASE || !SB) { showStatus('❌ ต้องเชื่อมต่อ Supabase ก่อน', false); return; }

  const text = (document.getElementById('announce-text')?.value || '').trim();
  const enabled = overrideEnabled !== undefined ? overrideEnabled : !!(document.getElementById('announce-enabled')?.checked);

  if(!text && enabled) {
    showStatus('❌ กรุณากรอกข้อความประกาศก่อนเปิดใช้งาน', false);
    const cb = document.getElementById('announce-enabled');
    if(cb) cb.checked = false;
    return;
  }

  if(btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }
  if(statusEl) statusEl.style.display = 'none';

  const data = { text, enabled, type: _announceType, updatedAt: new Date().toISOString() };
  const { data: existing } = await SB.from('settings').select('key').eq('key','announcement').maybeSingle();
  const { error } = existing
    ? await SB.from('settings').update({ value: data }).eq('key','announcement')
    : await SB.from('settings').insert({ key: 'announcement', value: data });

  if(btn) { btn.disabled = false; btn.innerHTML = '💾 บันทึกประกาศ'; }

  if(error) { showStatus('❌ บันทึกไม่สำเร็จ: ' + error.message, false); return; }
  _announceData = data;
  showStatus(enabled ? '✅ บันทึกและเปิดประกาศแล้ว' : '✅ บันทึกประกาศแล้ว (ยังปิดอยู่)', true);
  setTimeout(() => { if(statusEl) statusEl.style.display='none'; }, 4000);
}

function previewAnnouncement() {
  const text = (document.getElementById('announce-text')?.value || '').trim();
  if(!text) { toast2('กรอกข้อความก่อนดูตัวอย่าง', 'warn'); return; }
  showAnnouncementPopup({ text, type: _announceType, enabled: true, updatedAt: new Date().toISOString() });
}

async function checkAnnouncement() {
  if(!SB) return;
  // Show only once per browser session
  if(sessionStorage.getItem('ann_dismissed')) return;
  try {
    const { data } = await SB.from('settings').select('value').eq('key','announcement').maybeSingle();
    const ann = data?.value;
    if(!ann || !ann.enabled || !ann.text) return;
    // Check if same announcement was already dismissed this session
    const lastSeen = sessionStorage.getItem('ann_seen_at');
    if(lastSeen === ann.updatedAt) return;
    showAnnouncementPopup(ann);
  } catch(e) {}
}

function showAnnouncementPopup(ann) {
  const overlay = document.getElementById('announcement-overlay');
  if(!overlay) return;
  const th = ANNOUNCE_THEMES[ann.type] || ANNOUNCE_THEMES.info;
  // Header
  const header = document.getElementById('announcement-header');
  if(header) header.style.background = th.bg;
  const icon = document.getElementById('announcement-icon');
  if(icon) icon.textContent = th.icon;
  const typeLabel = document.getElementById('announcement-type-label');
  if(typeLabel) { typeLabel.textContent = th.label; typeLabel.style.color = th.color; }
  const title = document.getElementById('announcement-title');
  if(title) { title.textContent = th.title; title.style.color = '#1E293B'; }
  // Body
  const body = document.getElementById('announcement-body');
  if(body) body.textContent = ann.text;
  // Date
  const dateEl = document.getElementById('announcement-date');
  if(dateEl && ann.updatedAt) {
    dateEl.textContent = 'ประกาศเมื่อ ' + new Date(ann.updatedAt).toLocaleString('th-TH', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
  }
  // Button
  const btn = document.getElementById('announcement-close-btn');
  if(btn) { btn.style.background = th.btnBg; btn.style.color = '#fff'; }
  overlay.style.display = 'flex';
  // Store seen state
  if(ann.updatedAt) sessionStorage.setItem('ann_seen_at', ann.updatedAt);
}

function closeAnnouncement() {
  const overlay = document.getElementById('announcement-overlay');
  if(overlay) overlay.style.display = 'none';
  sessionStorage.setItem('ann_dismissed', '1');
}

// ╔══════════════════════════════════════════════════════╗
// ║  ATTENDANCE SYSTEM (เช็คชื่อ)                       ║
// ╚══════════════════════════════════════════════════════╝

let _attRecords = {};   // {studentId: status}
let _attLoaded = false;

const ATT_STATUS = {
  present:  { label:'มา',     icon:'✅', bg:'#DCFCE7', color:'#15803D', border:'#86EFAC' },
  absent:   { label:'ขาด',    icon:'❌', bg:'#FEE2E2', color:'#B91C1C', border:'#FCA5A5' },
  late:     { label:'สาย',    icon:'⏰', bg:'#FEF3C7', color:'#B45309', border:'#FCD34D' },
  sick:     { label:'ลาป่วย', icon:'🤒', bg:'#FFF1F2', color:'#BE123C', border:'#FDA4AF' },
  personal: { label:'ลากิจ',  icon:'📋', bg:'#F5F3FF', color:'#6D28D9', border:'#C4B5FD' },
};

function initAttendanceTab() {
  // Populate room selector
  const sel = document.getElementById('att-room-sel');
  if(!sel) return;
  const rooms = DB.rooms || [...new Set(DB.students.map(s=>s.room))].sort();
  sel.innerHTML = rooms.map(r=>`<option value="${r}">${r}</option>`).join('');

  // Set today's date
  const dateEl = document.getElementById('att-date');
  if(dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().slice(0,10);
  }

  renderAttendanceList();
}

function renderAttendanceList() {
  const room = document.getElementById('att-room-sel')?.value || '';
  const date = document.getElementById('att-date')?.value || '';
  if(!room) return;

  const students = DB.students.filter(s=>s.room===room)
    .sort((a,b)=>a.name.localeCompare(b.name,'th'));

  // Load saved records if date+room changed
  _attLoaded = false;
  loadAttendanceForDate(date, room).then(() => {
    _buildStudentList(students);
    updateAttSummary();
  });
}

async function loadAttendanceForDate(date, room) {
  if(!SB || !date || !room) {
    // default all present
    const students = DB.students.filter(s=>s.room===room);
    _attRecords = {};
    students.forEach(s => _attRecords[s.id] = 'present');
    return;
  }
  const dateKey = date.replace(/-/g,'');
  const roomKey = room.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_');
  const key = `att_${dateKey}_${roomKey}`;
  const { data } = await SB.from('settings').select('value')
    .eq('key', key + '_' + CURRENT_TEACHER.id).maybeSingle();

  _attRecords = {};
  if(data?.value?.records) {
    // migrate old 'leave' → 'sick'
    data.value.records.forEach(r => { _attRecords[r.id] = r.status === 'leave' ? 'sick' : r.status; });
  } else {
    DB.students.filter(s=>s.room===room).forEach(s => _attRecords[s.id] = 'present');
  }
  _attLoaded = true;
}

function _buildStudentList(students) {
  const el = document.getElementById('att-student-list');
  if(!el) return;
  if(!students.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">ไม่มีนักเรียนในห้องนี้</div>';
    return;
  }
  el.innerHTML = students.map((s, idx) => {
    const cur = _attRecords[s.id] || 'present';
    const btns = Object.entries(ATT_STATUS).map(([key, cfg]) => {
      const isActive = cur === key;
      return `<button onclick="setAttStatus('${s.id}',this,'${key}')"
        title="${cfg.label}"
        style="width:36px;height:36px;font-size:13px;border-radius:7px;border:1.5px solid ${isActive?cfg.border:'#E2E8F0'};background:${isActive?cfg.bg:'#F8FAFC'};color:${isActive?cfg.color:'#94A3B8'};cursor:pointer;font-family:Sarabun,sans-serif;display:flex;align-items:center;justify-content:center;">
        ${cfg.icon}
      </button>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 4px;border-bottom:1px solid #F1F5F9;">
      <div style="width:20px;text-align:center;font-size:11px;color:var(--text3);flex-shrink:0;">${idx+1}</div>
      <div style="flex:1;font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</div>
      <div style="display:flex;gap:3px;flex-shrink:0;">${btns}</div>
    </div>`;
  }).join('');
}

function setAttStatus(studentId, btn, status) {
  _attRecords[studentId] = status;
  // Update buttons in this row
  const row = btn.closest('div[style*="display:flex"]');
  if(row) {
    const allBtns = row.querySelectorAll('button');
    const keys = Object.keys(ATT_STATUS);
    allBtns.forEach((b, i) => {
      const k = keys[i];
      const cfg = ATT_STATUS[k];
      const isActive = k === status;
      b.style.borderColor = isActive ? cfg.border : '#E2E8F0';
      b.style.background = isActive ? cfg.bg : '#F8FAFC';
      b.style.color = isActive ? cfg.color : '#94A3B8';
    });
  }
  updateAttSummary();
}

function setAllAttStatus(status) {
  const room = document.getElementById('att-room-sel')?.value || '';
  DB.students.filter(s=>s.room===room).forEach(s => _attRecords[s.id] = status);
  const students = DB.students.filter(s=>s.room===room).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  _buildStudentList(students);
  updateAttSummary();
}

function updateAttSummary() {
  const el = document.getElementById('att-summary');
  if(!el) return;
  const counts = { present:0, absent:0, late:0, sick:0, personal:0 };
  Object.values(_attRecords).forEach(s => { if(counts[s]!==undefined) counts[s]++; });
  el.innerHTML = Object.entries(ATT_STATUS).map(([k,cfg]) =>
    `<div style="flex:1;text-align:center;padding:7px 4px;border-radius:8px;background:${cfg.bg};border:1.5px solid ${cfg.border};">
      <div style="font-size:16px;">${cfg.icon}</div>
      <div style="font-size:18px;font-weight:800;color:${cfg.color};">${counts[k]}</div>
      <div style="font-size:10px;color:${cfg.color};font-weight:600;">${cfg.label}</div>
    </div>`
  ).join('');
}

function onAttDateChange() {
  renderAttendanceList();
}

async function saveAttendance() {
  if(!SB || !CURRENT_TEACHER) { toast('ต้องเชื่อมต่อก่อน','err'); return; }
  const room = document.getElementById('att-room-sel')?.value || '';
  const date = document.getElementById('att-date')?.value || '';
  if(!room || !date) { toast('กรุณาเลือกห้องและวันที่','err'); return; }

  const btn = document.getElementById('att-save-btn');
  const statusEl = document.getElementById('att-save-status');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

  const students = DB.students.filter(s=>s.room===room);
  const records = students.map(s => ({ id:s.id, name:s.name, status:_attRecords[s.id]||'present' }));
  const counts = { present:0, absent:0, late:0, sick:0, personal:0 };
  records.forEach(r => { if(counts[r.status]!==undefined) counts[r.status]++; });

  const dateKey = date.replace(/-/g,'');
  const roomKey = room.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_');
  const key = `att_${dateKey}_${roomKey}`;
  const value = { date, room, records, counts, savedAt: new Date().toISOString() };

  const { data: existing } = await SB.from('settings').select('key')
    .eq('key', key + '_' + CURRENT_TEACHER.id).maybeSingle();
  const { error } = existing
    ? await SB.from('settings').update({ value }).eq('key', key + '_' + CURRENT_TEACHER.id)
    : await SB.from('settings').insert({ key: key + '_' + CURRENT_TEACHER.id, value });

  if(btn) { btn.disabled = false; btn.textContent = '💾 บันทึกเช็คชื่อ'; }
  if(error) {
    if(statusEl) { statusEl.textContent = '❌ บันทึกไม่สำเร็จ: '+error.message; statusEl.style.display='block'; statusEl.style.background='#FEE2E2'; statusEl.style.color='#B91C1C'; }
    return;
  }
  const dateDisplay = new Date(date).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  if(statusEl) {
    statusEl.textContent = `✅ บันทึกเช็คชื่อวันที่ ${dateDisplay} · มา ${counts.present} / ขาด ${counts.absent} / สาย ${counts.late} / ลา ${counts.leave}`;
    statusEl.style.display='block'; statusEl.style.background='#DCFCE7'; statusEl.style.color='#15803D';
    setTimeout(() => { statusEl.style.display='none'; }, 5000);
  }
  toast('✅ บันทึกเช็คชื่อแล้ว');
}

async function loadAttendanceHistory() {
  if(!SB || !CURRENT_TEACHER) return;
  const histEl = document.getElementById('att-history-list');
  if(histEl) histEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">⏳ กำลังโหลด...</div>';

  const { data, error } = await SB.from('settings')
    .select('key,value')
    .like('key', `att_%_${CURRENT_TEACHER.id}`)
    .order('key', { ascending: false })
    .limit(30);

  if(error || !data) { if(histEl) histEl.innerHTML = '<div style="font-size:13px;color:var(--red);padding:8px;">โหลดประวัติไม่สำเร็จ</div>'; return; }

  if(!data.length) { if(histEl) histEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">ยังไม่มีประวัติเช็คชื่อ</div>'; return; }

  if(histEl) histEl.innerHTML = data.map(row => {
    const v = row.value;
    const d = v.date ? new Date(v.date).toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'}) : '-';
    const c = v.counts || {};
    return `<div onclick="loadHistoryRecord('${v.date}','${v.room}')"
      style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border-radius:10px;margin-bottom:5px;border:1.5px solid #F1F5F9;cursor:pointer;"
      onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='#F1F5F9'">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${d} · ${v.room||'-'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">
          ✅ ${c.present||0} · ❌ ${c.absent||0} · ⏰ ${c.late||0} · 🏥 ${c.leave||0}
        </div>
      </div>
      <span style="font-size:16px;color:#CBD5E1;">›</span>
    </div>`;
  }).join('');
}

function loadHistoryRecord(date, room) {
  const dateEl = document.getElementById('att-date');
  const roomSel = document.getElementById('att-room-sel');
  if(dateEl) dateEl.value = date;
  if(roomSel) roomSel.value = room;
  renderAttendanceList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ╔══════════════════════════════════════════════════════╗
// ║  ATTENDANCE EXPORT (Excel + PDF)                    ║
// ╚══════════════════════════════════════════════════════╝

function _buildAttExportRows() {
  const room = document.getElementById('att-room-sel')?.value || '';
  const date = document.getElementById('att-date')?.value || '';
  const students = DB.students.filter(s=>s.room===room)
    .sort((a,b)=>a.name.localeCompare(b.name,'th'));
  const dateDisplay = date ? new Date(date).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '';
  const rows = students.map((s,i) => {
    const st = _attRecords[s.id] || 'present';
    const cfg = ATT_STATUS[st];
    return { เลขที่:i+1, รหัส:s.id, ชื่อ:s.name, ห้อง:s.room, สถานะ:`${cfg.icon} ${cfg.label}`, ประเภท:cfg.label };
  });
  const counts = {};
  Object.keys(ATT_STATUS).forEach(k => counts[k] = rows.filter(r=>r.ประเภท===ATT_STATUS[k].label).length);
  return { room, date, dateDisplay, students, rows, counts };
}

function exportAttendanceExcel() {
  if(!checkFeatureGate('export_excel','Export Excel')) return;
  if(!isPremium()) { showUpgradeModal('Export Excel เฉพาะ Premium 🔒'); return; }
  if(typeof XLSX === 'undefined') { toast('กำลังโหลด Excel library...','warn'); return; }
  const { room, dateDisplay, rows, counts } = _buildAttExportRows();
  const ws_data = [
    [`รายงานการเช็คชื่อ — ${room} — ${dateDisplay}`],
    [],
    ['เลขที่','รหัส','ชื่อ-นามสกุล','ห้อง','สถานะ'],
    ...rows.map(r=>[r.เลขที่, r.รหัส, r.ชื่อ, r.ห้อง, r.สถานะ]),
    [],
    ['สรุป','','มา','ขาด','สาย','ลาป่วย','ลากิจ'],
    ['','',counts.present||0, counts.absent||0, counts.late||0, counts.sick||0, counts.personal||0],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{wch:6},{wch:14},{wch:28},{wch:10},{wch:12}];
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:4}}];
  XLSX.utils.book_append_sheet(wb, ws, room);
  XLSX.writeFile(wb, `เช็คชื่อ_${room}_${(document.getElementById('att-date')?.value||'').replace(/-/g,'')}.xlsx`);
  toast('✅ Export Excel เช็คชื่อสำเร็จ');
}

function exportAttendancePDF() {
  if(!checkFeatureGate('export_pdf','Export PDF')) return;
  if(!isPremium()) { showUpgradeModal('Export PDF เฉพาะ Premium 🔒'); return; }
  const { room, dateDisplay, rows, counts } = _buildAttExportRows();
  const dateFile = (document.getElementById('att-date')?.value||'').replace(/-/g,'');
  const statusColors = {
    present:'#15803D', absent:'#B91C1C', late:'#B45309', sick:'#BE123C', personal:'#6D28D9'
  };

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
    <title>เช็คชื่อ ${room} ${dateDisplay}</title>
    <style>
      *{font-family:Sarabun,sans-serif;box-sizing:border-box;margin:0;padding:0;}
      body{font-size:11pt;color:#1E293B;padding:12mm 15mm;}
      h1{font-size:16pt;font-weight:700;color:#2563EB;margin-bottom:4px;}
      .meta{font-size:9pt;color:#64748B;border-bottom:2px solid #E2E8F0;padding-bottom:8px;margin-bottom:10px;}
      .summary{display:flex;gap:10px;margin-bottom:12px;}
      .sum-box{flex:1;text-align:center;padding:8px;border-radius:8px;}
      table{width:100%;border-collapse:collapse;font-size:10pt;}
      th{background:#DBEAFE;color:#1E40AF;font-weight:700;padding:7px 6px;border:1px solid #BFDBFE;text-align:center;}
      td{padding:6px 8px;border:1px solid #E2E8F0;}
      tr:nth-child(even) td{background:#F8FAFF;}
      .num{text-align:center;color:#64748B;}
      .status{text-align:center;font-weight:700;}
      @media print{body{padding:8mm 10mm;}}
    </style>
  </head><body>
    <h1>📋 รายงานเช็คชื่อ — ${room}</h1>
    <div class="meta">วันที่: ${dateDisplay} &nbsp;|&nbsp; นักเรียน ${rows.length} คน &nbsp;|&nbsp; พิมพ์: ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</div>
    <div class="summary">
      <div class="sum-box" style="background:#DCFCE7;color:#15803D;"><b style="font-size:18pt;">${counts.present||0}</b><br>✅ มา</div>
      <div class="sum-box" style="background:#FEE2E2;color:#B91C1C;"><b style="font-size:18pt;">${counts.absent||0}</b><br>❌ ขาด</div>
      <div class="sum-box" style="background:#FEF3C7;color:#B45309;"><b style="font-size:18pt;">${counts.late||0}</b><br>⏰ สาย</div>
      <div class="sum-box" style="background:#FFF1F2;color:#BE123C;"><b style="font-size:18pt;">${counts.sick||0}</b><br>🤒 ลาป่วย</div>
      <div class="sum-box" style="background:#F5F3FF;color:#6D28D9;"><b style="font-size:18pt;">${counts.personal||0}</b><br>📋 ลากิจ</div>
    </div>
    <table><thead><tr><th style="width:40px;">ที่</th><th style="width:90px;">รหัส</th><th>ชื่อ-นามสกุล</th><th style="width:100px;">สถานะ</th></tr></thead>
    <tbody>${rows.map(r=>{
      const st = Object.entries(_attRecords).find(([id])=>id===r.รหัส)?.[1]||'present';
      const cfg = ATT_STATUS[st]||ATT_STATUS.present;
      return `<tr><td class="num">${r.เลขที่}</td><td class="num">${r.รหัส||''}</td><td>${r.ชื่อ}</td><td class="status" style="color:${statusColors[st]||'#000'};">${cfg.icon} ${cfg.label}</td></tr>`;
    }).join('')}</tbody></table>
  </body></html>`;

  const win = window.open('','_blank','width=800,height=700');
  if(!win) { toast('กรุณาอนุญาต Popup เพื่อ Export PDF','warn'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 800);
  toast('✅ Export PDF เช็คชื่อสำเร็จ');
}

// ╔══════════════════════════════════════════════════════╗
// ║  FEATURE FLAG SYSTEM                                ║
// ╚══════════════════════════════════════════════════════╝

let _featureFlags = {};
let _globalBypassIds = []; // email/id ที่ bypass ทุก lock

function isBypassAccount() {
  if(!CURRENT_TEACHER || !_globalBypassIds.length) return false;
  return _globalBypassIds.some(id =>
    id && (id === CURRENT_TEACHER.email || id === CURRENT_TEACHER.id || id === CURRENT_TEACHER.username)
  );
}

const FEATURE_DEFS = [
  { key:'attendance',   icon:'📋', label:'เช็คชื่อ',          plan:'Premium', desc:'หน้าเช็คชื่อนักเรียน + Export' },
  { key:'ai_report',    icon:'🤖', label:'AI สรุปรายงาน',     plan:'Premium', desc:'วิเคราะห์ข้อมูลด้วย AI' },
  { key:'export_excel', icon:'📊', label:'Export Excel',       plan:'Premium', desc:'ดาวน์โหลดรายงาน Excel' },
  { key:'export_pdf',   icon:'📄', label:'Export PDF',         plan:'Premium', desc:'ดาวน์โหลดรายงาน PDF' },
  { key:'grade',        icon:'🎓', label:'จัดการเกรด',         plan:'Premium', desc:'คำนวณและ Export เกรด' },
  { key:'renewal',      icon:'💳', label:'ระบบชำระเงิน',      plan:'ทุกคน',   desc:'ต่ออายุ Premium ด้วยสลิป' },
  { key:'ai_slip',      icon:'🔍', label:'AI อ่านสลิป',        plan:'ทุกคน',   desc:'ตรวจสอบสลิปอัตโนมัติ' },
  { key:'barcode_scan', icon:'📷', label:'สแกนบาร์โค้ด',      plan:'ทุกคน',   desc:'สแกนบาร์โค้ดบันทึกงาน' },
];

async function loadFeatureFlags(renderList = false) {
  if(!SB) return;
  try {
    const { data } = await SB.from('settings').select('value').eq('key','feature_flags').maybeSingle();
    _featureFlags = data?.value || {};
  } catch(e) { _featureFlags = {}; }

  if(renderList) renderFeatureFlagsList();
}

function renderFeatureFlagsList() {
  const el = document.getElementById('feature-flags-list');
  if(!el) return;

  el.innerHTML = FEATURE_DEFS.map(f => {
    const enabled = _featureFlags[f.key] !== false; // default ON
    const planBadge = f.plan === 'Premium'
      ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:linear-gradient(135deg,#EDE9FE,#DDD6FE);color:#6D28D9;border:1px solid #C4B5FD;">💎 ${f.plan}</span>`
      : `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;">🆓 ${f.plan}</span>`;

    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:#fff;border-radius:10px;margin-bottom:6px;border:1.5px solid ${enabled?'#C7D2FE':'#FCA5A5'};">
      <span style="font-size:18px;flex-shrink:0;">${f.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:${enabled?'var(--text)':'#94A3B8'};">${f.label}</div>
        <div style="font-size:11px;color:var(--text3);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${planBadge} <span>${f.desc}</span>
        </div>
      </div>
      <button onclick="toggleFeatureFlag('${f.key}',${!enabled})"
        style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px;border:none;cursor:pointer;white-space:nowrap;font-family:Sarabun,sans-serif;
        background:${enabled?'#DCFCE7':'#FEE2E2'};color:${enabled?'#15803D':'#B91C1C'};">
        ${enabled ? '🔓 เปิด' : '🔒 ปิด'}
      </button>
    </div>`;
  }).join('');
}

async function toggleFeatureFlag(featureKey, enabledState) {
  if(!SB) return;
  _featureFlags[featureKey] = enabledState;

  const { data: existing } = await SB.from('settings').select('key').eq('key','feature_flags').maybeSingle();
  const { error } = existing
    ? await SB.from('settings').update({ value: _featureFlags }).eq('key','feature_flags')
    : await SB.from('settings').insert({ key: 'feature_flags', value: _featureFlags });

  if(error) { toast2('บันทึกไม่สำเร็จ: ' + error.message, 'err'); return; }

  renderFeatureFlagsList();
  const def = FEATURE_DEFS.find(f=>f.key===featureKey);
  toast2(`${enabledState ? '🔓 เปิด' : '🔒 ปิด'} ${def?.label || featureKey} แล้ว`);
}

function isFeatureEnabled(key) {
  return _featureFlags[key] !== false;
}

function showFeatureLockedPopup(label) {
  const overlay = document.getElementById('feature-locked-overlay');
  const nameEl = document.getElementById('feature-locked-name');
  if(!overlay) return;
  if(nameEl) nameEl.textContent = '"' + label + '"';
  overlay.style.display = 'flex';
}

function closeFeatureLockedPopup() {
  const overlay = document.getElementById('feature-locked-overlay');
  if(overlay) overlay.style.display = 'none';
}

// requiresPremium: true = Premium-only feature, false = available to all
function checkFeatureGate(key, label, requiresPremium = true) {
  if(isBypassAccount()) return true; // bypass accounts ใช้ทุกฟีเจอร์ได้
  if(!isFeatureEnabled(key)) {
    if(requiresPremium && !isPremium()) {
      // Free user + admin locked → ให้ plan check จัดการ (แสดง upgrade modal ตามปกติ)
      return true;
    }
    // Premium user + admin locked → ปิดปรับปรุงชั่วคราว
    // หรือ feature ทุกคน + admin locked → ปิดปรับปรุงชั่วคราว
    showFeatureLockedPopup(label);
    return false;
  }
  return true;
}

// ╔══════════════════════════════════════════════════════╗
// ║  SA SIDEBAR NAVIGATION                              ║
// ╚══════════════════════════════════════════════════════╝

function showSASection(id, btn) {
  // Hide all sections
  document.querySelectorAll('.sa-section').forEach(s => s.style.display = 'none');
  // Show target
  const sec = document.getElementById('sa-sec-' + id);
  if(sec) sec.style.display = 'block';
  // Update nav highlight
  document.querySelectorAll('.sa-nav-item').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = '#94A3B8';
  });
  const activeBtn = btn || document.getElementById('sanav-' + id);
  if(activeBtn) {
    activeBtn.style.background = 'rgba(99,102,241,0.25)';
    activeBtn.style.color = '#C7D2FE';
  }
  // Lazy-load section data
  if(id === 'features') loadFeatureFlags(true);
  if(id === 'announce') loadAnnouncementSettings();
  if(id === 'plans')    { loadPlansSettings(); loadPaymentSettings(); }
  if(id === 'contact')  loadContactSettings();
  if(id === 'system')   { loadMaintenanceStatus(); checkOrphanData(); }
  if(id === 'api')      loadAnthropicKey();
  if(id === 'security') loadBypassIds?.();
}

// ╔══════════════════════════════════════════════════════╗
// ║  ATTENDANCE STATISTICS (สถิติสะสม)                  ║
// ╚══════════════════════════════════════════════════════╝

// สัญลักษณ์สถานะในตาราง
const ATT_SYMBOL = {
  present: '',          // มา = ช่องว่าง
  absent:  'ข',         // ขาด
  late:    'ส',         // สาย
  sick:    'ป',         // ลาป่วย
  personal:'ก',         // ลากิจ
};
const ATT_CELL_COLOR = {
  present: 'transparent',
  absent:  '#FEE2E2',
  late:    '#FEF3C7',
  sick:    '#FFF1F2',
  personal:'#F5F3FF',
};
const ATT_TEXT_COLOR = {
  present: '#000',
  absent:  '#B91C1C',
  late:    '#B45309',
  sick:    '#BE123C',
  personal:'#6D28D9',
};

let _attStatsData = null; // cache for export

async function loadAttendanceStats() {
  const room = document.getElementById('att-room-sel')?.value || '';
  if(!room || !SB || !CURRENT_TEACHER) return;

  const statsEl = document.getElementById('att-stats-content');
  if(statsEl) statsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">⏳ กำลังโหลดสถิติ...</div>';

  const roomKey = room.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_');
  const { data, error } = await SB.from('settings')
    .select('key,value')
    .like('key', `att_%_${roomKey}%_${CURRENT_TEACHER.id}`)
    .order('key');

  if(error || !data?.length) {
    if(statsEl) statsEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">${error?'โหลดไม่สำเร็จ':'ยังไม่มีข้อมูลเช็คชื่อ'}</div>`;
    return;
  }

  const students = DB.students.filter(s=>s.room===room).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  // Build date list (sorted)
  const dates = data.map(r=>r.value?.date).filter(Boolean).sort();
  // Build lookup: date → {sid: status}
  const dayMap = {};
  data.forEach(row => {
    const d = row.value?.date;
    if(!d) return;
    dayMap[d] = {};
    (row.value?.records||[]).forEach(r => { dayMap[d][r.id] = r.status || 'present'; });
  });

  // Cache for export
  _attStatsData = { room, students, dates, dayMap };

  if(!statsEl) return;
  statsEl.innerHTML = _buildAttStatsTableHTML(room, students, dates, dayMap, false);
}

function _buildAttStatsTableHTML(room, students, dates, dayMap, forPrint = false) {
  // Group dates by month
  const monthGroups = {};
  dates.forEach(d => {
    const dt = new Date(d);
    const mKey = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
    const mLabel = dt.toLocaleDateString('th-TH',{month:'short', year:'2-digit'});
    if(!monthGroups[mKey]) monthGroups[mKey] = {label:mLabel, dates:[]};
    monthGroups[mKey].dates.push(d);
  });

  const cs = 'border:1px solid #999;'; // cell style base
  const thS = `${cs}padding:3px 4px;text-align:center;background:#f0f0f0;font-size:11px;font-weight:700;`;
  const tdS = `${cs}padding:2px 3px;text-align:center;font-size:11px;`;

  // Count totals per student
  const totals = {};
  students.forEach(s => { totals[s.id] = {present:0,absent:0,late:0,sick:0,personal:0}; });
  dates.forEach(d => {
    students.forEach(s => {
      const st = dayMap[d]?.[s.id] ?? 'present';
      if(totals[s.id][st] !== undefined) totals[s.id][st]++;
    });
  });

  // Build header rows
  let monthHeader = `<th rowspan="4" style="${thS}min-width:30px;">เลขที่</th>
    <th rowspan="4" style="${thS}min-width:60px;">เลข<br>ประจำตัว</th>
    <th rowspan="4" style="${thS}min-width:120px;">ชื่อ - สกุล</th>`;
  let weekHeader = ``;
  let dayHeader = ``;
  let symbolHeader = ``;

  Object.values(monthGroups).forEach(mg => {
    monthHeader += `<th colspan="${mg.dates.length}" style="${thS}background:#dbeafe;">${mg.label}</th>`;
    // Week numbers
    mg.dates.forEach(d => {
      const dt = new Date(d);
      const weekOfMonth = Math.ceil(dt.getDate()/7);
      weekHeader += `<th style="${thS}min-width:22px;">${weekOfMonth}</th>`;
      dayHeader  += `<th style="${thS}">${dt.getDate()}</th>`;
      symbolHeader += `<th style="${thS}font-size:9px;">${['อา','จ','อ','พ','พฤ','ศ','ส'][dt.getDay()]}</th>`;
    });
  });

  // Summary header
  const sumH = `<th rowspan="4" style="${thS}min-width:30px;background:#d1fae5;">ม</th>
    <th rowspan="4" style="${thS}min-width:30px;background:#fef3c7;">ส</th>
    <th rowspan="4" style="${thS}min-width:30px;background:#fff1f2;">ป</th>
    <th rowspan="4" style="${thS}min-width:30px;background:#f5f3ff;">ก</th>
    <th rowspan="4" style="${thS}min-width:30px;background:#fee2e2;">ข</th>`;

  // Build data rows
  const dataRows = students.map((s, idx) => {
    const tot = totals[s.id];
    let cells = '';
    dates.forEach(d => {
      const st = dayMap[d]?.[s.id] ?? 'present';
      const sym = ATT_SYMBOL[st] || '';
      const bg = ATT_CELL_COLOR[st] || 'transparent';
      const tc = ATT_TEXT_COLOR[st] || '#000';
      cells += `<td style="${tdS}background:${bg};color:${tc};font-weight:700;">${sym}</td>`;
    });
    return `<tr>
      <td style="${tdS}">${idx+1}</td>
      <td style="${tdS}">${s.id}</td>
      <td style="${cs}padding:2px 6px;font-size:11px;text-align:left;">${s.name}</td>
      ${cells}
      <td style="${tdS}background:#d1fae5;font-weight:700;color:#15803D;">${tot.present}</td>
      <td style="${tdS}background:#fef3c7;color:#B45309;">${tot.late}</td>
      <td style="${tdS}background:#fff1f2;color:#BE123C;">${tot.sick}</td>
      <td style="${tdS}background:#f5f3ff;color:#6D28D9;">${tot.personal}</td>
      <td style="${tdS}background:#fee2e2;font-weight:700;color:#B91C1C;">${tot.absent}</td>
    </tr>`;
  }).join('');

  const tableHTML = `<table style="border-collapse:collapse;font-family:Sarabun,sans-serif;${forPrint?'width:100%;':''}">
    <thead>
      <tr>${monthHeader}${sumH}</tr>
      <tr>${weekHeader}</tr>
      <tr>${dayHeader}</tr>
      <tr>${symbolHeader}</tr>
    </thead>
    <tbody>${dataRows}</tbody>
  </table>`;

  return forPrint ? tableHTML : `
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">
      📅 <b>${dates.length} วัน</b> · ห้อง ${room}
      &nbsp;|&nbsp; ม=มา ส=สาย ป=ลาป่วย ก=ลากิจ ข=ขาด
    </div>
    <div style="overflow-x:auto;">${tableHTML}</div>`;
}

async function exportAttendanceStatsPDF() {
  if(!isPremium()) { showUpgradeModal('Export PDF เฉพาะ Premium 🔒'); return; }
  if(!_attStatsData) { toast('กรุณากด "โหลดสถิติ" ก่อน', 'warn'); return; }
  const { room, students, dates, dayMap } = _attStatsData;
  const tableHTML = _buildAttStatsTableHTML(room, students, dates, dayMap, true);
  const dateStr = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
    <title>สมุดเช็คชื่อ ${room}</title>
    <style>
      *{font-family:Sarabun,sans-serif;box-sizing:border-box;margin:0;padding:0;}
      body{font-size:10pt;color:#1E293B;padding:8mm 10mm;}
      h1{font-size:14pt;font-weight:700;margin-bottom:4px;}
      .meta{font-size:9pt;color:#64748B;margin-bottom:10px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #999;padding:2px 3px;text-align:center;}
      @media print{
        @page{size:A3 landscape;margin:8mm;}
        body{padding:0;}
      }
    </style>
  </head><body>
    <h1>สมุดเช็คชื่อ — ห้อง ${room}</h1>
    <div class="meta">พิมพ์วันที่ ${dateStr} &nbsp;|&nbsp; ม=มา &nbsp;ส=สาย &nbsp;ป=ลาป่วย &nbsp;ก=ลากิจ &nbsp;ข=ขาด</div>
    ${tableHTML}
    <script>window.onload=()=>setTimeout(()=>{window.print();},600);</script>
  </body></html>`;

  const win = window.open('','_blank');
  if(!win) { toast('กรุณาอนุญาต Popup','warn'); return; }
  win.document.write(html);
  win.document.close();
  toast('✅ เปิดหน้า Export PDF สมุดเช็คชื่อ');
}

function switchAttTab(tab) {
  const histPanel = document.getElementById('att-panel-history');
  const statsPanel = document.getElementById('att-panel-stats');
  const histBtn = document.getElementById('att-tab-history');
  const statsBtn = document.getElementById('att-tab-stats');
  if(tab === 'history') {
    if(histPanel) histPanel.style.display = 'block';
    if(statsPanel) statsPanel.style.display = 'none';
    if(histBtn) { histBtn.style.background = 'var(--blue-light)'; histBtn.style.color = 'var(--blue-dark)'; histBtn.style.borderBottom = '2px solid var(--blue)'; }
    if(statsBtn) { statsBtn.style.background = '#fff'; statsBtn.style.color = 'var(--text2)'; statsBtn.style.borderBottom = '2px solid transparent'; }
  } else {
    if(histPanel) histPanel.style.display = 'none';
    if(statsPanel) statsPanel.style.display = 'block';
    if(statsBtn) { statsBtn.style.background = 'var(--blue-light)'; statsBtn.style.color = 'var(--blue-dark)'; statsBtn.style.borderBottom = '2px solid var(--blue)'; }
    if(histBtn) { histBtn.style.background = '#fff'; histBtn.style.color = 'var(--text2)'; histBtn.style.borderBottom = '2px solid transparent'; }
  }
}

async function clearAttendanceData() {
  const room = document.getElementById('att-room-sel')?.value || '';
  if(!room) { toast('กรุณาเลือกห้องก่อน', 'warn'); return; }
  if(!SB || !CURRENT_TEACHER) return;

  // Confirm dialog
  const confirmed = confirm(`⚠️ ล้างข้อมูลเช็คชื่อทั้งหมดของห้อง "${room}"?\n\nข้อมูลทุกวันจะถูกลบถาวร กรุณา Export ก่อนถ้าต้องการเก็บ`);
  if(!confirmed) return;

  const btn = document.getElementById('att-clear-btn');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ กำลังล้าง...'; }

  try {
    const roomKey = room.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_');
    const pattern = `att_%_${roomKey}%_${CURRENT_TEACHER.id}`;
    // Fetch all matching keys first
    const { data, error } = await SB.from('settings').select('key').like('key', pattern);
    if(error) throw error;
    if(!data?.length) { toast('ไม่พบข้อมูลเช็คชื่อ', 'warn'); return; }

    // Delete all
    for(const row of data) {
      await SB.from('settings').delete().eq('key', row.key);
    }

    _attStatsData = null;
    _attRecords = {};
    document.getElementById('att-history-list').innerHTML = '';
    const statsEl = document.getElementById('att-stats-content');
    if(statsEl) statsEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">ล้างข้อมูลแล้ว</div>';
    updateAttSummary();
    toast(`🗑️ ล้างข้อมูลเช็คชื่อห้อง ${room} แล้ว (${data.length} วัน)`);
  } catch(e) {
    toast('ล้างไม่สำเร็จ: ' + e.message, 'err');
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '🗑️ ล้างข้อมูลเช็คชื่อ'; }
  }
}
