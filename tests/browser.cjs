const {chromium}=require('playwright-core');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const suffix=Date.now().toString(36);
const taskTitle='跨端同步验收-'+suffix, offlineTitle='离线编辑保存-'+suffix, listTitle='同步清单验收-'+suffix, tagTitle='同步标签验收-'+suffix;
const base=process.env.DIDA_TEST_URL||'http://127.0.0.1:1431';
const password=fs.readFileSync(process.env.DIDA_TEST_PASSWORD_FILE,'utf8').trim();
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 try{
  const a=await browser.newContext(),b=await browser.newContext();
  const p=await a.newPage(),q=await b.newPage();
  for(const page of [p,q]){
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'networkidle'});
   assert.equal(await page.getByRole('button',{name:'登录',exact:true}).count(),1);
   await page.getByLabel('账号',{exact:true}).fill('motor');
   await page.getByLabel('密码',{exact:true}).fill(password);
   await page.getByRole('button',{name:'登录',exact:true}).click();
   await page.getByPlaceholder('添加任务',{exact:true}).waitFor();
  }
  console.log('PASS two browser sessions authenticate with one password');
  await p.getByPlaceholder('添加任务',{exact:true}).fill(taskTitle);await p.getByPlaceholder('添加任务',{exact:true}).press('Enter');
  await p.getByText(taskTitle,{exact:true}).waitFor();
  await p.waitForTimeout(1600);await q.getByRole('button',{name:'立即同步',exact:true}).click();
  await q.getByText(taskTitle,{exact:true}).waitFor();console.log('PASS create on A appears on B');
  await p.route('**/api/v1/**',route=>route.abort());
  await p.getByPlaceholder('添加任务',{exact:true}).fill(offlineTitle);await p.getByPlaceholder('添加任务',{exact:true}).press('Enter');
  await p.getByText(offlineTitle,{exact:true}).waitFor();
  await p.waitForTimeout(1400);assert.match(await p.locator('body').innerText(),/本机已保存/);console.log('PASS offline write remains usable and durably queued');
  const row=q.getByText(taskTitle,{exact:true}).locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await row.locator('.dida-checkbox').click();
  await q.waitForTimeout(1600);
  await p.unroute('**/api/v1/**');await p.getByRole('button',{name:'立即同步',exact:true}).click();
  await p.waitForTimeout(1000);await q.getByRole('button',{name:'立即同步',exact:true}).click();
  await q.getByText(offlineTitle,{exact:true}).waitFor();
  await p.reload({waitUntil:'networkidle'});await p.getByText(offlineTitle,{exact:true}).waitFor();
  assert.equal(await p.getByText(taskTitle,{exact:true}).locator('xpath=ancestor::div[contains(@class,"group")][1]').locator('.dida-checkbox.completed').count(),1);console.log('PASS reconnect, merge and reload preserve offline tasks and completion');
  await p.getByTitle('新建清单',{exact:true}).click();await p.getByPlaceholder('清单名称',{exact:true}).fill(listTitle);await p.getByPlaceholder('清单名称',{exact:true}).press('Enter');await p.getByText(listTitle,{exact:true}).waitFor();
  await p.getByTitle('新建标签',{exact:true}).click();await p.getByPlaceholder('名称',{exact:true}).fill(tagTitle);await p.getByRole('button',{name:'保存',exact:true}).click();await p.getByText(tagTitle,{exact:true}).waitFor();
  await p.waitForTimeout(1600);await q.getByRole('button',{name:'立即同步',exact:true}).click();await q.getByText(listTitle,{exact:true}).waitFor();await q.getByText(tagTitle,{exact:true}).waitFor();console.log('PASS lists and tags synchronize');
  await p.getByRole('button',{name:'账号与同步',exact:true}).click();
  p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'退出登录并清除本机缓存',exact:true}).click();
  await p.getByRole('button',{name:'登录',exact:true}).waitFor();
  assert.equal(await p.evaluate(async()=> (await fetch('/api/v1/sync/pull')).status),401);
  assert.equal(await p.getByText(offlineTitle,{exact:true}).count(),0);
  await q.evaluate(async()=>{await fetch('/api/v1/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})});
  assert.deepEqual(errors,[]);console.log('PASS logout removes cached view; anonymous API denied; no browser runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
