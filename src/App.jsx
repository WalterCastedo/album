import { useEffect, useState, useRef } from 'react'
import Modal from 'react-modal'
import { supabase } from './lib/supabase'

Modal.setAppElement('#root')

export default function App() {

  const [paginas, setPaginas] = useState([])
  const [stickers, setStickers] = useState([])
  const [paginaActiva, setPaginaActiva] = useState(null)
  const [stickerSeleccionado, setStickerSeleccionado] = useState(null)

  // ⭐ NUEVO: animación
  const [fade, setFade] = useState(true)

  const contenedorRef = useRef(null)
  const [dimensiones, setDimensiones] = useState({ w: 0, h: 0 })

  // =========================
  // ANIMACIÓN CAMBIO DE PÁGINA
  // =========================
  
function cambiarPagina(id) {
  if (id === paginaActiva) return

  setFade(false)

  setTimeout(() => {
    setPaginaActiva(id)
    setFade(true)
  }, 200) // duración del fade out
}
  // =========================
  // RESPONSIVE SIZE TRACKING
  // =========================
  useEffect(() => {
    function actualizar() {
      if (contenedorRef.current) {
        setDimensiones({
          w: contenedorRef.current.offsetWidth,
          h: contenedorRef.current.offsetHeight
        })
      }
    }

    actualizar()
    window.addEventListener('resize', actualizar)

    return () => window.removeEventListener('resize', actualizar)
  }, [])

  // =========================
  // CARGA INICIAL
  // =========================
  useEffect(() => {
    cargarPaginas()
    cargarStickers()
  }, [])

  async function cargarPaginas() {
    const { data } = await supabase.from('paginas').select('*')

    if (!data || data.length === 0) {
      const { data: nueva } = await supabase
        .from('paginas')
        .insert({
          titulo: 'Mi Primera Página ❤️',
          cantidad_fotos: 6
        })
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

  // =========================
  // COMPRESOR DE IMAGEN
  // =========================
  function comprimirImagen(file, maxWidth = 900, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (e) => {
        img.src = e.target.result
      }

      img.onload = () => {
        const canvas = document.createElement('canvas')

        const scale = maxWidth / img.width
        canvas.width = maxWidth
        canvas.height = img.height * scale

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality
        )
      }

      reader.readAsDataURL(file)
    })
  }

  // =========================
  // CREAR PÁGINA
  // =========================
  async function crearPagina() {

    const cantidad = Number(prompt("¿Cuántas fotos tendrá esta página?"))
    if (!cantidad || cantidad < 1) return

    const { data, error } = await supabase
      .from('paginas')
      .insert({
        titulo: 'Nueva Página ❤️',
        cantidad_fotos: cantidad
      })
      .select()
      .single()

    if (error) return console.error(error)

    setPaginas(prev => [...prev, data])
    setPaginaActiva(data.id)
  }

  // =========================
  // ELIMINAR PÁGINA
  // =========================
  async function eliminarPagina(id) {

    const confirmar = confirm('¿Eliminar esta página y todos sus stickers?')
    if (!confirmar) return

    await supabase.from('stickers').delete().eq('pagina_id', id)
    await supabase.from('paginas').delete().eq('id', id)

    await cargarPaginas()
    await cargarStickers()

    if (paginaActiva === id) setPaginaActiva(null)
  }

  // =========================
  // ⭐ NUEVO: RENOMBRAR PÁGINA
  // =========================
  async function renombrarPagina(id) {
    const nuevoNombre = prompt('Nuevo nombre de la página:')
    if (!nuevoNombre) return

    setPaginas(prev =>
      prev.map(p =>
        p.id === id ? { ...p, titulo: nuevoNombre } : p
      )
    )

    await supabase
      .from('paginas')
      .update({ titulo: nuevoNombre })
      .eq('id', id)
  }

  // =========================
  // TITULO (input live)
  // =========================
  let timeoutTitulo = null

  async function cambiarTitulo(id, valor) {

    setPaginas(prev =>
      prev.map(p =>
        p.id === id ? { ...p, titulo: valor } : p
      )
    )

    clearTimeout(timeoutTitulo)

    timeoutTitulo = setTimeout(async () => {
      await supabase
        .from('paginas')
        .update({ titulo: valor })
        .eq('id', id)
    }, 300)
  }

  // =========================
  // FONDO
  // =========================
  async function subirFondo(file, paginaId) {

    const imagen = await comprimirImagen(file, 1600, 0.6)
    const nombre = Date.now() + imagen.name

    await supabase.storage.from('stickers').upload(nombre, imagen)

    const { data } = supabase.storage
      .from('stickers')
      .getPublicUrl(nombre)

    await supabase
      .from('paginas')
      .update({ fondo: data.publicUrl })
      .eq('id', paginaId)

    cargarPaginas()
  }

  // =========================
  // STICKERS
  // =========================
  async function subirStickerSlot(file, paginaId, slotId) {

    const imagen = await comprimirImagen(file)
    const nombre = Date.now() + imagen.name

    await supabase.storage.from('stickers').upload(nombre, imagen)

    const { data } = supabase.storage
      .from('stickers')
      .getPublicUrl(nombre)

    await supabase
      .from('stickers')
      .insert({
        pagina_id: paginaId,
        slot_id: slotId,
        image: data.publicUrl,
        x: 0,
        y: 0
      })

    cargarStickers()
  }

  async function eliminarSticker(id) {
    await supabase.from('stickers').delete().eq('id', id)
    cargarStickers()
  }

  // =========================
  // GRID
  // =========================
  function generarSlots(cantidad) {

    const cols = Math.ceil(Math.sqrt(cantidad))
    const rows = Math.ceil(cantidad / cols)

    const ancho = dimensiones.w || 800
    const alto = dimensiones.h || 600

    const cellW = ancho / cols
    const cellH = alto / rows

    const slots = []
    let id = 1

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {

        if (id > cantidad) break

        slots.push({
          id,
          x: c * cellW + cellW / 2 - 64,
          y: r * cellH + cellH / 2 - 80
        })

        id++
      }
    }

    return slots
  }

  // =========================
  // DERIVADOS
  // =========================
  const paginaActual = paginas.find(p => p.id === paginaActiva)

  const slots = paginaActual
    ? generarSlots(paginaActual.cantidad_fotos || 6)
    : []

  const stickersPagina = stickers.filter(
    s => s.pagina_id === paginaActiva
  )

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-slate-950 text-white p-5">

      <h1 className="text-4xl text-center font-bold mb-6">
        Walter y Esmeralda
      </h1>

      {/* PAGINAS */}
      <div className="flex gap-2 justify-center mb-5 flex-wrap">
        {paginas.map(p => (
          <button
            key={p.id}
           onClick={() => cambiarPagina(p.id)}
            className={`px-4 py-2 rounded-xl ${
              paginaActiva === p.id
                ? 'bg-pink-500'
                : 'bg-white/10'
            }`}
          >
            {p.titulo}
          </button>
        ))}
      </div>

      {/* TITULO INPUT */}
      

      {/* BOTONES */}
      <div className="flex gap-3 justify-center mb-6">

        <button
          onClick={crearPagina}
          className="bg-green-500 px-4 py-2 rounded"
        >
          + Página
        </button>

        <button
          onClick={() => eliminarPagina(paginaActiva)}
          className="bg-red-500 px-4 py-2 rounded"
        >
          Eliminar página
        </button>

        {/* ⭐ NUEVO BOTÓN */}
        <button
          onClick={() => renombrarPagina(paginaActiva)}
          className="bg-yellow-500 px-4 py-2 rounded"
        >
          Renombrar página
        </button>

        <label className="bg-blue-500 px-4 py-2 rounded cursor-pointer">
          Fondo
          <input
            type="file"
            hidden
            onChange={(e) =>
              subirFondo(e.target.files[0], paginaActiva)
            }
          />
        </label>

      </div>

      {/* PAGINA CON ANIMACIÓN */}
      <div
        key={paginaActiva}
        ref={contenedorRef}
        className={`relative w-full max-w-5xl mx-auto h-[700px] rounded-2xl overflow-hidden border border-white/10 transition-all duration-500 ${
          fade ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: paginaActual?.fondo
            ? `url(${paginaActual.fondo})`
            : '',
          backgroundSize: 'cover'
        }}
      >

        {/* STICKERS */}
        {stickersPagina
          .filter(s => !s.slot_id)
          .map(s => (
            <div key={s.id} className="absolute">
              <img
                src={s.image}
                onClick={() => setStickerSeleccionado(s)}
                className="w-32 h-40 object-cover rounded-xl border-4 border-white cursor-pointer"
                style={{ left: s.x, top: s.y }}
              />

              <button
                onClick={() => eliminarSticker(s.id)}
                className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 rounded-full"
              >
                x
              </button>
            </div>
          ))}

        {/* SLOTS */}
        {slots.map(slot => {

          const sticker = stickersPagina.find(
            s => s.slot_id === slot.id
          )

          const ocupado = !!sticker

          return (
            <div
              key={slot.id}
              className="absolute"
              style={{ left: slot.x, top: slot.y }}
            >

              <label className={`block ${
                ocupado ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}>

                <input
                  type="file"
                  hidden
                  disabled={ocupado}
                  onChange={async (e) => {
                    if (ocupado) return
                    const file = await comprimirImagen(e.target.files[0])
                    subirStickerSlot(file, paginaActiva, slot.id)
                  }}
                />

                <div className="w-32 h-40 border-2 border-dashed border-gray-400 bg-white/30 flex items-center justify-center rounded-xl overflow-hidden relative">

                  {sticker ? (
                    <img
                      src={sticker.image}
                      className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                      onClick={() => setStickerSeleccionado(sticker)}
                    />
                  ) : (
                    <span className="text-xs text-gray-600">
                      click
                    </span>
                  )}

                </div>

              </label>

            </div>
          )
        })}
      </div>

      {/* MODAL */}
      <Modal
        isOpen={!!stickerSeleccionado}
        onRequestClose={() => setStickerSeleccionado(null)}
        style={{
          overlay: { background: 'rgba(0,0,0,.9)' },
          content: {
            background: 'transparent',
            border: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }
        }}
      >
        {stickerSeleccionado && (
          <div className="flex flex-col items-center gap-4">

            <img
              src={stickerSeleccionado.image}
              className="max-h-[80vh] rounded-2xl shadow-2xl"
            />

            <div className="flex gap-3">

              <button
                onClick={async () => {
                  await eliminarSticker(stickerSeleccionado.id)
                  setStickerSeleccionado(null)
                }}
                className="bg-red-600 px-4 py-2 rounded text-white"
              >
                Eliminar
              </button>

              <button
                onClick={() => setStickerSeleccionado(null)}
                className="bg-white/20 px-4 py-2 rounded text-white"
              >
                Cerrar
              </button>

            </div>

          </div>
        )}
      </Modal>

    </div>
  )
}