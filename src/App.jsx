import { useEffect, useState, useRef } from 'react'
import Modal from 'react-modal'
import HTMLFlipBook from 'react-pageflip'
import { supabase } from './lib/supabase'

Modal.setAppElement('#root')

export default function App() {
const [album, setAlbum] = useState(null)
  const [paginas, setPaginas] = useState([])
  const [stickers, setStickers] = useState([])
  const [paginaActiva, setPaginaActiva] = useState(null)
  const [stickerSeleccionado, setStickerSeleccionado] = useState(null)
  const [menuAbiertoPagina, setMenuAbiertoPagina] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  const flipBookRef = useRef(null)
const [configPortada, setConfigPortada] = useState({
  color: '#ffffff',
  size: 48,
  font: 'sans-serif',
  vertical: 'center',
  horizontal: 'center'
})

const [paginaActualFlip, setPaginaActualFlip] = useState(0)
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

  await supabase
    .from('album')
    .update({ titulo })
    .eq('id', album.id)
}
async function actualizarConfigAlbum(campo, valor) {

  if (!album) return

  setAlbum(prev => ({
    ...prev,
    [campo]: valor
  }))

  await supabase
    .from('album')
    .update({
      [campo]: valor
    })
    .eq('id', album.id)
}
async function subirPortada(file) {
  if (!file) return

  const imagen = await comprimirImagen(file, 1600, 0.7)

  const nombre = 'portada-' + Date.now() + imagen.name

  await supabase.storage
    .from('stickers')
    .upload(nombre, imagen)

  const { data } = supabase
    .storage
    .from('stickers')
    .getPublicUrl(nombre)

  await supabase
    .from('album')
    .update({ portada: data.publicUrl })
    .eq('id', album.id)

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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-1 md:p-3 font-sans selection:bg-pink-500 overflow-y-auto overflow-x-hidden real-album-body flex flex-col">
      
      <header className="max-w-5xl mx-auto text-center mb-2 select-none z-50">

  <span className="inline-block bg-gradient-to-r from-pink-500/10 to-amber-500/10 text-pink-400 text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-0.5 rounded-full border border-pink-500/20 shadow-sm">
    Álbum
  </span>

  <div className="flex flex-col items-center gap-3 mt-2">

   

    {/* TÍTULO */}
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

  {/* CONFIGURADOR PORTADA (SIEMPRE EXISTE) */}
  <div
  className={`
    absolute inset-0
    bg-slate-950/95 border border-slate-700 rounded-2xl px-3 py-2
    backdrop-blur-xl shadow-2xl
    flex flex-wrap items-center justify-center gap-2
w-full min-w-0 overflow-x-auto
    transition-all duration-300
    ${paginaActualFlip === 0 ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none scale-95'}
  `}
>
    {/* INPUT TÍTULO */}
    <input
      type="text"
      value={album?.titulo || ''}
      onChange={(e) => actualizarTitulo(e.target.value)}
      placeholder="Título del álbum"
      className="
bg-slate-800 text-white px-3 py-2 rounded-xl text-sm outline-none border border-slate-700
w-full sm:w-[160px] min-w-0 flex-1 min-w-0 flex-shrink
"
    />

    {/* SUBIR PORTADA */}
    <label className="cursor-pointer bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded-xl text-xs font-bold">
      Cambiar portada
      <input
        type="file"
        hidden
        onChange={(e) => subirPortada(e.target.files?.[0])}
      />
    </label>

    {/* COLOR */}
    <input
      type="color"
      value={configPortada.color}
      onChange={(e) =>
        setConfigPortada(prev => ({
          ...prev,
          color: e.target.value
        }))
      }
      className="w-8 h-8 rounded cursor-pointer flex-shrink-0"
    />

    {/* TAMAÑO */}
    <input
      type="range"
      min="20"
      max="90"
      value={configPortada.size}
      onChange={(e) =>
        setConfigPortada(prev => ({
          ...prev,
          size: Number(e.target.value)
        }))
      }
      className="w-[100px] max-w-[30vw] flex-shrink min-w-0"
    />

    {/* FUENTE */}
    <select
      value={configPortada.font}
      onChange={(e) =>
        setConfigPortada(prev => ({
          ...prev,
          font: e.target.value
        }))
      }
      className="
bg-slate-800 px-2 py-2 rounded text-xs
flex-shrink min-w-0 max-w-[35vw]
"
    >
      <option value="sans-serif">Sans</option>
      <option value="serif">Serif</option>
      <option value="monospace">Mono</option>
      <option value="cursive">Cursive</option>
    </select>

    {/* VERTICAL */}
    <select
      value={configPortada.vertical}
      onChange={(e) =>
        setConfigPortada(prev => ({
          ...prev,
          vertical: e.target.value
        }))
      }
       className="
bg-slate-800 px-2 py-2 rounded text-xs
flex-shrink min-w-0 max-w-[35vw]
"
    >
      <option value="top">Arriba</option>
      <option value="center">Centro</option>
      <option value="bottom">Abajo</option>
    </select>

    {/* HORIZONTAL */}
    <select
      value={configPortada.horizontal}
      onChange={(e) =>
        setConfigPortada(prev => ({
          ...prev,
          horizontal: e.target.value
        }))
      }
       className="
bg-slate-800 px-2 py-2 rounded text-xs
flex-shrink min-w-0 max-w-[35vw]
"
    >
      <option value="left">Izquierda</option>
      <option value="center">Centro</option>
      <option value="right">Derecha</option>
    </select>
  </div>

  {/* BOTÓN CREAR PÁGINA (SIEMPRE EXISTE) */}
  <div
    className={`
      absolute inset-0 flex items-center justify-center
      transition-all duration-300
      ${paginaActualFlip !== 0 ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none scale-95'}
    `}
  >
    <button
      onClick={crearPagina}
      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 px-4 py-1.5 rounded-xl text-[10px] md:text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-950/40"
    >
      ＋ Añadir Nueva Hoja
    </button>
  </div>

</div>
      {/* CONTENEDOR DE NAVEGACIÓN Y ÁLBUM */}
      <div className="w-full max-w-[1200px] mx-auto flex items-center justify-between flex-1 my-auto px-1 sm:px-4 relative">
        
        {paginas.length > 0 && (
          <>
            {/* BOTÓN IZQUIERDO MEJORADO PARA MÓVILES */}
            <button
            style={{ touchAction: 'manipulation' }}
            onTouchStart={(e) => {
  e.preventDefault()
  e.stopPropagation()
  flipBookRef.current?.pageFlip().flipPrev()
}}

onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  flipBookRef.current?.pageFlip().flipPrev()
}}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-1 md:left-4 z-[9999] shrink-0 pointer-events-auto bg-slate-800/95 hover:bg-slate-700 active:scale-95 w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center pb-1 text-slate-200 hover:text-white text-3xl md:text-4xl font-light shadow-[0_0_15px_rgba(0,0,0,0.6)] border border-slate-500/50 backdrop-blur-md transition-all"
            >
              ‹
            </button>

            {/* CONTENEDOR DEL LIBRO (Centrado) */}
            <div
  className="album-book-container relative w-full max-w-[340px] sm:max-w-[420px] md:max-w-[1000px] h-[81vh] min-h-[560px] md:h-[650px] p-0.5 md:p-1 bg-slate-900 rounded-2xl border border-slate-800/90 shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden z-10 mx-auto"
  style={{
    touchAction: 'none',
    overscrollBehavior: 'contain'
  }}
>  
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
                showCover={true}
                useMouseEvents={true}
                mobileScrollSupport={false}
                disableFlipByClick={true}
                clickEventForward={false}
                drawShadow={true}
                startPage={0}
                mode={isMobile ? 'portrait' : 'landscape'}
              onFlip={(e) => {
  const index = e.data

  setPaginaActualFlip(index)

  if (index > 0 && paginas[index - 1]) {
    setPaginaActiva(paginas[index - 1].id)
  }
}}
                ref={flipBookRef}
                className="album-flipbook h-full w-full"
              >
           {/* PORTADA DEL ÁLBUM */}
<div className="w-full h-full relative overflow-hidden bg-black">

  {/* IMAGEN */}
  {album?.portada ? (
    <img
      src={album.portada}
      alt="Portada"
      className="absolute inset-0 w-full h-full object-cover"
    />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <span className="text-8xl">📖</span>
    </div>
  )}

  {/* OVERLAY */}
  <div className="absolute inset-0 bg-black/25" />

  {/* TÍTULO */}
  <div
  className="absolute inset-0 flex p-6"
  style={{
    justifyContent:
      isMobile
        ? 'center'
        : configPortada.horizontal === 'left'
        ? 'flex-start'
        : configPortada.horizontal === 'center'
        ? 'center'
        : 'flex-end',

    alignItems:
      configPortada.vertical === 'top'
        ? 'flex-start'
        : configPortada.vertical === 'center'
        ? 'center'
        : 'flex-end',

    textAlign: isMobile ? 'center' : configPortada.horizontal
  }}
>
    <textarea
  value={album?.titulo || ''}
  onChange={(e) => {
    if (paginaActualFlip === 0) {
      actualizarTitulo(e.target.value)
    }
  }}
  readOnly={paginaActualFlip !== 0}
  rows={2}
  style={{
    color: configPortada.color,
    fontSize: `clamp(18px, ${configPortada.size / 12}vw, ${configPortada.size}px)`,
    fontFamily: configPortada.font,
    lineHeight: 1.1,
    textAlign: configPortada.horizontal
  }}
  className="
    bg-transparent
    resize-none
    outline-none
    font-black
    overflow-hidden
    max-w-[100%]
    min-w-[120px]
  "
/>
  </div>

</div>
                {paginas.map((pag, index) => {
                  const totalCromos = Math.min(pag.cantidad_fotos || 6, 9);
                  const slotsArray = Array.from({ length: totalCromos }, (_, i) => i + 1);
                  const stickersPagina = stickers.filter(s => s.pagina_id === pag.id);
                  
                  const esPaginaDerecha = !isMobile && index % 2 !== 0;

                  return (
                    <div key={pag.id} className="w-full h-full pb-15 bg-slate-900 relative overflow-hidden select-none page-sheet flex flex-col justify-between">
                      
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

                      <div 
                        className={`w-full flex justify-between items-center bg-slate-950/95 backdrop-blur-md px-3 py-2 md:px-4 md:py-3 border-b border-white/10 z-50 relative shrink-0 ${
                          esPaginaDerecha ? 'flex-row-reverse' : 'flex-row'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={`flex flex-col min-w-0 ${esPaginaDerecha ? 'items-end text-right' : 'items-start text-left'}`}>
                          <span className="text-[11px] md:text-xs font-black tracking-wide text-slate-100 truncate max-w-[120px] md:max-w-[240px]">
                            {pag.titulo}
                          </span>
                          <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-400 mt-0.5">
                            PÁGINA {index + 1 < 10 ? `0${index + 1}` : index + 1} / {paginas.length}
                          </span>
                        </div>

                        <div className="relative">
                          <button
                            onClick={() => setMenuAbiertoPagina(menuAbiertoPagina === pag.id ? null : pag.id)}
                            className="bg-slate-900 hover:bg-slate-800 px-2 py-0.5 md:px-2.5 md:py-1 rounded-xl text-[10px] md:text-[11px] font-bold border border-slate-700 text-slate-200 flex items-center gap-1 transition-all active:scale-95 shadow-sm pointer-events-auto"
                          >
                            ⚙️ Ver opciones
                          </button>

                          {menuAbiertoPagina === pag.id && (
                            <div className={`absolute mt-2 w-44 bg-slate-950/95 border border-slate-800 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 py-1 overflow-hidden backdrop-blur-md ${
                              esPaginaDerecha ? 'left-0' : 'right-0'
                            }`}>
                              <button
                                onClick={() => { renombrarPagina(pag.id); setMenuAbiertoPagina(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2 pointer-events-auto"
                              >
                                ✏️ Renombrar Hoja
                              </button>
                              
                              <label className="w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition-colors text-slate-300 flex items-center gap-2 cursor-pointer block pointer-events-auto">
                                🖼️ Cambiar Fondo
                                <input type="file" hidden onChange={(e) => { subirFondo(e.target.files?.[0], pag.id); setMenuAbiertoPagina(null); }} />
                              </label>
                              
                              <div className="border-t border-slate-900 my-1" />
                              
                              <button
                                onClick={() => { eliminarPagina(pag.id); setMenuAbiertoPagina(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-red-950/40 hover:text-red-400 transition-colors text-red-400/90 flex items-center gap-2 font-medium pointer-events-auto"
                              >
                                🗑️ Eliminar Hoja
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-full flex-1 flex flex-col justify-start items-center mt-0 content-center p-0 pt-0 md:p-0 md:pt-0 relative z-10 box-border overflow-hidden">
                        <div className="w-full flex flex-col justify-center items-center gap-1 md:gap-2 h-full">
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
                                          <div className="w-full h-full p-0.5 bg-white relative group pointer-events-auto">
                                            <img
                                              src={sticker.image}
                                              className="w-full h-full object-cover rounded-lg cursor-pointer"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setStickerSeleccionado(sticker);
                                              }}
                                              alt="Cromo"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center select-none text-center p-0.5 pointer-events-none">
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

            {/* BOTÓN DERECHO MEJORADO PARA MÓVILES */}
            <button
            style={{ touchAction: 'manipulation' }}
            onTouchStart={(e) => {
  e.preventDefault()
  e.stopPropagation()
  flipBookRef.current?.pageFlip().flipNext()
}}

onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  flipBookRef.current?.pageFlip().flipNext()
}}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-1 md:right-4 z-[9999] shrink-0 pointer-events-auto bg-slate-800/95 hover:bg-slate-700 active:scale-95 w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center pb-1 text-slate-200 hover:text-white text-3xl md:text-4xl font-light shadow-[0_0_15px_rgba(0,0,0,0.6)] border border-slate-500/50 backdrop-blur-md transition-all"
            >
              ›
            </button>
          </>
        )}

      </div>

      <footer className="text-center py-1 text-[9px] text-slate-600 select-none shrink-0 z-50">
        Álbum Virtual • Diseñado con Amor
      </footer>

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
        .stf__parent { cursor: default !important; }
        .stf__block { pointer-events: auto !important; }
        .page-sheet { pointer-events: auto; }
        .stf__block, .stf__item, .page-sheet { pointer-events: auto !important; }

        .album-book-container {
          position: relative;
          z-index: 10;
        }
        
        .stf__parent {
          cursor: default !important;
          overflow: visible !important;
        }
      `}</style>
    </div>
  )
}