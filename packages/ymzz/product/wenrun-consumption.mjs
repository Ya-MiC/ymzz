// MIT. Resolve immutable authority colors at the host boundary, not through
// inherited aliases which native theme presenters may already have computed.
export function consumeWenrunTheme(document, scheme) {
  if (!['light','dark'].includes(scheme)) throw new Error('WENRUN_SCHEME_INVALID');
  const read = document.defaultView.getComputedStyle(document.documentElement);
  const ink = read.getPropertyValue(scheme === 'dark' ? '--c-dusk-paper' : '--ink-1').trim();
  const fillInk = read.getPropertyValue(scheme === 'dark' ? '--bg-0' : '--ink-1').trim();
  if (![ink, fillInk].every(value => /^#[0-9a-f]{6}$/i.test(value))) throw new Error('WENRUN_AUTHORITY_COLOR_MISSING');
  for (const [name, value] of Object.entries({'--ink-1':ink, '--ymzz-readable-ink':ink, '--ymzz-on-accent':fillInk})) document.body.style.setProperty(name,value);
  const panel = document.getElementById('ymzz-dsh-panel');
  if (panel) {
    panel.style.color = ink;
    panel.style.setProperty('--ink-1',ink);
    panel.style.setProperty('--ymzz-readable-ink',ink);
    panel.style.setProperty('--ymzz-on-accent',fillInk);
  }
  return {scheme, authorityInk:ink, authorityFillInk:fillInk};
}
