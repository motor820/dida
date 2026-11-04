import { useTask, useSubtasks, useCreateSubtaskSimple, useUpdateTaskOrders, useUpdateTask, useUndoDeleteTask, useDeleteTaskPermanently, useDeleteTask, useToggleTask, useConvertDescriptionToSubtasks } from '../../hooks/useTasks';
import { useTags, useCreateTag } from '../../hooks/useTags';
import { useAppStore } from '../../store/useAppStore';
import { useAlertStore } from '../../store/useAlertStore';
import { X, Calendar, Flag, AlignLeft, ListTodo, Plus, Hash, RotateCcw, Trash2, MoreHorizontal, CheckSquare, ChevronRight, Type, MessageSquare, Copy, Printer, Archive, ArrowUpToLine, History, FileText, Play, Save, Link, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus, Paperclip, Workflow, Link2, Search, RefreshCw } from 'lucide-react';
import { Priority, Task, RepeatRule } from '../../types';
import { useState, useEffect, useRef, useMemo } from 'react';
import SubtaskItem from './SubtaskItem';
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea';
import { sortSubtasks } from '../../utils/subtaskOrder';
import DatePicker from '../Common/DatePicker';
import { useLists } from '../../hooks/useLists';
import { useQueryClient } from '@tanstack/react-query';
import { useClickOutside } from '../../hooks/useClickOutside';
import { getPriorityColor, getPriorityClass, getPriorityBgColor, getPriorityLabel, getPriorityTextClass } from '../../utils/priority';
import { formatTaskDateTime, isOverdue } from '../../utils/date';
import { getRandomTagColor } from '../../constants/colors';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

export default function TaskDetail() {
  const { selectedTaskId, setSelectedTaskId, selectedListId, taskChecklistViews, setTaskChecklistView } = useAppStore();
  
  const { showAlert } = useAlertStore();
  const queryClient = useQueryClient();
  const { data: task, isLoading } = useTask(selectedTaskId || '');
  const { data: subtasks } = useSubtasks(selectedTaskId || '');
  const { data: allTags } = useTags();
  const createTag = useCreateTag();
  const { data: allLists } = useLists();
  const convertDescription = useConvertDescriptionToSubtasks();
  const convertingRef = useRef(false);
  const titleBusyRef = useRef(false);
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const createSubtask = useCreateSubtaskSimple();
  const updateTaskOrders = useUpdateTaskOrders();
  const updateTask = useUpdateTask();
  const undoDeleteTask = useUndoDeleteTask();
  const deleteTaskPermanently = useDeleteTaskPermanently();
  const deleteTask = useDeleteTask();
  const [newSubtaskTitle, setNewTaskTitle] = useState('');

  const isTrashView = selectedListId === 'smart_trash';

  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState('');
  const tagSearchInputRef = useRef<HTMLInputElement>(null);
  const [isPriorityPopoverOpen, setIsPriorityPopoverOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const priorityPopoverRef = useRef<HTMLDivElement>(null);
  const priorityTriggerRef = useRef<HTMLButtonElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const originalTitleRef = useRef('');
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrowTextarea(titleInputRef, editTitleValue, isEditingTitle);

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const checklistView = selectedTaskId ? taskChecklistViews[selectedTaskId] ?? !!subtasks?.length : false;
  const modeLabel = checklistView ? '详情' : '检查事项';
  const [checklistText, setChecklistText] = useState('');
  const [checklistDirty, setChecklistDirty] = useState(false);
  const checklistInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setChecklistDirty(false);
    setChecklistText('');
  }, [selectedTaskId]);
  useEffect(() => {
    if (!checklistDirty) setChecklistText((subtasks || []).map(child => child.title).join('\n'));
  }, [subtasks, checklistDirty]);
  useEffect(() => {
    const input = checklistInputRef.current;
    if (input) {
      input.style.height = 'auto';
      const resize = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(input);
      return () => observer.disconnect();
    }
  }, [checklistText, checklistView]);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const toggleTask = useToggleTask();

  const slashMenuItems = useMemo(() => [
    { icon: Heading1, label: '一级标题', section: 'text' },
    { icon: Heading2, label: '二级标题', section: 'text' },
    { icon: Heading3, label: '三级标题', section: 'text' },
    { icon: List, label: '无序列表', section: 'list' },
    { icon: ListOrdered, label: '有序列表', section: 'list' },
    { icon: CheckSquare, label: '检查项', section: 'list' },
    { icon: Quote, label: '引用', section: 'other' },
    { icon: Minus, label: '水平分割线', section: 'other' },
    { icon: Paperclip, label: '附件', section: 'action' },
    { icon: Workflow, label: '子任务', section: 'action' },
    { icon: Hash, label: '标签', section: 'action' },
    { icon: Link2, label: '关联任务/笔记', section: 'action' },
  ], []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task) {
      toggleTask.mutate(task.id);
    }
  };

  useEffect(() => {
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setIsSlashMenuOpen(false);
    setNewTaskTitle('');
    setFocusedSubtaskId(null);
  }, [selectedTaskId]);

  useEffect(() => {
    if (task && !isEditingTitle) {
      console.log('TaskDetail sync task title:', task.id, task.title);
      setEditTitleValue(task.title);
    }
  }, [task?.id, task?.title, isTrashView, isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      // 使用 requestAnimationFrame 确保在 DOM 渲染后执行聚焦
      const timer = requestAnimationFrame(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          const end = titleInputRef.current.value.length;
          titleInputRef.current.setSelectionRange(end, end);
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [isEditingTitle, task?.id]);

  const handleTitleStartEdit = () => {
    if (isTrashView) return;
    originalTitleRef.current = task?.title || '';
    setIsEditingTitle(true);
  };

  const handleTitleChange = (newTitle: string) => {
    setEditTitleValue(newTitle);
    if (task) {
      // 实时更新本地缓存，实现列表和详情的同步
      const updatedTask = { ...task, title: newTitle };
      queryClient.setQueryData(['task', task.id], updatedTask);
      
      // 更新主列表缓存
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(t => t.id === task.id ? updatedTask : t);
      });

      // 如果是子任务，更新父任务的子任务列表缓存
      if (task.parent_id) {
        queryClient.setQueryData(['subtasks', task.parent_id], (oldData: Task[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(t => t.id === task.id ? updatedTask : t);
        });
      }
    }
  };

  const handleTitleSave = async (): Promise<boolean> => {
    if (!task || titleBusyRef.current) return false;
    titleBusyRef.current = true;
    try {
      const trimmedTitle = editTitleValue.trim();
      if (trimmedTitle !== originalTitleRef.current) {
        await updateTask.mutateAsync({ ...task, title: trimmedTitle });
        if (useAppStore.getState().selectedTaskId === task.id) originalTitleRef.current = trimmedTitle;
      }
      if (useAppStore.getState().selectedTaskId === task.id) setIsEditingTitle(false);
      return true;
    } catch { return false; /* Keep the title draft available when saving fails. */ }
    finally { titleBusyRef.current = false; }
  };

  const handleTitleKey = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!task || event.nativeEvent.isComposing || titleBusyRef.current) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (await handleTitleSave() && useAppStore.getState().selectedTaskId === task.id) {
        const savedTask = queryClient.getQueryData<Task>(['task', task.id]);
        setDescriptionValue(updateTask.isPending ? descriptionValue : savedTask?.description ?? task.description ?? '');
        setIsEditingDescription(true);
      }
    }
  };

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null);

  // 使用自定义 hook 处理点击外部关闭 Popover
  useClickOutside([tagPopoverRef, tagTriggerRef], () => setIsTagPopoverOpen(false), isTagPopoverOpen);
  useClickOutside([priorityPopoverRef, priorityTriggerRef], () => setIsPriorityPopoverOpen(false), isPriorityPopoverOpen);
  useClickOutside([datePickerRef, dateTriggerRef], () => setIsDatePickerOpen(false), isDatePickerOpen);
  useClickOutside([moreMenuRef, moreMenuTriggerRef], () => setIsMoreMenuOpen(false), isMoreMenuOpen);
  useClickOutside([slashMenuRef], () => setIsSlashMenuOpen(false), isSlashMenuOpen);

  useEffect(() => {
    if (task && !isEditingDescription && !updateTask.isPending) {
      setDescriptionValue(task.description || '');
    }
  }, [task?.description, isEditingDescription, updateTask.isPending]);

  useEffect(() => {
    const input = descriptionInputRef.current;
    if (isEditingDescription && input) {
      input.style.height = 'auto';
      const resize = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(input);
      return () => observer.disconnect();
    }
  }, [descriptionValue, isEditingDescription]);

  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      const input = descriptionInputRef.current;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.scrollIntoView({ block: 'nearest' });
    }
  }, [isEditingDescription]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescriptionValue(e.target.value);
    setIsSlashMenuOpen(e.target.value.endsWith('/'));
  };

  const handleDescriptionBlur = () => {
    if (isSlashMenuOpen || convertingRef.current) return;
    if (task && descriptionValue !== (task.description || '')) {
      updateTask.mutate({ ...task, description: descriptionValue });
    }
    setIsEditingDescription(false);
  };

  const handleConvertDescription = async () => {
    if (!task || convertingRef.current) return;
    const description = isEditingDescription ? descriptionValue : task.description;
    if (checklistView) {
      setTaskChecklistView(task.id, false);
      requestAnimationFrame(() => checklistInputRef.current?.focus());
      return;
    }
    // Only the initial text-to-checklist conversion consumes the description.
    // Once a checklist exists, description and checklist text are independent fields.
    const initialConversion = !subtasks?.length && taskChecklistViews[task.id] === undefined;
    convertingRef.current = true;
    try {
      await convertDescription.mutateAsync({
        id: task.id,
        description: initialConversion ? description : '',
        checklistText: checklistDirty ? checklistText : undefined,
        detailDescription: !initialConversion && isEditingDescription ? description : undefined,
      });
      setChecklistDirty(false);
      setTaskChecklistView(task.id, true);
      setDescriptionValue(initialConversion ? '' : description);
      setIsEditingDescription(false);
      setIsSlashMenuOpen(false);
    } catch { /* Keep the original draft when persistence fails. */ }
    finally { convertingRef.current = false; }
  };

  const handleChecklistTextBlur = async () => {
    if (!task || !checklistDirty || convertingRef.current) return;
    convertingRef.current = true;
    try {
      await convertDescription.mutateAsync({ id: task.id, description: '', checklistText });
      setChecklistDirty(false);
    } catch { /* Keep the draft available if the atomic save fails. */ }
    finally { convertingRef.current = false; }
  };

  const handleSlashItemClick = (label: string) => {
    // 1. 立即停止冒泡，防止触发其他事件
    // 注意：这里没有 event 对象，因为是 button 的 onClick
    
    // 2. 计算并更新描述（移除最后的 /）
    let newDesc = descriptionValue;
    if (descriptionValue.endsWith('/')) {
      newDesc = descriptionValue.slice(0, -1);
      setDescriptionValue(newDesc);
      
      // 3. 立即触发一次保存到数据库，确保状态同步
      if (task) {
        updateTask.mutate({
          ...task,
          description: newDesc
        });
      }
    }

    // 4. 处理具体功能
    if (label === '标签') {
      setIsTagPopoverOpen(true);
    }
    
    // 5. 关闭菜单并强制回焦
    setIsSlashMenuOpen(false);
    setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 0);
  };

// 本地子任务状态，用于流畅的拖放响应
  const [localSubtasks, setLocalSubtasks] = useState<Task[]>([]);

  useEffect(() => {
    if (subtasks) {
      // 过滤掉已删除的子任务
      const filteredSubtasks = subtasks.filter(t => !t.is_deleted);
      setLocalSubtasks(sortSubtasks(filteredSubtasks));
    }
  }, [subtasks, selectedTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSubtasks.findIndex((t) => t.id === active.id);
    const newIndex = localSubtasks.findIndex((t) => t.id === over.id);

    if (oldIndex < 0 || newIndex < 0 || localSubtasks[oldIndex].completed || localSubtasks[newIndex].completed) return;
    const newSubtasks = sortSubtasks(arrayMove(localSubtasks, oldIndex, newIndex));
    setLocalSubtasks(newSubtasks);

    const ascendingOrders: [string, number][] = newSubtasks.map((t, index) => [
      t.id,
      index * 10,
    ]);

    updateTaskOrders.mutate(ascendingOrders);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim() && task) {
      createSubtask.mutate({
        title: newSubtaskTitle.trim(),
        parentId: task.id,
        listId: task.list_id,
      });
      setNewTaskTitle('');
    }
  };

  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    const search = tagSearchValue.toLowerCase().trim();
    return allTags.filter(tag => 
      !task?.tags?.includes(tag.id) && 
      tag.name.toLowerCase().includes(search)
    );
  }, [allTags, task?.tags, tagSearchValue]);

  const showCreateOption = useMemo(() => {
    const search = tagSearchValue.trim();
    if (!search) return false;
    return !allTags?.some(tag => tag.name.toLowerCase() === search.toLowerCase());
  }, [allTags, tagSearchValue]);

  const handleCreateAndAddTag = async () => {
    const name = tagSearchValue.trim();
    if (!name || !task) return;

    try {
      const newTag = await createTag.mutateAsync({ name, color: getRandomTagColor() });
      if (newTag) {
        handleToggleTag(newTag.id);
        setTagSearchValue('');
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  useEffect(() => {
    if (isTagPopoverOpen) {
      setTagSearchValue('');
      // 延迟聚焦，确保 DOM 已渲染
      setTimeout(() => tagSearchInputRef.current?.focus(), 50);
    }
  }, [isTagPopoverOpen]);

  const handleToggleTag = (tagId: string) => {
    if (!task) return;
    const currentTags = task.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];

    updateTask.mutate({
      ...task,
      tags: newTags
    });
    // 选择标签后自动关闭弹窗
    setIsTagPopoverOpen(false);
  };

  const handlePriorityChange = (priority: Priority) => {
    if (!task) return;
    updateTask.mutate({ ...task, priority });
    setIsPriorityPopoverOpen(false);
  };

  const handleDateChange = (timestamp: number | undefined, reminder?: string, repeat_rule?: RepeatRule | null) => {
    if (task) {
      updateTask.mutate({
        ...task,
        due_date: timestamp || null,
        reminder: reminder || 'none',
        repeat_rule: repeat_rule || null,
      });
    }
    setIsDatePickerOpen(false);
  };

  const handleDelete = () => {
    if (task) {
      deleteTask.mutate(task.id);
      setSelectedTaskId(null);
    }
  };

  const handleRestore = () => {
    if (task) {
      undoDeleteTask.mutate(task.id);
      setSelectedTaskId(null);
    }
  };

  const handleDeletePermanently = () => {
    if (task) {
      showAlert({
        title: '永久删除任务',
        message: '确定要永久删除这个任务吗？此操作不可撤销。',
        type: 'error',
        confirmLabel: '删除',
        onConfirm: () => {
          deleteTaskPermanently.mutate(task.id);
          setSelectedTaskId(null);
        }
      });
    }
  };

  if (!selectedTaskId) {
    return (
      <div
        className="border-l border-gray-200 bg-white flex items-center justify-center relative min-w-0 w-full h-full"
      >
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-sm">选择一个任务查看详情</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="border-l border-gray-200 bg-white flex items-center justify-center relative min-w-0 w-full h-full"
      >
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div
      className="border-l border-gray-200 bg-white flex flex-col relative min-w-0 w-full h-full select-none"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-2 border-b border-gray-100 h-12">
        <div className="flex items-center gap-2">
          {/* 滴答清单风格 Checkbox */}
          <div className="flex-shrink-0 flex items-center justify-center pl-1">
            <div
              onClick={handleToggle}
              className={`dida-checkbox ${getPriorityClass(task.priority)} ${task.completed ? 'completed' : ''}`}
              style={{
                borderColor: getPriorityColor(task.priority),
                backgroundColor: getPriorityBgColor(task.priority, !!task.completed),
                width: '18px',
                height: '18px',
              }}
            />
          </div>

          {/* 日期选择器 */}
          <div className="relative">
            <button
              ref={dateTriggerRef}
              type="button"
              aria-label="设置任务日期"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"
            >
              {(() => {
                const overdue = !task.completed && isOverdue(task.due_date);
                const iconColor = overdue ? 'text-[var(--priority-high)]' : (task.due_date ? 'text-[var(--dida-primary)]' : 'text-gray-400');
                const textColor = overdue ? 'text-[var(--priority-high)]' : (task.due_date ? 'text-gray-700' : 'text-gray-400');
                
                return (
                  <>
                    <Calendar className={`w-4 h-4 ${iconColor}`} />
                    <span className={`text-[13px] font-medium ${textColor}`}>
                      {task.due_date ? formatTaskDateTime(task.due_date) : '日期'}
                    </span>
                    {task.repeat_rule && (
                      <RefreshCw className={`w-3 h-3 ml-0.5 ${iconColor}`} />
                    )}
                  </>
                );
              })()}
            </button>
            {isDatePickerOpen && (
              <div ref={datePickerRef} className="absolute top-full left-0 mt-1 z-[1000]">
                <DatePicker
                  selectedDate={task.due_date || undefined}
                  reminder={task.reminder || 'none'}
                  repeat_rule={task.repeat_rule}
                  onSelect={handleDateChange}
                  onCancel={() => setIsDatePickerOpen(false)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* 优先级 */}
          <div className="relative">
            <button
              ref={priorityTriggerRef}
              type="button"
              onClick={() => setIsPriorityPopoverOpen(!isPriorityPopoverOpen)}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="设置优先级"
            >
              <Flag className={`w-4 h-4 ${getPriorityTextClass(task.priority)} ${task.priority !== Priority.None ? 'fill-current' : ''}`} />
            </button>
            {isPriorityPopoverOpen && (
              <div
                ref={priorityPopoverRef}
                className="absolute top-full right-0 mt-1 w-32 bg-white border border-gray-100 shadow-xl rounded-lg p-1 z-[1000]"
              >
                {[Priority.High, Priority.Medium, Priority.Low, Priority.None].map((p) => (
                  <div
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
                  >
                    <Flag className={`w-3.5 h-3.5 ${getPriorityTextClass(p)} ${task.priority === p ? 'fill-current' : ''}`} />
                    <span className="text-[12px] text-gray-700">{getPriorityLabel(p)}优先级</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button 
              ref={moreMenuTriggerRef}
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`p-1.5 hover:bg-gray-100 rounded-md transition-colors ${isMoreMenuOpen ? 'bg-gray-100 text-gray-600' : ''}`}
              title="更多"
            >
              <MoreHorizontal className={`w-4 h-4 ${isMoreMenuOpen ? 'text-gray-600' : 'text-gray-400'}`} />
            </button>

            {/* 更多操作菜单 */}
            {isMoreMenuOpen && (
              <div
                ref={moreMenuRef}
                className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-100 shadow-xl rounded-xl py-1.5 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="px-1.5 space-y-0.5">
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Plus className="w-4 h-4 text-gray-400" />
                    <span>添加子任务</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Link className="w-4 h-4 text-gray-400" />
                    <span>关联主任务</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <ArrowUpToLine className="w-4 h-4 text-gray-400" />
                    <span>置顶</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Archive className="w-4 h-4 text-gray-400" />
                    <span>放弃</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span>标签</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Plus className="w-4 h-4 text-gray-400" />
                    <span>上传附件</span>
                  </button>
                  
                  <div className="h-[1px] bg-gray-50 my-1 mx-2" />
                  
                  <button type="button" className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors group">
                    <div className="flex items-center gap-3">
                      <Play className="w-4 h-4 text-gray-400" />
                      <span>开始专注</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  </button>
                  
                  <div className="h-[1px] bg-gray-50 my-1 mx-2" />
                  
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <History className="w-4 h-4 text-gray-400" />
                    <span>任务动态</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Save className="w-4 h-4 text-gray-400" />
                    <span>保存为模板</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Copy className="w-4 h-4 text-gray-400" />
                    <span>创建副本</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Link className="w-4 h-4 text-gray-400" />
                    <span>复制链接</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span>转换为笔记</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                    <Printer className="w-4 h-4 text-gray-400" />
                    <span>打印</span>
                  </button>
                  
                  <div className="h-[1px] bg-gray-50 my-1 mx-2" />
                  
                  <button 
                    type="button" 
                    onClick={() => {
                      handleDelete();
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setSelectedTaskId(null)}
            type="button"
            aria-label="关闭任务详情"
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* 标题 */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {isEditingTitle && !isTrashView ? (
              <textarea
                ref={titleInputRef}
                rows={1}
                aria-label="主任务标题"
                data-task-id={task.id}
                value={editTitleValue}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKey}
                readOnly={updateTask.isPending}
                placeholder="无标题"
                className="dida-title-editor block w-full resize-none overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] text-[18px] font-bold text-gray-800 leading-snug outline-none bg-transparent"
              />
            ) : (
              <h3
                onClick={handleTitleStartEdit}
                className={`text-[18px] font-bold text-gray-800 leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] ${isTrashView ? 'text-gray-400 cursor-default' : 'cursor-text hover:bg-gray-50 -mx-1 px-1 rounded transition-colors'
                  } ${task.completed ? 'text-gray-400' : ''}`}
                title={isTrashView ? '' : "点击修改标题"}
              >
                {task.title || '无标题'}
              </h3>
            )}
          </div>
          {!isTrashView && (
            <button type="button" aria-label={modeLabel} title={modeLabel}
              onMouseDown={e => e.preventDefault()}
              onClick={handleConvertDescription} disabled={convertDescription.isPending}
              className="group/checklist relative p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:shadow-md focus-visible:shadow-md transition-shadow disabled:opacity-40">
              {checklistView ? <AlignLeft className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
              <span className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/checklist:opacity-100 group-focus-visible/checklist:opacity-100 z-20">{modeLabel}</span>
            </button>
          )}
        </div>

        {/* 垃圾桶视图下的操作按钮 */}
        {isTrashView && (
          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-[var(--dida-primary)] text-white rounded-md hover:bg-[#40a9ff] transition-colors text-[13px] font-medium shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              恢复任务
            </button>
            <button
              onClick={handleDeletePermanently}
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-red-200 text-red-500 rounded-md hover:bg-red-50 transition-colors text-[13px] font-medium"
            >
              <Trash2 className="w-4 h-4" />
              永久删除
            </button>
          </div>
        )}

        {/* 描述区域 */}
        <div className={`space-y-2 relative ${!checklistView && subtasks?.length && !task.description && !isEditingDescription ? 'hidden' : ''}`}>
          <div 
            className={`min-h-[28px] p-2 -mx-2 hover:bg-gray-50 rounded-md transition-colors cursor-text group ${isEditingDescription ? 'bg-white' : ''}`}
            onClick={() => { if (!isTrashView) setIsEditingDescription(true); }}
          >
            {isEditingDescription ? (
              <textarea
                ref={descriptionInputRef}
                value={descriptionValue}
                onChange={handleDescriptionChange}
                onBlur={handleDescriptionBlur}
                placeholder="输入内容或使用 / 快速插入"
                className="w-full min-h-[28px] overflow-hidden bg-transparent outline-none text-[13px] text-gray-700 leading-relaxed resize-none placeholder:text-gray-300"
              />
            ) : task.description ? (
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-[13px] text-gray-300 italic">点此添加详细描述...</p>
            )}
          </div>

          {/* Slash Context Menu */}
          {isSlashMenuOpen && (
            <div 
              ref={slashMenuRef}
              className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-100 shadow-2xl rounded-xl py-1.5 z-[60] animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="overflow-y-auto custom-scrollbar">
                {slashMenuItems.map((item, index) => {
                  const showDivider = index > 0 && slashMenuItems[index-1].section !== item.section;
                  return (
                    <div key={item.label}>
                      {showDivider && <div className="h-[1px] bg-gray-50 my-1 mx-2" />}
                      <button
                        onClick={() => handleSlashItemClick(item.label)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-all">
                          <item.icon className="w-3.5 h-3.5 text-gray-500 group-hover:text-[var(--dida-primary)]" />
                        </div>
                        <span className="text-[12px] text-gray-600 group-hover:text-gray-900">{item.label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 子任务区域；文本模式下与独立描述之间留一行间距。 */}
        <div className={`space-y-2 ${!checklistView && (task.description || isEditingDescription) && subtasks?.length ? 'pt-1' : ''}`}>
          {!checklistView && (!!subtasks?.length || checklistDirty) ? (
            <textarea ref={checklistInputRef} aria-label="任务详情" value={checklistText}
              readOnly={isTrashView || convertDescription.isPending}
              onChange={event => { setChecklistText(event.target.value); setChecklistDirty(true); }}
              onBlur={handleChecklistTextBlur}
              className="block w-full min-h-[28px] overflow-hidden resize-none bg-transparent text-[13px] text-gray-700 leading-relaxed outline-none"
            />
          ) : <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext items={localSubtasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {localSubtasks.map((subtask) => (
                  <SubtaskItem key={subtask.id} subtask={subtask} readOnly={isTrashView}
                    autoFocus={focusedSubtaskId === subtask.id}
                    onCreated={next => {
                      setLocalSubtasks(current => {
                        const rows = current.filter(child => child.id !== next.id);
                        const index = rows.findIndex(child => child.id === subtask.id);
                        rows.splice(index + 1, 0, next);
                        return rows;
                      });
                      setFocusedSubtaskId(next.id);
                    }} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {!isTrashView && (
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 py-1 px-2 group">
              <Plus className="w-4 h-4 text-gray-300 group-hover:text-[var(--dida-primary)] transition-colors" />
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="添加子任务..."
                className="flex-1 bg-transparent outline-none text-[13px] text-gray-700 placeholder:text-gray-300"
              />
            </form>
          )}
          </>}
        </div>
        {/* 标签展示区 - 位于子任务下方 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px] font-bold text-gray-400 uppercase tracking-tighter">
            <Hash className="w-3.5 h-3.5" />
            <span>标签</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 relative">
            {Array.isArray(task.tags) && task.tags
              .map(tagId => ({ tagId, tagInfo: (allTags || []).find(t => t.id === tagId) }))
              .filter(item => item.tagInfo)
              .map(({ tagId, tagInfo }) => {
                return (
                  <span
                    key={tagId}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium group cursor-default transition-colors"
                    style={{ 
                      color: tagInfo!.color, 
                      backgroundColor: `${tagInfo!.color}15`,
                      border: `1px solid ${tagInfo!.color}20`
                    }}
                  >
                    <Hash className="w-3 h-3 mr-0.5 opacity-70" style={{ color: tagInfo!.color }} />
                    {tagInfo!.name}
                    {!isTrashView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTag(tagId);
                        }}
                        className="ml-1 hover:opacity-100 opacity-40 transition-opacity"
                        style={{ color: tagInfo!.color }}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                );
              })}
            {!isTrashView && (
              <>
                <button
                  ref={tagTriggerRef}
                  onClick={() => setIsTagPopoverOpen(!isTagPopoverOpen)}
                  className="inline-flex items-center px-1.5 py-0.5 text-gray-400 hover:text-[var(--dida-primary)] hover:bg-blue-50 rounded transition-colors"
                  title="添加标签"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* 标签简易选择器 Popover - 移动到按钮旁边 */}
                {isTagPopoverOpen && (
                  <div
                    ref={tagPopoverRef}
                    className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-100 shadow-xl rounded-lg p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        ref={tagSearchInputRef}
                        type="text"
                        value={tagSearchValue}
                        onChange={(e) => setTagSearchValue(e.target.value)}
                        placeholder="快速搜索或创建标签"
                        className="w-full pl-7 pr-2 py-1.5 bg-gray-50 border-none rounded-md text-[13px] outline-none placeholder:text-gray-300 focus:bg-gray-100 transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && showCreateOption) {
                            handleCreateAndAddTag();
                          }
                        }}
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {filteredTags.map(tag => (
                        <div
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-[#F0F7FF] rounded-md cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#CBD5E0' }} />
                            <span className="text-[13px] text-gray-700">{tag.name}</span>
                          </div>
                        </div>
                      ))}

                      {showCreateOption && (
                        <div
                          onClick={handleCreateAndAddTag}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#F0F7FF] rounded-md cursor-pointer transition-colors text-[var(--dida-primary)]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[13px]">创建标签 "{tagSearchValue}"</span>
                        </div>
                      )}

                      {filteredTags.length === 0 && !showCreateOption && (
                        <div className="px-2 py-4 text-center text-xs text-gray-400 italic">
                          {tagSearchValue ? '未找到相关标签' : '暂无可用标签'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>


      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-white h-12 relative">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {/* 所属清单 */}
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer transition-colors max-w-[150px]">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-[13px] text-gray-500 truncate">
              {allLists?.find(l => l.id === task.list_id)?.name || '收集箱'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title="排版"
          >
            <Type className="w-4 h-4 text-gray-400" />
          </button>
          <button
            type="button"
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors relative"
            title="评论"
          >
            <MessageSquare className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
