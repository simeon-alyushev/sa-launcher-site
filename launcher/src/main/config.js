'use strict';
// siteUrl — адрес сайта (скачивание, каталог). msClientId — Client ID для входа Microsoft.
// По умолчанию — публичный ID официального лаунчера Minecraft; свой можно задать в package.json -> "msClientId"
// или переменной SA_MS_CLIENT_ID. Менять ДО сборки установщика.
const pkg = require('../../package.json');
module.exports = {
  siteUrl: String(process.env.SA_SITE || pkg.saSite || 'http://localhost:3000').replace(/\/$/, ''),
  msClientId: String(process.env.SA_MS_CLIENT_ID || pkg.msClientId || '00000000402b5328')
};
