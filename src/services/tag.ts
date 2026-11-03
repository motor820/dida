import { Tag } from '../types';
import { offline } from '../sync/store';
import { uid } from '../sync/model';
export const tagService = {
  async getTags(): Promise<Tag[]> { await offline.initialize(); const tags=offline.values<Tag>('tag').filter(t=>typeof t.name==='string');const ids=new Set(tags.map(t=>t.id));return tags.map(t=>t.parent_id&&!ids.has(t.parent_id)?{...t,parent_id:null}:t).sort((a,b)=>a.name.localeCompare(b.name)); },
  async createTag(name:string,color:string,parentId?:string|null):Promise<Tag>{const tag:Tag={id:uid(),name,color,parent_id:parentId??null,is_pinned:false,created_at:Math.floor(Date.now()/1000)};await offline.put('tag',{...tag});return tag;},
  async updateTag(tag:Tag):Promise<Tag>{await offline.put('tag',{...tag});return tag;},
  async deleteTag(id:string):Promise<void>{await offline.batch([{kind:'tag',id,value:{__deleted:true}}]);}
};
