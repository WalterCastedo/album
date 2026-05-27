export default function Pagina({
  pagina,
  stickers,
  onEditNombre,
  onAddSticker,
  onDeleteSticker
}) {
  return (
    <div>
      <h2>{pagina.nombre}</h2>

      <button onClick={() => {
        const nuevo = prompt("Nuevo nombre")
        if (nuevo) onEditNombre(pagina.id, nuevo)
      }}>
        Editar nombre
      </button>

      <div>
        {stickers.map((s) => (
          <div key={s.id}>
            <img src={s.url} width={80} />
            <button onClick={() => onDeleteSticker(s.id)}>
              X
            </button>
          </div>
        ))}
      </div>

      <button onClick={() =>
        onAddSticker({
          pagina_id: pagina.id,
          url: "..."
        })
      }>
        Agregar sticker
      </button>
    </div>
  )
}