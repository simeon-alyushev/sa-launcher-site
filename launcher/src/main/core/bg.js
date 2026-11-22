'use strict';
// Свои фоны для темы «Своя»: PNG / JPG / WEBP / GIF. Файлы копируются в папку данных лаунчера (оригинал не трогаем),
// тип определяется по сигнатуре файла, а не по расширению. Отдаются интерфейсу через протокол sa-bg://f/<id> (см. main.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX = 60 * 1048576, LIMIT = 8, ID = /^[a-f0-9]{12}$/;
function kind(b) {
  if (b.length < 12) return '';
  if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 0, 3) === 'GIF' && /^GIF8[79]a$/.test(b.toString('latin1', 0, 6))) return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return '';
}
class Backgrounds {
  constructor(dataDir, store) { this.dir = path.join(dataDir, 'custom-bg'); this.store = store; }
  list() { const l = this.store.settings.customBgs; return Array.isArray(l) ? l : []; }
  // Копирует файл и возвращает запись. replaceId — заменить существующий фон (запись и файл) новым.
  add(file, replaceId) {
    const st = fs.statSync(file); if (!st.isFile()) throw new Error('err:bgBad');
    if (st.size > MAX) throw new Error('err:bgBig');
    const fd = fs.openSync(file, 'r'), head = Buffer.alloc(16); try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
    const ext = kind(head); if (!ext) throw new Error('err:bgBad');
    const list = this.list().slice(), at = replaceId ? list.findIndex(x => x.id === replaceId) : -1;
    if (at < 0 && list.length >= LIMIT) throw new Error('err:bgLimit');
    fs.mkdirSync(this.dir, { recursive: true });
    const id = crypto.randomBytes(6).toString('hex');
    fs.copyFileSync(file, path.join(this.dir, id + '.' + ext));
    const item = { id, ext, name: path.basename(file).replace(/[\u0000-\u001f<>]/g, '').slice(0, 60), size: st.size, v: Date.now() };
    if (at >= 0) { this.unlink(list[at].id); list[at] = item; } else list.push(item);
    this.store.set({ customBgs: list, customBgSel: item.id });
    return { list, sel: item.id, item };
  }
  unlink(id) { if (!ID.test(String(id))) return; try { for (const n of fs.readdirSync(this.dir)) if (n.startsWith(id + '.')) fs.rmSync(path.join(this.dir, n), { force: true }); } catch (_) {} }
  remove(id) {
    const list = this.list().filter(x => x.id !== id); this.unlink(id);
    const sel = this.store.settings.customBgSel === id ? (list[list.length - 1] || {}).id || '' : this.store.settings.customBgSel;
    this.store.set({ customBgs: list, customBgSel: sel || '' });
    return { list, sel: sel || '' };
  }
  // Путь файла для протокола: только по id из 12 hex-символов и только внутри папки фонов
  file(id) {
    if (!ID.test(String(id))) return null;
    try { const n = fs.readdirSync(this.dir).find(x => /^[a-f0-9]{12}\.(png|jpg|webp|gif)$/.test(x) && x.startsWith(id + '.')); return n ? path.join(this.dir, n) : null; } catch (_) { return null; }
  }
}
module.exports = { Backgrounds, kind };
