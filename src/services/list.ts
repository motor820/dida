import { List } from '../types';
import { offline, defaultLists } from '../sync/store';
export const listService = {
  async getLists(): Promise<List[]> { await offline.initialize(); return [...defaultLists, ...offline.values<List>('list').filter(l => typeof l.name === 'string' && !l.is_smart)].sort((a,b) => a.order-b.order || a.created_at-b.created_at); },
  async getList(id: string): Promise<List> { const l=(await this.getLists()).find(l=>l.id===id); if(!l) throw new Error('清单不存在'); return l; },
  async createList(list: List): Promise<List> { await offline.put('list',{...list,is_smart:false}); return this.getList(list.id); },
  async updateList(list: List): Promise<List> { if(list.is_smart) return list; await offline.put('list',{...list}); return this.getList(list.id); },
  async deleteList(id: string): Promise<void> {
    if(defaultLists.some(l=>l.id===id)) return;
    const tasks=offline.values<{id:string;list_id:string}>('task').filter(t=>t.list_id===id);
    await offline.batch([{kind:'list',id,value:{__deleted:true}},...tasks.map(t=>({kind:'task' as const,id:t.id,value:{__deleted:true}}))]);
  }
};
