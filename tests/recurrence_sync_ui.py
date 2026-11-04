"""Two offline browser contexts against a real isolated Rust API; never uses production state."""
import json
import os
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

url = os.environ.get('DIDA_UI_TEST_URL', 'http://127.0.0.1:1431/')
assert urlparse(url).hostname in ('localhost', '127.0.0.1')
origin = url.rstrip('/')
root = Path(__file__).resolve().parents[1]
binary = Path(os.environ.get('DIDA_SERVER_BIN', str(root/'server/target/debug/dida-sync-server')))
with tempfile.TemporaryDirectory(prefix='dida-recurrence-sync-') as directory:
    directory = Path(directory)
    password = secrets.token_urlsafe(24)
    password_file = directory/'password'
    password_file.write_text(password)
    password_file.chmod(0o600)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    backend = f'http://127.0.0.1:{port}'
    environment = {**os.environ, 'DIDA_BIND':f'127.0.0.1:{port}', 'DIDA_DATA_DIR':str(directory/'data'),
        'DIDA_PASSWORD_FILE':str(password_file), 'DIDA_USERNAME':'test-user', 'DIDA_PUBLIC_URL':origin, 'DIDA_WEB_DIR':str(root/'dist')}
    process = subprocess.Popen([str(binary)], env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(backend+'/healthz', timeout=1).close()
                break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError(process.stderr.read().decode())
                time.sleep(.1)
        else:
            raise RuntimeError('Isolated API did not start')
        def session(name):
            data = json.dumps({'username':'test-user','password':password,'device_name':name}).encode()
            request = urllib.request.Request(backend+'/api/v1/auth/login', data=data, headers={'Origin':origin,'Content-Type':'application/json'})
            with urllib.request.urlopen(request) as response:
                return response.headers['Set-Cookie'].split(';',1)[0]
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('DIDA_CHROME', '/usr/bin/google-chrome'), headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
            pages = []
            flags = []
            errors = []
            for index in range(2):
                context = browser.new_context()
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                flag = {'online':True}
                cookie = session(f'isolated-browser-{index}')
                def route_api(route, request, flag=flag, cookie=cookie):
                    if not flag['online']:
                        route.abort()
                        return
                    parsed = urlparse(route.request.url)
                    target = backend+parsed.path+('?' + parsed.query if parsed.query else '')
                    headers = {**route.request.headers,'cookie':cookie,'origin':origin}
                    response = route.fetch(url=target,headers=headers)
                    route.fulfill(response=response)
                page.route('**/api/**', route_api)
                page.goto(url)
                expect(page.get_by_placeholder('添加任务', exact=True)).to_be_visible()
                page.wait_for_function("async () => !(await import('/src/sync/store.ts')).offline.getStatus().syncing")
                pages.append(page); flags.append(flag)
            def sync(page):
                page.wait_for_function("async () => !(await import('/src/sync/store.ts')).offline.getStatus().syncing")
                page.evaluate("async () => {const {offline}=await import('/src/sync/store.ts');await offline.sync();if(offline.getStatus().error)throw Error(offline.getStatus().error);}")
            original = pages[0].evaluate("""async () => {
                const {taskService:s}=await import('/src/services/task.ts');
                const due=Math.floor(Date.now()/1000)+86400;
                const task=await s.createTaskExtended('双浏览器重复任务','smart_inbox',due,'none',{type:'daily',timezone:'Asia/Shanghai'});
                await s.createSubtaskSimple('下一期保留的子任务',task.id,task.list_id);
                return task.id;
            }""")
            sync(pages[0]); sync(pages[1])
            for flag in flags:
                flag['online'] = False
            next_a = pages[0].evaluate("""async id => {
                const {taskService:s}=await import('/src/services/task.ts');await s.toggleTask(id);
                const next=(await s.getTasks()).find(t=>t.id.startsWith('repeat_')&&!t.parent_id);
                await s.updateTask({...next,title:'保留用户对下一期的修改',completed:true,completed_at:Math.floor(Date.now()/1000)});
                await s.deleteTask(next.id);
                return next.id;
            }""", original)
            next_b = pages[1].evaluate("""async id => {
                const {offline}=await import('/src/sync/store.ts');await offline.change(s=>{s.offset=60000;});
                const {taskService:s}=await import('/src/services/task.ts');await s.toggleTask(id);
                return (await s.getTasks()).find(t=>t.id.startsWith('repeat_')&&!t.parent_id).id;
            }""", original)
            assert next_a == next_b, 'Offline devices must generate the same occurrence ID'
            flags[0]['online'] = True
            sync(pages[0])
            flags[1]['online'] = True
            sync(pages[1]); sync(pages[0])
            for page in pages:
                value = page.evaluate("""async id => {
                    const {offline}=await import('/src/sync/store.ts');const tasks=offline.values('task');
                    return {next:tasks.find(t=>t.id===id),copies:tasks.filter(t=>t.id.startsWith('repeat_')&&!t.parent_id).length,pending:offline.getStatus().pending};
                }""", next_a)
                assert value['copies'] == 1 and value['pending'] == 0, value
                assert value['next']['title'] == '保留用户对下一期的修改' and value['next']['completed'] and value['next']['is_deleted'], value
            pages[0].evaluate("""async id => await (await import('/src/services/task.ts')).taskService.deleteTaskPermanently(id)""", next_a)
            sync(pages[0]); sync(pages[1])
            pages[1].evaluate("""async id => {const {taskService:s}=await import('/src/services/task.ts');await s.toggleTask(id);await s.toggleTask(id);}""", original)
            sync(pages[1]); sync(pages[0])
            pages[1].reload()
            expect(pages[1].get_by_placeholder('添加任务', exact=True)).to_be_visible()
            sync(pages[1])
            for page in pages:
                state = page.evaluate("""async id => {const {offline}=await import('/src/sync/store.ts');return {known:offline.recordIds('task').includes(id),tasks:offline.values('task'),pending:offline.getStatus().pending};}""", next_a)
                assert state['known'] and state['pending'] == 0, state
                assert len(state['tasks']) == 2, state
                assert not any(t['id'].startswith('repeat_') for t in state['tasks']), state
            assert not errors, errors
            browser.close()
            print('PASS: real isolated API, two offline browsers, shared successor IDs, edited/deleted successor protection, retries, permanent deletion and restart persistence')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()
