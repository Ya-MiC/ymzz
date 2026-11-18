// MIT. Resolve immutable authority colors at the host boundary, not through
// inherited aliases which native theme presenters may already have computed.
export function consumeWenrunTheme(document, scheme, actualPanel) {
  if (!['light','dark'].includes(scheme)) throw new Error('WENRUN_SCHEME_INVALID');
  const read = document.defaultView.getComputedStyle(document.documentElement);
  const ink = read.getPropertyValue(scheme === 'dark' ? '--c-dusk-paper' : '--ink-1').trim();
  const fillInk = read.getPropertyValue(scheme === 'dark' ? '--bg-0' : '--ink-1').trim();
  if (![ink, fillInk].every(value => /^#[0-9a-f]{6}$/i.test(value))) throw new Error('WENRUN_AUTHORITY_COLOR_MISSING');
  for (const [name, value] of Object.entries({'--ink-1':ink, '--ymzz-readable-ink':ink, '--ymzz-on-accent':fillInk})) document.body.style.setProperty(name,value,'important');
  const panel = actualPanel || document.getElementById('ymzz-dsh-panel');
  if (panel) {
    panel.style.setProperty('color',ink,'important');
    panel.style.setProperty('--ink-1',ink,'important');
    panel.style.setProperty('--ymzz-readable-ink',ink,'important');
    panel.style.setProperty('--ymzz-on-accent',fillInk,'important');
  }
  return {scheme, authorityInk:ink, authorityFillInk:fillInk, panelFound:Boolean(panel), inlineColor:panel?.style.getPropertyValue?.('color'), inlineColorPriority:panel?.style.getPropertyPriority?.('color')};
}
