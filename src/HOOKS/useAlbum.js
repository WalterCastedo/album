import { useEffect, useState } from "react"
import {
  getPaginas,
  getStickers,
  updatePaginaNombre,
  createSticker,
  deleteSticker
} from "../services/supabaseService"

export function useAlbum() {
  const [paginas, setPaginas] = useState([])
  const [stickers, setStickers] = useState([])
  const [loading, setLoading] = useState(true)

  const cargarDatos = async () => {
    const { data: p } = await getPaginas()
    const { data: s } = await getStickers()

    setPaginas(p || [])
    setStickers(s || [])
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const editarNombrePagina = async (id, nombre) => {
    await updatePaginaNombre(id, nombre)
    cargarDatos()
  }

  const agregarSticker = async (data) => {
    await createSticker(data)
    cargarDatos()
  }

  const eliminarSticker = async (id) => {
    await deleteSticker(id)
    cargarDatos()
  }

  return {
    paginas,
    stickers,
    loading,
    editarNombrePagina,
    agregarSticker,
    eliminarSticker
  }
}