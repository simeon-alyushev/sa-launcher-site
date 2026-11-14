'use strict';
// Адрес вашего сайта (где запущен server/server.js). Задаётся в launcher/package.json -> "saSite"
// (или переменной SA_SITE при разработке). Меняйте ДО сборки установщика.
const pkg = require('../../package.json');
module.exports = { siteUrl: String(process.env.SA_SITE || pkg.saSite || 'http://localhost:3000').replace(/\/$/, '') };
