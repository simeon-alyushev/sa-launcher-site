'use strict';
// «Сборки SA» — готовые наборы: загрузчик + моды + ресурспаки + шейдеры.
// Названия записаны по-человечески. Лаунчер находит проект на Modrinth так:
//   1) пробует точные slug'и из `s` (если есть);
//   2) иначе ищет по названию `n` (или по `q`) среди проектов нужного типа, версии и загрузчика
//      и берёт результат, только если название действительно похоже (см. similar в instances.js).
// Если проекта нет под выбранную версию Minecraft — он пропускается и попадает в отчёт.
const it = (n, s, q) => ({ n, s: s || [], q: q || n });

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
    it('Smooth Scrolling', ['smooth-scrolling', 'smoothscrollingrefabricated']),
    it('Sounds', ['sounds']),
    it('Smooth Swapping', ['smooth-swapping']),
    it('Client Sort', ['client-sort', 'clientsort']),
    it('Mouse Tweaks', ['mouse-tweaks']),
    it('AppleSkin', ['appleskin']),
    it('Smooth GUI', ['smooth-gui', 'smoothgui']),
    it('Blur+', ['blur-plus', 'blur-fabric'], 'Blur+'),
    it('Inventory Particles', ['inventory-particles']),
    it('Click+', ['click-plus', 'clickplus'], 'Click+'),
    it('OkZoom', ['okzoom']),
    it('Durability Tooltip', ['durability-tooltip']),
    it('Stack Refill', ['stack-refill']),
    it('Shoulder Surfing Reloaded', ['shoulder-surfing-reloaded']),
    it('Picture Mode', ['picture-mode']),
    it('Better Screenshot', ['better-mc-screenshot', 'better-screenshot'], 'Better Screenshot'),
    it('Pool Rain', ['pool-rain', 'poolrain']),
    it('Presence Footsteps', ['presence-footsteps']),
    it('Particular Reforged', ['particular', 'particular-reforged'], 'Particular'),
    it('Subtle Effects', ['subtle-effects']),
    it('Particle Interactions', ['particle-interactions']),
    it('Explosive Enhancement', ['explosive-enhancement']),
    it('Punchy!', ['punchy'], 'Punchy'),
    it('Sound Physics Remastered', ['sound-physics-remastered']),
    it('Visuality', ['visuality']),
    it('Atmospheric', ['atmospherics', 'atmospheric'], 'Atmospheric'),
    it('Shine', ['shine']),
    it('Particle Rain', ['particle-rain']),
    it('Particle Effects', ['particle-effects']),
    // нужны для Fresh Animations
    it('Entity Model Features', ['entity-model-features']),
    it('Entity Texture Features', ['entitytexturefeatures', 'entity-texture-features'])
  ],
  // порядок = порядок включения в игре (нижний в списке — сверху по приоритету)
  resourcepacks: [
    it('Icons', [], 'Icons'),
    it('Low Fire', ['low-fire']),
    it('Low Shield', ['low-shield']),
    it('Recolourful Containers', ['recolourful-containers']),
    it('Player Extension', ['player-extension']),
    it('Fresh Animations', ['fresh-animations']),
    it('Simple Grass Flowers', [], 'Simple Grass'),
    it("Weskerson's Nature", [], 'Weskerson Nature'),
    it('Enchantment Outline', ['enchantment-outline']),
    it('3D Crops Revamped', ['3d-crops-revamped']),
    it("Drigo's 3D Lanterns", [], 'Drigo 3D'),
    it('Glowing 3D Totem', ['glowing-3d-totem']),
    it('3D Potions', [], '3D Potions'),
    it('Fresh End Crystal', ['fresh-end-crystal']),
    it('Fresh Flowers and Plants', [], 'Fresh Flower Plants'),
    it('Refined Buckets', [], 'Refine Buckets')
  ],
  shaders: [
    it('Photon', ['photon-shader', 'photon']),
    it('Astral Core', [], 'Astral Core')
  ]
};

const BUILDS = [VANILLA_SA];
const info = b => ({ id: b.id, icon: b.icon || '', name: b.name, loader: b.loader, desc: b.desc, mods: b.mods.map(x => x.n), resourcepacks: b.resourcepacks.map(x => x.n), shaders: b.shaders.map(x => x.n) });
module.exports = { BUILDS, info };
