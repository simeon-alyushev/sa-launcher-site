// Server List Ping на настоящем TCP-сервере-заглушке: онлайн, офлайн, молчит, мусор, плохая иконка, кэш.   node scripts/test-servers.js
const net = require('net'), assert = require('assert'), zlib = require('zlib');
const S = require('../src/main/core/slp');
const vi = n => S.wVarInt(n), str = s => { const b = Buffer.from(s); return Buffer.concat([vi(b.length), b]); }, fr = b => Buffer.concat([vi(b.length), b]);
function png(w, h) { const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr = Buffer.alloc(25); ihdr.writeUInt32BE(13, 0); ihdr.write('IHDR', 4); ihdr.writeUInt32BE(w, 8); ihdr.writeUInt32BE(h, 12); return Buffer.concat([sig, ihdr, Buffer.alloc(12)]); }
const fav = b => 'data:image/png;base64,' + b.toString('base64');
// сервер: mode = ok | nopong | silent | garbage | huge
function fake(mode, status) {
  let conns = 0;
  const srv = net.createServer(sock => {
    conns++; let buf = Buffer.alloc(0), got = 0;
    sock.on('error', () => {});
    sock.on('data', d => {
      if (mode === 'silent') return; if (mode === 'garbage') { sock.write(Buffer.from('HTTP/1.1 400 Bad\r\n\r\n')); return; } if (mode === 'huge') { sock.write(Buffer.alloc(2e6, 1)); return; }
      buf = Buffer.concat([buf, d]);
      for (;;) { const l = S.rVarInt(buf, 0); if (!l || buf.length < l.n + l.v) break; const pk = buf.subarray(l.n, l.n + l.v); buf = buf.subarray(l.n + l.v); got++;
        if (got === 2) sock.write(fr(Buffer.concat([vi(0), str(JSON.stringify(status))])));           // 1-й пакет рукопожатие, 2-й запрос статуса
        else if (got === 3 && mode === 'ok') sock.write(fr(Buffer.concat([vi(1), pk.subarray(1)])));      // ping → pong
        else if (got === 3 && mode === 'nopong') sock.end(); }
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, conns: () => conns, close: () => srv.close() })));
}
(async () => {
  // 1) онлайн: игроки, MOTD (коды § убраны, extra склеен), версия, иконка 64×64, задержка — число
  const st = { version: { name: 'Paper 1.21.1', protocol: 767 }, players: { online: 3, max: 20 }, description: { text: '§aSA ', extra: [{ text: 'Server' }, '\n§7second line'] }, favicon: fav(png(64, 64)) };
  const a = await fake('ok', st), r = await S.ping('127.0.0.1:' + a.port, { timeout: 2000 });
  assert(r.online && r.players.online === 3 && r.players.max === 20 && r.version === 'Paper 1.21.1' && r.protocol === 767, JSON.stringify(r).slice(0, 200));
  assert.strictEqual(r.motd, 'SA Server · second line'); assert(r.icon.startsWith('data:image/png;base64,') && typeof r.ms === 'number' && r.ms >= 0);
  // 2) кэш: второй запрос без нового подключения, force — с новым
  await S.ping('127.0.0.1:' + a.port); assert.strictEqual(a.conns(), 1, 'из кэша'); await S.ping('127.0.0.1:' + a.port, { force: true }); assert.strictEqual(a.conns(), 2); a.close();
  // 3) плохие иконки отбрасываются, остальное остаётся
  for (const [name, f] of [['не 64×64', fav(png(32, 32))], ['не PNG', 'data:image/png;base64,' + Buffer.from('x'.repeat(100)).toString('base64')], ['SVG', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='], ['огромная', fav(Buffer.concat([png(64, 64), Buffer.alloc(70000)]))]]) {
    S.clear(); const b = await fake('ok', { ...st, favicon: f }), x = await S.ping('127.0.0.1:' + b.port); assert(x.online && x.icon === '' && x.players.online === 3, name + ' -> ' + JSON.stringify(x).slice(0, 120)); b.close();
  }
  // 4) сервер закрыл соединение без pong: статус всё равно есть, задержка — по запросу статуса
  S.clear(); const c = await fake('nopong', st), cr = await S.ping('127.0.0.1:' + c.port); assert(cr.online && typeof cr.ms === 'number'); c.close();
  // 5) порт закрыт → офлайн с причиной, без выдуманных игроков/MOTD
  S.clear(); const dead = await fake('ok', st); const dp = dead.port; dead.close(); await new Promise(r => setTimeout(r, 50));
  const off = await S.ping('127.0.0.1:' + dp, { timeout: 1500 }); assert(!off.online && off.error === 'refused' && !('players' in off) && !('motd' in off), JSON.stringify(off));
  // 6) сервер молчит → таймаут; отвечает мусором → bad; огромный ответ → bad
  S.clear(); const sl = await fake('silent', st), t0 = Date.now(), so = await S.ping('127.0.0.1:' + sl.port, { timeout: 400 }); assert(!so.online && so.error === 'timeout' && Date.now() - t0 < 1500); sl.close();
  const g = await fake('garbage', st), go = await S.ping('127.0.0.1:' + g.port, { timeout: 1500 }); assert(!go.online && /bad|closed|timeout/.test(go.error), go.error); g.close();
  const h = await fake('huge', st), ho = await S.ping('127.0.0.1:' + h.port, { timeout: 1500 }); assert(!ho.online, 'огромный ответ отвергнут'); h.close();
  // 7) адреса
  const P = S.parseAddress;
  assert.deepStrictEqual(P('play.example.com'), { host: 'play.example.com', port: 0 }); assert.deepStrictEqual(P('h.io:25570'), { host: 'h.io', port: 25570 }); assert.deepStrictEqual(P('[::1]:25565'), { host: '::1', port: 25565 });
  for (const bad of ['', 'a b', 'h:70000', 'h:0', '::1', 'a/b', 'x;rm -rf', 'h'.repeat(200)]) assert.strictEqual(P(bad), null, 'отвергнут: ' + bad);
  assert.deepStrictEqual(await S.ping('bad address'), { online: false, error: 'address' });
  // 8) пачка: не больше 8, ключ — исходная строка
  const many = await S.many(Array.from({ length: 12 }, (_, i) => '127.0.0.1:' + (dp + i % 3)), { timeout: 300 }); assert(Object.keys(many).length <= 8);
  console.log('OK servers');
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
