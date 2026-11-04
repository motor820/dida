import { useEffect, useState, useSyncExternalStore } from 'react';
import { offline } from '../../sync/store';
import { request } from '../../sync/api';
interface Device { id: string; name: string; created: number; current: boolean }
export default function SyncPanel({ onClose }: { onClose: () => void }) {
  const status = useSyncExternalStore(offline.subscribe, offline.getStatus);
  const [username, setUsername] = useState(status.username || 'motordida');
  const [password, setPassword] = useState(''), [current, setCurrent] = useState(''), [next, setNext] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [devices, setDevices] = useState<Device[]>([]);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const refresh = async () => { try { setDevices(await request<Device[]>('GET', '/devices')); } catch { setDevices([]); } };
  useEffect(() => { void refresh(); }, []);
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([offline.exportData()], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `dida-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-5" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="账号与同步" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">账号与同步</h2><button aria-label="关闭" onClick={onClose}>关闭</button></div>
      <p className="text-sm text-slate-500">服务： https://dida.aiking.net:888<br />上次同步：{status.lastSync ? new Date(status.lastSync).toLocaleString() : '尚未同步'} · 待上传 {status.pending} 项</p>
      {status.error && <p role="status" className="text-sm text-amber-700">本机已保存 · {status.error}</p>}
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void action(async () => { await offline.login(username, password); setPassword(''); setMessage('登录成功'); await refresh(); }); }}>
        <h3 className="font-medium">{status.username ? '重新登录同步' : '登录同步'}</h3>
        <label className="block text-sm">账号<input aria-label="同步账号" autoComplete="username" className="mt-1 w-full border rounded-lg p-2" value={username} onChange={e => setUsername(e.target.value)} required /></label><input aria-label="同步密码" type="password" autoComplete="current-password" placeholder="账号密码" className="w-full border rounded-lg p-2" value={password} onChange={e => setPassword(e.target.value)} required />
        <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">登录</button>
      </form>
      <div className="border-t pt-4 space-y-3"><h3 className="font-medium">数据备份与迁移</h3>
        <button className="mr-4 text-blue-600" onClick={exportData}>导出本机数据</button>
        <label className="text-blue-600 cursor-pointer">导入备份<input className="hidden" type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f) void action(async () => { if (f.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20MB'); await offline.importData(await f.text()); setMessage('数据已导入本机，将自动同步'); }); e.target.value = ''; }} /></label>
        <button className="block text-sm text-slate-500" disabled={busy} onClick={() => { if (confirm('将旧版本在这台设备上的任务、清单和标签导入当前账号？原始数据会保留。')) void action(async () => { await offline.importLegacy(); setMessage('旧数据已导入，原始数据仍保留'); }); }}>导入这台设备的旧版数据</button>
      </div>
      {status.username && <form className="border-t pt-4 space-y-3" onSubmit={e => { e.preventDefault(); void action(async () => { if (!confirm('修改后所有设备都需要重新登录。继续？')) return; await offline.changePassword(current, next); setCurrent(''); setNext(''); setMessage('密码已修改，请重新登录'); }); }}>
        <h3 className="font-medium">修改三端共用密码</h3><input aria-label="当前密码" type="password" autoComplete="current-password" placeholder="当前密码" className="w-full border rounded-lg p-2" value={current} onChange={e => setCurrent(e.target.value)} required />
        <input aria-label="新密码" type="password" autoComplete="new-password" minLength={12} placeholder="新密码（至少 12 个字符）" className="w-full border rounded-lg p-2" value={next} onChange={e => setNext(e.target.value)} required />
        <button disabled={busy} className="border rounded-lg px-4 py-2">修改密码</button>
      </form>}
      {devices.length > 0 && <div className="border-t pt-4 space-y-2"><h3 className="font-medium">已登录设备</h3>{devices.map(d => <div key={d.id} className="flex justify-between gap-3 text-sm"><span>{d.name} {d.current ? '（当前设备）' : ''}</span>{!d.current && <button className="text-red-600" onClick={() => { void action(async () => { await request('DELETE', `/devices/${d.id}`); await refresh(); }); }}>撤销登录</button>}</div>)}</div>}
      {message && <p role="status" className="text-sm text-blue-700">{message}</p>}
      <button disabled={busy} className="text-sm text-red-600" onClick={() => { if (confirm(status.pending ? '本机还有未上传修改。请先导出备份；退出会清除本机缓存。确定退出？' : '退出并清除这台设备的任务缓存？服务器数据保留。')) void action(async () => { await offline.logout(); onClose(); }); }}>退出登录并清除本机缓存</button>
    </section>
  </div>;
}
