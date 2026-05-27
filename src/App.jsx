import { useEffect, useState, useRef } from 'react'
import Modal from 'react-modal'
import HTMLFlipBook from 'react-pageflip'
import { supabase } from './lib/supabase'

Modal.setAppElement('#root')

export default function App() {

  const [paginas, setPaginas] = useState([])
  const [stickers, setStickers] = useState([])
  const [paginaActiva, setPaginaActiva] = useState(null)
  const [stickerSeleccionado, setStickerSeleccionado] = useState(null)
  const [menuAbiertoPagina, setMenuAbiertoPagina] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const flipBookRef = useRef(null)

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
    cargarPaginas()
    cargarStickers()
  }, [])

  async function cargarPaginas() {
    const { data } = await supabase.from('paginas').select('*').order('created_at', { ascending: true })

    if (!data || data.length === 0) {
      const { data: nueva } = await supabase
        .from('paginas')
        .insert({ titulo: 'Mi Primera Página ❤️', cantidad_fotos: 4 })
        .select()

      setPaginas(nueva)
      setPaginaActiva(nueva[0].id)
      return
    }

    setPaginas(data)
    setPaginaActiva(data[0].id)
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
    setPaginaActiva(data.id)
  }

  async function eliminarPagina(id) {
    const confirmar = confirm('¿Eliminar esta página y todos sus stickers?')
    if (!confirmar) return

    await supabase.from('stickers').delete().eq('pagina_id', id)
    await supabase.from('paginas').delete().eq('id', id)

    await cargarPaginas()
    await cargarStickers()

    if (paginaActiva === id) setPaginaActiva(null)
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

  // CONFIGURADOR DE DISTRIBUCIÓN EXACTA
  const agruparCromos = (slots) => {
    const n = slots.length;
    if (n === 1) return [slots];
    if (n === 2) return [[slots[0]], [slots[1]]];                                   // 1 arriba, 1 abajo
    if (n === 3) return [[slots[0]], [slots[1], slots[2]]];                         // 1 arriba, 2 abajo
    if (n === 4) return [slots.slice(0, 2), slots.slice(2, 4)];                     // 2 arriba, 2 abajo
    if (n === 5) return [slots.slice(0, 2), slots.slice(2, 5)];                     // 2 arriba, 3 abajo
    if (n === 6) return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 6)];  // 2, 2, 2
    if (n === 7) return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 7)];  // 2, 2, 3
    if (n === 8) return [slots.slice(0, 2), slots.slice(2, 5), slots.slice(5, 8)];  // 2, 3, 3
    if (n === 9) return [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];  // 3, 3, 3
    return [slots];
  };

  const irAtras = () => flipBookRef.current?.pageFlip().flipPrev()
  const irAdelante = () => flipBookRef.current?.pageFlip().flipNext()

  return (
    <div className="h-screen bg-slate-950 text-white p-1 md:p-3 font-sans selection:bg-pink-500 overflow-hidden real-album-body flex flex-col">
      
      {/* ENCABEZADO PRINCIPAL */}
      <header className="max-w-5xl mx-auto text-center mb-.5 select-none">
        <span className="inline-block bg-gradient-to-r from-pink-500/10 to-amber-500/10 text-pink-400 text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-0.5 rounded-full border border-pink-500/20 shadow-sm">
         Álbum
        </span>
        <h1 className="text-xl md:text-3xl font-black tracking-tight mt-0.5 bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
          Walter y Esmeralda
        </h1>
      </header>

      {/* BOTÓN GLOBAL ÚNICO */}
      <div className="flex justify-center mb-2 z-40 shrink-0">
        <button
          onClick={crearPagina}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 px-4 py-1.5 rounded-xl text-[10px] md:text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-950/40"
        >
          ＋ Añadir Nueva Hoja
        </button>
      </div>

      {/* ESTRUCTURA CONTENEDORA GLOBAL EN FILA CON BOTONES LATERALES INTEGRADOS */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-center gap-1 sm:gap-4 flex-1 my-auto px-0.5 ">
        
        {/* ◀️ BOTÓN IZQUIERDO NATIVO */}
        <button
          onClick={irAtras}
          className="bg-slate-900/95 hover:bg-pink-600 text-white w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center border border-slate-700/90 shadow-xl transition-all shrink-0 active:scale-90 z-50"
          title="Anterior"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 md:w-5 md:h-"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>

        {paginas.length > 0 && (
          <div className="album-book-container relative w-full max-w-[315px] sm:max-w-[390px] md:max-w-[1000px] h-[81vh] min-h-[560px] md:h-[650px] p-0.5 md:p-1 bg-slate-900 rounded-2xl border border-slate-800/90 shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex-1">
            
            {!isMobile && (
              <div className="absolute left-1/2 top-0 bottom-0 w-6 bg-gradient-to-r from-black/50 via-black/15 to-black/50 -translate-x-1/2 z-40 pointer-events-none border-x border-black/30" />
            )}

           <HTMLFlipBook
  width={500}
  height={isMobile ? 700 : 650}
  size="stretch"
  minWidth={280}
  maxWidth={500}
  minHeight={isMobile ? 560 : 500}
  maxHeight={650}
  maxShadowOpacity={0.6}
  showCover={false}

  useMouseEvents={false}
  mobileScrollSupport={false}
  disableFlipByClick={true}

  mode={isMobile ? 'portrait' : 'landscape'}
  onFlip={(e) => {
    const index = e.data;
    if (paginas[index]) setPaginaActiva(paginas[index].id)
  }}
  ref={flipBookRef}
  className="album-flipbook h-full w-full"
>
              {paginas.map((pag, index) => {
                const totalCromos = Math.min(pag.cantidad_fotos || 6, 9);
                const slotsArray = Array.from({ length: totalCromos }, (_, i) => i + 1);
                const stickersPagina = stickers.filter(s => s.pagina_id === pag.id);
                
                const esPaginaDerecha = !isMobile && index % 2 !== 0;

                return (
                  <div key={pag.id} className="w-full h-full pb-15 bg-slate-900 relative overflow-hidden select-none page-sheet flex flex-col justify-between">
                    
                    {/* CAPA DE FONDO INDEPENDIENTE */}
                    <div 
                      className="absolute inset-0 z-0 pointer-events-none"
                      style={{
                        backgroundImage: pag.fondo
                          ? `linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.4)), url("${pag.fondo}")`
                          : 'radial-gradient(circle at center, #1e293b 1.2px, transparent 1.2px)',
                        backgroundSize: pag.fondo ? 'cover' : '24px 24px',
                        backgroundPosition: 'center',
                        backgroundRepeat: pag.fondo ? 'no-repeat' : 'repeat'
                      }}
                    />

                    {/* HEADER CON INVERSIÓN SIMÉTRICA */}
                    <div 
                      className={`w-full flex justify-between items-center bg-slate-950/95 backdrop-blur-md px-3 py-2 md:px-4 md:py-3 border-b border-white/10 z-50 relative shrink-0 ${
                        esPaginaDerecha ? 'flex-row-reverse' : 'flex-row'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={`flex flex-col min-w-0 ${esPaginaDerecha ? 'items-end text-righ' : 'items-start text-left'}`}>
                        <span className="text-[11px] md:text-xs font-black tracking-wide text-slate-100 truncate max-w-[120px] md:max-w-[240px]">
                          {pag.titulo}
                        </span>
                        <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-400 mt-0.5">
                          PÁGINA {index + 1 < 10 ? `0${index + 1}` : index + 1} / {paginas.length}
                        </span>
                      </div>

                      {/* MENÚ DE OPCIONES DE HOJA LOCAL */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuAbiertoPagina(menuAbiertoPagina === pag.id ? null : pag.id)}
                          className="bg-slate-900 hover:bg-slate-800 px-2 py-0.5 md:px-2.5 md:py-1 rounded-xl text-[10px] md:text-[11px] font-bold border border-slate-700 text-slate-200 flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                        >
                          ⚙️ Ver opciones
               t         </button>

                        {menuAbiertoPagina === pag.id && (
                          <div className={`absolute mt-2 w-44 bg-slate-950/95 border border-slate-800 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 py-1 overflow-hidden backdrop-blur-md ${
                            esPaginaDerecha ? 'left-0' : 'right-0'
                          }`}>
                            <button
                              onClick={() => { renombrarPagina(pag.id); setMenuAbiertoPagina(null); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2"
                            >
                              ✏️ Renombrar Hoja
                            </button>
                            
                            <label className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2 cursor-pointer block">
                              🖼️ Cambiar Fondo
                              <input type="file" hidden onChange={(e) => { subirFondo(e.target.files?.[0], pag.id); setMenuAbiertoPagina(null); }} />
                            </label>
                            
                            <div className="border-t border-slate-900 my-1" />
                            
                            <button
                              onClick={() => { eliminarPagina(pag.id); setMenuAbiertoPagina(null); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-red-950/40 hover:text-red-400 transition-colors text-red-400/90 flex items-center gap-2 font-medium"
                            >
                              🗑️ Eliminar Hoja
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CUERPO OPERATIVO AJUSTADO: justify-start y padding superior pt-4 / pt-8 sitúan el bloque arriba */}
                    <div className="w-full h-full flex-1 flex flex-col justify-start items-center mt-0 content-center p-0 pt-0 md:p-0 md:pt-0 relative z-10 box-border overflow-hidden">
                      
                      {/* ESTRUCTURA FLEX DE FILAS EXACTAS */}
                      <div className="w-full flex flex-col justify-center items-center  gap-1 md:gap-2 h-full">
                        {agruparCromos(slotsArray).map((fila, indexFila) => (
                          
                          <div key={`fila-${indexFila}`} className="flex flex-row justify-center items-center gap-2 md:gap-4 w-full">
                            {fila.map(slotId => {
                              const sticker = stickersPagina.find(s => s.slot_id === slotId)
                              const ocupado = !!sticker
                              const esEspecial = slotId % 2 === 0

                              return (
                                <div key={slotId} className="w-[58px] h-[82px] sm:w-[92px] sm:h-[125px] md:w-[110px] md:h-[155px] pointer-events-auto shadow-sm rounded-xl transition-all duration-300">
                                  <label className={`block h-full ${ocupado ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="file"
                                      hidden
                                      disabled={ocupado}
                                      onChange={async (e) => {
                                        if (ocupado || !e.target.files?.[0]) return
                                        const file = await comprimirImagen(e.target.files[0])
                                        subirStickerSlot(file, pag.id, slotId)
                                      }}
                                    />

                                    <div className={`w-full h-full transition-all duration-300 relative rounded-xl overflow-hidden flex items-center justify-center border-2 ${
                                      ocupado 
                                        ? 'border-white bg-white hover:rotate-1 hover:scale-105 shadow-md shadow-black/60' 
                                        : esEspecial
                                          ? 'border-dashed border-amber-400/70 bg-amber-500/5 hover:bg-amber-500/10 shadow-[inset_0_0_8px_rgba(245,158,11,0.1)]'
                                          : 'border-dashed border-slate-700 bg-slate-950/90 hover:border-slate-500 hover:bg-slate-900/40'
                                    }`}>
                                      
                                      {sticker ? (
                                        <div className="w-full h-full p-0.5 bg-white relative group">
                                          <img
                                            src={sticker.image}
                                            className="w-full h-full object-cover rounded-lg cursor-pointer"
                                            onClick={() => setStickerSeleccionado(sticker)}
                                            alt="Cromo"
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center justify-center select-none text-center p-0.5">
                                          <span className={`text-[6.5px] md:text-[9px] font-mono tracking-tighter uppercase font-bold ${esEspecial ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {esEspecial ? '★ BRILL' : 'CROMO'}
                                          </span>
                                          <span className={`text-xs md:text-xl font-black tracking-tighter font-mono ${esEspecial ? 'text-amber-300' : 'text-slate-500'}`}>
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
                )
              })}
            </HTMLFlipBook>
          </div>
        )}

        {/* ▶️ BOTÓN DERECHO NATIVO */}
        <button
          onClick={irAdelante}
          className="bg-slate-900/95 hover:bg-pink-600 text-white w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center border border-slate-700/90 shadow-xl transition-all shrink-0 active:scale-90 z-50"
          title="Siguiente"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>

      </div>

      {/* FOOTER DISCRETO */}
      <footer className="text-center py-1 text-[9px] text-slate-600 select-none shrink-0">
        Álbum Virtual • Diseñado con Amor
      </footer>

      {/* MODAL DE VISUALIZACIÓN */}
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
              <button
                onClick={async () => {
                  await eliminarSticker(stickerSeleccionado.id)
                  setStickerSeleccionado(null)
                }}
                className="bg-red-600 hover:bg-red-500 active:scale-95 px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg text-white"
              >
                Despegar Cromo
              </button>
              <button
                onClick={() => setStickerSeleccionado(null)}
                className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-xs tracking-wide text-white transition-all border border-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ESTILOS GLOBALES */}
      <style>{`
        .real-album-body {
          background-image: radial-gradient(#1e293b 0.7px, transparent 0.7px);
          background-size: 16px 16px;
        }
        .album-flipbook {
          background-color: transparent;
          margin: 0 auto;
        }
        .page-sheet {
          box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5);
        }
        .stf__parent {
          cursor: grab;
        }
        .stf__parent:active {
          cursor: grabbing;
        }
        .stf__parent {
  cursor: default !important;
}
      `}</style>
    </div>
  )
}