import { useEffect } from 'react';
import TaskList from '../Task/TaskList';
import TaskDetail from '../Task/TaskDetail';
import { useAppStore } from '../../store/useAppStore';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import ResponsivePanel from './ResponsivePanel';

export default function TaskWorkspace() {
  const { drawerDetails } = useResponsiveLayout();
  const { detailDrawerOpen, setDetailDrawerOpen } = useAppStore();
  // Entering the narrow layout starts with the task list; selecting a row opens details.
  useEffect(() => { setDetailDrawerOpen(false); }, [drawerDetails, setDetailDrawerOpen]);

  return <div className={`dida-task-workspace ${drawerDetails ? 'is-narrow' : ''}`}>
    <section aria-label="任务列表" className="dida-task-column" inert={drawerDetails && detailDrawerOpen}>
      <TaskList />
    </section>
    <ResponsivePanel drawer={drawerDetails} open={detailDrawerOpen} label="任务详情" className="dida-detail-column"
      onClose={() => setDetailDrawerOpen(false)}>
      <TaskDetail />
    </ResponsivePanel>
  </div>;
}
