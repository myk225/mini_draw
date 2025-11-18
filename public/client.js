// client.js — improved, drop-in replacement
document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // assumes same origin; change if needed
  
    const canvas = document.getElementById('board');
    const controls = document.getElementById('controls');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    const joinBtn = document.getElementById('joinBtn');
    const clearBtn = document.getElementById('clearBtn');
    const roomInput = document.getElementById('room');
    const nameInput = document.getElementById('name');
    const status = document.getElementById('status');
    const presence = document.getElementById('presence');
  
    if (!canvas || !ctx) {
      console.error('Canvas or 2D context not found. Check #board exists in DOM.');
      return;
    }
    if (!joinBtn || !clearBtn || !roomInput || !nameInput) {
      console.warn('One or more control elements missing.');
    }
  
    // Prevent page scrolling when touching the canvas on mobile
    canvas.style.touchAction = 'none';
  
    // HiDPI scaling
    function resizeCanvasToDisplaySize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations
      }
    }
  
    function fitCanvas() {
      // Make the canvas occupy window width and remaining height below controls
      const ctrlHeight = controls ? controls.getBoundingClientRect().height : 56;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = (window.innerHeight - ctrlHeight) + 'px';
      resizeCanvasToDisplaySize();
    }
    window.addEventListener('resize', fitCanvas);
    fitCanvas();
  
    // Drawing state
    let drawing = false;
    let last = { x: 0, y: 0 };
    let roomId = null;
    let color = '#000';
    let width = 2;
  
    // helpers
    function getPos(e) {
      // support pointer/touch/mouse
      if (e.touches && e.touches.length) e = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
    }
  
    function drawLine({ x0, y0, x1, y1, color = '#000', width = 2 }, emit = false) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.closePath();
  
      if (emit && roomId) {
        socket.emit('stroke', { roomId, stroke: { x0, y0, x1, y1, color, width } });
      }
    }
  
    // Pointer event handlers using Pointer Events API (works for mouse + touch + pen)
    canvas.addEventListener('pointerdown', (e) => {
      // only left button or touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      canvas.setPointerCapture?.(e.pointerId);
      drawing = true;
      last = getPos(e);
      e.preventDefault();
    }, { passive: false });
  
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pos = getPos(e);
      // here we emit our first
      drawLine({ x0: last.x, y0: last.y, x1: pos.x, y1: pos.y, color, width }, true);
      last = pos;
      e.preventDefault();
    }, { passive: false });
  
    function stopDrawing(e) {
      if (!drawing) return;
      drawing = false;
      try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
      e?.preventDefault?.();
    }
  
    canvas.addEventListener('pointerup', stopDrawing, { passive: false });
    canvas.addEventListener('pointercancel', stopDrawing, { passive: false });
    canvas.addEventListener('pointerleave', (e) => {
      // keep drawing if pointer is captured; otherwise stop
      if (!canvas.hasPointerCapture?.(e.pointerId)) stopDrawing(e);
    }, { passive: false });
  
    // Buttons
    joinBtn?.addEventListener('click', () => {
      roomId = (roomInput.value || 'testroom').trim();
      const name = (nameInput.value || 'guest').trim();
      if (!roomId) return alert('Enter a room id');
      socket.emit('join-room', { roomId, name });
      status.textContent = 'connected';
      console.log('joined room', roomId);
    });
  
    clearBtn?.addEventListener('click', () => {
      if (!roomId) return alert('Join a room first');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      socket.emit('clear', { roomId });
    });
  
    // Socket handlers
    socket.on('connect', () => {
      status.textContent = 'connected';
      console.log('socket connected', socket.id);
    });
    socket.on('disconnect', () => {
      status.textContent = 'disconnected';
      console.log('socket disconnected');
    });
  
    socket.on('stroke', (stroke) => {
      // defensive: ensure stroke has coordinates
      if (stroke && stroke.x0 != null) drawLine(stroke, false);
    });
  
    socket.on('init-strokes', (strokes) => {
      if (!Array.isArray(strokes)) return;
      for (const s of strokes) drawLine(s, false);
    });
  
    socket.on('clear', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  
    socket.on('presence', ({ users } = {}) => {
      presence.textContent = 'Users: ' + (users && users.length ? users.join(', ') : '—');
    });
  
    // Debug helpers: expose some things on window for quick console debugging
    window._miniDraw = {
      canvas, ctx, socket, rooms: () => { /* no server info from client */ }
    };
  
    console.log('client ready');
  });
  