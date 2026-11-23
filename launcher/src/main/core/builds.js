'use strict';
// «Сборки SA» — готовые наборы: загрузчик + моды + ресурспаки + шейдеры.
// Названия записаны по-человечески. Лаунчер находит проект на Modrinth так:
//   1) пробует точные slug'и из `s` (если есть);
//   2) иначе ищет по названию `n` (или по `q`) среди проектов нужного типа, версии и загрузчика
//      и берёт результат, только если название действительно похоже (см. similar в instances.js).
// Если проекта нет под выбранную версию Minecraft — ищется похожий по `alt` (показывается в отчёте как «замена»); если и его нет — пропускается.
// alt — запросы «по смыслу» (что делает мод): если самого проекта под выбранную версию нет, лаунчер поставит похожий
const it = (n, s, q, alt) => ({ n, s: s || [], q: q || n, alt: alt || [] });

const VANILLA_SA = {
  id: 'vanilla-sa',
  name: 'Vanilla SA',
  // Картинка сборки: файл лежит в renderer/builds/. Чтобы сменить — положите другой файл и поменяйте имя здесь
  // (или нажмите «Сменить картинку» в окне сборки внутри лаунчера — выбранная картинка важнее этой).
  icon: 'vanilla-sa.jpg',
  loader: 'fabric',
  descEn: 'Vanilla Minecraft, but prettier and smoother: performance, animations, particles, sounds and shaders. Versions from the latest down to 1.16.5: mods are matched and replaced automatically.',
  desc: 'Ванильный Minecraft, но красивее и плавнее: оптимизация, анимации, частицы, звуки и шейдеры. Версии от актуальной до 1.16.5: моды подбираются и заменяются под версию автоматически.',
  // Без этих проектов сборка бессмысленна: по ним лаунчер выбирает версию Minecraft в режиме «Авто»
  core: ['fabric-api', 'sodium', 'iris'],
  mods: [
    it('Iris Shaders', ['iris']),
    it('Smooth Scrolling', ['smooth-scrolling', 'smoothscrollingrefabricated'], undefined, ["smooth scrolling"]),
    it('Sounds', ['sounds'], undefined, ["ambient sounds", "immersive sounds"]),
    it('Smooth Swapping', ['smooth-swapping'], undefined, ["smooth item swapping"]),
    it('Client Sort', ['client-sort', 'clientsort'], undefined, ["inventory sorting", "sort inventory"]),
    it('Mouse Tweaks', ['mouse-tweaks'], undefined, ["inventory mouse tweaks", "inventory tweaks"]),
    it('AppleSkin', ['appleskin'], undefined, ["hunger saturation tooltip", "food values"]),
    it('Smooth GUI', ['smooth-gui', 'smoothgui'], undefined, ["smooth gui", "gui animations"]),
    it('Blur+', ['blur-plus', 'blur-fabric'], 'Blur+', ['gui blur background']),
    it('Inventory Particles', ['inventory-particles'], undefined, ["inventory particles"]),
    it('Click+', ['click-plus', 'clickplus'], 'Click+', ['click animation gui']),
    it('OkZoom', ['okzoom'], undefined, ["zoom"]),
    it('Durability Tooltip', ['durability-tooltip'], undefined, ["durability tooltip"]),
    it('Stack Refill', ['stack-refill'], undefined, ["refill hotbar stack", "auto refill"]),
    it('Shoulder Surfing Reloaded', ['shoulder-surfing-reloaded'], undefined, ["over the shoulder camera", "third person camera"]),
    it('Picture Mode', ['picture-mode'], undefined, ["hide hud screenshot"]),
    it('Better Screenshot', ['better-mc-screenshot', 'better-screenshot'], 'Better Screenshot', ['screenshot']),
    it('Pool Rain', ['pool-rain', 'poolrain'], undefined, ["rain puddles", "rain ripples"]),
    it('Presence Footsteps', ['presence-footsteps'], undefined, ["footsteps sounds"]),
    it('Particular Reforged', ['particular', 'particular-reforged'], 'Particular', ['waterfall particles']),
    it('Subtle Effects', ['subtle-effects'], undefined, ["subtle effects particles", "ambient particles"]),
    it('Particle Interactions', ['particle-interactions'], undefined, ["particle interactions"]),
    it('Explosive Enhancement', ['explosive-enhancement'], undefined, ["explosion particles"]),
    it('Punchy!', ['punchy'], 'Punchy', ['hit damage effects']),
    it('Sound Physics Remastered', ['sound-physics-remastered'], undefined, ["sound physics reverb"]),
    it('Visuality', ['visuality'], undefined, ["visual effects particles"]),
    it('Atmospheric', ['atmospherics', 'atmospheric'], 'Atmospheric', ['atmosphere ambience']),
    it('Shine', ['shine'], undefined, ["shine glint"]),
    it('Particle Rain', ['particle-rain'], undefined, ["rain particles"]),
    it('Particle Effects', ['particle-effects'], undefined, ["particle effects"]),
    // нужны для Fresh Animations
    it('Entity Model Features', ['entity-model-features']),
    it('Entity Texture Features', ['entitytexturefeatures', 'entity-texture-features'])
  ],
  // порядок = порядок включения в игре (нижний в списке — сверху по приоритету)
  resourcepacks: [
    it('Icons', [], 'Icons'),
    it('Low Fire', ['low-fire'], undefined, ["low fire"]),
    it('Low Shield', ['low-shield'], undefined, ["low shield"]),
    it('Recolourful Containers', ['recolourful-containers'], undefined, ["recolor containers gui"]),
    it('Player Extension', ['player-extension'], undefined, ["player animations"]),
    it('Fresh Animations', ['fresh-animations'], undefined, ["mob animations"]),
    it('Simple Grass Flowers', [], 'Simple Grass', ['grass flowers']),
    it("Weskerson's Nature", [], 'Weskerson Nature'),
    it('Enchantment Outline', ['enchantment-outline'], undefined, ["enchantment outline", "enchanted glint"]),
    it('3D Crops Revamped', ['3d-crops-revamped'], undefined, ["3d crops"]),
    it("Drigo's 3D Lanterns", [], 'Drigo 3D', ['3d lanterns']),
    it('Glowing 3D Totem', ['glowing-3d-totem'], undefined, ["3d totem"]),
    it('3D Potions', [], '3D Potions', ['3d potions']),
    it('Fresh End Crystal', ['fresh-end-crystal'], undefined, ["end crystal"]),
    it('Fresh Flowers and Plants', [], 'Fresh Flower Plants', ['flowers plants']),
    it('Refined Buckets', [], 'Refine Buckets')
  ],
  // Шейдеры: включается первый из списка, который подходит именно под выбранную версию Minecraft; остальные просто лежат в папке shaderpacks.
  // Сначала универсальные (работают и на старых версиях, и с Iris, и с OptiFine), потом тяжёлые и «лёгкие для слабых ПК».
  shaders: [
    it('Complementary Reimagined', ['complementary-reimagined'], undefined, ['complementary shaders', 'shaders']),
    it('Complementary Unbound', ['complementary-unbound']),
    it('BSL Shaders', ['bsl-shaders'], 'BSL Shaders'),
    it('Photon', ['photon-shader', 'photon'], undefined, ['realistic shaders', 'shaders']),
    it('Rethinking Voxels', ['rethinking-voxels']),
    it('Solas Shader', ['solas-shader'], 'Solas Shader'),
    it('Bliss Shaders', ['bliss-shader', 'bliss-shaders'], 'Bliss Shader'),
    it('Sildur\'s Vibrant Shaders', ['sildurs-vibrant-shaders'], 'Sildurs Vibrant'),
    it('Sildur\'s Enhanced Default', ['sildurs-enhanced-default'], 'Sildurs Enhanced Default'),
    it('MakeUp - Ultra Fast', ['makeup-ultra-fast-shaders'], 'MakeUp Ultra Fast'),
    it('Miniature Shader', ['miniature-shader'], 'Miniature Shader'),
    it('Nostalgia Shader', ['nostalgia-shader'], 'Nostalgia Shader'),
    it('Kappa Shader', ['kappa-shader'], 'Kappa Shader'),
    it('Astral Core', [], 'Astral Core')
  ]
};

// ---------- общие наборы ----------
// Оптимизация: лаунчер ещё и сам добавляет набор из OPT_MODS и подбирает запасные моды для старых версий (см. smart.js)
// Любимый шейдер: есть во всех сборках, кроме PvP SA (там шейдеров нет вообще)
const ASTRAL = it('Astral Core', [], 'Astral Core');
const PERF = [
  it('Sodium', ['sodium']), it('Lithium', ['lithium']), it('FerriteCore', ['ferrite-core'], 'FerriteCore'), it('ModernFix', ['modernfix']),
  it('ImmediatelyFast', ['immediatelyfast']), it('Entity Culling', ['entityculling'], 'Entity Culling'),
  it('More Culling', ['moreculling', 'more-culling'], 'More Culling', ['culling optimization']),
  it('Sodium Extra', ['sodium-extra']), it("Reese's Sodium Options", ['reeses-sodium-options'], "Reese's Sodium Options"),
  it('Dynamic FPS', ['dynamic-fps'], 'Dynamic FPS', ['fps when unfocused'])
];
const MENU = [it('Mod Menu', ['modmenu'], 'Mod Menu'), it('Cloth Config API', ['cloth-config'], 'Cloth Config')];

// ---------- SA PvP: максимум FPS и отклик, полезные индикаторы, ничего лишнего ----------
const PVP_SA = {
  id: 'pvp-sa', name: 'PvP SA', icon: '', loader: 'fabric', autoShader: false,
  desc: 'Для PvP и мини-игр: максимум FPS без лагов, индикаторы (клавиши, CPS, броня, эффекты), приближение и низкий огонь.',
  descEn: 'For PvP and minigames: maximum FPS, key/CPS/armor/effect HUDs, zoom and low fire.',
  core: ['fabric-api', 'sodium'],
  // Игровые настройки, которые сборка выставляет при создании (только то, что даёт FPS и чистый обзор)
  opts: { maxFps: 260, enableVsync: false, viewBobbing: false, entityShadows: false, fancyGraphics: false, graphicsMode: 0, renderDistance: 10, simulationDistance: 8, particles: 2, mipmapLevels: 2, biomeBlendRadius: 1, attackIndicator: 1 },
  mods: [...PERF, ...MENU,
    it('Keystrokes', [], 'Keystrokes', ['keystrokes display', 'keys hud']),
    it('CPS Counter', [], 'CPS', ['cps counter', 'clicks per second']),
    it('Armor Status HUD', [], 'Armor HUD', ['armor status hud', 'armor durability hud']),
    it('Potion Effects HUD', [], 'Status Effect', ['status effect hud', 'potion effects display']),
    it('Toggle Sprint', [], 'Toggle Sprint', ['toggle sprint', 'toggle sneak']),
    it('Zoomify', ['zoomify'], 'Zoomify', ['zoom']),
    it('Freelook', [], 'Freelook', ['free look camera', 'perspective']),
    it('Damage Tint', [], 'Damage Tint', ['hit color', 'damage tint']),
    it('Coordinates HUD', [], 'Coordinates', ['coordinates hud', 'xyz hud']),
    it('No Chat Reports', ['no-chat-reports'], 'No Chat Reports'),
    it('Fast Quit', ['fastquit'], 'FastQuit', ['fast world exit']),
    it('Replay Mod', ['replaymod'], 'Replay Mod', ['record gameplay'])
  ],
  resourcepacks: [
    it('Low Fire', ['low-fire'], undefined, ['low fire']), it('Low Shield', ['low-shield'], undefined, ['low shield']),
    it('Short Swords', [], 'Short Swords', ['short swords', 'smaller swords']),
    it('Bare Bones', ['bare-bones'], 'Bare Bones', ['minimal textures'])
  ],
  shaders: []
};

// ---------- SA Servers: игра на серверах (Hypixel и др.): удобство без читерских функций ----------
const SERVERS_SA = {
  id: 'servers-sa', name: 'Servers SA', icon: '', loader: 'fabric',
  desc: 'Для игры на серверах: оптимизация, карта, подсказки о блоках, удобный инвентарь, чат с головами, пинг и защита чата. Без модов, которые на серверах считаются читами.',
  descEn: 'For playing on servers: performance, minimap, block info, inventory tweaks, chat heads, ping and chat privacy. No mods that servers treat as cheats.',
  core: ['fabric-api', 'sodium'],
  mods: [...PERF, ...MENU,
    it('No Chat Reports', ['no-chat-reports'], 'No Chat Reports'),
    it("Xaero's Minimap", ['xaeros-minimap'], "Xaero's Minimap", ['minimap']),
    it("Xaero's World Map", ['xaeros-world-map'], "Xaero's World Map", ['world map']),
    it('Jade', ['jade'], 'Jade', ['block info tooltip', 'what am i looking at']),
    it('AppleSkin', ['appleskin']), it('Mouse Tweaks', ['mouse-tweaks']),
    it('Inventory Profiles Next', ['inventory-profiles-next'], 'Inventory Profiles Next', ['inventory sorting', 'sort inventory']),
    it('EMI', ['emi'], 'EMI', ['recipe viewer', 'roughly enough items']),
    it('Chat Heads', ['chat-heads'], 'Chat Heads', ['player heads in chat']),
    it('Ping Wheel', ['ping-wheel'], 'Ping Wheel', ['ping wheel']),
    it('Better Ping Display', [], 'Better Ping Display', ['ping display tab list', 'ping numbers']),
    it('Shulker Box Tooltip', ['shulkerboxtooltip'], 'Shulker Box Tooltip', ['shulker preview']),
    it('Skin Layers 3D', ['skinlayers3d'], 'Skin Layers 3D', ['3d skin layers']),
    it('Wavey Capes', ['wavey-capes'], 'Wavey Capes', ['cape physics']),
    it('Sound Physics Remastered', ['sound-physics-remastered']), it('Zoomify', ['zoomify'], 'Zoomify', ['zoom']),
    it('Iris Shaders', ['iris'], 'Iris Shaders')
  ],
  resourcepacks: [
    it('Low Fire', ['low-fire'], undefined, ['low fire']), it('Low Shield', ['low-shield'], undefined, ['low shield']),
    it('Fresh Animations', ['fresh-animations'], undefined, ['mob animations'])
  ],
  shaders: [it('Complementary Reimagined', ['complementary-reimagined'], undefined, ['shaders']), it('MakeUp - Ultra Fast', ['makeup-ultra-fast-shaders'], 'MakeUp Ultra Fast'), ASTRAL]
};

// ---------- SA Explorer: одиночная игра, выживание, путешествия ----------
const EXPLORER_SA = {
  id: 'explorer-sa', name: 'Explorer SA', icon: '', loader: 'fabric',
  desc: 'Для выживания и путешествий: карта и дальняя прорисовка, шейдеры, подсказки о блоках, живая природа и звуки, плавный интерфейс.',
  descEn: 'For survival and exploration: map and distant terrain, shaders, block info, living nature and sound, smooth UI.',
  core: ['fabric-api', 'sodium', 'iris'],
  mods: [...PERF, ...MENU, it('Iris Shaders', ['iris']),
    it('Distant Horizons', ['distanthorizons'], 'Distant Horizons', ['distant terrain lod', 'render distance lod']),
    it("Xaero's Minimap", ['xaeros-minimap'], "Xaero's Minimap", ['minimap']), it("Xaero's World Map", ['xaeros-world-map'], "Xaero's World Map", ['world map']),
    it('Jade', ['jade'], 'Jade', ['block info tooltip']), it('AppleSkin', ['appleskin']), it('Mouse Tweaks', ['mouse-tweaks']),
    it('Inventory Profiles Next', ['inventory-profiles-next'], 'Inventory Profiles Next', ['inventory sorting']),
    it('Continuity', ['continuity'], 'Continuity', ['connected textures']),
    it('LambDynamicLights', ['lambdynamiclights'], 'LambDynamicLights', ['dynamic lights']),
    it('Falling Leaves', ['fallingleaves', 'falling-leaves'], 'Falling Leaves', ['falling leaves particles']),
    it('Presence Footsteps', ['presence-footsteps'], undefined, ['footsteps sounds']), it('Sound Physics Remastered', ['sound-physics-remastered']),
    it('Not Enough Animations', ['not-enough-animations'], 'Not Enough Animations', ['player animations']),
    it('Eating Animation', ['eating-animation'], 'Eating Animation', ['eating animation']),
    it('Smooth Scrolling', ['smooth-scrolling', 'smoothscrollingrefabricated'], undefined, ['smooth scrolling']),
    it('Entity Model Features', ['entity-model-features']), it('Entity Texture Features', ['entitytexturefeatures', 'entity-texture-features']),
    it('Chunky', ['chunky'], 'Chunky', ['pregenerate chunks'])
  ],
  resourcepacks: [
    it('Fresh Animations', ['fresh-animations'], undefined, ['mob animations']), it('Simple Grass Flowers', [], 'Simple Grass', ['grass flowers']),
    it("Weskerson's Nature", [], 'Weskerson Nature'), it('3D Crops Revamped', ['3d-crops-revamped'], undefined, ['3d crops']),
    it('Enchantment Outline', ['enchantment-outline'], undefined, ['enchantment outline']), it('Fresh Flowers and Plants', [], 'Fresh Flower Plants', ['flowers plants'])
  ],
  shaders: [
    it('Complementary Reimagined', ['complementary-reimagined'], undefined, ['shaders']), it('BSL Shaders', ['bsl-shaders'], 'BSL Shaders'),
    it('Photon', ['photon-shader', 'photon']), it('Rethinking Voxels', ['rethinking-voxels']), it("Sildur's Vibrant Shaders", ['sildurs-vibrant-shaders'], 'Sildurs Vibrant'), ASTRAL
  ]
};

// ---------- SA Lite: слабые ПК и ноутбуки ----------
const LITE_SA = {
  id: 'lite-sa', name: 'Lite SA', icon: '', loader: 'fabric', autoShader: false,
  desc: 'Для слабых ПК и ноутбуков: всё, что убирает лаги и подвисания, и пара лёгких шейдеров на случай, если запас по FPS есть (по умолчанию выключены).',
  descEn: 'For weak PCs and laptops: everything that removes lag and stutter, plus a couple of light shaders for when you have spare FPS (off by default).',
  core: ['fabric-api', 'sodium'],
  opts: { renderDistance: 6, simulationDistance: 5, fancyGraphics: false, graphicsMode: 0, particles: 2, entityShadows: false, biomeBlendRadius: 0, mipmapLevels: 0, viewBobbing: false },
  mods: [...PERF, ...MENU,
    it('Starlight', ['starlight'], 'Starlight', ['lighting engine']), it('Krypton', ['krypton'], 'Krypton', ['network optimization']),
    it('LazyDFU', ['lazydfu'], 'LazyDFU', ['faster startup']), it('Smooth Boot', ['smoothboot', 'smooth-boot'], 'Smooth Boot', ['thread priority', 'smooth boot']),
    it('Cull Leaves', ['cull-leaves'], 'Cull Leaves', ['leaves culling']), it('Memory Leak Fix', ['memoryleakfix'], 'Memory Leak Fix', ['memory leak fix']),
    it('BadOptimizations', ['badoptimizations'], 'BadOptimizations', ['render optimization']),
    it('FastQuit', ['fastquit'], 'FastQuit', ['fast world exit']), it('Zoomify', ['zoomify'], 'Zoomify', ['zoom']),
    it('Iris Shaders', ['iris'], 'Iris Shaders')
  ],
  resourcepacks: [it('Low Fire', ['low-fire'], undefined, ['low fire']), it('Low Shield', ['low-shield'], undefined, ['low shield']), it('Bare Bones', ['bare-bones'], 'Bare Bones', ['minimal textures'])],
  shaders: [it("Sildur's Enhanced Default", ['sildurs-enhanced-default'], 'Sildurs Enhanced Default'), it('MakeUp - Ultra Fast', ['makeup-ultra-fast-shaders'], 'MakeUp Ultra Fast'), it('Complementary Reimagined', ['complementary-reimagined']), ASTRAL]
};

// ---------- SA Cinematic: красивые скриншоты и видео ----------
const CINEMATIC_SA = {
  id: 'cinematic-sa', name: 'Cinematic SA', icon: '', loader: 'fabric',
  desc: 'Для скриншотов и видео: тяжёлые шейдеры, дальняя прорисовка, анимации мобов и игрока, частицы, запись игры и свободная камера. Нужен мощный ПК.',
  descEn: 'For screenshots and video: heavy shaders, distant terrain, mob and player animations, particles, game recording and a free camera. Needs a strong PC.',
  core: ['fabric-api', 'sodium', 'iris'],
  mods: [...PERF, ...MENU, it('Iris Shaders', ['iris']),
    it('Distant Horizons', ['distanthorizons'], 'Distant Horizons', ['distant terrain lod']),
    it('Replay Mod', ['replaymod'], 'Replay Mod', ['record gameplay']),
    it('Freecam', [], 'Freecam', ['free camera', 'freecam']), it('Zoomify', ['zoomify'], 'Zoomify', ['zoom']),
    it('Better Screenshot', ['better-mc-screenshot', 'better-screenshot'], 'Better Screenshot', ['screenshot']),
    it('Picture Mode', ['picture-mode'], undefined, ['hide hud screenshot']),
    it('Entity Model Features', ['entity-model-features']), it('Entity Texture Features', ['entitytexturefeatures', 'entity-texture-features']),
    it('Not Enough Animations', ['not-enough-animations'], 'Not Enough Animations', ['player animations']),
    it('Eating Animation', ['eating-animation'], 'Eating Animation', ['eating animation']),
    it('Continuity', ['continuity'], 'Continuity', ['connected textures']), it('LambDynamicLights', ['lambdynamiclights'], 'LambDynamicLights', ['dynamic lights']),
    it('Falling Leaves', ['fallingleaves', 'falling-leaves'], 'Falling Leaves', ['falling leaves particles']),
    it('Particular Reforged', ['particular', 'particular-reforged'], 'Particular', ['waterfall particles']), it('Visuality', ['visuality'], undefined, ['visual effects particles']),
    it('Subtle Effects', ['subtle-effects'], undefined, ['subtle effects particles']), it('Pool Rain', ['pool-rain', 'poolrain'], undefined, ['rain puddles']),
    it('Sound Physics Remastered', ['sound-physics-remastered']), it('Skin Layers 3D', ['skinlayers3d'], 'Skin Layers 3D', ['3d skin layers']),
    it('Wavey Capes', ['wavey-capes'], 'Wavey Capes', ['cape physics'])
  ],
  resourcepacks: [
    it('Fresh Animations', ['fresh-animations'], undefined, ['mob animations']), it('Player Extension', ['player-extension'], undefined, ['player animations']),
    it('3D Crops Revamped', ['3d-crops-revamped'], undefined, ['3d crops']), it("Drigo's 3D Lanterns", [], 'Drigo 3D', ['3d lanterns']),
    it('Glowing 3D Totem', ['glowing-3d-totem'], undefined, ['3d totem']), it('3D Potions', [], '3D Potions', ['3d potions']),
    it('Fresh Flowers and Plants', [], 'Fresh Flower Plants', ['flowers plants']), it('Enchantment Outline', ['enchantment-outline'], undefined, ['enchantment outline'])
  ],
  shaders: [
    it('Complementary Unbound', ['complementary-unbound']), it('Photon', ['photon-shader', 'photon']), it('BSL Shaders', ['bsl-shaders'], 'BSL Shaders'),
    it('Rethinking Voxels', ['rethinking-voxels']), it('Solas Shader', ['solas-shader'], 'Solas Shader'), it('Bliss Shaders', ['bliss-shader', 'bliss-shaders'], 'Bliss Shader'),
    it('Complementary Reimagined', ['complementary-reimagined']), ASTRAL
  ]
};

const BUILDS = [VANILLA_SA, PVP_SA, SERVERS_SA, EXPLORER_SA, LITE_SA, CINEMATIC_SA];
const info = b => ({ id: b.id, icon: b.icon || '', name: b.name, loader: b.loader, desc: b.desc, descEn: b.descEn || b.desc, mods: b.mods.map(x => x.n), resourcepacks: b.resourcepacks.map(x => x.n), shaders: b.shaders.map(x => x.n) });
module.exports = { BUILDS, info };
