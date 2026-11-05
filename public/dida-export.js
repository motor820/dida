'use strict';
document.getElementById('export').addEventListener('click', () => {
  try {
    const data = { format: 'dida-export-v1', tasks: JSON.parse(localStorage.getItem('dida-tasks') || '[]'), lists: JSON.parse(localStorage.getItem('dida-lists') || '[]'), tags: JSON.parse(localStorage.getItem('dida-tags') || '[]') };
    if (![data.tasks, data.lists, data.tags].every(Array.isArray)) throw new Error('旧数据格式异常，请先保留当前浏览器数据');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'dida-legacy-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('status').textContent = `已导出 ${data.tasks.length} 条任务、${data.lists.length} 个清单和 ${data.tags.length} 个标签。原始数据仍保留。`;
  } catch (error) { document.getElementById('status').textContent = error instanceof Error ? error.message : '导出失败'; }
});
