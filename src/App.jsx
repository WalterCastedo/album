import { useEffect, useState } from 'react'
import Modal from 'react-modal'
import { supabase } from './lib/supabase'

Modal.setAppElement('#root')

export default function App() {
  const [album, setAlbum] = useState(null)
  const [paginas, setPaginas] = useState([])
  const [stickers, setStickers] = useState([])
  const [stickerSeleccionado, setStickerSeleccionado] = useState(null)
  const [menuAbiertoPagina, setMenuAbiertoPagina] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  // ESTADO QUE REEMPLAZA EL FLIPBOOK: 0 es la Portada, 1 en adelante son las páginas.
  const [paginaActualIndex, setPaginaActualIndex] = useState(0)

  const [configPortada, setConfigPortada] = useState({
    color: '#ffffff',
    size: 48,
    font: 'sans-serif',
    vertical: 'center',
    horizontal: 'center'
  })

  // DETECTOR RESPONSIVO DE PANTALLA
  useEffect(() => {
    const comprobarPantalla = () => {
      setIsMobile(window.innerWidth < 768)
    }
    comprobarPantalla()
    window.addEventListener('resize', comprobarPantalla)
    return () => window.removeEventListener('resize', comprobarPantalla)
  }, [])

  // CARGA INICIAL DE DATOS
  useEffect(() => {
    cargarAlbum()
    cargarPaginas()
    cargarStickers()
  }, [])

  async function cargarAlbum() {
    const { data, error } = await supabase
      .from('album')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      console.error(error)
      return
    }
    setAlbum(data)
  }

  async function actualizarTitulo(titulo) {
    setAlbum(prev => ({ ...prev, titulo }))
    await supabase.from('album').update({ titulo }).eq('id', album.id)
  }

  async function subirPortada(file) {
    if (!file) return
    const imagen = await comprimirImagen(file, 1600, 0.7)
    const nombre = 'portada-' + Date.now() + imagen.name
    await supabase.storage.from('stickers').upload(nombre, imagen)
    const { data } = supabase.storage.from('stickers').getPublicUrl(nombre)

    await supabase.from('album').update({ portada: data.publicUrl }).eq('id', album.id)
    cargarAlbum()
  }

  async function cargarPaginas() {
    const { data } = await supabase.from('paginas').select('*').order('created_at', { ascending: true })

    if (!data || data.length === 0) {
      const { data: nueva } = await supabase
        .from('paginas')
        .insert({ titulo: 'Mi Primera Página ❤️', cantidad_fotos: 4 })
        .select()

      setPaginas(nueva)
      return
    }
    setPaginas(data)
  }

  async function cargarStickers() {
    const { data } = await supabase.from('stickers').select('*')
    setStickers(data || [])
  }

  function comprimirImagen(file, maxWidth = 900, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()
      reader.onload = (e) => { img.src = e.target.result }
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = maxWidth / img.width
        canvas.width = maxWidth
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        }, 'image/jpeg', quality)
      }
      reader.readAsDataURL(file)
    })
  }

  // OPERACIONES DEL ÁLBUM
  async function crearPagina() {
    let cantidad = Number(prompt("¿Cuántas fotos tendrá esta página? (Máximo 9)"))
    if (!cantidad || cantidad < 1) return
    
    if (cantidad > 9) {
      alert("El límite máximo por hoja es de 9 cromos para mantener la estética.")
      cantidad = 9
    }

    const { data, error } = await supabase
      .from('paginas')
      .insert({ titulo: 'Nueva Página 🥰', cantidad_fotos: cantidad })
      .select()
      .single()

    if (error) return console.error(error)

    setPaginas(prev => [...prev, data])
    // Ir a la nueva página creada
    setPaginaActualIndex(paginas.length + 1)
  }

  async function eliminarPagina(id) {
    const confirmar = confirm('¿Eliminar esta página y todos sus stickers?')
    if (!confirmar) return

    await supabase.from('stickers').delete().eq('pagina_id', id)
    await supabase.from('paginas').delete().eq('id', id)

    await cargarPaginas()
    await cargarStickers()

    // Regresar una página atrás si eliminamos la actual
    setPaginaActualIndex(prev => Math.max(0, prev - 1))
  }

  async function renombrarPagina(id) {
    const nuevoNombre = prompt('Nuevo nombre de la página:')
    if (!nuevoNombre) return
    setPaginas(prev => prev.map(p => p.id === id ? { ...p, titulo: nuevoNombre } : p))
    await supabase.from('paginas').update({ titulo: nuevoNombre }).eq('id', id)
  }

  async function subirFondo(file, paginaId) {
    if (!file) return
    const imagen = await comprimirImagen(file, 1600, 0.6)
    const nombre = Date.now() + imagen.name
    await supabase.storage.from('stickers').upload(nombre, imagen)
    const { data } = supabase.storage.from('stickers').getPublicUrl(nombre)

    await supabase.from('paginas').update({ fondo: data.publicUrl }).eq('id', paginaId)
    cargarPaginas()
  }

  async function subirStickerSlot(file, paginaId, slotId) {
    const imagen = await comprimirImagen(file)
    const nombre = Date.now() + imagen.name
    await supabase.storage.from('stickers').upload(nombre, imagen)
    const { data } = supabase.storage.from('stickers').getPublicUrl(nombre)

    await supabase.from('stickers').insert({
      pagina_id: paginaId,
      slot_id: slotId,
      image: data.publicUrl,
      x: 0, y: 0
    })
    cargarStickers()
  }

  async function eliminarSticker(id) {
    await supabase.from('stickers').delete().eq('id', id)
    cargarStickers()
  }

  const agruparCromos = (slots) => {
    const n = slots.length;
    if (n === 1) return [slots];
    if (n === 2) return [[slots[0]], [slots[1]]];
    if (n === 3) return [[slots[0]], [slots[1], slots[2]]];
    if (n === 4) return [slots.slice(0, 2), slots.slice(2, 4)];
    if (n === 5) return [slots.slice(0, 2), slots.slice(2, 5)];
    if (n === 6) return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 6)];
    if (n === 7) return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 7)];
    if (n === 8) return [slots.slice(0, 2), slots.slice(2, 5), slots.slice(5, 8)];
    if (n === 9) return [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];
    return [slots];
  };

  const pagActualObj = paginaActualIndex > 0 ? paginas[paginaActualIndex - 1] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-1 md:p-3 font-sans selection:bg-pink-500 overflow-y-auto overflow-x-hidden real-album-body flex flex-col">
      
      <header className="max-w-5xl mx-auto text-center mb-2 select-none z-50">
        <span className="inline-block bg-gradient-to-r from-pink-500/10 to-amber-500/10 text-pink-400 text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-0.5 rounded-full border border-pink-500/20 shadow-sm">
          Álbum
        </span>
        <div className="flex flex-col items-center gap-3 mt-2">
          <input
            type="text"
            value={album?.titulo || ''}
            disabled
            placeholder="Título del álbum"
            className="bg-transparent text-center text-xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 bg-clip-text text-transparent outline-none border-b border-pink-500/20 focus:border-pink-400 px-2 py-1 max-w-[90vw]"
          />
        </div>
      </header>

      <div className="w-full max-w-[1200px] mx-auto mb-3 min-h-[90px] relative flex items-center justify-center">
        {/* CONFIGURADOR PORTADA */}
        <div
          className={`absolute inset-0 bg-slate-950/95 border border-slate-700 rounded-2xl px-3 py-2 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-center gap-2 w-full min-w-0 overflow-x-auto transition-all duration-300 ${paginaActualIndex === 0 ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none scale-95'}`}
        >
          <input
            type="text"
            value={album?.titulo || ''}
            onChange={(e) => actualizarTitulo(e.target.value)}
            placeholder="Título del álbum"
            className="bg-slate-800 text-white px-3 py-2 rounded-xl text-sm outline-none border border-slate-700 w-full sm:w-[160px] min-w-0 flex-1 flex-shrink"
          />
          <label className="cursor-pointer bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
            Cambiar portada
            <input type="file" hidden onChange={(e) => subirPortada(e.target.files?.[0])} />
          </label>
          <input type="color" value={configPortada.color} onChange={(e) => setConfigPortada(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer flex-shrink-0" />
          <input type="range" min="20" max="90" value={configPortada.size} onChange={(e) => setConfigPortada(prev => ({ ...prev, size: Number(e.target.value) }))} className="w-[80px] sm:w-[100px] flex-shrink min-w-0" />
          <select value={configPortada.font} onChange={(e) => setConfigPortada(prev => ({ ...prev, font: e.target.value }))} className="bg-slate-800 px-2 py-2 rounded text-xs flex-shrink min-w-0">
            <option value="sans-serif">Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Mono</option>
            <option value="cursive">Cursive</option>
          </select>
          <select value={configPortada.vertical} onChange={(e) => setConfigPortada(prev => ({ ...prev, vertical: e.target.value }))} className="bg-slate-800 px-2 py-2 rounded text-xs flex-shrink min-w-0">
            <option value="top">Arriba</option>
            <option value="center">Centro</option>
            <option value="bottom">Abajo</option>
          </select>
          <select value={configPortada.horizontal} onChange={(e) => setConfigPortada(prev => ({ ...prev, horizontal: e.target.value }))} className="bg-slate-800 px-2 py-2 rounded text-xs flex-shrink min-w-0">
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>

        {/* BOTÓN CREAR PÁGINA */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${paginaActualIndex !== 0 ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none scale-95'}`}>
          <button onClick={crearPagina} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-950/40">
            ＋ Añadir Nueva Hoja
          </button>
        </div>
      </div>

      {/* CONTENEDOR DE NAVEGACIÓN Y ÁLBUM */}
      <div className="w-full max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-center my-0 px-2 sm:px-4 relative min-h-[75vh] md:min-h-[650px]">
        
        {/* BOTÓN IZQUIERDO */}
        {paginaActualIndex > 0 && (
          <button
            onClick={() => setPaginaActualIndex(prev => Math.max(0, prev - 1))}
            className="absolute left-0 sm:left-4 top-1/2 -translate-y-1/2 z-[9999] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-800/95 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white text-3xl md:text-4xl font-light shadow-xl border border-slate-500/50 backdrop-blur-md transition-all"
          >
            ‹
          </button>
        )}

        {/* CONTENEDOR PRINCIPAL DEL ÁLBUM (CARD) */}
        <div key={paginaActualIndex} className="animate-in fade-in zoom-in-95 duration-300 w-full max-w-[420px] md:max-w-[500px] h-[75vh] md:h-[650px] bg-slate-900 rounded-2xl border border-slate-800/90 shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden relative mx-auto flex flex-col">
          
          {/* ================= VISTA: PORTADA ================= */}
          {paginaActualIndex === 0 && (
            <div className="w-full h-full relative overflow-hidden bg-black flex-1">
              {album?.portada ? (
                <img src={album.portada} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <span className="text-8xl">📖</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 pointer-events-none" />
              <div
                className="absolute inset-0 flex p-6 pointer-events-none"
                style={{
                  justifyContent: configPortada.horizontal === 'left' ? 'flex-start' : configPortada.horizontal === 'center' ? 'center' : 'flex-end',
                  alignItems: configPortada.vertical === 'top' ? 'flex-start' : configPortada.vertical === 'center' ? 'center' : 'flex-end',
                  textAlign: configPortada.horizontal
                }}
              >
                <textarea
                  value={album?.titulo || ''}
                  onChange={(e) => actualizarTitulo(e.target.value)}
                  rows={3}
                  style={{
                    color: configPortada.color,
                    fontSize: `clamp(24px, ${configPortada.size / 10}vw, ${configPortada.size}px)`,
                    fontFamily: configPortada.font,
                    lineHeight: 1.1,
                    textAlign: configPortada.horizontal
                  }}
                  className="pointer-events-auto bg-transparent resize-none outline-none font-black overflow-hidden w-full"
                />
              </div>
            </div>
          )}

          {/* ================= VISTA: PÁGINAS INTERNAS ================= */}
          {paginaActualIndex > 0 && pagActualObj && (
            <div className="w-full h-full pb-10 bg-slate-900 relative overflow-hidden select-none flex flex-col justify-between flex-1">
              {/* FONDO DE PÁGINA */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: pagActualObj.fondo ? `linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.4)), url("${pagActualObj.fondo}")` : 'radial-gradient(circle at center, #1e293b 1.2px, transparent 1.2px)',
                  backgroundSize: pagActualObj.fondo ? 'cover' : '24px 24px',
                  backgroundPosition: 'center',
                  backgroundRepeat: pagActualObj.fondo ? 'no-repeat' : 'repeat'
                }}
              />

              {/* HEADER DE LA PÁGINA */}
              <div className="w-full flex justify-between items-center bg-slate-950/95 backdrop-blur-md px-4 py-3 border-b border-white/10 z-50 relative shrink-0">
                <div className="flex flex-col min-w-0 items-start text-left">
                  <span className="text-[12px] md:text-sm font-black tracking-wide text-slate-100 truncate max-w-[180px] md:max-w-[240px]">
                    {pagActualObj.titulo}
                  </span>
                  <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                    PÁGINA {paginaActualIndex < 10 ? `0${paginaActualIndex}` : paginaActualIndex} / {paginas.length}
                  </span>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setMenuAbiertoPagina(menuAbiertoPagina === pagActualObj.id ? null : pagActualObj.id)}
                    className="bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-700 text-slate-200 flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                  >
                    ⚙️ Opciones
                  </button>

                  {menuAbiertoPagina === pagActualObj.id && (
                    <div className="absolute right-0 mt-2 w-44 bg-slate-950/95 border border-slate-800 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 py-1 overflow-hidden backdrop-blur-md">
                      <button onClick={() => { renombrarPagina(pagActualObj.id); setMenuAbiertoPagina(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2">
                        ✏️ Renombrar Hoja
                      </button>
                      <label className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2 cursor-pointer block">
                        🖼️ Cambiar Fondo
                        <input type="file" hidden onChange={(e) => { subirFondo(e.target.files?.[0], pagActualObj.id); setMenuAbiertoPagina(null); }} />
                      </label>
                      <div className="border-t border-slate-900 my-1" />
                      <button onClick={() => { eliminarPagina(pagActualObj.id); setMenuAbiertoPagina(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-950/40 hover:text-red-400 transition-colors text-red-400/90 flex items-center gap-2 font-medium">
                        🗑️ Eliminar Hoja
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* CONTENIDO (SLOTS DE CROMOS) */}
              <div className="w-full h-full flex-1 flex flex-col justify-start items-center mt-2 content-center p-2 md:p-4 relative z-10 box-border overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="w-full flex flex-col justify-center items-center gap-4 h-full">
                  {agruparCromos(Array.from({ length: Math.min(pagActualObj.cantidad_fotos || 6, 9) }, (_, i) => i + 1)).map((fila, indexFila) => (
                    <div key={`fila-${indexFila}`} className="flex flex-row justify-center items-center gap-3 w-full">
                      {fila.map(slotId => {
                        const sticker = stickers.filter(s => s.pagina_id === pagActualObj.id).find(s => s.slot_id === slotId)
                        const ocupado = !!sticker
                        const esEspecial = slotId % 2 === 0

                        return (
                          <div key={slotId} className="w-[100px] h-[127px] sm:w-[110px] sm:h-[140px] md:w-[125px] md:h-[165px] pointer-events-auto shadow-sm rounded-xl transition-all duration-300 shrink-0">
                            <label className={`block h-full ${ocupado ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="file"
                                hidden
                                disabled={ocupado}
                                onChange={async (e) => {
                                  if (ocupado || !e.target.files?.[0]) return
                                  const file = await comprimirImagen(e.target.files[0])
                                  subirStickerSlot(file, pagActualObj.id, slotId)
                                }}
                              />
                              <div className={`w-full h-full transition-all duration-300 relative rounded-xl overflow-hidden flex items-center justify-center border-2 ${ocupado ? 'border-white bg-white hover:brightness-110 shadow-md shadow-black/60' : esEspecial ? 'border-dashed border-amber-400/70 bg-amber-500/5 hover:bg-amber-500/10 shadow-[inset_0_0_8px_rgba(245,158,11,0.1)]' : 'border-dashed border-slate-700 bg-slate-950/90 hover:border-slate-500 hover:bg-slate-900/40'}`}>
                                {sticker ? (
                                  <div className="w-full h-full p-0.5 bg-white relative group">
                                    <img src={sticker.image} className="w-full h-full object-cover rounded-lg cursor-pointer" onClick={(e) => { e.preventDefault(); setStickerSeleccionado(sticker); }} alt="Cromo" />
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center select-none text-center p-0.5 pointer-events-none">
                                    <span className={`text-[8px] md:text-[10px] font-mono tracking-tighter uppercase font-bold ${esEspecial ? 'text-amber-400' : 'text-slate-600'}`}>
                                      {esEspecial ? '★ BRILL' : 'CROMO'}
                                    </span>
                                    <span className={`text-sm md:text-2xl font-black tracking-tighter font-mono ${esEspecial ? 'text-amber-300' : 'text-slate-500'}`}>
                                      {slotId < 10 ? `0${slotId}` : slotId}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTÓN DERECHO */}
        {paginaActualIndex < paginas.length && (
          <button
            onClick={() => setPaginaActualIndex(prev => Math.min(paginas.length, prev + 1))}
            className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 z-[9999] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-800/95 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white text-3xl md:text-4xl font-light shadow-xl border border-slate-500/50 backdrop-blur-md transition-all"
          >
            ›
          </button>
        )}
      </div>

      <footer className="text-center py-2 text-[10px] text-slate-600 select-none shrink-0 z-50">
        Álbum Virtual • Diseñado con Amor
      </footer>

      {/* MODAL PARA VER CROMO EN GRANDE */}
      <Modal
        isOpen={!!stickerSeleccionado}
        onRequestClose={() => setStickerSeleccionado(null)}
        style={{
          overlay: { background: 'rgba(5, 8, 16, 0.94)', backdropFilter: 'blur(10px)', zIndex: 100 },
          content: { background: 'transparent', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', inset: '0px' }
        }}
      >
        {stickerSeleccionado && (
          <div className="flex flex-col items-center gap-4 max-w-[280px] md:max-w-xs w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="p-2.5 bg-white rounded-2xl shadow-2xl border border-slate-100 transform rotate-1">
              <img src={stickerSeleccionado.image} className="max-h-[55vh] object-contain rounded-xl" alt="Cromo ampliado" />
            </div>
            <div className="flex gap-2 w-full justify-center">
              <button onClick={async () => { await eliminarSticker(stickerSeleccionado.id); setStickerSeleccionado(null); }} className="bg-red-600 hover:bg-red-500 active:scale-95 px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg text-white">
                Despegar Cromo
              </button>
              <button onClick={() => setStickerSeleccionado(null)} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs tracking-wide text-white transition-all border border-slate-700">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .real-album-body {
          background-image: radial-gradient(#1e293b 0.7px, transparent 0.7px);
          background-size: 16px 16px;
        }
        
        /* Oculta la barra de scroll dentro del álbum pero permite arrastrar hacia abajo si hay mucho contenido */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}