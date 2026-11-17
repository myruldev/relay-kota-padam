// Input: mouse clicks on the board and the keyboard. The module translates a
// raw pointer position into a grid cell and hands the game clean events
// (turn a tile, start, restart, pause, mute) instead of raw DOM events.

export function makeInput(canvas, handlers) {
  function cellFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (ev.clientX - rect.left) * scaleX;
    const py = (ev.clientY - rect.top) * scaleY;
    return { px, py };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const { px, py } = cellFromEvent(ev);
    handlers.onPointer(px, py);
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const key = ev.key.toLowerCase();
    if (key === 'enter' || key === ' ') handlers.onConfirm();
    else if (key === 'r') handlers.onRestart();
    else if (key === 'm') handlers.onMute();
    else if (key === 'p' || key === 'escape') handlers.onPause();
  });
}
