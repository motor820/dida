"""Isolated browser checks for task date context menus and repeat settings (local Vite only)."""
import os
import re
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

url = os.environ.get('DIDA_UI_TEST_URL', 'http://127.0.0.1:1431/')
assert urlparse(url).hostname in ('localhost', '127.0.0.1')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('DIDA_CHROME', '/usr/bin/google-chrome'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def api(route):
        if '/auth/session' in route.request.url:
            route.fulfill(json={'username': 'date-test', 'epoch': 'date-test', 'time': int(time.time()*1000)})
        elif '/sync/pull' in route.request.url:
            route.fulfill(json={'records': [], 'cursor': 0, 'until': 0, 'has_more': False, 'time': int(time.time()*1000)})
        else:
            route.abort()
    page.route('**/api/**', api)
    page.goto(url)
    expect(page.get_by_placeholder('添加任务', exact=True)).to_be_visible()
    page.wait_for_function("async () => !(await import('/src/sync/store.ts')).offline.getStatus().syncing")
    task_id = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        const task=await s.createTaskSimple('右键日期与重复验收','smart_inbox');
        await s.createSubtaskSimple('每期都需要的检查项',task.id,task.list_id);
        return task.id;
    }""")
    row = page.locator(f'[data-task-row="{task_id}"]')
    row.click(button='right')
    menu = page.locator('[aria-label="任务操作"]')
    for label in ['今天', '明天', '下周', '自定义']:
        button = menu.get_by_role('button', name=label, exact=True)
        button.hover()
        expect(page.get_by_role('tooltip', name=label, exact=True)).to_be_visible(timeout=300)
    expect(menu.get_by_role('button', name='下月', exact=True)).to_have_count(0)
    menu.get_by_role('button', name='自定义', exact=True).click()
    picker = page.get_by_role('dialog', name='日期设置', exact=True)
    expect(picker).to_be_visible()
    # Changes are a draft until the final confirm.
    picker.locator('button[data-date]').filter(has_text='20').first.click()
    picker.get_by_role('button', name='取消', exact=True).click()
    assert page.evaluate("""async id => (await (await import('/src/services/task.ts')).taskService.getTask(id)).due_date""", task_id) is None
    row.click(button='right')
    menu.get_by_role('button', name='自定义', exact=True).click()
    picker.locator('button[data-date]').filter(has_text='20').first.click()
    picker.get_by_role('button', name=re.compile(r'^时间')).click()
    picker.get_by_label('具体时间', exact=True).fill('09:30')
    picker.get_by_role('button', name=re.compile(r'^提醒')).click()
    picker.get_by_role('button', name='提前 5 分钟', exact=True).click()
    picker.get_by_role('button', name=re.compile(r'^重复')).click()
    picker.get_by_role('button', name='自定义重复', exact=True).click()
    picker.get_by_label('重复频率', exact=True).select_option('weekly')
    picker.get_by_label('重复间隔', exact=True).fill('0')
    picker.get_by_role('button', name='应用重复规则', exact=True).click()
    expect(picker.get_by_role('alert')).to_contain_text('1 至 999')
    picker.get_by_label('重复间隔', exact=True).fill('2')
    for day in '日一二三四五六':
        button = picker.get_by_role('button', name=f'星期{day}', exact=True)
        target = day in '一三'
        if (button.get_attribute('aria-pressed') == 'true') != target:
            button.click()
    picker.get_by_role('button', name='应用重复规则', exact=True).click()
    page.screenshot(path='/tmp/dida-date-repeat.png', full_page=True)
    picker.get_by_role('button', name='确定', exact=True).click()
    page.wait_for_function("""async id => (await (await import('/src/services/task.ts')).taskService.getTask(id)).repeat_rule?.frequency === 'weekly'""", arg=task_id)
    settings = page.evaluate("""async id => await (await import('/src/services/task.ts')).taskService.getTask(id)""", task_id)
    assert settings['repeat_rule']['interval'] == 2
    assert settings['repeat_rule']['daysOfWeek'] == [1, 3]
    assert settings['reminder'] == '5m_before'
    assert page.evaluate('(due) => new Date(due*1000).getHours()', settings['due_date']) == 9
    assert page.evaluate('(due) => new Date(due*1000).getMinutes()', settings['due_date']) == 30
    page.reload()
    row.click(button='right')
    menu.get_by_role('button', name='自定义', exact=True).click()
    expect(picker.get_by_role('button', name=re.compile(r'^重复'))).to_contain_text('每隔2周（一、三）')
    picker.get_by_role('button', name=re.compile(r'^重复')).click()
    picker.get_by_role('button', name='自定义重复', exact=True).click()
    expect(picker.get_by_label('重复频率', exact=True)).to_have_value('weekly')
    expect(picker.get_by_label('重复间隔', exact=True)).to_have_value('2')
    expect(picker.get_by_role('button', name='星期一', exact=True)).to_have_attribute('aria-pressed', 'true')
    picker.get_by_label('重复间隔', exact=True).fill('99')
    picker.get_by_role('button', name='取消重复修改', exact=True).click()
    picker.get_by_role('button', name=re.compile(r'^重复')).click()
    picker.get_by_role('button', name='自定义重复', exact=True).click()
    expect(picker.get_by_label('重复间隔', exact=True)).to_have_value('2')
    picker.get_by_role('button', name='取消重复修改', exact=True).click()
    picker.get_by_role('button', name='取消', exact=True).click()
    # Clicking completion generates exactly one next parent and its checklist.
    row.click()
    page.locator('.dida-detail-column .dida-checkbox').first.click()
    page.wait_for_function("""async () => (await (await import('/src/services/task.ts')).taskService.getTasks()).some(t=>t.id.startsWith('repeat_')&&!t.parent_id)""")
    result = page.evaluate("""async id => {
        const {taskService:s}=await import('/src/services/task.ts');
        const tasks=await s.getTasks();
        const next=tasks.filter(t=>t.id.startsWith('repeat_')&&!t.parent_id);
        return {original:await s.getTask(id),next,children:await s.getSubtasks(next[0].id)};
    }""", task_id)
    assert result['original']['completed'] is True
    assert len(result['next']) == 1 and len(result['children']) == 1
    assert result['next'][0]['completed'] is False and result['children'][0]['completed'] is False
    assert result['next'][0]['due_date'] > result['original']['due_date']
    # Reopen/completion retries must preserve the same next occurrence.
    next_id = result['next'][0]['id']
    retry = page.evaluate("""async args => {
        const {taskService:s}=await import('/src/services/task.ts');
        const next=await s.getTask(args.next);
        await s.updateTask({...next,title:'下一期已修改的名称'});
        await s.toggleTask(args.original); await s.toggleTask(args.original);
        return (await s.getTasks()).filter(t=>t.id.startsWith('repeat_')&&!t.parent_id);
    }""", {'next':next_id,'original':task_id})
    assert len(retry) == 1 and retry[0]['title'] == '下一期已修改的名称'
    # Clear removes date, reminder and repeat; expanding settings at the viewport edge remains accessible.
    page.set_viewport_size({'width': 700, 'height': 620})
    row.click(button='right', position={'x': 500, 'y': 20})
    menu.get_by_role('button', name='自定义', exact=True).click()
    box = picker.bounding_box()
    assert box['x'] >= 0 and box['x'] + box['width'] <= 700
    assert box['y'] >= 0 and box['y'] + box['height'] <= 620
    picker.get_by_role('button', name='清除', exact=True).click()
    page.wait_for_function("""async id => (await (await import('/src/services/task.ts')).taskService.getTask(id)).due_date === null""", arg=task_id)
    cleared = page.evaluate("""async id => await (await import('/src/services/task.ts')).taskService.getTask(id)""", task_id)
    assert cleared['repeat_rule'] is None and cleared['reminder'] == 'none'
    # Quarterly is a visible preset, persisted compatibly as every three calendar months.
    page.set_viewport_size({'width':1440,'height':1000})
    quarter_id = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        return (await s.createTaskExtended('季度重复验收','smart_inbox',Math.floor(new Date(2030,0,31,9).getTime()/1000),'none')).id;
    }""")
    quarter_row = page.locator(f'[data-task-row="{quarter_id}"]')
    quarter_row.click(button='right')
    menu.get_by_role('button',name='自定义',exact=True).click()
    picker.get_by_role('button',name=re.compile(r'^重复')).click()
    picker.get_by_role('button',name=re.compile(r'^每季度')).click()
    picker.get_by_role('button',name='确定',exact=True).click()
    page.wait_for_function("""async id => (await (await import('/src/services/task.ts')).taskService.getTask(id)).repeat_rule?.interval === 3""",arg=quarter_id)
    quarter_row.click()
    page.locator('.dida-detail-column .dida-checkbox').first.click()
    page.wait_for_function("""async () => (await (await import('/src/services/task.ts')).taskService.getTasks()).some(t=>t.title==='季度重复验收'&&t.id.startsWith('repeat_')&&!t.completed)""")
    quarterly = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        const first=(await s.getTasks()).find(t=>t.title==='季度重复验收'&&!t.completed);
        const due=new Date(first.due_date*1000);
        await s.toggleTask(first.id);
        const second=(await s.getTasks()).find(t=>t.title==='季度重复验收'&&!t.completed);
        const next=new Date(second.due_date*1000);
        return {first:[due.getFullYear(),due.getMonth()+1,due.getDate()],second:[next.getFullYear(),next.getMonth()+1,next.getDate()],type:second.repeat_rule.type,interval:second.repeat_rule.interval,id:second.id};
    }""")
    assert quarterly['first'] == [2030,4,30] and quarterly['second'] == [2030,7,31], quarterly
    assert quarterly['type'] == 'monthly' and quarterly['interval'] == 3, quarterly
    page.reload()
    page.locator(f'[data-task-row="{quarterly["id"]}"]').click(button='right')
    menu.get_by_role('button',name='自定义',exact=True).click()
    expect(picker.get_by_role('button',name=re.compile(r'^重复'))).to_contain_text('每季度')
    page.screenshot(path='/tmp/dida-quarterly-repeat.png',full_page=True)
    assert not errors, errors
    browser.close()
    print('PASS: immediate date tooltips, custom date/time/reminder/repeat, cancel, persistence, completion successor, no duplicate on retry, viewport edges and clear, quarterly preset/next dates/persistence')
