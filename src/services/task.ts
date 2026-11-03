import { Task, RepeatRule, Priority } from '../types';
import { offline, defaultLists } from '../sync/store';
import { uid } from '../sync/model';

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
  async updateTask(task:Task):Promise<Task>{await offline.put('task',{...task,updated_at:Math.floor(Date.now()/1000)});return this.getTask(task.id);},
  async updateTaskOrders(orders:[string,number][]):Promise<void>{await offline.batch(orders.map(([id,order])=>({kind:'task',id,value:{order,updated_at:Math.floor(Date.now()/1000)}})));},
  async deleteTask(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{is_deleted:true,updated_at:Math.floor(Date.now()/1000)}})));},
  async undoDeleteTask(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{is_deleted:false,updated_at:Math.floor(Date.now()/1000)}})));},
  async deleteTaskPermanently(id:string):Promise<void>{const t=await this.getTask(id);const tasks=offline.values<Task>('task');await offline.batch([t,...descendants(tasks,id)].map(task=>({kind:'task',id:task.id,value:{__deleted:true}})));},
  async emptyTrash():Promise<void>{await offline.batch(offline.values<Task>('task').filter(t=>t.is_deleted).map(t=>({kind:'task',id:t.id,value:{__deleted:true}})));},
  async toggleTask(id:string):Promise<Task>{const t=await this.getTask(id);const completed=!t.completed,now=Math.floor(Date.now()/1000);const targets=completed?[t,...descendants(offline.values<Task>('task'),id).filter(t=>!t.completed)]:[t];await offline.batch(targets.map(task=>({kind:'task',id:task.id,value:{completed,completed_at:completed?now:null,updated_at:now}})));return this.getTask(id);}
};
