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
  desc: 'Ванильный Minecraft, но красивее и плавнее: оптимизация, анимации, частицы, звуки и шейдеры.',
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
  shaders: [
    it('Photon', ['photon-shader', 'photon'], undefined, ['realistic shaders', 'shaders']),
    it('Astral Core', [], 'Astral Core')
  ]
};

const BUILDS = [VANILLA_SA];
const info = b => ({ id: b.id, icon: b.icon || '', name: b.name, loader: b.loader, desc: b.desc, mods: b.mods.map(x => x.n), resourcepacks: b.resourcepacks.map(x => x.n), shaders: b.shaders.map(x => x.n) });
module.exports = { BUILDS, info };
