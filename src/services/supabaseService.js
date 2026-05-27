import { supabase } from "../lib/supabase"

// PAGINAS
export const getPaginas = () =>
  supabase.from("paginas").select("*")

export const updatePaginaNombre = (id, nombre) =>
  supabase.from("paginas").update({ nombre }).eq("id", id)

// STICKERS
export const getStickers = () =>
  supabase.from("stickers").select("*")

export const createSticker = (data) =>
  supabase.from("stickers").insert(data)

export const deleteSticker = (id) =>
  supabase.from("stickers").delete().eq("id", id)