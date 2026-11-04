import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { CheckSquare, Calendar, Search, Settings, RefreshCw } from 'lucide-react';
import { offline } from '../../sync/store';
import SyncPanel from '../Sync/SyncPanel';
import Tooltip from '../Common/Tooltip';
import userAvatar from '../../assets/user-avatar.jpg';

export default function NavRail() {
    const { viewMode, setViewMode } = useAppStore();
    const status = useSyncExternalStore(offline.subscribe, offline.getStatus);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const syncLabel = status.syncing ? '正在同步…' : status.error ? `本机已保存 · ${status.error}` : status.pending ? `待上传 ${status.pending} 项` : status.username ? '已同步' : '离线使用，数据保存在本机';

    return (
        <nav aria-label="快捷导航" className="w-[60px] h-full bg-[var(--dida-border-light)] border-r border-gray-200 flex flex-col items-center py-4 text-gray-500 z-50 flex-shrink-0">
            {/* 用户头像 */}
            <img src={userAvatar} alt="用户头像" width={32} height={32}
                className="w-8 h-8 rounded-full object-cover mb-6 shrink-0 shadow-sm" />

            {/* 核心导航 */}
            <div className="flex flex-col gap-4 w-full items-center px-2">
                <button
                    onClick={() => setViewMode('tasks')}
                    className={`nav-item w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === 'tasks' ? 'bg-white text-[var(--dida-primary)] shadow-sm' : 'hover:bg-gray-200/50 text-gray-500'
                        }`}
                    title="任务"
                >
                    <CheckSquare className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setViewMode('calendar')}
                    className={`nav-item w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-white text-[var(--dida-primary)] shadow-sm' : 'hover:bg-gray-200/50 text-gray-500'
                        }`}
                    title="日历"
                >
                    <Calendar className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setViewMode('search')}
                    className={`nav-item w-10 h-10 flex items-center justify-center rounded-xl transition-all ${viewMode === 'search' ? 'bg-white text-[var(--dida-primary)] shadow-sm' : 'hover:bg-gray-200/50 text-gray-500'
                        }`}
                    title="搜索"
                >
                    <Search className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1" />

            {/* 底部功能 */}
            <div className="flex flex-col gap-4 mb-2">
                <Tooltip placement="right" label={`立即同步 · ${syncLabel}`}>
                    <button type="button" aria-label="立即同步" aria-busy={status.syncing}
                        disabled={status.syncing || !status.username}
                        onClick={() => { void offline.sync(); }}
                        className="relative p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-40">
                        <RefreshCw className={`w-5 h-5 ${status.syncing ? 'animate-spin' : ''}`} />
                        {(status.error || status.pending > 0) && <span aria-hidden="true" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${status.error ? 'bg-red-500' : 'bg-blue-500'}`} />}
                    </button>
                </Tooltip>
                <Tooltip placement="right" label="设置">
                    <button type="button" aria-label="设置" aria-haspopup="dialog" aria-expanded={settingsOpen}
                        onClick={() => setSettingsOpen(true)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <Settings className="w-5 h-5" />
                    </button>
                </Tooltip>
            </div>
            {settingsOpen && createPortal(<SyncPanel onClose={() => setSettingsOpen(false)} />, document.body)}
        </nav>
    );
}
