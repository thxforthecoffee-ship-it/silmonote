/* Authorization is enforced again by database policies/RPCs. URL parameters never grant access. */
window.AppAccess = (() => {
  let epoch = 0;
  let activeUserId = null;
  const unavailable = () => new Error('이 기록은 휴지통으로 이동되었거나 접근할 수 없습니다. 목록을 새로고침해 주세요.');
  const stale = () => new Error('로그인 상태가 변경되었습니다. 다시 로그인해 주세요.');
  function assertCurrent(version) { if (version !== epoch) throw stale(); }
  function watch(client) {
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (activeUserId && session?.user?.id && activeUserId !== session.user.id)) {
        epoch++;
        activeUserId = null;
        document.body.hidden = true;
        location.replace('index.html?reason=session');
      }
    });
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  }
  async function requireAccess(client, adminOnly = false) {
    const version = epoch;
    const { data, error } = await client.auth.getUser();
    assertCurrent(version);
    if (error || !data?.user) {
      location.replace('index.html?reason=login');
      throw stale();
    }
    const user = data.user;
    activeUserId = user.id;
    const result = await client.rpc('is_admin');
    assertCurrent(version);
    if (result.error || typeof result.data !== 'boolean') throw new Error('접근 권한을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    const isAdmin = result.data === true;
    if (adminOnly && !isAdmin) throw new Error('관리자 승인이 필요한 페이지입니다. 권한을 받은 계정으로 로그인해 주세요.');
    if (!isAdmin) {
      const profile = await client.from('profiles').select('is_approved').eq('id', user.id).maybeSingle();
      assertCurrent(version);
      if (profile.error) throw new Error('가입 승인 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
      if (!profile.data?.is_approved) {
        location.replace('index.html?reason=pending');
        throw new Error('아직 가입 승인 대기 중입니다. 선생님의 승인 후 이용할 수 있습니다.');
      }
    }
    activeUserId = user.id;
    return { user, isAdmin, version };
  }
  async function loadActive(client, table, id, ownerOnly = false) {
    const access = await requireAccess(client);
    let query = client.from(table).select('*').eq('id', id).is('deleted_at', null);
    if (!access.isAdmin || ownerOnly) query = query.eq('user_id', access.user.id);
    const { data, error } = await query.maybeSingle();
    assertCurrent(access.version);
    if (error || !data || data.deleted_at != null) throw unavailable();
    return { data, access };
  }
  async function updateActive(client, table, id, changes, adminOnly = false, ownerOnly = false) {
    const access = await requireAccess(client, adminOnly);
    let query = client.from(table).update(changes).eq('id', id).is('deleted_at', null);
    if (!access.isAdmin || ownerOnly) query = query.eq('user_id', access.user.id);
    const { data, error } = await query.select('id::text').maybeSingle();
    assertCurrent(access.version);
    if (error) throw new Error('저장하지 못했습니다. 권한과 기록 상태를 확인한 뒤 다시 시도해 주세요.');
    if (!data) throw unavailable();
    return data;
  }
  function escapeDeep(value) {
    if (typeof value === 'string') return value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    if (Array.isArray(value)) return value.map(escapeDeep);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, escapeDeep(item)]));
    return value;
  }
  return { requireAccess, watch, loadActive, updateActive, assertCurrent, unavailable, escapeDeep };
})();
