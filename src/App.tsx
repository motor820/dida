import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/Layout/MainLayout';
import TaskWorkspace from './components/Layout/TaskWorkspace';
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
        <TaskWorkspace />
      </MainLayout>
      <Toast />
      <AlertDialog />
      <ReminderManager />
      </SyncGate>
    </QueryClientProvider>
  );
}

export default App;
