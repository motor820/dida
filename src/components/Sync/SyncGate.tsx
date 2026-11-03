import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { offline } from '../../sync/store';
import SyncPanel from './SyncPanel';

export default function SyncGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(offline.subscribe, offline.getStatus);
  const query = useQueryClient();
  const [username, setUsername] = useState('motor'), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [settings, setSettings] = useState(false);
  useEffect(() => {
    void offline.initialize().catch(e => setError(String(e)));
    const update = () => { if (!offline.getStatus().authorized) query.clear(); else void query.invalidateQueries(); };
    window.addEventListener('dida-data-changed', update);
    return () => window.removeEventListener('dida-data-changed', update);
  }, [query]);
  if (!status.ready || !status.authorized) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-slate-200 space-y-5" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError('');
        try { await offline.login(username, password); setPassword(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
      }}>
        <div><h1 className="text-2xl font-semibold text-slate-900">Dida</h1><p className="mt-2 text-sm text-slate-500">登录后同步你的任务与清单</p></div>
        <label className="block text-sm">账号<input autoComplete="username" className="mt-2 w-full rounded-lg border p-3" value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label className="block text-sm">密码<input type="password" autoComplete="current-password" className="mt-2 w-full rounded-lg border p-3" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {(error || status.error) && <p role="alert" className="text-sm text-red-600">{error || status.error}</p>}
        <button disabled={busy || !status.ready} className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:opacity-50">{busy ? '正在登录…' : '登录'}</button>
        {status.native && <button type="button" className="w-full text-sm text-slate-500" onClick={() => { void offline.useOffline(); }}>先离线使用，稍后登录同步</button>}
        <p className="text-xs text-slate-400">Mac、安卓和网页使用同一账号密码。当前版本先提供 Mac 与网页。</p>
      </form>
    </div>
  );
  return <div className="h-screen flex flex-col">
    <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span>{status.username || '离线使用'} · {status.syncing ? '正在同步…' : status.error ? `本机已保存 · ${status.error}` : status.pending ? `本机已保存 · 待上传 ${status.pending} 项` : status.username ? '已同步' : '数据仅保存在本机'}</span>
      <div className="flex shrink-0 gap-4"><button disabled={status.syncing || !status.username} onClick={() => { void offline.sync(); }}>立即同步</button><button onClick={() => setSettings(true)}>账号与同步</button></div>
    </div>
    <div className="min-h-0 flex-1">{children}</div>
    {settings && <SyncPanel onClose={() => setSettings(false)} />}
  </div>;
}
