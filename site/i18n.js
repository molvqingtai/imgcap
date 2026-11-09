/**
 * Tiny message catalogue: en, zh, ja.
 *
 * Priority for the first visit: stored choice, then the browser's languages,
 * then English. Switching rewrites every [data-i18n] node and calls back so
 * the app can rebuild the text it generates itself.
 */

const STORAGE_KEY = 'imgcap.lang.v1'

const LANG_TAGS = { en: 'en', zh: 'zh-CN', ja: 'ja' }

const DICT = {
  en: {
    title: 'ImgCap — image compressor',
    skip: 'Skip to the file picker',
    note: 'Image compressor',
    github: 'Source on GitHub',
    lang: 'Language',
    settings: 'Compression settings',
    target: 'Target size',
    unit: 'Unit',
    presets: 'Presets',
    presetNone: 'None',
    format: 'Format',
    formatAuto: 'Auto',
    reset: 'Reset settings',
    add: 'Add images',
    queue: 'Queue',
    dropAria: 'Add images. Drop files, browse, or paste from the clipboard.',
    dropTitle: 'Drop images here',
    dropBrowse: 'Browse files',
    dropPaste: 'paste with',
    upTo: 'up to 80 files',
    foot: 'Everything runs locally in your browser — images are never uploaded.',
    dragDrop: 'Drop to compress',
    cmpSub: 'Drag the divider to compare',
    close: 'Close',
    original: 'Original',
    compressed: 'Compressed',
    reveal: 'Reveal compressed image',
    download: 'Download',
    clear: 'Clear the queue',
    rowDownload: 'Download',
    rowRetry: 'Try again',
    rowRemove: 'Remove',
    queued: 'Queued',
    working: 'Working',
    done: 'Done',
    outdated: 'Outdated',
    failed: 'Failed',
    noscript: 'ImgCap needs JavaScript to compress images on your device.',
    empty: 'No images yet',
    countBase: ({ n, done, total, complete }) =>
      complete ? `${n} ${n === 1 ? 'image' : 'images'}` : `${done}/${total}`,
    countWord: ({ done, complete }) => (complete ? ` · ${done} compressed` : ' compressed'),
    running: ({ n }) => ` · ${n} running`,
    failedCount: ({ n }) => ` · ${n} failed`,
    withinTarget: '· within target',
    couldNotRead: ({ n }) => `${n} could not be read`,
    waiting: 'Waiting for the first pass',
    reapply: 'Re-apply',
    reapplyTo: ({ n }) => `Re-apply to ${n}`,
    downloadAll: 'Download all',
    packing: ({ done, total }) => `Packing ${done}/${total}`,
    tooMany: 'Only 80 images can be queued at once. Add the rest after clearing.',
    duplicates: ({ n }) => `${n} duplicate${n > 1 ? 's' : ''} skipped.`,
    rejected: ({ n }) => `${n} file${n > 1 ? 's' : ''} could not be queued.`,
    reapplyFirst: 'Re-apply the current settings before downloading.',
    packed: ({ n, suffix }) => `Packed ${n} image${n > 1 ? 's' : ''} into one ZIP${suffix}.`,
    packedSuffix: ({ n }) => ` (${n} awaiting re-apply)`,
    zipFailed: ({ msg }) => `Could not build the ZIP: ${msg}`,
    metaFrom: ({ w, h }) => `from ${w}×${h}`,
    kept: 'kept',
    errUnsupported: 'Unsupported format — use JPG, PNG, WebP or AVIF.',
    errEmpty: 'This file is empty.',
    errTooLarge: 'Larger than 200 MB.',
    errFailed: 'Compression failed.',
    statOriginal: 'Original',
    statOutput: 'Output',
    statSaved: 'Saved',
    statDimensions: 'Dimensions',
    statResolution: 'Resolution',
    statFormat: 'Format',
    statTarget: 'Target',
    savedDown: ({ size, delta }) => `−${size} · ${delta}`,
    savedUp: ({ size, delta }) => `+${size} · ${delta}`,
    savedNone: 'none'
  },
  zh: {
    title: 'ImgCap — 图片压缩',
    skip: '跳到文件选择',
    note: '图片压缩',
    github: 'GitHub 源码',
    lang: '语言',
    settings: '压缩设置',
    target: '目标体积',
    unit: '单位',
    presets: '预设',
    presetNone: '无',
    format: '格式',
    formatAuto: '自动',
    reset: '重置设置',
    add: '添加图片',
    queue: '队列',
    dropAria: '添加图片。可以拖入文件、选择文件，或从剪贴板粘贴。',
    dropTitle: '把图片拖到这里',
    dropBrowse: '选择文件',
    dropPaste: '粘贴',
    upTo: '· 最多 80 个文件',
    foot: '一切都在浏览器本地完成 — 图片不会上传。',
    dragDrop: '松开即可压缩',
    cmpSub: '拖动分割线对比',
    close: '关闭',
    original: '原图',
    compressed: '压缩后',
    reveal: '拖动查看压缩后图片',
    download: '下载',
    clear: '清空队列',
    rowDownload: '下载',
    rowRetry: '重试',
    rowRemove: '移除',
    queued: '排队中',
    working: '处理中',
    done: '完成',
    outdated: '待更新',
    failed: '失败',
    noscript: '需要启用 JavaScript 才能在本地压缩图片。',
    empty: '还没有图片',
    countBase: ({ n, done, total, complete }) => (complete ? `${n} 张图片` : `${done}/${total}`),
    countWord: ({ done, complete }) => (complete ? ` · ${done} 已压缩` : ' 已压缩'),
    running: ({ n }) => ` · ${n} 个处理中`,
    failedCount: ({ n }) => ` · ${n} 个失败`,
    withinTarget: '· 已在目标内',
    couldNotRead: ({ n }) => `${n} 个无法读取`,
    waiting: '等待首次压缩',
    reapply: '重新应用',
    reapplyTo: ({ n }) => `重新应用到 ${n}`,
    downloadAll: '全部下载',
    packing: ({ done, total }) => `打包 ${done}/${total}`,
    tooMany: '一次最多排队 80 张图片，清空后再添加其余的。',
    duplicates: ({ n }) => `已跳过 ${n} 个重复文件。`,
    rejected: ({ n }) => `${n} 个文件无法加入队列。`,
    reapplyFirst: '下载前请先按当前设置重新应用。',
    packed: ({ n, suffix }) => `已把 ${n} 张图片打包为一个 ZIP${suffix}。`,
    packedSuffix: ({ n }) => `（${n} 个待重新应用）`,
    zipFailed: ({ msg }) => `无法生成 ZIP：${msg}`,
    metaFrom: ({ w, h }) => `原 ${w}×${h}`,
    kept: '保留',
    errUnsupported: '不支持的格式 — 请使用 JPG、PNG、WebP 或 AVIF。',
    errEmpty: '这个文件是空的。',
    errTooLarge: '超过 200 MB。',
    errFailed: '压缩失败。',
    statOriginal: '原图',
    statOutput: '输出',
    statSaved: '节省',
    statDimensions: '尺寸',
    statResolution: '分辨率',
    statFormat: '格式',
    statTarget: '目标',
    savedDown: ({ size, delta }) => `−${size} · ${delta}`,
    savedUp: ({ size, delta }) => `+${size} · ${delta}`,
    savedNone: '无'
  },
  ja: {
    title: 'ImgCap — 画像圧縮',
    skip: 'ファイル選択へスキップ',
    note: '画像圧縮',
    github: 'GitHub のソース',
    lang: '言語',
    settings: '圧縮設定',
    target: '目標サイズ',
    unit: '単位',
    presets: 'プリセット',
    presetNone: 'なし',
    format: '形式',
    formatAuto: '自動',
    reset: '設定をリセット',
    add: '画像を追加',
    queue: 'キュー',
    dropAria: '画像を追加します。ドロップ、ファイル選択、貼り付けが使えます。',
    dropTitle: 'ここに画像をドロップ',
    dropBrowse: 'ファイルを選ぶ',
    dropPaste: '貼り付け',
    upTo: '· 最大 80 ファイル',
    foot: 'すべてブラウザ内で完結します — 画像はアップロードされません。',
    dragDrop: 'ドロップで圧縮',
    cmpSub: 'スライダーをドラッグして比較',
    close: '閉じる',
    original: '元画像',
    compressed: '圧縮後',
    reveal: '圧縮後の画像を表示',
    download: 'ダウンロード',
    clear: 'キューを空にする',
    rowDownload: 'ダウンロード',
    rowRetry: '再試行',
    rowRemove: '削除',
    queued: '待機中',
    working: '処理中',
    done: '完了',
    outdated: '要更新',
    failed: '失敗',
    noscript: '画像を端末内で圧縮するには JavaScript が必要です。',
    empty: 'まだ画像がありません',
    countBase: ({ n, done, total, complete }) => (complete ? `${n} 枚` : `${done}/${total}`),
    countWord: ({ done, complete }) => (complete ? ` · ${done} 圧縮済み` : ' 圧縮済み'),
    running: ({ n }) => ` · ${n} 件処理中`,
    failedCount: ({ n }) => ` · ${n} 件失敗`,
    withinTarget: '· 目標内',
    couldNotRead: ({ n }) => `${n} 件を読み込めません`,
    waiting: '最初の圧縮を待機中',
    reapply: '再適用',
    reapplyTo: ({ n }) => `${n} 件に再適用`,
    downloadAll: 'すべてダウンロード',
    packing: ({ done, total }) => `まとめ中 ${done}/${total}`,
    tooMany: '一度に並べられるのは 80 枚までです。空にしてから追加してください。',
    duplicates: ({ n }) => `${n} 件の重複をスキップしました。`,
    rejected: ({ n }) => `${n} 件をキューに追加できませんでした。`,
    reapplyFirst: 'ダウンロード前に現在の設定を再適用してください。',
    packed: ({ n, suffix }) => `${n} 枚を 1 つの ZIP にまとめました${suffix}。`,
    packedSuffix: ({ n }) => `（${n} 件が再適用待ち）`,
    zipFailed: ({ msg }) => `ZIP を作成できませんでした：${msg}`,
    metaFrom: ({ w, h }) => `元 ${w}×${h}`,
    kept: '保持',
    errUnsupported: '未対応の形式です — JPG・PNG・WebP・AVIF をご利用ください。',
    errEmpty: 'このファイルは空です。',
    errTooLarge: '200 MB を超えています。',
    errFailed: '圧縮に失敗しました。',
    statOriginal: '元画像',
    statOutput: '出力',
    statSaved: '削減',
    statDimensions: '寸法',
    statResolution: '解像度',
    statFormat: '形式',
    statTarget: '目標',
    savedDown: ({ size, delta }) => `−${size} · ${delta}`,
    savedUp: ({ size, delta }) => `+${size} · ${delta}`,
    savedNone: 'なし'
  }
}

const listeners = new Set()
let current = 'en'

export function isSupported(lang) {
  return Object.prototype.hasOwnProperty.call(DICT, lang)
}

/** Stored choice, else the browser's preference, else English. */
export function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isSupported(stored)) return stored

  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const lower = String(tag || '').toLowerCase()
    if (lower.startsWith('zh')) return 'zh'
    if (lower.startsWith('ja')) return 'ja'
    if (lower.startsWith('en')) return 'en'
  }
  return 'en'
}

export function getLang() {
  return current
}

export function t(key, vars) {
  const table = DICT[current] || DICT.en
  const value = table[key] ?? DICT.en[key] ?? key
  return typeof value === 'function' ? value(vars || {}) : value
}

/** Rewrites text, title and aria-label for every annotated node. */
export function translateDom(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n)
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle)
  }
  for (const node of root.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria))
  }
  for (const node of root.querySelectorAll('[data-i18n-alt]')) {
    node.setAttribute('alt', t(node.dataset.i18nAlt))
  }
  document.title = t('title')
}

export function setLang(lang, { persist = true } = {}) {
  current = isSupported(lang) ? lang : 'en'
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, current)
    } catch {
      /* private mode */
    }
  }
  document.documentElement.lang = LANG_TAGS[current]
  translateDom()
  for (const listener of listeners) listener(current)
}

export function onLangChange(listener) {
  listeners.add(listener)
}

export function initLang() {
  setLang(detectLang(), { persist: false })
  return current
}