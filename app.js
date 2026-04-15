// app.js
// 保存・復元・通知スケジューリング（5分前）・土曜週管理（統合版）

// グローバルでタイマーを管理して再設定時にクリアできるようにする
window._scheduledTimers = window._scheduledTimers || { timeouts: [], intervals: [] };

// ユーティリティ：週番号を取得（ISOではないが一貫した算出）
function getWeekNumber(date) {
  const onejan = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

// 現在の週番号を表示
function updateThisWeekLabel() {
  const el = document.getElementById('this-week-label');
  const w = getWeekNumber(new Date());
  el.textContent = `今週の週番号: ${w}`;
}

// enabled weeks 表示更新
function renderEnabledWeeks() {
  const el = document.getElementById('enabled-weeks');
  const arr = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
  el.textContent = arr.length ? arr.join(', ') : 'なし';
}

// 保存処理
document.getElementById('save').addEventListener('click', () => {
  const subjects = document.querySelectorAll('.subject');
  const items = document.querySelectorAll('.items');
  const starts = document.querySelectorAll('.start');

  const data = [];

  subjects.forEach((sub, i) => {
    const item = items[i];
    const time = starts[i];

    const subj = sub.value.trim();
    if (!subj) return; // 空欄は保存しない

    // データ属性は文字列なので数値に変換
    const day = Number(sub.dataset.day); // 1=Mon ... 6=Sat
    const period = Number(sub.dataset.period);

    // 時刻が未入力ならデフォルトを設定（例: 1限 8:30）
    let hour = 8, minute = 30;
    if (time.value) {
      const parts = time.value.split(':');
      hour = Number(parts[0]);
      minute = Number(parts[1]);
    }

    data.push({
      day,
      period,
      subject: subj,
      items: item.value.trim(),
      hour,
      minute
    });
  });

  localStorage.setItem('timetable', JSON.stringify(data));
  alert('保存しました');
});

// 復元処理
window.addEventListener('load', () => {
  updateThisWeekLabel();
  renderEnabledWeeks();

  const saved = JSON.parse(localStorage.getItem('timetable') || '[]');

  saved.forEach(item => {
    const subjEl = document.querySelector(`.subject[data-day="${item.day}"][data-period="${item.period}"]`);
    const itemsEl = document.querySelector(`.items[data-day="${item.day}"][data-period="${item.period}"]`);
    const startEl = document.querySelector(`.start[data-day="${item.day}"][data-period="${item.period}"]`);
    if (subjEl) subjEl.value = item.subject;
    if (itemsEl) itemsEl.value = item.items || '';
    if (startEl) startEl.value = `${String(item.hour).padStart(2,'0')}:${String(item.minute).padStart(2,'0')}`;
  });

  // 今週の土曜有無チェックを復元
  const thisWeek = getWeekNumber(new Date());
  const enabled = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
  document.getElementById('sat-this-week').checked = enabled.includes(thisWeek);

  // イベント：今週チェックの保存
  document.getElementById('sat-this-week').addEventListener('change', () => {
    const checked = document.getElementById('sat-this-week').checked;
    let list = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
    if (checked) {
      if (!list.includes(thisWeek)) list.push(thisWeek);
    } else {
      list = list.filter(w => w !== thisWeek);
    }
    localStorage.setItem('satEnabledWeeks', JSON.stringify(list));
    renderEnabledWeeks();
  });

  // 追加・削除ボタン
  document.getElementById('add-weeks').addEventListener('click', () => {
    const raw = document.getElementById('week-input').value.trim();
    if (!raw) return;
    const parts = raw.split(',').map(s => Number(s.trim())).filter(Boolean);
    let list = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
    parts.forEach(p => { if (!list.includes(p)) list.push(p); });
    localStorage.setItem('satEnabledWeeks', JSON.stringify(list));
    renderEnabledWeeks();
    document.getElementById('week-input').value = '';
  });

  document.getElementById('remove-weeks').addEventListener('click', () => {
    const raw = document.getElementById('week-input').value.trim();
    if (!raw) return;
    const parts = raw.split(',').map(s => Number(s.trim())).filter(Boolean);
    let list = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
    list = list.filter(w => !parts.includes(w));
    localStorage.setItem('satEnabledWeeks', JSON.stringify(list));
    renderEnabledWeeks();
    document.getElementById('week-input').value = '';
  });
});

// 通知許可とスケジュール開始
document.getElementById('notify').addEventListener('click', async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('通知が許可されていません');
    return;
  }

  // 既存タイマーをクリアして再設定
  clearScheduledTimers();
  scheduleAllNotifications();
  alert('通知を設定しました（5分前に通知されます）');
});

// 全通知クリア（タイマーとServiceWorkerの通知タグは別）
document.getElementById('clear').addEventListener('click', async () => {
  clearScheduledTimers();
  // ServiceWorker側の通知を閉じる（表示中のもの）
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const reg = await navigator.serviceWorker.ready;
    reg.getNotifications().then(notifs => notifs.forEach(n => n.close()));
  }
  alert('ローカルのスケジュールをクリアしました');
});

// タイマーをクリアする
function clearScheduledTimers() {
  if (window._scheduledTimers) {
    window._scheduledTimers.timeouts.forEach(id => clearTimeout(id));
    window._scheduledTimers.intervals.forEach(id => clearInterval(id));
    window._scheduledTimers.timeouts = [];
    window._scheduledTimers.intervals = [];
  } else {
    window._scheduledTimers = { timeouts: [], intervals: [] };
  }
}

// JSONエクスポート
document.getElementById('export').addEventListener('click', () => {
  const timetable = JSON.parse(localStorage.getItem('timetable') || '[]');
  const satWeeks = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');

  const data = {
    timetable,
    satEnabledWeeks: satWeeks
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable_backup.json';
  a.click();

  URL.revokeObjectURL(url);
});

// JSONインポート
document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    alert('JSONファイルが壊れています');
    return;
  }

  if (!data.timetable || !data.satEnabledWeeks) {
    alert('このファイルは正しいバックアップではありません');
    return;
  }

  // 保存
  localStorage.setItem('timetable', JSON.stringify(data.timetable));
  localStorage.setItem('satEnabledWeeks', JSON.stringify(data.satEnabledWeeks));

  alert('インポート完了！ページを再読み込みします');
  location.reload();
});

// 通知スケジューラー（n分前通知、土曜は有効週のみ）
function scheduleAllNotifications() {
  const data = JSON.parse(localStorage.getItem('timetable') || '[]');
  const satEnabledWeeks = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');

  // 登録済みのServiceWorkerを取得して通知表示に使う
  navigator.serviceWorker.ready.then(reg => {
    const now = new Date();

    data.forEach(item => {
      // 土曜(day===6)は有効週か確認
      if (item.day === 6) {
        const thisWeek = getWeekNumber(now);
        if (!satEnabledWeeks.includes(thisWeek)) return;
      }

      // 現在の曜日を 1=Mon ... 7=Sun の形式に変換（item.day は 1..6）
      let nowDay = now.getDay(); // 0=Sun ... 6=Sat
      if (nowDay === 0) nowDay = 7;
      // item.day uses 1..6 (Mon..Sat). If item.day==6 it's Saturday.

      // 次の該当曜日の日付を計算
      const diff = (item.day - nowDay + 7) % 7;
      const target = new Date(now.getTime());
      target.setDate(now.getDate() + diff);
      // set to class start time
      target.setHours(item.hour, item.minute, 0, 0);
      // subtract 5 minutes for notification
      target.setMinutes(target.getMinutes() - 10);

      // If target is in the past (shouldn't be because diff handles), ensure it's next week
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 7);
      }

      const timeout = target.getTime() - now.getTime();

      // 1回目の通知を setTimeout でスケジュール
      const toId = setTimeout(() => {
        reg.showNotification(`10分後：${item.subject}`, {
          body: item.items ? `持ち物：${item.items}` : '忘れ物に注意！',
          tag: `${item.day}-${item.period}`
        });

        // 以降は毎週同じ曜日・時刻（10分前）で繰り返す
        const intervalId = setInterval(() => {
          // 土曜の場合は毎週ではなく、実行時の週が有効か確認する
          if (item.day === 6) {
            const w = getWeekNumber(new Date());
            const enabled = JSON.parse(localStorage.getItem('satEnabledWeeks') || '[]');
            if (!enabled.includes(w)) return;
          }

          reg.showNotification(`10分後：${item.subject}`, {
            body: item.items ? `持ち物：${item.items}` : '忘れ物に注意！',
            tag: `${item.day}-${item.period}`
          });
        }, 7 * 24 * 60 * 60 * 1000);

        window._scheduledTimers.intervals.push(intervalId);
      }, timeout);

      window._scheduledTimers.timeouts.push(toId);
    });
  });
}