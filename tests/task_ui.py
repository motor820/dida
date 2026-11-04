"""Browser regression against a local Vite server, using mocked API and fresh IndexedDB.

Requires Python Playwright and Chrome; see docs/WEB-TASK-ACCEPTANCE.md.
"""
import os
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

url = os.environ.get('DIDA_UI_TEST_URL', 'http://127.0.0.1:1431/')
assert urlparse(url).hostname in ('127.0.0.1', 'localhost'), 'Use a local Vite server only'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('DIDA_CHROME', '/usr/bin/google-chrome'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    def api(route):
        url = route.request.url
        if '/auth/session' in url:
            route.fulfill(json={'username': 'isolated-ui-test', 'epoch': 'ui-test', 'time': int(time.time()*1000)})
        elif '/sync/pull' in url:
            route.fulfill(json={'records': [], 'cursor': 0, 'until': 0, 'has_more': False, 'time': int(time.time()*1000)})
        else:
            route.abort()
    page.route('**/api/**', api)
    page.goto(url)
    expect(page.get_by_placeholder('添加任务', exact=True)).to_be_visible()
    page.wait_for_function("async () => !(await import('/src/sync/store.ts')).offline.getStatus().syncing")
    ids = page.evaluate("""async () => {
        const {taskService:s} = await import('/src/services/task.ts');
        const first = await s.createTaskSimple('第一条任务', 'smart_inbox');
        const second = await s.createTaskSimple('第二条任务', 'smart_inbox');
        await s.updateTaskOrders([[first.id, 0], [second.id, 10]]);
        await s.updateTask({...first, description: '这是描述摘要。\\n多行内容'});
        return {first:first.id, second:second.id};
    }""")
    expect(page.get_by_text('第一条任务', exact=True)).to_be_visible()
    expect(page.get_by_text('原有子任务', exact=True)).to_have_count(0)
    expect(page.get_by_text('这是描述摘要。 多行内容', exact=True)).to_be_visible()
    page.get_by_text('第一条任务', exact=True).click()
    title = page.get_by_role('textbox', name='任务名称', exact=True)
    expect(title).to_be_focused()
    assert title.evaluate('(e) => e.selectionStart === e.value.length && e.selectionEnd === e.value.length')
    title.fill('中文输入中')
    title.dispatch_event('keydown', {'key': 'Enter', 'code': 'Enter', 'isComposing': True})
    expect(title).to_have_attribute('data-task-id', ids['first'])
    title.fill('直接编辑后的任务')
    previous_id = title.get_attribute('data-task-id')
    title.press('Enter')
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).not_to_have_attribute('data-task-id', previous_id)
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).to_be_focused()
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).to_have_attribute('placeholder', '无标题')
    page.get_by_role('textbox', name='任务名称', exact=True).fill('回车新建任务')
    previous_id = page.get_by_role('textbox', name='任务名称', exact=True).get_attribute('data-task-id')
    page.get_by_role('textbox', name='任务名称', exact=True).press('Enter')
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).not_to_have_attribute('data-task-id', previous_id)
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).to_have_value('')
    page.get_by_role('textbox', name='任务名称', exact=True).press('Backspace')
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).to_have_count(0)
    stored = page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); return (await s.getTasks()).filter(t=>!t.parent_id).map(t=>t.title); }""", ids['first'])
    assert stored == ['直接编辑后的任务', '回车新建任务', '第二条任务'], stored
    page.reload()
    expect(page.get_by_text('回车新建任务', exact=True)).to_be_visible()
    page.get_by_text('直接编辑后的任务', exact=True).click()
    page.locator('p').filter(has_text='这是描述摘要。').click()
    desc = page.get_by_placeholder('输入内容或使用 / 快速插入')
    desc.fill('\n'.join('长描述第%d行' % n for n in range(30)))
    dimensions = desc.evaluate('(e) => ({scroll: e.scrollHeight, client: e.clientHeight})')
    assert dimensions['client'] >= dimensions['scroll'], dimensions
    desc.fill('第一条检查事项\n\n第二条检查事项\r\n第三条检查事项')
    page.get_by_role('button', name='检查事项', exact=True).click()
    expect(page.get_by_text('第一条检查事项', exact=True)).to_be_visible()
    expect(page.get_by_text('第二条检查事项', exact=True)).to_be_visible()
    page.evaluate("""async id => {const {taskService:s}=await import('/src/services/task.ts'); const child=await s.createSubtaskSimple('原有子任务', id, 'smart_inbox'); await s.updateTask({...child, order:-10});}""", ids['first'])
    converted = page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); return {parent:await s.getTask(id), children:await s.getSubtasks(id)}; }""", ids['first'])
    assert converted['parent']['description'] == ''
    assert [c['title'] for c in converted['children']] == ['原有子任务', '第一条检查事项', '第二条检查事项', '第三条检查事项']
    # A description added after initial conversion remains independent on every toggle.
    page.get_by_text('点此添加详细描述...', exact=True).click()
    page.get_by_placeholder('输入内容或使用 / 快速插入').fill('这是单独补充的详细描述。\n描述仍可多行。')
    page.get_by_role('button', name='详情', exact=True).click()
    details = page.get_by_role('textbox', name='任务详情', exact=True)
    expect(details).to_have_value('原有子任务\n第一条检查事项\n第二条检查事项\n第三条检查事项')
    paragraph = page.locator('p').filter(has_text='这是单独补充的详细描述。')
    expect(paragraph).to_be_visible()
    gap = details.bounding_box()['y'] - (paragraph.bounding_box()['y'] + paragraph.bounding_box()['height'])
    assert gap >= 20, gap
    page.get_by_role('button', name='检查事项', exact=True).click()
    preserved = page.evaluate("""async id => {const {taskService:s}=await import('/src/services/task.ts');return {parent:await s.getTask(id), children:await s.getSubtasks(id)};}""", ids['first'])
    assert preserved['parent']['description'] == '这是单独补充的详细描述。\n描述仍可多行。'
    assert [c['id'] for c in preserved['children']] == [c['id'] for c in converted['children']]
    expect(page.get_by_role('button', name='详情', exact=True)).to_be_visible()
    row = page.get_by_text('第一条检查事项', exact=True).locator('..').locator('..')
    row.hover()
    row.get_by_role('button', name='设置子任务截止日期', exact=True).click()
    page.get_by_role('button', name='20', exact=True).click()
    page.get_by_role('button', name='确定', exact=True).click()
    page.wait_for_function("""async id => {const {taskService:s}=await import('/src/services/task.ts');return (await s.getSubtasks(id)).find(t=>t.title==='第一条检查事项')?.due_date != null;}""", arg=ids['first'])
    row.get_by_role('button', name='设置子任务截止日期', exact=True).click()
    page.keyboard.press('Escape')
    expect(page.get_by_role('button', name='详情', exact=True)).to_be_visible()
    page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); const children=await s.getSubtasks(id); await s.toggleTask(children.find(t=>t.title==='第三条检查事项').id); }""", ids['first'])
    before_toggle = page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); return await s.getSubtasks(id); }""", ids['first'])
    for _ in range(2):
        page.get_by_role('button', name='详情', exact=True).click()
        expect(page.get_by_role('button', name='检查事项', exact=True)).to_have_attribute('title', '检查事项')
        text_details = page.get_by_role('textbox', name='任务详情', exact=True)
        expect(text_details).to_have_value('原有子任务\n第一条检查事项\n第二条检查事项\n第三条检查事项')
        expect(page.get_by_role('button', name='设置子任务截止日期', exact=True)).to_have_count(0)
        page.get_by_role('button', name='检查事项', exact=True).click()
        expect(page.get_by_role('button', name='详情', exact=True)).to_have_attribute('title', '详情')
    after_toggle = page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); return await s.getSubtasks(id); }""", ids['first'])
    assert before_toggle == after_toggle, 'Switching the view must preserve child IDs, dates, completion and metadata'
    page.get_by_role('button', name='详情', exact=True).click()
    page.locator('p').filter(has_text='这是单独补充的详细描述。').click()
    page.get_by_placeholder('输入内容或使用 / 快速插入').fill('详情模式修改后的描述')
    page.get_by_role('textbox', name='任务详情', exact=True).fill('原有子任务\n第一条检查事项\n修改后的检查事项\n第三条检查事项\n新增检查事项')
    page.get_by_role('button', name='检查事项', exact=True).click()
    expect(page.get_by_text('新增检查事项', exact=True)).to_be_visible()
    edited_children = page.evaluate("""async id => { const {taskService:s}=await import('/src/services/task.ts'); return await s.getSubtasks(id); }""", ids['first'])
    assert [c['id'] for c in edited_children[:4]] == [c['id'] for c in before_toggle]
    assert edited_children[1]['due_date'] == before_toggle[1]['due_date']
    assert edited_children[2]['title'] == '修改后的检查事项'
    saved_description = page.evaluate("""async id => (await (await import('/src/services/task.ts')).taskService.getTask(id)).description""", ids['first'])
    assert saved_description == '详情模式修改后的描述'
    assert len(edited_children) == 5, 'The description must not become an extra checklist item'
    page.reload()
    expect(page.get_by_text('直接编辑后的任务', exact=True)).to_be_visible()
    page.get_by_text('直接编辑后的任务', exact=True).click()
    expect(page.get_by_role('button', name='详情', exact=True)).to_be_visible()
    row = page.get_by_text('第一条检查事项', exact=True).locator('..').locator('..')
    row.hover()
    row.get_by_title('删除子任务', exact=True).click()
    expect(page.get_by_text('第一条检查事项', exact=True)).to_have_count(0)
    result = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        const description = '有效的首行\\n' + 'x'.repeat(5000);
        const task=await s.createTaskExtended('转换失败回归', 'smart_inbox', undefined, undefined, undefined, undefined, undefined, description);
        let rejected = false;
        try { await s.convertDescriptionToSubtasks(task.id, description); } catch { rejected = true; }
        const unchanged = (await s.getTask(task.id)).description === description;
        const children = (await s.getSubtasks(task.id)).length;
        await s.deleteTaskPermanently(task.id);
        return {rejected, unchanged, children};
    }""")
    assert result == {'rejected': True, 'unchanged': True, 'children': 0}, result
    sort_parent = page.evaluate("""async () => {
        const {taskService:s}=await import('/src/services/task.ts');
        const parent=await s.createTaskSimple('子任务完成排序回归', 'smart_inbox');
        for (const [index,title] of ['排序-A','排序-B','排序-C','排序-D'].entries()) {
            const child=await s.createSubtaskSimple(title,parent.id,parent.list_id);
            const time=index===0?200:index===2?100:null;
            await s.updateTask({...child,order:index*10,completed:time!==null,completed_at:time});
        }
        return parent.id;
    }""")
    page.get_by_text('子任务完成排序回归', exact=True).click()
    def expect_child_order(names):
        page.wait_for_function("""expected => JSON.stringify(Array.from(document.querySelectorAll('button[role=checkbox]')).map(e=>e.getAttribute('aria-label'))) === JSON.stringify(expected)""", arg=names)
    expect_child_order(['排序-B', '排序-D', '排序-C', '排序-A'])
    page.get_by_role('checkbox', name='排序-B', exact=True).click()
    expect_child_order(['排序-D', '排序-C', '排序-A', '排序-B'])
    page.get_by_role('checkbox', name='排序-C', exact=True).click()
    expect_child_order(['排序-C', '排序-D', '排序-A', '排序-B'])
    page.reload()
    page.get_by_text('子任务完成排序回归', exact=True).click()
    expect_child_order(['排序-C', '排序-D', '排序-A', '排序-B'])
    # Existing long titles must immediately open as growing, multiline editors.
    long_title = '超长主任务标题应直接换行并且能够完整编辑。' * 12 + 'LongWordWithoutSpaces' * 10
    long_child_title = '子任务超过一行需要完整换行显示。' * 12 + '\n子任务原有换行内容'
    multiline_ids = page.evaluate("""async args => {
        const {taskService:s}=await import('/src/services/task.ts');
        const parent=await s.createTaskSimple(args.title,'smart_inbox');
        const child=await s.createSubtaskSimple(args.child,parent.id,parent.list_id);
        await s.createSubtaskSimple('另一条未完成子任务',parent.id,parent.list_id);
        return {parent:parent.id,child:child.id};
    }""", {'title':long_title,'child':long_child_title})
    page.locator(f'[data-task-row="{multiline_ids["parent"]}"]').click()
    title_editor = page.get_by_role('textbox', name='任务名称', exact=True)
    expect(title_editor).to_have_value(long_title)
    def expect_multiline(editor):
        size = editor.evaluate('(e) => ({scroll:e.scrollHeight, client:e.clientHeight, width:e.clientWidth, scrollWidth:e.scrollWidth, line:parseFloat(getComputedStyle(e).lineHeight)})')
        assert size['client'] >= size['scroll'], size
        assert size['client'] >= size['line'] * 2, size
        assert size['scrollWidth'] <= size['width'], size
    expect_multiline(title_editor)
    title_editor.press('Control+End')
    title_editor.press('Shift+Enter')
    title_editor.press_sequentially('列表中补充的标题行')
    expect(title_editor).to_have_value(long_title + '\n列表中补充的标题行')
    page.get_by_role('heading', name='所有任务', exact=True).click()
    page.wait_for_function("""async args => (await (await import('/src/services/task.ts')).taskService.getTask(args.id)).title === args.title""", arg={'id':multiline_ids['parent'],'title':long_title + '\n列表中补充的标题行'})
    page.locator('h3').click()
    detail_title = page.get_by_role('textbox', name='主任务标题', exact=True)
    expect_multiline(detail_title)
    expect(detail_title).to_be_focused()
    assert detail_title.evaluate('(e) => e.selectionStart === e.value.length && e.selectionEnd === e.value.length')
    final_title = long_title + '\n详情中补充的标题行'
    detail_title.fill(final_title)
    title_task_ids = page.evaluate("""async () => (await (await import('/src/services/task.ts')).taskService.getTasks()).map(t=>t.id).sort()""")
    detail_title.dispatch_event('keydown', {'key': 'Enter', 'code': 'Enter', 'isComposing': True})
    expect(detail_title).to_be_focused()
    detail_title.press('Enter')
    description_editor = page.get_by_placeholder('输入内容或使用 / 快速插入')
    expect(description_editor).to_be_focused()
    expect(description_editor).to_have_value('')
    description_editor.press_sequentially('标题回车后输入的描述')
    page.locator('h3').click()
    detail_title = page.get_by_role('textbox', name='主任务标题', exact=True)
    expect(detail_title).to_be_focused()
    detail_title.press('Enter')
    expect(description_editor).to_be_focused()
    expect(description_editor).to_have_value('标题回车后输入的描述')
    assert description_editor.evaluate('(e) => e.selectionStart === e.value.length && e.selectionEnd === e.value.length')
    description_editor.press_sequentially('，继续补充')
    task_ids_after_enter = page.evaluate("""async () => (await (await import('/src/services/task.ts')).taskService.getTasks()).map(t=>t.id).sort()""")
    assert task_ids_after_enter == title_task_ids, 'Detail title Enter must not create another task or subtask'
    child_row = page.locator(f'[data-subtask-id="{multiline_ids["child"]}"]')
    child_text = child_row.locator('span').first
    expect_multiline(child_text)
    original_child_x = child_text.bounding_box()['x']
    child_text.click()
    child_editor = page.get_by_role('textbox', name='子任务标题', exact=True)
    expect(child_editor).to_have_value(long_child_title)
    expect_multiline(child_editor)
    expect(child_editor).to_be_focused()
    assert child_editor.evaluate('(e) => e.selectionStart === e.value.length && e.selectionEnd === e.value.length')
    assert abs(child_editor.bounding_box()['x'] - original_child_x) < 1
    assert child_editor.evaluate('(e) => getComputedStyle(e).borderTopWidth') == '0px'
    child_editor.press('Control+End')
    child_editor.press('Shift+Enter')
    child_editor.press_sequentially('子任务补充的标题行')
    expect_multiline(child_editor)
    page.screenshot(path='/tmp/dida-multiline-title-edit.png', full_page=True)
    child_editor.click()
    child_editor.press('Enter')
    expect(child_editor).not_to_have_attribute('data-task-id', multiline_ids['child'])
    expect(child_editor).to_be_focused()
    expect(child_editor).to_have_value('')
    expect(child_editor).to_have_attribute('placeholder', '无标题')
    first_new_child_id = child_editor.get_attribute('data-task-id')
    child_editor.press_sequentially('回车续建的子任务一')
    child_editor.dispatch_event('keydown', {'key': 'Enter', 'code': 'Enter', 'isComposing': True})
    expect(child_editor).to_have_attribute('data-task-id', first_new_child_id)
    child_editor.press('Enter')
    expect(child_editor).not_to_have_attribute('data-task-id', first_new_child_id)
    expect(child_editor).to_be_focused()
    child_editor.press_sequentially('回车续建的子任务二')
    page.get_by_role('heading', name='所有任务', exact=True).click()
    expect(child_editor).to_have_count(0)
    child_order = page.evaluate("""async id => (await (await import('/src/services/task.ts')).taskService.getSubtasks(id)).map(t=>({title:t.title,parent:t.parent_id}))""", multiline_ids['parent'])
    assert [t['title'] for t in child_order] == [long_child_title + '\n子任务补充的标题行', '回车续建的子任务一', '回车续建的子任务二', '另一条未完成子任务'], child_order
    assert all(t['parent'] == multiline_ids['parent'] for t in child_order)
    child_row.get_by_role('checkbox').click()
    expect(child_row.get_by_role('checkbox')).to_be_checked()
    expect_multiline(child_row.locator('span').first)
    page.reload()
    page.locator(f'[data-task-row="{multiline_ids["parent"]}"]').click()
    expect(page.get_by_role('textbox', name='任务名称', exact=True)).to_have_value(final_title)
    expect_multiline(page.get_by_role('textbox', name='任务名称', exact=True))
    saved_titles = page.evaluate("""async ids => {
        const {taskService:s}=await import('/src/services/task.ts');
        return {parent:(await s.getTask(ids.parent)).title,child:(await s.getTask(ids.child)).title,count:(await s.getSubtasks(ids.parent)).length};
    }""", multiline_ids)
    assert saved_titles == {'parent':final_title,'child':long_child_title + '\n子任务补充的标题行','count':4}, saved_titles
    page.locator(f'[data-task-row="{sort_parent}"]').click()
    # The task list stays at 480px; details absorb width changes until becoming a drawer.
    page.get_by_role('heading', name='所有任务', exact=True).click()
    column = page.get_by_role('region', name='任务列表', exact=True)
    panel = page.locator('.dida-detail-column')
    page.get_by_text('点此添加详细描述...', exact=True).click()
    resize_draft = '\n'.join('窗口缩放时编辑内容需要完整保留，长描述也应自动换行。' * 3 for _ in range(10))
    page.get_by_placeholder('输入内容或使用 / 快速插入').fill(resize_draft)
    width_before = panel.bounding_box()['width']
    assert abs(column.bounding_box()['width'] - 480) < 1
    page.set_viewport_size({'width': 1600, 'height': 1000})
    page.wait_for_timeout(350)
    assert abs(column.bounding_box()['width'] - 480) < 1
    assert abs(panel.bounding_box()['width'] - width_before - 160) < 1
    rail = page.locator('nav[aria-label="快捷导航"]')
    page.set_viewport_size({'width': 1100, 'height': 1000})
    expect(rail).to_be_visible()
    assert abs(rail.bounding_box()['width'] - 60) < 1
    expect(page.get_by_role('dialog', name='导航栏', exact=True)).to_be_hidden()
    expect(panel).to_be_visible()
    assert abs(column.bounding_box()['width'] - 480) < 1
    assert abs(panel.bounding_box()['width'] - 560) < 1
    page.wait_for_timeout(250)
    dimensions = page.get_by_placeholder('输入内容或使用 / 快速插入').evaluate('(e) => ({scroll:e.scrollHeight, client:e.clientHeight})')
    assert dimensions['scroll'] <= dimensions['client'], dimensions
    page.set_viewport_size({'width': 900, 'height': 1000})
    expect(panel).to_be_visible()
    assert abs(column.bounding_box()['width'] - 480) < 1
    assert abs(panel.bounding_box()['width'] - 360) < 1
    page.set_viewport_size({'width': 880, 'height': 1000})
    expect(panel).to_be_hidden()
    expect(rail).to_be_visible()
    assert abs(column.bounding_box()['width'] - 820) < 1
    page.set_viewport_size({'width': 760, 'height': 1000})
    expect(panel).to_be_hidden()
    expect(rail).to_be_visible()
    assert abs(rail.bounding_box()['x']) < 1
    assert abs(column.bounding_box()['width'] - 700) < 1
    column.locator(f'[data-task-row="{sort_parent}"]').click()
    detail_dialog = page.get_by_role('dialog', name='任务详情', exact=True)
    expect(detail_dialog).to_be_visible()
    page.wait_for_timeout(250)
    assert abs(detail_dialog.bounding_box()['x'] - 280) < 1
    assert abs(detail_dialog.bounding_box()['width'] - 480) < 1
    expect(column).to_have_attribute('inert', '')
    page.wait_for_function("""async args => (await (await import('/src/services/task.ts')).taskService.getTask(args.id)).description === args.text""", arg={'id':sort_parent,'text':resize_draft})
    page.keyboard.press('Tab')
    assert detail_dialog.evaluate('(e) => e.contains(document.activeElement)')
    page.keyboard.press('Escape')
    expect(detail_dialog).to_be_hidden()
    column.locator(f'[data-task-row="{sort_parent}"]').click()
    expect(detail_dialog).to_be_visible()
    detail_dialog.get_by_role('button', name='关闭任务详情', exact=True).click()
    expect(detail_dialog).to_be_hidden()
    column.locator(f'[data-task-row="{sort_parent}"]').focus()
    page.keyboard.press('Enter')
    expect(detail_dialog).to_be_visible()
    page.mouse.click(100, 500)
    expect(detail_dialog).to_be_hidden()
    column.get_by_role('button', name='显示侧边栏', exact=True).click()
    nav_dialog = page.get_by_role('dialog', name='导航栏', exact=True)
    expect(nav_dialog).to_be_visible()
    expect(rail).to_be_visible()
    page.wait_for_timeout(250)
    assert abs(nav_dialog.bounding_box()['x'] - 60) < 1
    nav_dialog.get_by_role('button', name='收集箱', exact=True).click()
    expect(nav_dialog).to_be_hidden()
    page.set_viewport_size({'width': 375, 'height': 812})
    assert abs(column.bounding_box()['width'] - 315) < 1
    column.locator(f'[data-task-row="{sort_parent}"]').click()
    expect(detail_dialog).to_be_visible()
    page.wait_for_timeout(250)
    assert abs(detail_dialog.bounding_box()['width'] - 315) < 1
    assert abs(detail_dialog.bounding_box()['x'] - 60) < 1
    expect(rail).to_be_visible()
    assert rail.bounding_box()['x'] + rail.bounding_box()['width'] <= detail_dialog.bounding_box()['x']
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/tmp/dida-task-ui-narrow.png', full_page=True)
    detail_dialog.get_by_role('button', name='关闭任务详情', exact=True).click()
    expect(detail_dialog).to_be_hidden()
    page.set_viewport_size({'width': 1440, 'height': 1000})
    expect(panel).to_be_visible()
    assert abs(column.bounding_box()['width'] - 480) < 1
    page.screenshot(path='/tmp/dida-task-ui.png', full_page=True)
    assert not errors, errors
    print('PASS: inline editing, Enter insertion/order/focus, empty deletion, persistence, hidden children, summary, expanding description, conversion, date picker, child deletion, reversible checklist/details mode with independent description and metadata preservation, completion ordering and reopening, fixed task list and responsive drawers, multiline title editing and child wrapping, inline title style, caret at end and Enter continuation, detail title Enter focuses description without creating a task')
    browser.close()
