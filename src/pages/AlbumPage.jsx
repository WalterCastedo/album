import { useAlbum } from "../HOOKS/useAlbum"
import Pagina from "../components/Pagina"

export default function AlbumPage() {
  const {
    paginas,
    stickers,
    loading,
    editarNombrePagina,
    agregarSticker,
    eliminarSticker
  } = useAlbum()

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      {paginas.map((p) => (
        <Pagina
          key={p.id}
          pagina={p}
          stickers={stickers.filter(s => s.pagina_id === p.id)}
          onEditNombre={editarNombrePagina}
          onAddSticker={agregarSticker}
          onDeleteSticker={eliminarSticker}
        />
      ))}
    </div>
  )
}