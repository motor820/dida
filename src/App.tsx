import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/Layout/MainLayout';
import TaskList from './components/Task/TaskList';
import TaskDetail from './components/Task/TaskDetail';
import Toast from './components/Common/Toast';
import AlertDialog from './components/Common/AlertDialog';
import ReminderManager from './components/Task/ReminderManager';
import { useAlertStore } from './store/useAlertStore';
import SyncGate from './components/Sync/SyncGate';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error: Error) => useAlertStore.getState().showAlert({ title: '保存失败', message: error.message, type: 'error' }),
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncGate>
      <MainLayout>
        <div className="flex h-full">
          <div className="flex-1">
            <TaskList />
          </div>
          <TaskDetail />
        </div>
      </MainLayout>
      <Toast />
      <AlertDialog />
      <ReminderManager />
      </SyncGate>
    </QueryClientProvider>
  );
}

export default App;
