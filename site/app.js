import { defineProxy } from './vendor/comctx.js'
import { outputName, SUPPORTED_TYPES } from './engine.js'
import { buildZip, sanitizeName, uniqueName } from './zip.js'
import { getLang, initLang, onLangChange, setLang, t, translateDom } from './i18n.js'

const NAMESPACE = 'imgcap:compress'
const MAX_FILES = 80
const MAX_BYTES = 200 * 1024 * 1024
const SETTINGS_KEY = 'imgcap.settings.v1'
const CONCURRENCY = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))

const $ = (selector) => document.querySelector(selector)

const el = {
  drop: $('#drop'),
  dropInner: $('#dropInner'),
  fileInput: $('#fileInput'),
  langBtn: $('#langBtn'),
  langMenu: $('#langMenu'),
  langCode: $('#langCode'),
  queue: $('#queue'),
  list: $('#list'),
  count: $('#count'),
  totals: $('#totals'),
  applyBtn: $('#applyBtn'),
  applyLabel: $('#applyLabel'),
  addBtn: $('#addBtn'),
  zipBtn: $('#zipBtn'),
  zipLabel: $('#zipLabel'),
  clearBtn: $('#clearBtn'),
  target: $('#target'),
  unitBtn: $('#unitBtn'),
  unitMenu: $('#unitMenu'),
  unitLabel: $('#unitLabel'),
  presets: $('#presets'),
  presetBtn: $('#presetBtn'),
  presetMenu: $('#presetMenu'),
  presetLabel: $('#presetLabel'),
  formatBtn: $('#formatBtn'),
  formatMenu: $('#formatMenu'),
  formatCode: $('#formatCode'),
  resetBtn: $('#resetBtn'),
  compareDlg: $('#compareDlg'),
  cmpName: $('#cmpName'),
  cmpA: $('#cmpA'),
  cmpB: $('#cmpB'),
  cmpStage: $('#cmpStage'),
  cmpRange: $('#cmpRange'),
  cmpStats: $('#cmpStats'),
  cmpDownload: $('#cmpDownload'),
  toasts: $('#toasts'),
  tpl: $('#rowTpl')
}

const defaults = { amount: 500, unit: 'KB', format: 'keep' }

const state = {
  items: [],
  running: 0,
  zipping: false,
  compare: null
}

let settings = loadSettings()
let seq = 0

/* ------------------------------------------------------------------ */
/* comctx: one proxy per worker                                        */
/* ------------------------------------------------------------------ */

class WorkerAdapter {
  constructor(target, name) {
    this.target = target
    this.name = name
  }

  sendMessage = (message, transfer) => {
    this.target.postMessage(message, transfer)
  }

  onMessage = (callback) => {
    const handler = (event) => callback(event.data)
    this.target.addEventListener('message', handler)
    return () => this.target.removeEventListener('message', handler)
  }
}

const [, inject] = defineProxy(
  () => ({
    async compress() {
      throw new Error('Not implemented on the page side.')
    }
  }),
  {
    namespace: NAMESPACE,
    heartbeatInterval: 250,
    /* A multi-megapixel encode blocks the worker's event loop, so the ping
       can go unanswered for far longer than a network timeout would allow. */
    heartbeatTimeout: 3 * 60 * 1000,
    transfer: true
  }
)

const pool = {
  entries: [],

  ensure() {
    if (this.entries.length) return
    for (let i = 0; i < CONCURRENCY; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
        name: `imgcap-${i}`
      })
      this.entries.push({ worker, proxy: inject(new WorkerAdapter(worker, 'imgcap-page')), busy: 0 })
    }
  },

  async compress(file, options) {
    this.ensure()
    const entry = this.entries.reduce((best, item) => (item.busy < best.busy ? item : best), this.entries[0])
    entry.busy++
    try {
      return await entry.proxy.compress(file, options)
    } finally {
      entry.busy--
    }
  }
}

/* ------------------------------------------------------------------ */
/* settings                                                           */
/* ------------------------------------------------------------------ */

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (!saved) return { ...defaults }
    return {
      amount: Number(saved.amount) > 0 ? Number(saved.amount) : defaults.amount,
      unit: saved.unit === 'MB' ? 'MB' : 'KB',
      format: ['keep', 'image/webp', 'image/jpeg', 'image/png', 'image/avif'].includes(saved.format)
        ? saved.format
        : 'keep'
    }
  } catch {
    return { ...defaults }
  }
}

function persist() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* private mode */
  }
}

const unitBytes = () => (settings.unit === 'MB' ? 1024 * 1024 : 1024)

const targetBytes = () => Math.max(1024, Math.round(Number(settings.amount || 0) * unitBytes()))

const signature = () => `${targetBytes()}|${settings.format}`

const currentOptions = () => ({ targetBytes: targetBytes(), format: settings.format })

function syncSettingsUI() {
  el.target.value = formatAmount(settings.amount)
  syncPickerLabels()
}

function syncPickerLabels() {
  langPicker.set(getLang())
  unitPicker.set(settings.unit)
  formatPicker.set(settings.format)
  syncPresets()
}

function formatAmount(value) {
  const number = Number(value) || 0
  if (settings.unit === 'MB') return String(Math.round(number * 1000) / 1000)
  return String(Math.round(number * 100) / 100)
}

function applyPreset(kb) {
  const asMb = kb >= 1024 && kb % 1024 === 0
  settings.unit = asMb ? 'MB' : 'KB'
  settings.amount = asMb ? kb / 1024 : kb
  el.target.value = formatAmount(settings.amount)
  persist()
  syncPickerLabels()
  markStale()
}

function syncPresets() {
  const bytes = targetBytes()
  for (const chip of el.presets.querySelectorAll('.chip')) {
    const kb = Number(chip.dataset.kb)
    chip.setAttribute('aria-pressed', bytes === kb * 1024 ? 'true' : 'false')
  }
  const match = [...el.presetMenu.children].find(
    (option) => option.dataset.value && Number(option.dataset.value) * 1024 === bytes
  )
  presetPicker.set(match ? match.dataset.value : '')
}

function markStale() {
  const current = signature()
  for (const item of state.items) {
    if (item.state !== 'done') continue
    const stale = item.resultSignature !== current
    if (item.stale !== stale) {
      item.stale = stale
      syncRow(item)
    }
  }
  chrome()
}

/* ------------------------------------------------------------------ */
/* items                                                              */
/* ------------------------------------------------------------------ */

function addFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return

  let duplicates = 0
  let overflow = 0
  let rejected = 0
  let added = 0
  const appended = []

  for (const file of files) {
    if (state.items.length >= MAX_FILES) {
      overflow++
      continue
    }

    const key = `${file.name}:${file.size}:${file.type}`
    if (state.items.some((item) => item.key === key)) {
      duplicates++
      continue
    }

    const type = file.type
    const item = {
      id: ++seq,
      key,
      file,
      name: file.name || `image-${seq}`,
      size: file.size,
      type,
      state: 'queued',
      result: null,
      resultSignature: '',
      error: '',
      stale: false,
      thumbUrl: '',
      outUrl: '',
      el: null,
      removed: false
    }

    if (!SUPPORTED_TYPES.includes(type)) {
      item.state = 'error'
      item.error = t('errUnsupported')
      rejected++
    } else if (file.size === 0) {
      item.state = 'error'
      item.error = t('errEmpty')
      rejected++
    } else if (file.size > MAX_BYTES) {
      item.state = 'error'
      item.error = t('errTooLarge')
      rejected++
    }

    state.items.push(item)
    appended.push(item)
    added++
  }

  if (overflow) toast(t('tooMany'), 'warn')
  if (duplicates) toast(t('duplicates', { n: duplicates }), 'info')
  if (rejected) toast(t('rejected', { n: rejected }), 'warn')
  if (!added) return

  withTransition(() => {
    for (const item of appended) appendRow(item)
    chrome()
  })

  for (const item of appended) makeThumb(item)
  pump()
}

/* Row names are only handed out while a transition runs: a named element is
   isolated into its own transition group, and doing that to every row of a
   long scrolling list costs the compositor on every frame. */
let activeTransition = null

function withTransition(mutate) {
  if (!document.startViewTransition) {
    mutate()
    return
  }

  const nameRows = () => {
    for (const node of el.list.children) {
      node.style.viewTransitionName = `item-${node.dataset.id}`
    }
  }

  nameRows()

  const transition = document.startViewTransition(() => {
    mutate()
    nameRows()
  })

  activeTransition = transition

  transition.finished
    .catch(() => {})
    .then(() => {
      if (activeTransition !== transition) return
      activeTransition = null
      for (const node of el.list.children) node.style.viewTransitionName = ''
    })
}

const THUMB_WIDTH = 96

/* Decoding a 12 megapixel photo to paint a 34px square is the single most
   expensive thing a long queue does, and it happens again every time a row
   scrolls into view. Render one small bitmap instead and keep the original
   file for the compare dialog. */
async function makeThumb(item) {
  if (!SUPPORTED_TYPES.includes(item.type)) return

  try {
    const bitmap = await createImageBitmap(item.file, { resizeWidth: THUMB_WIDTH, resizeQuality: 'low' })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    bitmap.close()

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
    if (item.removed) return
    item.thumbUrl = URL.createObjectURL(blob)
    syncRow(item)
  } catch {
    // Keep the placeholder. Pointing the <img> at a huge original is what
    // paints a broken-image icon while the browser chews on the decode.
  }
}

function appendRow(item) {
  const node = el.tpl.content.firstElementChild.cloneNode(true)
  item.el = node
  node.dataset.id = String(item.id)

  node.querySelector('.item__hit').addEventListener('click', () => openCompare(item))
  node.querySelector('[data-act="download"]').addEventListener('click', (event) => {
    event.stopPropagation()
    downloadItem(item)
  })
  node.querySelector('[data-act="retry"]').addEventListener('click', (event) => {
    event.stopPropagation()
    retryItem(item)
  })
  node.querySelector('[data-act="remove"]').addEventListener('click', (event) => {
    event.stopPropagation()
    removeItem(item)
  })

  const img = node.querySelector('.item__thumb img')
  img.addEventListener('load', () => img.classList.add('is-loaded'))
  img.addEventListener('error', () => {
    img.classList.remove('is-loaded')
    img.removeAttribute('src')
  })

  el.list.append(node)
  syncRow(item)
}

const STATUS_KEYS = {
  queued: 'queued',
  working: 'working',
  done: 'done',
  stale: 'outdated',
  error: 'failed'
}

function syncRow(item) {
  const node = item.el
  if (!node) return

  const state = item.state === 'done' && item.stale ? 'stale' : item.state
  node.dataset.state = state

  const status = node.querySelector('.item__status')
  status.dataset.state = state
  status.textContent = t(STATUS_KEYS[state])

  const img = node.querySelector('.item__thumb img')
  if (item.thumbUrl && img.getAttribute('src') !== item.thumbUrl) img.src = item.thumbUrl

  node.querySelector('.item__name').textContent = item.name

  const meta = node.querySelector('.item__meta')
  meta.replaceChildren(
    ...describe(item).map((part) => {
      const span = document.createElement('span')
      span.textContent = part.text
      if (part.className) span.className = part.className
      return span
    })
  )

  const from = node.querySelector('.item__from')
  const to = node.querySelector('.item__to')
  const delta = node.querySelector('.item__delta')

  delta.classList.remove('is-warn')
  node.querySelector('.item__arrow').hidden = item.state === 'error'
  if (item.state === 'done' && item.result) {
    const outSize = item.result.blob.size
    from.textContent = formatBytes(item.size)
    to.textContent = formatBytes(outSize)

    const percent = percentValue(item.size - outSize, item.size)
    if (item.result.keptOriginal) {
      // Nothing was re-encoded: the file already fits, so both sides match.
      delta.textContent = t('kept')
    } else {
      delta.textContent = percentLabel(percent)
      // A percent or two of drift is noise, not a warning.
      if (percent < -2) delta.classList.add('is-warn')
    }
  } else {
    from.textContent = formatBytes(item.size)
    to.textContent = ''
    delta.textContent = ''
  }

  const download = node.querySelector('[data-act="download"]')
  download.hidden = !item.result
  download.disabled = item.state === 'error'

  const retry = node.querySelector('[data-act="retry"]')
  retry.hidden = item.state !== 'error' || !canRetry(item)

  node.querySelector('.item__hit').disabled = item.state === 'error'
}

function describe(item) {
  if (item.state === 'error') return [{ text: item.error }]

  if (item.state === 'done' && item.result) {
    const result = item.result
    const resized = result.width !== result.originalWidth || result.height !== result.originalHeight
    const inputLabel = prettyType(item.type)
    const outputLabel = prettyType(result.type)
    const parts = [
      { text: `${result.width}×${result.height}` },
      { text: inputLabel === outputLabel ? outputLabel : `${inputLabel} → ${outputLabel}` }
    ]

    if (resized) {
      parts.push({
        text: t('metaFrom', { w: result.originalWidth, h: result.originalHeight }),
        className: 'meta-from'
      })
    }

    return parts
  }

  return [{ text: formatBytes(item.size) }, { text: prettyType(item.type) }]
}

function removeItem(item) {
  item.removed = true
  if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl)
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  item.thumbUrl = ''
  item.outUrl = ''

  const index = state.items.indexOf(item)
  if (index >= 0) state.items.splice(index, 1)

  if (state.compare === item) el.compareDlg.close()

  withTransition(() => {
    item.el?.remove()
    item.el = null
    chrome()
  })
}

function canRetry(item) {
  return SUPPORTED_TYPES.includes(item.type) && item.size > 0 && item.size <= MAX_BYTES
}

function retryItem(item) {
  item.state = 'queued'
  item.error = ''
  syncRow(item)
  chrome()
  pump()
}

function clearAll() {
  for (const item of state.items) {
    item.removed = true
    if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl)
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
  }
  state.items = []
  if (el.compareDlg.open) el.compareDlg.close()

  withTransition(() => {
    el.list.replaceChildren()
    chrome()
  })
}

/* ------------------------------------------------------------------ */
/* compression                                                        */
/* ------------------------------------------------------------------ */

function pump() {
  while (state.running < CONCURRENCY) {
    const next = state.items.find((item) => item.state === 'queued')
    if (!next) break
    runItem(next)
  }
}

async function runItem(item) {
  state.running++
  item.state = 'working'
  item.error = ''
  syncRow(item)
  chrome()

  const options = currentOptions()
  const stamp = signature()

  try {
    const result = await pool.compress(item.file, options)
    if (item.removed) return

    if (item.outUrl) URL.revokeObjectURL(item.outUrl)
    item.result = result
    item.resultSignature = stamp
    item.outUrl = URL.createObjectURL(result.blob)
    item.state = 'done'
    item.stale = false
  } catch (error) {
    if (item.removed) return
    item.state = 'error'
    item.error = error?.message || t('errFailed')
  } finally {
    state.running--
    if (!item.removed) {
      syncRow(item)
      chrome()
      pump()
    }
  }
}

function retryStale() {
  for (const item of state.items) {
    if (item.stale || (item.state === 'error' && canRetry(item))) {
      item.state = 'queued'
      item.error = ''
      item.stale = false
      syncRow(item)
    }
  }
  chrome()
  pump()
}

/* ------------------------------------------------------------------ */
/* downloads                                                          */
/* ------------------------------------------------------------------ */

const resultName = (item) => (item.result.keptOriginal ? item.name : outputName(item.name, item.result.type))

function downloadItem(item) {
  if (!item.result) return
  saveBlob(item.result.blob, resultName(item))
}

async function downloadAll() {
  const signatureNow = signature()
  const all = state.items.filter((item) => item.result)
  const ready = all.filter((item) => item.resultSignature === signatureNow)
  const skipped = all.length - ready.length
  if (!ready.length || state.zipping) {
    if (all.length) toast(t('reapplyFirst'), 'warn')
    return
  }

  state.zipping = true
  chrome()

  try {
    const used = new Set()
    const entries = ready.map((item) => ({
      name: uniqueName(sanitizeName(resultName(item)), used),
      blob: item.result.blob
    }))

    const zip = await buildZip(entries, (done, total) => {
      el.zipLabel.textContent = t('packing', { done, total })
    })

    saveBlob(zip, `imgcap-${stamp()}.zip`)
    const suffix = skipped ? t('packedSuffix', { n: skipped }) : ''
    toast(t('packed', { n: entries.length, suffix }))
  } catch (error) {
    toast(t('zipFailed', { msg: error?.message || 'unknown' }), 'error')
  } finally {
    state.zipping = false
    el.zipLabel.textContent = t('downloadAll')
    chrome()
  }
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

const stamp = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

/* ------------------------------------------------------------------ */
/* chrome                                                             */
/* ------------------------------------------------------------------ */

function chrome() {
  const items = state.items.length
  el.queue.dataset.empty = items ? 'false' : 'true'
  el.drop.hidden = items > 0
  el.list.hidden = items === 0

  if (!items) {
    el.count.textContent = t('empty')
    el.totals.replaceChildren()
    el.zipBtn.disabled = true
    el.clearBtn.disabled = true
    el.applyBtn.hidden = true
    return
  }

  const done = state.items.filter((item) => item.state === 'done')
  const stale = done.filter((item) => item.stale)
  const working = state.items.filter((item) => item.state === 'working').length
  const failed = state.items.filter((item) => item.state === 'error').length

  // "compressed" is the word that gives way first when the bar is narrow;
  // the running and failed counts stay.
  const complete = done.length === items
  const counts = `${working ? t('running', { n: working }) : ''}${failed ? t('failedCount', { n: failed }) : ''}`
  el.count.replaceChildren(
    textSpan(t('countBase', { n: items, done: done.length, total: items, complete })),
    textSpan(t('countWord', { done: done.length, complete }), 'count__word'),
    textSpan(counts)
  )

  const totalIn = done.reduce((sum, item) => sum + item.size, 0)
  const totalOut = done.reduce((sum, item) => sum + item.result.blob.size, 0)

  el.totals.replaceChildren()
  if (done.length && totalIn !== totalOut) {
    // A few re-encodes end up heavier than the file they replaced; the
    // totals have to say so instead of claiming a saving.
    const diff = totalIn - totalOut
    const percent = percentValue(diff, totalIn)
    el.totals.append(
      textSpan(formatBytes(totalIn)),
      textSpan('→', 'arrow'),
      textSpan(formatBytes(totalOut), 'total-out'),
      textSpan(`· ${percentLabel(percent)}`, diff > 0 ? 'saved' : 'larger')
    )
  } else if (done.length) {
    el.totals.append(textSpan(formatBytes(totalIn)), textSpan(t('withinTarget'), 'saved'))
  } else if (failed === items) {
    el.totals.append(textSpan(t('couldNotRead', { n: failed }), 'failed'))
  } else {
    el.totals.append(textSpan(t('waiting')))
  }

  el.zipBtn.disabled = !done.length || state.zipping
  el.clearBtn.disabled = state.zipping
  el.applyBtn.hidden = stale.length === 0
  el.applyLabel.textContent = t('reapplyTo', { n: stale.length })
}

function textSpan(text, className) {
  const span = document.createElement('span')
  span.textContent = text
  if (className) span.className = className
  return span
}

/* ------------------------------------------------------------------ */
/* compare dialog                                                     */
/* ------------------------------------------------------------------ */

function openCompare(item) {
  if (!item.result || !item.outUrl) return
  state.compare = item

  el.cmpName.textContent = item.name
  item.previewUrl ??= URL.createObjectURL(item.file)
  el.cmpA.src = item.previewUrl
  el.cmpB.src = item.outUrl
  el.cmpStage.style.setProperty('--pos', '50%')
  el.cmpRange.value = '50'
  el.cmpStats.replaceChildren(...compareStats(item))

  if (!el.compareDlg.open) el.compareDlg.showModal()
}

function compareStats(item) {
  const result = item.result
  const nodes = []
  const add = (label, value, tone) => {
    const wrap = document.createElement('div')
    wrap.className = 'stat'
    const dt = document.createElement('dt')
    dt.textContent = label
    const dd = document.createElement('dd')
    dd.textContent = value
    if (tone) dd.classList.add(tone)
    wrap.append(dt, dd)
    nodes.push(wrap)
  }

  const out = result.blob.size
  const saved = item.size - out
  const percent = Math.round(Math.abs(percentValue(saved, item.size)) * 100) / 100
  const resized = result.width !== result.originalWidth || result.height !== result.originalHeight

  add(t('statOriginal'), formatBytes(item.size))
  add(t('statOutput'), formatBytes(out))
  add(
    t('statSaved'),
    percent > 0
      ? t('savedDown', { size: formatBytes(saved), percent })
      : saved < 0
        ? t('savedUp', { size: formatBytes(-saved), percent: Math.abs(percent) })
        : t('savedNone'),
    percent > 0 ? 'good' : 'warn'
  )
  add(resized ? t('statDimensions') : t('statResolution'), `${result.width}×${result.height}`)
  add(
    t('statFormat'),
    prettyType(item.type) === prettyType(result.type)
      ? prettyType(result.type)
      : `${prettyType(item.type)} → ${prettyType(result.type)}`
  )
  add(t('statTarget'), formatBytes(result.targetBytes))

  return nodes
}

/* ------------------------------------------------------------------ */
/* toasts                                                             */
/* ------------------------------------------------------------------ */

function toast(message, tone = 'info', duration = 4600) {
  const node = document.createElement('div')
  node.className = `toast${tone === 'info' ? '' : ` toast--${tone}`}`
  node.textContent = message
  el.toasts.append(node)
  setTimeout(() => {
    node.style.transition = 'opacity 0.22s'
    node.style.opacity = '0'
    setTimeout(() => node.remove(), 240)
  }, duration)
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

// Percentages are shown with the precision they earn: hundredths while the
// change is a rounding error, integers once it means something, one decimal at
// the top of the scale where 99.8% would otherwise read as "−100%".
function percentValue(saved, original) {
  return original ? (saved / original) * 100 : 0
}

function percentLabel(value) {
  const abs = Math.abs(value)
  if (abs < 0.005) return '0%'
  const sign = value > 0 ? '−' : '+'
  if (abs < 1) return `${sign}${Math.round(abs * 100) / 100}%`
  if (abs < 99.5 || value < 0) return `${sign}${Math.round(abs)}%`
  return `${sign}${Math.min(99.9, Math.round(abs * 10) / 10)}%`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  const digits = value >= 100 || index === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[index]}`
}

function prettyType(type) {
  if (!type) return 'unknown'
  if (type === 'image/jpeg') return 'JPG'
  if (type === 'image/png') return 'PNG'
  if (type === 'image/webp') return 'WebP'
  if (type === 'image/avif') return 'AVIF'
  return type.replace('image/', '').toUpperCase()
}

/* ------------------------------------------------------------------ */
/* events                                                             */
/* ------------------------------------------------------------------ */

function bindSettings() {
  el.target.addEventListener('input', () => {
    const value = Number.parseFloat(el.target.value)
    settings.amount = Number.isFinite(value) && value > 0 ? value : 0
    persist()
    syncPresets()
    markStale()
  })

  el.target.addEventListener('blur', () => {
    const minimum = settings.unit === 'MB' ? 0.001 : 1
    if (!settings.amount || !(settings.amount >= minimum)) settings.amount = minimum
    el.target.value = formatAmount(settings.amount)
    persist()
    syncPresets()
    markStale()
  })

  // Unit changes are handled by the picker itself; see setUnit().

  el.presets.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip')
    if (!chip) return
    applyPreset(Number(chip.dataset.kb))
  })

  el.resetBtn.addEventListener('click', () => {
    settings = { ...defaults }
    persist()
    syncSettingsUI()
    markStale()
  })
}

function bindFiles() {
  el.dropInner.addEventListener('click', () => el.fileInput.click())
  el.dropInner.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      el.fileInput.click()
    }
  })

  el.fileInput.addEventListener('change', () => {
    addFiles(el.fileInput.files)
    el.fileInput.value = ''
  })

  el.addBtn.addEventListener('click', () => el.fileInput.click())
  el.clearBtn.addEventListener('click', clearAll)
  el.zipBtn.addEventListener('click', downloadAll)
  el.applyBtn.addEventListener('click', retryStale)

  let depth = 0
  let dragging = false

  const hasFilesType = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

  window.addEventListener('dragenter', (event) => {
    if (!hasFilesType(event)) return
    event.preventDefault()
    dragging = true
    depth++
    document.body.classList.add('is-dragging')
  })

  window.addEventListener('dragover', (event) => {
    if (!dragging) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  })

  window.addEventListener('dragleave', (event) => {
    if (!dragging) return
    event.preventDefault()
    depth = Math.max(0, depth - 1)
    if (depth === 0) {
      dragging = false
      document.body.classList.remove('is-dragging')
    }
  })

  window.addEventListener('drop', (event) => {
    if (!hasFilesType(event)) return
    event.preventDefault()
    dragging = false
    depth = 0
    document.body.classList.remove('is-dragging')
    addFiles(event.dataTransfer?.files)
  })

  window.addEventListener('paste', (event) => {
    const files = Array.from(event.clipboardData?.files || [])
    if (!files.length) return
    event.preventDefault()
    addFiles(files)
  })

  window.addEventListener('pagehide', () => {
    for (const entry of pool.entries) {
      try {
        entry.worker.terminate()
      } catch {
        /* noop */
      }
    }
  })
}

function bindCompare() {
  el.cmpRange.addEventListener('input', () => {
    el.cmpStage.style.setProperty('--pos', `${el.cmpRange.value}%`)
  })

  el.cmpDownload.addEventListener('click', () => {
    if (state.compare) downloadItem(state.compare)
  })

  for (const button of el.compareDlg.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => el.compareDlg.close())
  }

  el.compareDlg.addEventListener('click', (event) => {
    if (event.target === el.compareDlg) el.compareDlg.close()
  })

  el.compareDlg.addEventListener('close', () => {
    state.compare = null
  })
}

function bindBar() {
  const bar = $('.bar')

  const sync = () => bar.toggleAttribute('data-stuck', window.scrollY > 0)

  window.addEventListener('scroll', sync, { passive: true })
  sync()
}

function registerWorker() {
  navigator.serviceWorker.register('sw.js').catch(() => {})
}

function renderText() {
  for (const item of state.items) syncRow(item)
  chrome()
  el.zipLabel.textContent = t('downloadAll')
  if (state.compare) el.cmpStats.replaceChildren(...compareStats(state.compare))
  syncPickerLabels()
}

let openPicker = null

// Every choice on the page is the same little list box: a button that shows the
// current value, a menu that spells the options out, and nothing native.
function createPicker({ button, menu, label, onPick }) {
  const options = [...menu.children]

  const close = ({ focus = false } = {}) => {
    if (menu.hidden) return
    menu.hidden = true
    button.setAttribute('aria-expanded', 'false')
    if (openPicker === picker) openPicker = null
    if (focus) button.focus()
  }

  const open = ({ focus = true } = {}) => {
    if (openPicker && openPicker !== picker) openPicker.close()
    menu.hidden = false
    button.setAttribute('aria-expanded', 'true')
    openPicker = picker
    if (!focus) return
    const current = options.find((option) => option.getAttribute('aria-selected') === 'true')
    ;(current ?? options[0]).focus()
  }

  const choose = (option) => {
    close({ focus: true })
    if (option.dataset.value === picker.value) return
    onPick?.(option.dataset.value)
  }

  const picker = {
    close,
    get value() {
      return button.dataset.value ?? ''
    },
    set(value) {
      const option = options.find((item) => item.dataset.value === value) ?? options[0]
      button.dataset.value = option.dataset.value
      label.textContent = option.dataset.short ?? option.textContent.trim()
      for (const item of options) {
        item.setAttribute('aria-selected', String(item === option))
      }
    },
  }

  button.addEventListener('click', () => (menu.hidden ? open() : close()))
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      open()
    } else if (event.key === 'Escape') {
      close()
    }
  })
  menu.addEventListener('click', (event) => {
    const option = event.target.closest('[data-value]')
    if (option) choose(option)
  })
  menu.addEventListener('keydown', (event) => {
    const at = options.indexOf(document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close({ focus: true })
    } else if (event.key === 'Tab') {
      close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      options[(at + step + options.length) % options.length].focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (at >= 0) choose(options[at])
    }
  })
  menu.closest('.pick').addEventListener('focusout', (event) => {
    if (!event.relatedTarget || menu.contains(event.relatedTarget) || button === event.relatedTarget) return
    if (event.relatedTarget.closest('.pick') !== menu.closest('.pick')) close()
  })
  document.addEventListener('click', (event) => {
    if (!menu.hidden && event.target.closest('.pick') !== menu.closest('.pick')) close()
  })

  return picker
}

const langPicker = createPicker({
  button: el.langBtn,
  menu: el.langMenu,
  label: el.langCode,
  onPick: (value) => {
    setLang(value)
    renderText()
  },
})

const unitPicker = createPicker({
  button: el.unitBtn,
  menu: el.unitMenu,
  label: el.unitLabel,
  onPick: setUnit,
})

const formatPicker = createPicker({
  button: el.formatBtn,
  menu: el.formatMenu,
  label: el.formatCode,
  onPick: (value) => {
    settings.format = value
    persist()
    syncPickerLabels()
    markStale()
  },
})

const presetPicker = createPicker({
  button: el.presetBtn,
  menu: el.presetMenu,
  label: el.presetLabel,
  onPick: (value) => {
    if (!value) {
      syncPickerLabels()
      return
    }
    applyPreset(Number(value))
  },
})

function setUnit(value) {
  // 500 KB -> 0.49 MB, not 500 MB.
  const bytes = Number(settings.amount || 0) * unitBytes()
  settings.unit = value
  settings.amount = bytes / unitBytes()
  if (!settings.amount || targetBytes() < 1024) settings.amount = settings.unit === 'MB' ? 0.001 : 1
  el.target.value = formatAmount(settings.amount)
  persist()
  syncPickerLabels()
  markStale()
}

function boot() {
  initLang()
  syncPickerLabels()
  // chrome() only owns the numbers; this label is ours from the first frame.
  el.zipLabel.textContent = t('downloadAll')
  syncSettingsUI()
  bindSettings()
  bindFiles()
  bindCompare()
  bindBar()
  chrome()
  registerWorker()
}

boot()
