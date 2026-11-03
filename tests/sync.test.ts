import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecord, changedFields, decodeRecord, applyOperation, observeClock, stamp, validateImport } from '../src/sync/model.ts';
import type { SyncRecord, LocalState } from '../src/sync/model.ts';
const record = (title: string, time: string): SyncRecord => ({kind:'task',id:'test',fields:{title:{value:title,stamp:time},description:{value:'old',stamp:'001'}}});
test('late delivery of old offline edits cannot replace newer text',()=>{assert.equal(mergeRecord(record('new','003'),record('old','002')).fields.title.value,'new');});
test('independent fields merge without reverting newer server fields',()=>{const original=record('old','001');const ui=decodeRecord<{id:string;title:string;description:string}>(original);const server=record('new','003');const edits={...ui,description:'edited offline'};assert.deepEqual(changedFields(edits,server),{description:'edited offline'});});
test('a permanent tombstone cannot be revived by later input',()=>{const r=record('x','001');r.fields.__deleted={value:true,stamp:'002'};assert.equal(mergeRecord(r,{kind:'task',id:'test',fields:{__deleted:{value:false,stamp:'003'}}}).fields.__deleted.value,true);});
test('duplicate application is stable and keeps record identity',()=>{const state={records:{}} as LocalState;const op={op_id:'op',kind:'task' as const,id:'test',patch:{title:'text'},stamp:'001'};applyOperation(state,op);const once=JSON.stringify(state);applyOperation(state,op);assert.equal(JSON.stringify(state),once);});
test('untrusted prototype keys are rejected',()=>{const incoming=JSON.parse('{"kind":"task","id":"test","fields":{"__proto__":{"value":{},"stamp":"001"}}}');assert.throws(()=>mergeRecord(undefined,incoming));});

test('observed remote logical counter is preserved before a new local edit',()=>{const state={lastTime:Date.now()+10000,counter:0,offset:0,device:'local'} as LocalState;const remote=`${state.lastTime}-000099-remote`;observeClock(state,remote);assert.ok(stamp(state)>remote);});
test('import rejects unexpected fields before they enter the durable outbox',()=>{assert.throws(()=>validateImport('tag',{id:'tag',name:'name',color:'#fff',created_at:1,malicious:1}));});

test('edit baseline survives query cache object copying',()=>{const old=record('old','001');const ui=JSON.parse(JSON.stringify(decodeRecord(old)));const fresh=record('new from another device','003');assert.deepEqual(changedFields({...ui,description:'my edit'},fresh),{description:'my edit'});});
