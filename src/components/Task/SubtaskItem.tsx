import { useState, useRef, useEffect } from 'react';
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea';
import { createPortal } from 'react-dom';
import DatePicker from '../Common/DatePicker';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatTaskDate } from '../../utils/date';
import { Task } from '../../types';
import { useToggleTask, useUpdateTask, useDeleteTask, useCreateTaskAfter } from '../../hooks/useTasks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, AlarmClock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getPriorityClass, getPriorityColor, getPriorityBgColor } from '../../utils/priority';

interface SubtaskItemProps {
    subtask: Task;
    readOnly?: boolean;
    autoFocus?: boolean;
    onCreated: (task: Task) => void;
}

export default function SubtaskItem({ subtask, readOnly = false, autoFocus = false, onCreated }: SubtaskItemProps) {
    const toggleTask = useToggleTask();
    const updateTask = useUpdateTask();
    const deleteTask = useDeleteTask();
    const createAfter = useCreateTaskAfter();
    const busyRef = useRef(false);
    const skipBlurRef = useRef(false);
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(subtask.title);
    const originalTitleRef = useRef(subtask.title);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useAutoGrowTextarea(inputRef, editTitle, isEditing);

    const [datePosition, setDatePosition] = useState<{ top: number; left: number } | null>(null);
    const dateRef = useRef<HTMLDivElement>(null);
    const dateButtonRef = useRef<HTMLButtonElement>(null);
    useClickOutside([dateRef, dateButtonRef], () => setDatePosition(null), !!datePosition);
    useEffect(() => {
        const close = (event: Event) => { if (!(event.target instanceof Node) || !dateRef.current?.contains(event.target)) setDatePosition(null); };
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
        return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
    }, []);

    useEffect(() => {
        if (!datePosition) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setDatePosition(null);
                dateButtonRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleEscape, true);
        return () => window.removeEventListener('keydown', handleEscape, true);
    }, [datePosition]);

    // Sortable logic
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subtask.id, disabled: readOnly || subtask.completed });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: 'relative' as const,
    };

    // 同步外部标题变化
    useEffect(() => {
        if (!isEditing && subtask.title !== editTitle) {
            console.log('SubtaskItem sync subtask title:', subtask.id, subtask.title);
            setEditTitle(subtask.title);
            originalTitleRef.current = subtask.title;
        }
    }, [subtask.title, isEditing]);

    // 当任务完成时，确保退出编辑模式
    useEffect(() => {
        if (subtask.completed && isEditing) {
            setIsEditing(false);
        }
    }, [subtask.completed, isEditing]);

    useEffect(() => {
        if (autoFocus) setIsEditing(true);
    }, [autoFocus]);

    useEffect(() => {
        if (isEditing) {
            skipBlurRef.current = false;
            inputRef.current?.focus();
            const end = inputRef.current?.value.length ?? 0;
            inputRef.current?.setSelectionRange(end, end);
            inputRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        if (isEditing || readOnly || subtask.completed || isDragging) return;
        originalTitleRef.current = subtask.title;
        setIsEditing(true);
    };

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (readOnly) return;
        // 如果正在编辑，先保存或关闭编辑
        if (isEditing) {
            await handleSave();
        }
        console.log('SubtaskItem toggling task:', subtask.id, subtask.title);
        toggleTask.mutate(subtask.id);
    };

    const handleTitleChange = (newTitle: string) => {
        setEditTitle(newTitle);
        // 实时更新缓存
        const updatedTask = { ...subtask, title: newTitle };
        queryClient.setQueryData(['task', subtask.id], updatedTask);
        
        // 更新主列表
        queryClient.setQueriesData({ queryKey: ['tasks'] }, (oldData: Task[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(t => t.id === subtask.id ? updatedTask : t);
        });

        // 更新父任务的子任务列表
        if (subtask.parent_id) {
            queryClient.setQueryData(['subtasks', subtask.parent_id], (oldData: Task[] | undefined) => {
                if (!oldData) return oldData;
                return oldData.map(t => t.id === subtask.id ? updatedTask : t);
            });
        }
    };

    const handleSave = async () => {
        if (busyRef.current || skipBlurRef.current) return;
        const trimmedTitle = editTitle.trim();
        if (trimmedTitle !== originalTitleRef.current) {
            console.log('SubtaskItem saving title:', subtask.id, trimmedTitle, 'original:', originalTitleRef.current);
            try {
                await updateTask.mutateAsync({ ...subtask, title: trimmedTitle });
                originalTitleRef.current = trimmedTitle;
            } catch (err) {
                console.error('SubtaskItem save title failed:', err);
                return;
            }
        }
        setIsEditing(false);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing || busyRef.current) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            busyRef.current = true;
            try {
                const next = await createAfter.mutateAsync({ id: subtask.id, title: editTitle });
                originalTitleRef.current = editTitle;
                setIsEditing(false);
                onCreated(next);
            } catch { /* Keep the draft; the global mutation handler shows the error. */ }
            finally { busyRef.current = false; }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            skipBlurRef.current = true;
            handleTitleChange(originalTitleRef.current);
            setIsEditing(false);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteTask.mutate(subtask.id);
    };

    return (
        <div
            ref={setNodeRef}
            data-subtask-id={subtask.id}
            tabIndex={0}
            style={style}
            className={`group -ml-[13px] flex items-start gap-1 py-2 px-0 border-b border-gray-100 hover:bg-[var(--dida-bg-hover)] rounded-md transition-colors cursor-pointer ${isDragging ? 'opacity-50 shadow-md bg-white ring-1 ring-[rgba(var(--dida-primary-rgb),0.1)]' : ''
                }`}
        >
            {/* 拖拽手柄 */}
            <div
                {...attributes}
                {...listeners}
                className="w-5 shrink-0 mt-0.5 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity cursor-grab active:cursor-grabbing"
            >
                <GripVertical className="w-3.5 h-3.5 text-[var(--dida-text-tertiary)]" />
            </div>

            <div className="flex-shrink-0 flex items-center justify-center w-6 mt-0.5">
                <button
                    type="button"
                    role="checkbox"
                    aria-label={subtask.title || '无标题子任务'}
                    aria-checked={subtask.completed}
                    disabled={readOnly || toggleTask.isPending}
                    onClick={handleToggle}
                    className={`dida-checkbox ${getPriorityClass(subtask.priority)} ${subtask.completed ? 'completed' : ''}`}
                    style={{
                        borderColor: !subtask.completed ? getPriorityColor(subtask.priority) : undefined,
                        backgroundColor: getPriorityBgColor(subtask.priority, !!subtask.completed),
                        width: '15px',
                        height: '15px',
                    }}
                />
            </div>

            <div className="flex-1 min-w-0 px-1" onClick={handleStartEdit}>
                {isEditing ? (
                    <textarea
                        ref={inputRef}
                        rows={1}
                        aria-label="子任务标题"
                        data-task-id={subtask.id}
                        placeholder="无标题"
                        readOnly={createAfter.isPending}
                        value={editTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="dida-title-editor block w-full resize-none overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] bg-transparent text-[13px] leading-5 outline-none placeholder:text-gray-300"
                    />
                ) : (
                    <span
                        className={`text-[13px] leading-5 transition-colors block whitespace-pre-wrap [overflow-wrap:anywhere] ${subtask.completed ? 'text-[var(--dida-text-tertiary)]' : 'text-[var(--dida-text-main)]'
                            }`}
                    >
                        {subtask.title || '无标题子任务'}
                    </span>
                )}
            </div>

            {subtask.due_date && <span className="shrink-0 whitespace-nowrap mt-0.5 text-xs text-gray-400">{formatTaskDate(subtask.due_date)}</span>}
            {!readOnly && <div className={`flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${isEditing || datePosition ? 'opacity-100' : ''}`}>
            <button ref={dateButtonRef} type="button" aria-label="设置子任务截止日期" title="设置截止日期"
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                    e.stopPropagation();
                    if (datePosition) { setDatePosition(null); return; }
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDatePosition({ top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 520)), left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288)) });
                }}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-[var(--dida-primary)]">
                <AlarmClock className="w-3.5 h-3.5" />
            </button>
            {/* 删除按钮 */}
            <button
                onClick={handleDelete}
                className="w-6 h-6 flex items-center justify-center text-[var(--dida-text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded transition-all"
                title="删除子任务"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            </div>}
            {datePosition && createPortal(
                <div ref={dateRef} style={datePosition} className="fixed z-[300] max-h-[calc(100vh-16px)] overflow-y-auto bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
                    <DatePicker onCancel={() => setDatePosition(null)} selectedDate={subtask.due_date ?? undefined} reminder={subtask.reminder ?? undefined} repeat_rule={subtask.repeat_rule}
                        onSelect={(timestamp, reminder, repeat_rule) => {
                            updateTask.mutate({ ...subtask, title: isEditing ? editTitle : subtask.title, due_date: timestamp ?? null, reminder: reminder ?? null, repeat_rule: repeat_rule ?? null });
                            setDatePosition(null);
                        }} />
                </div>, document.body
            )}
        </div>
    );
}
