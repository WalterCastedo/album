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