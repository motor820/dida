import { Task, RepeatRule, Priority } from '../types';
import { offline, defaultLists } from '../sync/store';
import { uid } from '../sync/model';
import { completionChanges } from './recurrence';

function base(title:string,listId:string):Task {const now=Math.floor(Date.now()/1000);return {id:uid(),title,description:'',list_id:listId,completed:false,priority:Priority.None,due_date:null,reminder:null,repeat_rule:null,tags:[],parent_id:null,order:0,is_deleted:false,created_at:now,updated_at:now,completed_at:null};}
function descendants(tasks:Task[],id:string):Task[]{const result:Task[]=[];const queue=[id],visited=new Set<string>([id]);while(queue.length){const parent=queue.shift();for(const task of tasks){if(task.parent_id===parent&&!visited.has(task.id)){visited.add(task.id);result.push(task);queue.push(task.id);}}}return result;}
export const taskService = {
  async getTasks(listId?:string):Promise<Task[]>{
    await offline.initialize();
    const lists=new Set([...defaultLists.map(l=>l.id),...offline.values<{id:string}>('list').map(l=>l.id)]);
    const tags=new Set(offline.values<{id:string}>('tag').map(t=>t.id));
    let tasks=offline.values<Task>('task').filter(t=>typeof t.title==='string'&&typeof t.list_id==='string'&&lists.has(t.list_id));
    const allIds=new Set(tasks.map(t=>t.id));tasks=tasks.filter(t=>!t.parent_id||allIds.has(t.parent_id));
    tasks=tasks.map(t=>({...t,tags:(t.tags||[]).filter(id=>tags.has(id))}));
    if(listId==='smart_trash')return tasks.filter(t=>t.is_deleted).sort((a,b)=>b.updated_at-a.updated_at);
    tasks=tasks.filter(t=>!t.is_deleted);
    if(listId==='smart_completed')return tasks.filter(t=>t.completed).sort((a,b)=>(b.completed_at||0)-(a.completed_at||0));
    if(listId==='smart_today'||listId==='smart_week'){
      const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+(listId==='smart_week'?7:0));end.setHours(23,59,59,999);
      tasks=tasks.filter(t=>(!t.completed&&t.due_date!==null&&t.due_date<=end.getTime()/1000)||(t.completed&&(t.completed_at||0)>=start.getTime()/1000&&(t.completed_at||0)<=end.getTime()/1000));
    }else if(listId&&listId!=='smart_all')tasks=tasks.filter(t=>t.list_id===listId);
    return tasks.sort((a,b)=>a.order-b.order||a.created_at-b.created_at);
  },
  async getTask(id:string):Promise<Task>{await offline.initialize();const t=offline.values<Task>('task').find(t=>t.id===id);if(!t)throw new Error('任务不存在或已永久删除');return t;},
  async getTasksByTag(id:string):Promise<Task[]>{return (await this.getTasks()).filter(t=>t.tags.includes(id));},
  async getSubtasks(id:string):Promise<Task[]>{return (await this.getTasks()).filter(t=>t.parent_id===id);},
  async createTask(task:Task):Promise<Task>{await offline.put('task',{...task});return this.getTask(task.id);},
  async createTaskSimple(title:string,listId:string):Promise<Task>{return this.createTask(base(title,listId));},
  async createTaskExtended(title:string,listId:string,dueDate?:number,reminder?:string,repeat_rule?:RepeatRule,priority?:number,tags?:string[],description?:string):Promise<Task>{return this.createTask({...base(title,listId),due_date:dueDate??null,reminder:reminder??null,repeat_rule:repeat_rule??null,priority:priority??Priority.None,tags:tags??[],description:description??''});},
  async createSubtaskSimple(title:string,parentId:string,listId:string):Promise<Task>{const parent=await this.getTask(parentId);return this.createTask({...base(title,listId),parent_id:parentId,due_date:parent.due_date});},
  async createTaskAfter(id: string, title: string): Promise<Task> {
    const anchor = await this.getTask(id);
    const siblings = (await this.getTasks()).filter(t => t.parent_id === anchor.parent_id);
    const next = { ...base('', anchor.list_id), parent_id: anchor.parent_id, due_date: anchor.due_date, tags: [...anchor.tags] };
    const index = siblings.findIndex(t => t.id === id);
    siblings.splice(index + 1, 0, next);
    await offline.batch([
      { kind: 'task', id, value: { title, updated_at: Math.floor(Date.now() / 1000) } },
      { kind: 'task', id: next.id, value: { ...next } },
      ...siblings.map((t, order) => ({ kind: 'task' as const, id: t.id, value: { order: order * 10 } })),
    ]);
    return this.getTask(next.id);
  },
  async convertDescriptionToSubtasks(id: string, description: string, checklistText?: string, detailDescription?: string): Promise<void> {
    const parent = await this.getTask(id);
    const lines = description.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length && checklistText === undefined && detailDescription === undefined) return;
    const siblings = await this.getSubtasks(id);
    const updates: { kind: 'task'; id: string; value: { [key: string]: unknown } }[] = [];
    let children = siblings;
    if (checklistText !== undefined) {
      const titles = checklistText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      // Match unchanged lines first so reordering preserves completion, dates and descendants.
      const available = new Set(siblings.map(child => child.id));
      const matches = titles.map(title => {
        const match = siblings.find(child => available.has(child.id) && child.title === title);
        if (match) available.delete(match.id);
        return match;
      });
      children = titles.map((title, index) => {
        const existing = matches[index] ?? siblings.find(child => available.has(child.id));
        if (existing) available.delete(existing.id);
        const child = existing ?? { ...base(title, parent.list_id), parent_id: id };
        updates.push({ kind: 'task', id: child.id, value: existing
          ? { title, order: index * 10, updated_at: Math.floor(Date.now() / 1000) }
          : { ...child, order: index * 10 } });
        return { ...child, title, order: index * 10 };
      });
      const allTasks = offline.values<Task>('task');
      for (const child of siblings.filter(child => available.has(child.id))) {
        for (const removed of [child, ...descendants(allTasks, child.id)]) {
          updates.push({ kind: 'task', id: removed.id, value: { is_deleted: true, updated_at: Math.floor(Date.now() / 1000) } });
        }
      }
    }
    const start = Math.max(-10, ...children.map(t => t.order)) + 10;
    for (const [index, title] of lines.entries()) {
      const child = { ...base(title, parent.list_id), parent_id: id, order: start + index * 10 };
      updates.push({ kind: 'task', id: child.id, value: { ...child } });
    }
    if (lines.length || detailDescription !== undefined) updates.push({ kind: 'task', id, value: { description: lines.length ? '' : detailDescription, updated_at: Math.floor(Date.now() / 1000) } });
    if (updates.length) await offline.batch(updates);
  },
  async updateTask(task:Task):Promise<Task>{await offline.put('task',{...task,updated_at:Math.floor(Date.now()/1000)});return this.getTask(task.id);},
  async updateTaskOrders(orders:[string,number][]):Promise<void>{await offline.batch(orders.map(([id,order])=>({kind:'task',id,value:{order,updated_at:Math.floor(Date.now()/1000)}})));},
  async deleteTask(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{is_deleted:true,updated_at:Math.floor(Date.now()/1000)}})));},
  async undoDeleteTask(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{is_deleted:false,updated_at:Math.floor(Date.now()/1000)}})));},
  async deleteTaskPermanently(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{__deleted:true}})));},
  async emptyTrash():Promise<void>{await offline.batch(offline.values<Task>('task').filter(t=>t.is_deleted).map(t=>({kind:'task',id:t.id,value:{__deleted:true}})));},
  async toggleTask(id: string): Promise<Task> {
    const task = await this.getTask(id);
    const changes = await completionChanges(task, offline.values<Task>('task'), Math.floor(Date.now() / 1000), new Set(offline.recordIds('task')));
    await offline.batch(changes);
    return this.getTask(id);
  }
};
