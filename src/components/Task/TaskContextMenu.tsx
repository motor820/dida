import React, { useState } from 'react';
import { 
  Flag, 
  ListTree, 
  Link2, 
  ArrowUpToLine, 
  XCircle, 
  FolderInput, 
  Tag as TagIcon, 
  Target, 
  Copy, 
  Link, 
  FileText, 
  Trash2,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { Task, Priority, RepeatRule } from '../../types';
import ContextMenu, { ContextMenuSeparator } from '../Common/ContextMenu';
import TagSelectorPopover from './TagSelectorPopover';
import DatePicker from '../Common/DatePicker';
import DateShortcuts from '../Common/DateShortcuts';
import { getPriorityTextClass, getPriorityBgColor } from '../../utils/priority';

interface TaskContextMenuProps {
  x: number;
  y: number;
  task: Task;
  isTrashView?: boolean;
  onClose: () => void;
  onSetPriority: (priority: Priority) => void;
  onSetDate: (days: number | null) => void;
  onUpdateDate: (date: number | undefined, reminder?: string, repeat?: RepeatRule | null) => void;
  onDelete: () => void;
  onRestore?: () => void;
  onDeletePermanently?: () => void;
  onAddSubtask: () => void;
  onUpdateTags: (tagIds: string[]) => void;
}

export default function TaskContextMenu({
  x,
  y,
  task,
  isTrashView,
  onClose,
  onSetPriority,
  onSetDate,
  onUpdateDate,
  onDelete,
  onRestore,
  onDeletePermanently,
  onAddSubtask,
  onUpdateTags
}: TaskContextMenuProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  if (showDatePicker) {
    return <ContextMenu x={x} y={y} onClose={onClose}>
      <DatePicker selectedDate={task.due_date ?? undefined} reminder={task.reminder ?? 'none'} repeat_rule={task.repeat_rule}
        onSelect={(date, reminder, repeat) => { onUpdateDate(date, reminder, repeat); onClose(); }} onCancel={onClose} />
    </ContextMenu>;
  }

  if (showTagSelector) {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <TagSelectorPopover
          selectedTagIds={task.tags || []}
          onConfirm={(tagIds) => {
            onUpdateTags(tagIds);
            onClose();
          }}
          onCancel={() => setShowTagSelector(false)}
        />
      </ContextMenu>
    );
  }

  if (isTrashView) {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className="w-[180px] bg-white rounded-lg overflow-hidden py-1">
          <MenuItem 
            icon={<RotateCcw className="w-4 h-4" />} 
            label="恢复任务" 
            onClick={() => { onRestore?.(); onClose(); }} 
          />
          <MenuItem 
            icon={<XCircle className="w-4 h-4" />} 
            label="永久删除" 
            onClick={() => { onDeletePermanently?.(); onClose(); }} 
            danger 
          />
        </div>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <div className="w-[220px] bg-white rounded-lg overflow-hidden shadow-xl border border-[var(--dida-border-light)]">
        {/* 日期部分 */}
        <div className="px-3 py-2">
          <div className="text-[11px] text-[var(--dida-text-tertiary)] mb-2">日期</div>
          <DateShortcuts onSelect={days => {
            if (days === undefined) setShowDatePicker(true);
            else { onSetDate(days); onClose(); }
          }} />
        </div>

        <ContextMenuSeparator />

        {/* 优先级部分 */}
        <div className="px-3 py-2">
          <div className="text-[11px] text-[var(--dida-text-tertiary)] mb-2">优先级</div>
          <div className="flex items-center justify-between px-1">
            <button 
              onClick={() => { onSetPriority(Priority.High); onClose(); }}
              className={`p-1.5 hover:bg-[var(--dida-bg-hover)] rounded-md transition-colors ${getPriorityTextClass(Priority.High)}`}
              style={{ backgroundColor: task.priority === Priority.High ? getPriorityBgColor(Priority.High, false) : undefined }}
              title="高优先级"
            >
              <Flag className="w-4 h-4 fill-current" />
            </button>
            <button 
              onClick={() => { onSetPriority(Priority.Medium); onClose(); }}
              className={`p-1.5 hover:bg-[var(--dida-bg-hover)] rounded-md transition-colors ${getPriorityTextClass(Priority.Medium)}`}
              style={{ backgroundColor: task.priority === Priority.Medium ? getPriorityBgColor(Priority.Medium, false) : undefined }}
              title="中优先级"
            >
              <Flag className="w-4 h-4 fill-current" />
            </button>
            <button 
              onClick={() => { onSetPriority(Priority.Low); onClose(); }}
              className={`p-1.5 hover:bg-[var(--dida-bg-hover)] rounded-md transition-colors ${getPriorityTextClass(Priority.Low)}`}
              style={{ backgroundColor: task.priority === Priority.Low ? getPriorityBgColor(Priority.Low, false) : undefined }}
              title="低优先级"
            >
              <Flag className="w-4 h-4 fill-current" />
            </button>
            <button 
              onClick={() => { onSetPriority(Priority.None); onClose(); }}
              className={`p-1.5 hover:bg-[var(--dida-bg-hover)] rounded-md transition-colors ${getPriorityTextClass(Priority.None)}`}
              style={{ backgroundColor: task.priority === Priority.None ? getPriorityBgColor(Priority.None, false) : undefined }}
              title="无优先级"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ContextMenuSeparator />

        {/* 操作列表 */}
        <div className="py-1">
          <MenuItem icon={<ListTree className="w-4 h-4" />} label="添加子任务" onClick={() => { onAddSubtask(); onClose(); }} />
          <MenuItem icon={<Link2 className="w-4 h-4" />} label="关联主任务" onClick={() => {}} />
          <MenuItem icon={<ArrowUpToLine className="w-4 h-4" />} label="置顶" onClick={() => {}} />
          <MenuItem icon={<XCircle className="w-4 h-4" />} label="放弃" onClick={() => {}} />
          <MenuItem icon={<FolderInput className="w-4 h-4" />} label="移动到" onClick={() => {}} hasSubmenu />
          <MenuItem icon={<TagIcon className="w-4 h-4" />} label="标签" onClick={() => setShowTagSelector(true)} hasSubmenu />
          <MenuItem icon={<Target className="w-4 h-4" />} label="开始专注" onClick={() => {}} hasSubmenu />
          <ContextMenuSeparator />
          <MenuItem icon={<Copy className="w-4 h-4" />} label="创建副本" onClick={() => {}} />
          <MenuItem icon={<Link className="w-4 h-4" />} label="复制链接" onClick={() => {}} />
          <MenuItem icon={<FileText className="w-4 h-4" />} label="转换为笔记" onClick={() => {}} />
          <ContextMenuSeparator />
          <MenuItem 
            icon={<Trash2 className="w-4 h-4" />} 
            label="删除" 
            onClick={() => { onDelete(); onClose(); }} 
            danger 
          />
        </div>
      </div>
    </ContextMenu>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}

function MenuItem({ icon, label, onClick, danger, hasSubmenu }: MenuItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full flex items-center gap-3 px-3 py-1.5 text-[13px] hover:bg-[var(--dida-bg-hover)] transition-colors ${
        danger ? 'text-red-500' : 'text-[var(--dida-text-main)]'
      }`}
    >
      <span className={`${danger ? 'text-red-500' : 'text-[var(--dida-text-tertiary)]'}`}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hasSubmenu && <ChevronRight className="w-3.5 h-3.5 text-[var(--dida-text-tertiary)]" />}
    </button>
  );
}
