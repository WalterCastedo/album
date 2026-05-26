import { motion } from 'framer-motion'

export default function Sticker({
  item,
  abrir
}){

  return(

    <motion.div
      drag
      dragMomentum={false}
      whileHover={{scale:1.05}}
      className="
        absolute
        cursor-pointer
      "
      style={{
        left:item.x,
        top:item.y
      }}
      onClick={()=>abrir(item.image)}
    >

      <img
        src={item.image}
        className="
          w-36
          h-44
          object-cover
          rounded-2xl
          border-4
          border-white
          shadow-2xl
        "
      />

    </motion.div>

  )
}