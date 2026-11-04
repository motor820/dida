import { useState, useRef, useEffect, useMemo } from 'react';
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
import { Plus, Calendar, ChevronDown, Flag, Hash, X, Check, Trash2, Inbox, Paperclip, Copy, Settings, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTasks, useCreateTaskExtended, useUpdateTaskOrders, useEmptyTrash } from '../../hooks/useTasks';
import { useTags, useCreateTag, useUpdateTag } from '../../hooks/useTags';
import { useLists } from '../../hooks/useLists';
import { Task, Priority, RepeatRule } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useAlertStore } from '../../store/useAlertStore';
import TaskItem from './TaskItem';
import { sortTasksByDate } from '../../utils/taskOrder';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import DatePicker from '../Common/DatePicker';

import { SMART_LIST_IDS } from '../../constants/smartLists';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatTaskDateTime } from '../../utils/date';
import { getPriorityLabel, getPriorityTextClass } from '../../utils/priority';
import { groupTasks, getSortedGroupNames } from '../../utils/taskGrouping';
export default function TaskList() {
  const { compactNavigation, drawerDetails } = useResponsiveLayout();
  const { navigationDrawerOpen, setNavigationDrawerOpen } = useAppStore();
  const isSidebarCollapsed = useAppStore(state => state.isSidebarCollapsed);
  const sidebarHidden = compactNavigation ? !navigationDrawerOpen : isSidebarCollapsed;
  const { 
    selectedListId, 
    selectedTagId, 
    toggleSidebar 
  } = useAppStore();
  const { data: tasks } = useTasks(selectedListId || undefined, selectedTagId || undefined);
  const { data: allTasks } = useTasks();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [insertions, setInsertions] = useState<Record<string, string>>({});
  useEffect(() => { setEditingTaskId(null); setInsertions({}); }, [selectedListId, selectedTagId]);
  const { data: allTags } = useTags();
  const { data: lists } = useLists();
  const createTask = useCreateTaskExtended();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const updateTaskOrders = useUpdateTaskOrders();
  const emptyTrash = useEmptyTrash();
  const { showAlert } = useAlertStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<number | undefined>();
  const [newTaskReminder, setNewTaskReminder] = useState<string | undefined>();
  const [newTaskRepeat, setNewTaskRepeat] = useState<RepeatRule | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState<number | undefined>();
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);

  // 标题编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState('');
  
  // 当切换标签或列表时，重置标题输入框和预设标签
  useEffect(() => {
    // 只有在真的切换了 ID 且不是因为点击日期选择器等操作导致的重新渲染时才重置
    if (selectedTagId && allTags) {
      const tag = allTags.find(t => t.id === selectedTagId);
      if (tag) {
        // setTitleInputValue(tag.name); // 这行可能是干扰，因为它和 newTaskTitle 逻辑混淆了
        setNewTaskTags([selectedTagId]);
      }
    } else {
      setNewTaskTags([]);
    }
  }, [selectedTagId]); // 减少依赖项，只在 ID 变化时触发

  const handleTitleSave = () => {
    if (selectedTagId && allTags && titleInputValue.trim()) {
      const tag = allTags.find(t => t.id === selectedTagId);
      if (tag && tag.name !== titleInputValue.trim()) {
        updateTag.mutate({ ...tag, name: titleInputValue.trim() });
      }
    }
    setIsEditingTitle(false);
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);

  // 本地排序状态，用于流畅的拖拽响应
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks || []);

  useEffect(() => {
    if (tasks) {
      console.log('TaskList received tasks:', tasks.length);
      setLocalTasks(tasks);
    }
  }, [tasks]);

  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('focus-task-input', handleFocus);
    return () => window.removeEventListener('focus-task-input', handleFocus);
  }, []);

  // 使用自定义 hook 处理点击外部关闭弹层
  useClickOutside([datePickerRef], () => setShowDatePicker(false), showDatePicker);
  useClickOutside([moreMenuRef], () => {
    setShowMoreMenu(false);
    setShowTagMenu(false);
    setShowListMenu(false);
  }, showMoreMenu);

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      // 检查当前是否有正在进行的点击/交互可能导致了误触
      // 特别是 DatePicker 内部的按钮点击不应该触发此表单提交
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.closest('.date-picker-container') || 
        datePickerRef.current?.contains(activeElement)
      )) {
        console.log('Prevented accidental task submission from DatePicker interaction');
        return;
      }
    }
    if (newTaskTitle.trim()) {
      // 如果是“所有任务”视图或没有选择清单，默认为收集箱 (inbox)
      const listId = (selectedListId === 'smart_all' || !selectedListId) ? 'smart_inbox' : selectedListId;
      let title = newTaskTitle.trim();
      const tagsToAssign = new Set(newTaskTags);

      // 解析标题中的标签 (例如 "#工作")
      const tagMatches = title.match(/#(\S+)/g);
      if (tagMatches) {
        for (const match of tagMatches) {
          const tagName = match.substring(1); // 移除 #
          // 查找现有标签
          const existingTag = allTags?.find(t => t.name === tagName);
          
          if (existingTag) {
            tagsToAssign.add(existingTag.id);
          } else {
            // 创建新标签
            try {
               const newTag = await createTag.mutateAsync({ name: tagName, color: 'var(--dida-tag-default)' });
               tagsToAssign.add(newTag.id);
            } catch (error) {
               console.error('Failed to create tag:', error);
            }
          }
          
          // 从标题中移除标签文本
          title = title.replace(match, '').trim();
        }
      }

      // 如果移除标签后标题为空，恢复原标题（或者根据需求保留空标题但通常不允许）
      // 这里如果只输入了 #tag，可能标题就为空了。滴答清单允许这种情况吗？通常需要一个标题。
      // 如果为空，我们保留原标题，但仍然关联标签。
      if (!title) {
        title = newTaskTitle.trim();
      }

      createTask.mutate({
        title: title,
        listId: listId,
        dueDate: newTaskDueDate,
        reminder: newTaskReminder,
        repeat_rule: newTaskRepeat || undefined,
        priority: newTaskPriority,
        tags: Array.from(tagsToAssign),
        description: undefined,
      });
      setNewTaskTitle('');
      setNewTaskDueDate(undefined);
      setNewTaskReminder(undefined);
      setNewTaskRepeat(null);
      setNewTaskPriority(undefined);
      setNewTaskTags([]);
      setShowDatePicker(false);
      setShowMoreMenu(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setNewTaskTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || isTrashView) return;

    const oldIndex = localTasks.findIndex((t) => t.id === active.id);
    const newIndex = localTasks.findIndex((t) => t.id === over.id);

    if (oldIndex < 0 || newIndex < 0 || localTasks[oldIndex].completed !== localTasks[newIndex].completed || localTasks[oldIndex].due_date !== localTasks[newIndex].due_date) return;
    setInsertions({});
    const newTasks = arrayMove(localTasks, oldIndex, newIndex);
    setLocalTasks(newTasks);

    const ascendingOrders: [string, number][] = newTasks.map((t, index) => [
      t.id,
      index * 10,
    ]);

    updateTaskOrders.mutate(ascendingOrders);
  };

  const isTrashView = selectedListId === SMART_LIST_IDS.TRASH;
  const isCompletedView = selectedListId === SMART_LIST_IDS.COMPLETED;
  const isAllView = selectedListId === SMART_LIST_IDS.ALL;
  const isTodayView = selectedListId === SMART_LIST_IDS.TODAY;
  const isWeekView = selectedListId === SMART_LIST_IDS.WEEK;

  // 统一分组逻辑
  const taskGroups = useMemo(() => {
    let strategy: 'all' | 'today' | 'week' | 'none' = 'none';
    if (isAllView) strategy = 'all';
    else if (isTodayView) strategy = 'today';
    else if (isWeekView) strategy = 'week';

    const roots = isTrashView ? localTasks.filter(t => !t.parent_id) : sortTasksByDate(localTasks.filter(t => !t.parent_id));
    const groups = strategy === 'none'
      ? { '任务': roots.filter(t => !t.completed), '已完成': roots.filter(t => t.completed) }
      : groupTasks(roots, strategy);
    const sortedNames = getSortedGroupNames(groups);

    for (const [id, anchorId] of Object.entries(insertions)) {
      const source = Object.keys(groups).find(name => groups[name].some(t => t.id === id));
      const target = Object.keys(groups).find(name => groups[name].some(t => t.id === anchorId));
      if (!source || !target || id !== editingTaskId) continue;
      const task = groups[source].find(t => t.id === id)!;
      const anchor = groups[target].find(t => t.id === anchorId)!;
      if (task.due_date !== anchor.due_date) continue;
      groups[source] = groups[source].filter(t => t.id !== id);
      const index = groups[target].findIndex(t => t.id === anchorId);
      groups[target].splice(index + 1, 0, task);
    }
    return sortedNames.map(name => ({ name, tasks: groups[name] }));
  }, [localTasks, isAllView, isTodayView, isWeekView, isTrashView, insertions, editingTaskId]);

  const renderTask = (task: Task) => (
    <TaskItem key={task.id} task={task}
      subtasks={(allTasks || []).filter(t => t.parent_id === task.id && !t.is_deleted)}
      isEditing={editingTaskId === task.id}
      onEdit={() => { if (!drawerDetails) setEditingTaskId(task.id); }}
      onEditEnd={() => {
        setEditingTaskId(current => current === task.id ? null : current);
        setInsertions(current => { const next = { ...current }; delete next[task.id]; return next; });
      }}
      onCreated={next => {
        setLocalTasks(current => [...current.filter(t => t.id !== next.id), next].sort((a, b) => a.order - b.order));
        setInsertions(current => { const positions = { ...current, [next.id]: task.id }; delete positions[task.id]; return positions; });
        setEditingTaskId(next.id);
      }}
    />
  );

  const hideInput = isTrashView || isCompletedView;

  // 辅助函数：根据优先级获取颜色已选属性是否存在的标记
  const hasAttributes = newTaskDueDate || newTaskPriority !== undefined || newTaskTags.length > 0;

  const handleEmptyTrash = () => {
    showAlert({
      title: '清空垃圾桶',
      message: '确定要清空垃圾桶吗？所有任务都将永久删除。',
      type: 'error',
      confirmLabel: '清空',
      onConfirm: () => {
        emptyTrash.mutate();
      }
    });
  };

  // 计算当前视图标题
  let viewTitle = '';
  if (selectedTagId && allTags) {
    const tag = allTags.find(t => t.id === selectedTagId);
    if (tag) viewTitle = tag.name;
  } else if (selectedListId && lists) {
    const list = lists.find(l => l.id === selectedListId);
    if (list) viewTitle = list.name;
  }

  return (
    <div className="h-full flex flex-col bg-white select-none">
      {/* 顶部标题栏 */}
      <div className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => compactNavigation ? setNavigationDrawerOpen(!navigationDrawerOpen) : toggleSidebar()}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
            title={sidebarHidden ? "显示侧边栏" : "收起侧边栏"}
          >
            {sidebarHidden ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          {selectedTagId ? (
            isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={titleInputValue}
                onChange={(e) => setTitleInputValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                className="text-2xl font-bold text-gray-800 outline-none border-b-2 border-[var(--dida-primary)] pb-1 bg-transparent"
              />
            ) : (
              <h1
                onClick={() => {
                  setTitleInputValue(viewTitle);
                  setIsEditingTitle(true);
                }}
                className="text-2xl font-bold text-gray-800 cursor-text hover:bg-gray-50 px-1 -mx-1 rounded transition-colors"
                title="点击修改标签名称"
              >
                # {viewTitle}
              </h1>
            )
          ) : (
            <h1 className="text-2xl font-bold text-gray-800">{viewTitle}</h1>
          )}
        </div>
      </div>

      {/* 垃圾桶顶部操作栏 */}
      {isTrashView && localTasks.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-[12px] text-gray-400">
            任务将在垃圾桶中保留 7 天
          </div>
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-red-500 hover:bg-red-50 rounded transition-colors font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空垃圾桶
          </button>
        </div>
      )}

      {/* 顶部快速添加栏 - 垃圾桶和已完成视图下隐藏 */}
      {!hideInput && (
        <div className={`px-4 py-3 shrink-0 relative ${showDatePicker || showMoreMenu ? 'z-[200]' : 'z-10'}`}>
          <form 
            onSubmit={handleAddTask} 
            className="relative"
          >
            <div className={`flex flex-col bg-[#F1F1F1] focus-within:bg-white border-2 border-transparent focus-within:border-[var(--dida-primary)]/30 rounded-xl transition-all group ${hasAttributes ? 'pb-2' : ''}`}>
              {/* 输入区域 */}
              <div className="flex items-center gap-2 px-3 py-2">
                <Plus className={`w-5 h-5 transition-colors shrink-0 ${newTaskPriority ? getPriorityTextClass(newTaskPriority as Priority) : 'text-gray-400 group-focus-within:text-[var(--dida-primary)]'}`} />
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="添加任务"
                  className="min-w-0 flex-1 bg-transparent h-9 text-[14px] text-gray-700 outline-none placeholder:text-gray-400"
                />

                {/* 右侧按钮组 - 只有在聚焦或有内容时才显示 */}
                <div className={`flex items-center gap-1 transition-all duration-200 ${newTaskTitle || showDatePicker || showMoreMenu ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100'}`}>
                  {/* 日期按钮 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="flex items-center gap-1 px-1.5 py-1 text-[13px] text-gray-400 hover:text-[var(--dida-primary)] hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                    >
                      {newTaskDueDate ? (
                        <>
                          <span className="text-[var(--dida-primary)] font-medium">{formatTaskDateTime(newTaskDueDate)}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--dida-primary)]" />
                        </>
                      ) : (
                        <Calendar className="w-4.5 h-4.5" />
                      )}
                    </button>

                    {/* 日期选择器浮层 */}
                    {showDatePicker && (
                      <div ref={datePickerRef} className="absolute top-full right-0 mt-2 z-[200] shadow-2xl rounded-xl bg-white">
                        <DatePicker
                          selectedDate={newTaskDueDate}
                          reminder={newTaskReminder}
                          repeat_rule={newTaskRepeat}
                          onCancel={() => setShowDatePicker(false)}
                          onSelect={(timestamp, reminder, repeat_rule) => {
                            setNewTaskDueDate(timestamp);
                            setNewTaskReminder(reminder);
                            setNewTaskRepeat(repeat_rule || null);
                            setShowDatePicker(false);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 更多按钮 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-4.5 h-4.5" />
                    </button>

                    {/* 更多菜单浮层 */}
                    {showMoreMenu && (
                      <div ref={moreMenuRef} className="absolute top-full right-0 mt-2 w-52 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-[200] animate-in fade-in zoom-in-95 duration-100">
                        {/* 优先级选择 - 顶部行 */}
                        <div className="px-3 pb-2 mb-1 border-b border-gray-50">
                          <div className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">优先级</div>
                          <div className="flex justify-between items-center bg-gray-50 p-1 rounded-lg">
                            {[3, 2, 1, 0].map((p) => {
                              const isSelected = newTaskPriority === (p === 0 ? undefined : p);
                              const priorityColors = {
                                3: 'text-red-500',
                                2: 'text-orange-500',
                                1: 'text-blue-500',
                                0: 'text-gray-400'
                              };
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    setNewTaskPriority(p === 0 ? undefined : p);
                                    setShowMoreMenu(false);
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                  }}
                                  className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${isSelected ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-gray-100'}`}
                                  title={p === 0 ? '无优先级' : getPriorityLabel(p) + '优先级'}
                                >
                                  <Flag className={`w-4 h-4 ${priorityColors[p as keyof typeof priorityColors]}`} fill={isSelected || p === 0 ? 'none' : 'currentColor'} />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 功能列表 */}
                        <div className="space-y-0.5 px-1 relative">
                          {/* 切换清单 */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowListMenu(!showListMenu);
                                setShowTagMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors group ${showListMenu ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <Inbox className={`w-4 h-4 ${showListMenu ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                <span className={`text-[13px] ${showListMenu ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                                  {lists?.find(l => l.id === (selectedListId || 'inbox'))?.name || '收集箱'}
                                </span>
                              </div>
                              <ChevronRight className={`w-3.5 h-3.5 ${showListMenu ? 'text-blue-400' : 'text-gray-300'}`} />
                            </button>

                            {showListMenu && (
                              <div ref={listMenuRef} className="absolute right-full top-0 mr-1 w-48 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-[60] animate-in fade-in slide-in-from-right-2 duration-150">
                                <div className="px-3 pb-1 mb-1 border-b border-gray-50">
                                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">移动至清单</div>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                  {lists?.map(list => (
                                    <button
                                      key={list.id}
                                      type="button"
                                      onClick={() => {
                                        // 这里实际应该是设置新任务的 list_id，但当前创建任务逻辑是跟随当前视图
                                        // 为了演示，我们先只关闭菜单，后续可以根据需求增强 createTaskExtended
                                        setShowListMenu(false);
                                        setShowMoreMenu(false);
                                        setTimeout(() => inputRef.current?.focus(), 0);
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
                                    >
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: list.color || 'var(--dida-primary)' }} />
                                      <span className="text-[13px] text-gray-600 truncate">{list.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 标签选择 */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowTagMenu(!showTagMenu);
                                setShowListMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors group ${showTagMenu ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <Hash className={`w-4 h-4 ${showTagMenu ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                                <span className={`text-[13px] ${showTagMenu ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>标签</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {newTaskTags.length > 0 && (
                                  <span className="text-[11px] bg-blue-100 text-blue-600 px-1.5 rounded-full">{newTaskTags.length}</span>
                                )}
                                <ChevronRight className={`w-3.5 h-3.5 ${showTagMenu ? 'text-blue-400' : 'text-gray-300'}`} />
                              </div>
                            </button>

                            {showTagMenu && (
                              <div ref={tagMenuRef} className="absolute right-full top-0 mr-1 w-48 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-[60] animate-in fade-in slide-in-from-right-2 duration-150">
                                <div className="px-3 pb-1 mb-1 border-b border-gray-50">
                                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">选择标签</div>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                  {allTags?.map(tag => {
                                    const isSelected = newTaskTags.includes(tag.id);
                                    return (
                                      <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 transition-colors group"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#CBD5E0' }} />
                                          <span className={`text-[13px] ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{tag.name}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                                      </button>
                                    );
                                  })}
                                  {(!allTags || allTags.length === 0) && (
                                    <div className="px-3 py-4 text-center text-xs text-gray-400 italic">暂无标签</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-md transition-colors group"
                          >
                            <Paperclip className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-[13px] text-gray-600">附件</span>
                          </button>

                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-md transition-colors group"
                          >
                            <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-[13px] text-gray-600">从模板添加</span>
                          </button>

                          <div className="h-[1px] bg-gray-50 my-1 mx-2" />

                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-md transition-colors group"
                          >
                            <Settings className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-[13px] text-gray-600">输入框设置</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 属性展示 Chips */}
              {hasAttributes && (
                <div className="flex flex-wrap gap-2 px-10 pb-1">
                  {/* 优先级 Chip */}
                  {newTaskPriority !== undefined && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100/50 hover:bg-gray-100 cursor-default ${getPriorityTextClass(newTaskPriority as Priority)}`}>
                      <Flag className="w-3 h-3" fill="currentColor" />
                      {getPriorityLabel(newTaskPriority as Priority)}
                      <button
                        type="button"
                        onClick={() => {
                          setNewTaskPriority(undefined);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="ml-1 hover:text-gray-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {/* 标签 Chips */}
                  {newTaskTags.map(tagId => {
                    const tag = allTags?.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span key={tagId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-[var(--dida-primary)] hover:bg-blue-100 cursor-default">
                        <Hash className="w-3 h-3" />
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => {
                            toggleTag(tagId);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                          className="ml-1 hover:text-blue-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto w-full relative z-10">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <div className="pb-10">
            {taskGroups.map(({ name, tasks }) => tasks.length > 0 && (
              <div key={name} className={['任务', '无日期', '更远'].includes(name) ? '' : 'mb-6'}>
                {!['任务', '无日期', '更远'].includes(name) && (
                  <div className="px-4 py-2 text-[13px] font-bold text-gray-900 flex items-center gap-2">
                    <span>{name}</span>
                    <span className="font-normal text-[11px] text-gray-400">({tasks.length})</span>
                  </div>
                )}
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {tasks.map(renderTask)}
                </SortableContext>
              </div>
            ))}
          </div>
        </DndContext>

        {localTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <div className="text-5xl mb-4">{isTrashView ? '🗑️' : '✨'}</div>
            <div className="text-[13px] font-medium">{isTrashView ? '垃圾桶是空的' : '今天没有任务，享受生活吧'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
