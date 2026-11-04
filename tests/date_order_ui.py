"""Local-only browser regression for consistent date shortcuts and immediate list reordering."""
import os
import re
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

url = os.environ.get('DIDA_UI_TEST_URL', 'http://127.0.0.1:1431/')
assert urlparse(url).hostname in ('localhost', '127.0.0.1')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('DIDA_CHROME', '/usr/bin/google-chrome'), headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def api(route):
        if '/auth/session' in route.request.url:
            route.fulfill(json={'username':'date-order-test','epoch':'date-order-test','time':int(time.time()*1000)})
        elif '/sync/pull' in route.request.url:
            route.fulfill(json={'records':[],'cursor':0,'until':0,'has_more':False,'time':int(time.time()*1000)})
        else:
            route.abort()
    page.route('**/api/**',api)
    page.goto(url)
    expect(page.get_by_placeholder('添加任务',exact=True)).to_be_visible()
    page.wait_for_function("async () => !(await import('/src/sync/store.ts')).offline.getStatus().syncing")
    ids = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        const at=(days,hour)=>{const date=new Date();date.setDate(date.getDate()+days);date.setHours(hour,0,0,0);return Math.floor(date.getTime()/1000);};
        const ids={};
        for(const [key,due,order] of [['far',at(7,15),0],['later',at(2,14),10],['near',at(2,9),100],['none',null,5],['overdue',at(-2,9),200]]) {
            const task=await s.createTaskSimple(key,'smart_inbox');
            await s.updateTask({...task,due_date:due,order});ids[key]=task.id;
        }
        const childFar=await s.createSubtaskSimple('子任务手动排在前',ids.near,'smart_inbox');
        const childNear=await s.createSubtaskSimple('子任务手动排在后',ids.near,'smart_inbox');
        await s.updateTask({...childFar,due_date:at(9,9),order:0});
        await s.updateTask({...childNear,due_date:at(1,9),order:10});
        return ids;
    }""")
    def expect_order(keys):
        expected = [ids[key] for key in keys]
        page.wait_for_function("""ids => JSON.stringify([...document.querySelectorAll('[data-task-row]')].map(e=>e.dataset.taskRow))===JSON.stringify(ids)""",arg=expected)
    expect_order(['none','overdue','near','later','far'])
    expect(page.get_by_text('无日期',exact=True)).to_have_count(0)
    expect(page.get_by_text('更远',exact=True)).to_have_count(0)
    far = page.locator(f'[data-task-row="{ids["far"]}"]')
    far.click(button='right')
    context = page.locator('[aria-label="任务操作"]')
    context_group = context.get_by_role('group',name='日期快捷选项',exact=True)
    def shortcuts(group):
        return group.get_by_role('button').evaluate_all("els=>els.map(e=>({label:e.getAttribute('aria-label'),icon:e.querySelector('svg').getAttribute('class')}))")
    context_buttons = shortcuts(context_group)
    assert [button['label'] for button in context_buttons] == ['今天','明天','下周','自定义']
    assert len(set(button['icon'] for button in context_buttons)) == 4
    context.get_by_role('button',name='自定义',exact=True).click()
    picker = page.get_by_role('dialog',name='日期设置',exact=True)
    assert shortcuts(picker.get_by_role('group',name='日期快捷选项',exact=True)) == context_buttons
    picker.get_by_role('button',name='取消',exact=True).click()
    far.click()
    page.get_by_role('button',name='设置任务日期',exact=True).click()
    assert shortcuts(picker.get_by_role('group',name='日期快捷选项',exact=True)) == context_buttons
    # Custom focuses the current selected calendar day rather than being a dead shortcut.
    picker.get_by_role('button',name='自定义',exact=True).click()
    selected = picker.get_by_role('group',name='选择日期',exact=True).locator('[aria-pressed="true"]')
    expect(selected).to_be_focused()
    for label in ['今天','明天','下周','自定义']:
        picker.get_by_role('group',name='日期快捷选项',exact=True).get_by_role('button',name=label,exact=True).hover()
        expect(page.get_by_role('tooltip',name=label,exact=True)).to_be_visible(timeout=300)
    picker.get_by_role('button',name='明天',exact=True).click()
    picker.get_by_role('button',name='确定',exact=True).click()
    expect_order(['none','overdue','far','near','later'])
    # A second date change in the same future group must also reorder, including the time.
    page.locator(f'[data-task-row="{ids["near"]}"]').click()
    page.get_by_role('button',name='设置任务日期',exact=True).click()
    picker.get_by_role('button',name='明天',exact=True).click()
    picker.get_by_role('button',name=re.compile(r'^时间')).click()
    picker.get_by_label('具体时间',exact=True).fill('08:00')
    picker.get_by_role('button',name='确定',exact=True).click()
    expect_order(['none','overdue','near','far','later'])
    page.get_by_role('button',name='设置任务日期',exact=True).click()
    picker.get_by_role('button',name='下周',exact=True).click()
    picker.get_by_role('button',name='确定',exact=True).click()
    expect_order(['none','overdue','far','later','near'])
    page.get_by_role('button',name='设置任务日期',exact=True).click()
    picker.get_by_role('button',name='明天',exact=True).click()
    picker.get_by_role('button',name='确定',exact=True).click()
    expect_order(['none','overdue','near','far','later'])
    assert [e.get_attribute('aria-label') for e in page.get_by_role('checkbox').all()] == ['子任务手动排在前','子任务手动排在后']
    # Clearing through the second-column context menu moves the task into undated tasks.
    far.click(button='right')
    context.get_by_role('button',name='自定义',exact=True).click()
    picker.get_by_role('button',name='清除',exact=True).click()
    expect_order(['far','none','overdue','near','later'])
    page.reload()
    expect_order(['far','none','overdue','near','later'])
    # Normal lists use the same date ordering; completed tasks keep their own section.
    page.get_by_role('button',name='收集箱',exact=True).click()
    expect_order(['far','none','overdue','near','later'])
    page.evaluate("""async id => await (await import('/src/services/task.ts')).taskService.toggleTask(id)""",ids['near'])
    expect_order(['far','none','overdue','later','near'])
    page.screenshot(path='/tmp/dida-date-order.png',full_page=True)
    assert not errors, errors
    browser.close()
    print('PASS: four shared shortcuts with distinct icons, immediate tooltips, custom calendar focus, due-date/time reordering, clear/refresh/list behavior and unchanged subtask ordering')
