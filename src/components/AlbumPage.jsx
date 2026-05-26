import Sticker from './Sticker'

export default function AlbumPage({
  stickers,
  abrir
}){

  return(

    <div
      className="
        relative
        w-full
        h-[800px]
        rounded-3xl
        overflow-hidden
        border
        border-white/10
        bg-white/5
        backdrop-blur
      "
    >

      {stickers.map((item)=>(

        <Sticker
          key={item.id}
          item={item}
          abrir={abrir}
        />

      ))}

    </div>

  )
}