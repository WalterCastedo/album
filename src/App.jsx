import { useEffect, useRef, useState, useMemo } from "react";
import Modal from "react-modal";
import { supabase } from "./lib/supabase";

Modal.setAppElement("#root");

export default function App() {
  const [album, setAlbum] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [stickerSeleccionado, setStickerSeleccionado] = useState(null);
  const [menuAbiertoPagina, setMenuAbiertoPagina] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState("");
  // ESTADO DE NAVEGACIÓN Y ANIMACIÓN
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState(4);
  const SLOT_W = 115;
  const [bloquearDrag, setBloquearDrag] = useState(false);
  const SLOT_H = 0;
  const movedRef = useRef(false);
  const [configPortada, setConfigPortada] = useState({
    color: "#ffffff",
    size: 48,
    font: "sans-serif",
    vertical: "center",
    horizontal: "center",
  });
  const dragRef = useRef(null);
  // ESTRUCTURA DEL LIBRO
  const bookPages = useMemo(
    () => [
      { isBlankCover: true },
      { id: "portada", isPortada: true },
      ...paginas,
    ],
    [paginas],
  );

  // DETECTOR RESPONSIVO DE PANTALLA
  useEffect(() => {
    const comprobarPantalla = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      setCurrentIndex((prev) => {
        if (!mobile && prev % 2 !== 0) return Math.max(0, prev - 1);
        if (mobile && prev === 0) return 1;
        return prev;
      });
    };
    comprobarPantalla();
    window.addEventListener("resize", comprobarPantalla);
    return () => window.removeEventListener("resize", comprobarPantalla);
  }, []);

  // CARGA INICIAL DE DATOS
  useEffect(() => {
    cargarAlbum();
    cargarPaginas();
    cargarStickers();
  }, []);
  function iniciarDrag(e, sticker) {
    e.preventDefault();
    movedRef.current = false;

    const isTouch = e.touches?.[0];
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      id: sticker.id,
      lastX: clientX,
      lastY: clientY,
    };

    window.addEventListener("mousemove", mover);
    window.addEventListener("touchmove", mover);
    window.addEventListener("mouseup", soltar);
    window.addEventListener("touchend", soltar);
  }
  function mover(e) {
    if (!dragRef.current) return;

    movedRef.current = true;

    const isTouch = e.touches?.[0];
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragRef.current.lastX;
    const dy = clientY - dragRef.current.lastY;

    dragRef.current.lastX = clientX;
    dragRef.current.lastY = clientY;

    const id = dragRef.current.id;

    setStickers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const zoom = Math.max(getMinZoom(s), s.zoom ?? 1);

        const newX = (s.x ?? 0) + dx;
        const newY = (s.y ?? 0) + dy;

        const limitado = limitarMovimiento(newX, newY, zoom);

        return {
          ...s,
          x: limitado.x,
          y: limitado.y,
        };
      }),
    );
  }
  function limitarMovimiento(x, y, zoom) {
    const currentW = SLOT_W * zoom;
    const currentH = SLOT_H * zoom;

    // Calculamos cuánto sobra de la imagen respecto al slot
    // Si sobra (es positivo), permitimos movernos en ese rango
    // Si no sobra (es negativo), fijamos el límite en 0 (centrado)
    const limitX = Math.max(0, (currentW - SLOT_W) / 2);
    const limitY = Math.max(0, (currentH - SLOT_H) / 2);

    return {
      x: Math.max(-limitX, Math.min(limitX, x)),
      y: Math.max(-limitY, Math.min(limitY, y)),
    };
  }
  async function soltar() {
    if (!dragRef.current) return;

    const id = dragRef.current.id;
    const sticker = stickers.find((s) => s.id === id);

    if (sticker) {
      await supabase
        .from("stickers")
        .update({
          x: sticker.x,
          y: sticker.y,
          zoom: sticker.zoom,
        })
        .eq("id", id);
    }

    dragRef.current = null;

    window.removeEventListener("mousemove", mover);
    window.removeEventListener("touchmove", mover);
    window.removeEventListener("mouseup", soltar);
    window.removeEventListener("touchend", soltar);

    setTimeout(() => {
      movedRef.current = false;
    }, 0);
  }
  async function cargarAlbum() {
    const { data, error } = await supabase
      .from("album")
      .select("*")
      .limit(1)
      .single();
    if (!error) setAlbum(data);
  }
  async function actualizarSticker(id, cambios) {
    setStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)),
    );

    await supabase.from("stickers").update(cambios).eq("id", id);
  }
  async function actualizarTitulo(titulo) {
    setAlbum((prev) => ({ ...prev, titulo }));
    await supabase.from("album").update({ titulo }).eq("id", album.id);
  }

  async function subirPortada(file) {
    if (!file) return;
    const imagen = await convertirAJPG(file, 1600, 0.7);
    const nombre = "portada-" + Date.now() + imagen.name;
    await supabase.storage.from("stickers").upload(nombre, imagen);
    const { data } = supabase.storage.from("stickers").getPublicUrl(nombre);
    await supabase
      .from("album")
      .update({ portada: data.publicUrl })
      .eq("id", album.id);
    cargarAlbum();
  }

  async function cargarPaginas() {
    const { data } = await supabase
      .from("paginas")
      .select("*")
      .order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      const { data: nueva } = await supabase
        .from("paginas")
        .insert({ titulo: "Mi Primera Página ❤️", cantidad_fotos: 4 })
        .select();
      setPaginas(nueva);
      return;
    }
    setPaginas(data);
  }

  async function cargarStickers() {
    const { data } = await supabase.from("stickers").select("*");
    setStickers(data || []);
  }

  function comprimirImagen(file, maxWidth = 900, quality = 0.7) {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      reader.readAsDataURL(file);
    });
  }

  // OPERACIONES DEL ÁLBUM
  async function crearPagina() {
    let nombre = prompt("Nombre de la hoja:");
    if (!nombre) return;

    let cantidad = Number(prompt("Cantidad de fotos (1 - 9):"));
    if (!cantidad) return;

    if (cantidad < 1) cantidad = 1;
    if (cantidad > 9) cantidad = 9;

    const { data, error } = await supabase
      .from("paginas")
      .insert({
        titulo: nombre,
        cantidad_fotos: cantidad,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setPaginas((prev) => [...prev, data]);
  }
  async function crearPaginaConfirmada() {
    if (!nuevoNombre) return;

    const { data, error } = await supabase
      .from("paginas")
      .insert({
        titulo: nuevoNombre,
        cantidad_fotos: nuevaCantidad,
      })
      .select()
      .single();

    if (error) return console.error(error);

    setModalCrear(false);
    setNuevoNombre("");
    setNuevaCantidad(4);

    setPaginas((prev) => {
      const nuevas = [...prev, data];

      setToast("Página creada correctamente");
      setTimeout(() => setToast(""), 2000);

      return nuevas;
    });
  }

  async function eliminarPagina(id) {
    const confirmar = confirm("¿Eliminar esta página y todos sus stickers?");
    if (!confirmar) return;
    await supabase.from("stickers").delete().eq("pagina_id", id);
    await supabase.from("paginas").delete().eq("id", id);
    await cargarPaginas();
    await cargarStickers();

    const prevIndex = Math.max(
      isMobile ? 1 : 0,
      currentIndex - (isMobile ? 1 : 2),
    );
    ejecutarAnimacion(prevIndex, "prev");
  }

  async function renombrarPagina(id) {
    const nuevoNombre = prompt("Nuevo nombre de la página:");
    if (!nuevoNombre) return;
    setPaginas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, titulo: nuevoNombre } : p)),
    );
    await supabase.from("paginas").update({ titulo: nuevoNombre }).eq("id", id);
  }

  async function subirFondo(file, paginaId) {
    if (!file) return;
    const imagen = await convertirAJPG(file, 1600, 0.7);
    const nombre = Date.now() + imagen.name;
    await supabase.storage.from("stickers").upload(nombre, imagen);
    const { data } = supabase.storage.from("stickers").getPublicUrl(nombre);
    await supabase
      .from("paginas")
      .update({ fondo: data.publicUrl })
      .eq("id", paginaId);
    cargarPaginas();
  }

  async function subirStickerSlot(file, paginaId, slotId) {
    const imagen = await convertirAJPG(file, 1600, 0.7);

    const nombre = Date.now() + imagen.name;
    await supabase.storage.from("stickers").upload(nombre, imagen);
    const { data } = supabase.storage.from("stickers").getPublicUrl(nombre);

    // obtener dimensiones reales
    const img = new Image();
    const urlTemp = URL.createObjectURL(imagen);

    const { naturalWidth, naturalHeight } = await new Promise((resolve) => {
      img.onload = () => {
        resolve({
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        });
      };
      img.src = urlTemp;
    });

    URL.revokeObjectURL(urlTemp);

    await supabase.from("stickers").insert({
      pagina_id: paginaId,
      slot_id: slotId,
      image: data.publicUrl,
      x: 0,
      y: 0,
      zoom: 1,
      naturalWidth,
      naturalHeight,
    });

    cargarStickers();
  }
  function getMinZoom(sticker) {
    if (!sticker.naturalWidth || !sticker.naturalHeight) return 1;

    const scaleX = SLOT_W / sticker.naturalWidth;
    const scaleY = SLOT_H / sticker.naturalHeight;

    // Usamos Math.max para asegurar que cubra toda el área (cover)
    return Math.max(scaleX, scaleY);
  }
  async function eliminarSticker(id) {
    await supabase.from("stickers").delete().eq("id", id);
    cargarStickers();
  }

  function convertirAJPG(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;

        let done = false;

        img.onload = () => {
          if (done) return;
          done = true;

          const canvas = document.createElement("canvas");

          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(null);
                return;
              }

              const name = file.name.replace(/\.[^/.]+$/, "") + ".jpg";

              resolve(
                new File([blob], name, {
                  type: "image/jpeg",
                }),
              );
            },
            "image/jpeg",
            quality,
          );
        };

        img.onerror = () => {
          if (done) return;
          done = true;
          resolve(null);
        };
      };

      reader.onerror = () => resolve(null);

      reader.readAsDataURL(file);
    });
  }

  const agruparCromos = (slots) => {
    const n = slots.length;
    if (n === 1) return [slots];
    if (n === 2) return [[slots[0]], [slots[1]]];
    if (n === 3) return [[slots[0]], [slots[1], slots[2]]];
    if (n === 4) return [slots.slice(0, 2), slots.slice(2, 4)];
    if (n === 5) return [slots.slice(0, 2), slots.slice(2, 5)];
    if (n === 6)
      return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 6)];
    if (n === 7)
      return [slots.slice(0, 2), slots.slice(2, 4), slots.slice(4, 7)];
    if (n === 8)
      return [slots.slice(0, 2), slots.slice(2, 5), slots.slice(5, 8)];
    if (n === 9)
      return [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)];
    return [slots];
  };

  // ===================== MOTOR DE ANIMACIÓN =====================
  const ejecutarAnimacion = (newIndex, dir) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);
    setCurrentIndex(newIndex);

    setTimeout(() => {
      setIsAnimating(false);
      setDirection("");
    }, 600);
  };

  const handleNext = () => {
    const maxIndex = isMobile
      ? bookPages.length - 1
      : Math.ceil(bookPages.length / 2) * 2 - 2;
    if (currentIndex >= maxIndex) return;
    const newIndex = Math.min(maxIndex, currentIndex + (isMobile ? 1 : 2));
    ejecutarAnimacion(newIndex, "next");
  };

  const handlePrev = () => {
    if (currentIndex <= (isMobile ? 1 : 0)) return;
    const newIndex = Math.max(
      isMobile ? 1 : 0,
      currentIndex - (isMobile ? 1 : 2),
    );
    ejecutarAnimacion(newIndex, "prev");
  };

  const isViewingCover = currentIndex === 1;

  const paginaIzquierda = bookPages[currentIndex];
  const paginaDerecha = isMobile ? null : bookPages[currentIndex + 1];
  const isMenuLeftOpen = menuAbiertoPagina === paginaIzquierda?.id;
  const isMenuRightOpen = !isMobile && menuAbiertoPagina === paginaDerecha?.id;

  // ===================== RENDERIZADOR DE PÁGINAS =====================
  const renderItem = (item, isLeftPage) => {
    if (!item || item.isBlankCover) {
      return (
        <div className="absolute inset-0 z-0 bg-slate-800 flex items-center justify-center border-slate-700 border-8 overflow-hidden book-texture rounded-[inherit]">
          <div className="absolute inset-0 bg-black/40" />
        </div>
      );
    }

    if (item.isPortada) {
      return (
        <>
          <div className="absolute inset-0 z-0 bg-black overflow-hidden rounded-[inherit] border-slate-700 border-r-4">
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
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          </div>

          <div
            className="absolute inset-0 flex p-6 pointer-events-none z-10"
            style={{
              justifyContent:
                configPortada.horizontal === "left"
                  ? "flex-start"
                  : configPortada.horizontal === "center"
                    ? "center"
                    : "flex-end",
              alignItems:
                configPortada.vertical === "top"
                  ? "flex-start"
                  : configPortada.vertical === "center"
                    ? "center"
                    : "flex-end",
            }}
          >
            <textarea
              value={album?.titulo || ""}
              onChange={(e) => actualizarTitulo(e.target.value)}
              rows={3}
              style={{
                color: configPortada.color,
                fontSize: `clamp(24px, ${configPortada.size / 10}vw, ${configPortada.size}px)`,
                fontFamily: configPortada.font,
                lineHeight: 1.1,
                textAlign: configPortada.horizontal,
              }}
              className="pointer-events-auto bg-transparent resize-none outline-none font-black max-w-[100%] min-w-[120px]"
            />
          </div>
        </>
      );
    }

    return (
      <>
        {/* FONDO AISLADO */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-slate-900">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: item.fondo
                ? `linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.5)), url("${item.fondo}")`
                : "radial-gradient(circle at center, #1e293b 1.2px, transparent 1.2px)",
              backgroundSize: item.fondo ? "cover" : "24px 24px",
              backgroundPosition: "center",
              backgroundRepeat: item.fondo ? "no-repeat" : "repeat",
            }}
          />
        </div>

        {/* CONTENIDO INTERACTIVO */}
        <div className="relative z-10 w-full h-full pb-6 select-none flex flex-col justify-between">
          <div
            className={`relative z-[100] w-full flex justify-between items-center bg-slate-950/90 backdrop-blur-md px-4 py-2 border-b border-white/10 shrink-0 ${isLeftPage ? "flex-row" : "flex-row-reverse"}`}
          >
            <div
              className={`flex flex-col min-w-0 ${isLeftPage ? "items-start text-left" : "items-end text-right"}`}
            >
              <span className="text-[12px] md:text-sm font-black tracking-wide text-slate-100 truncate max-w-[150px] md:max-w-[200px]">
                {item.titulo}
              </span>
            </div>

            <div className="relative z-[99999]">
              <button
                onClick={() =>
                  setMenuAbiertoPagina(
                    menuAbiertoPagina === item.id ? null : item.id,
                  )
                }
                className="bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-xl text-[10px] font-bold border border-slate-600 text-slate-200 flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                ⚙️ Opciones
              </button>

              {/* MENÚ FLOTANTE */}
              {menuAbiertoPagina === item.id && (
                <div
                  className={`absolute top-full mt-2 w-44 bg-slate-950/95 border border-slate-700 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.9)] z-[99999] py-1 backdrop-blur-xl ${isLeftPage ? "right-0" : "left-0"}`}
                >
                  <button
                    onClick={() => {
                      renombrarPagina(item.id);
                      setMenuAbiertoPagina(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300"
                  >
                    ✏️ Renombrar Hoja
                  </button>
                  {/* AQUÍ ESTÁ EL ACCEPT="IMAGE/*" PARA EL FONDO */}
                  <label className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 cursor-pointer block">
                    🖼️ Cambiar Fondo{" "}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        subirFondo(e.target.files?.[0], item.id);
                        setMenuAbiertoPagina(null);
                      }}
                    />
                  </label>
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    onClick={() => {
                      eliminarPagina(item.id);
                      setMenuAbiertoPagina(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/50 text-red-400 font-medium"
                  >
                    🗑️ Eliminar Hoja
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="w-full h-full flex-1 flex flex-col justify-start items-center mt-2 content-center p-2 relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="w-full flex flex-col justify-center items-center gap-3 h-full">
              {agruparCromos(
                Array.from(
                  { length: Math.min(item.cantidad_fotos || 6, 9) },
                  (_, i) => i + 1,
                ),
              ).map((fila, indexFila) => (
                <div
                  key={`fila-${indexFila}`}
                  className="flex flex-row justify-center items-center gap-3 w-full"
                >
                  {fila.map((slotId) => {
                    const sticker = stickers
                      .filter((s) => s.pagina_id === item.id)
                      .find((s) => s.slot_id === slotId);

                    const ocupado = !!sticker;
                    const esEspecial = slotId % 2 === 0;

                    return (
                      <div
                        key={slotId}
                        className="w-[95px] h-[120px] sm:w-[100px] sm:h-[130px] md:w-[115px] md:h-[150px] pointer-events-auto shadow-md rounded-xl transition-all duration-300 shrink-0"
                      >
                        <div className="w-full h-full relative">
                          {/* INPUT SOLO SI ESTÁ VACÍO */}
                          {!sticker && (
                            <label>
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  subirStickerSlot(file, item.id, slotId);
                                }}
                              />
                            </label>
                          )}

                          {/* SLOT */}
                          <div
                            className={`w-full h-full transition-all duration-300 relative rounded-xl overflow-hidden flex items-center justify-center border-2 ${
                              ocupado
                                ? "border-white bg-white shadow-lg shadow-black/80"
                                : esEspecial
                                  ? "border-dashed border-amber-400/50 bg-amber-500/10"
                                  : "border-dashed border-slate-600 bg-slate-950/80"
                            }`}
                          >
                            {/* SI HAY STICKER */}
                            {sticker ? (
                              <div
                                className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  iniciarDrag(e, sticker);
                                }}
                                onTouchStart={(e) => {
                                  e.preventDefault();
                                  iniciarDrag(e, sticker);
                                }}
                                onWheel={(e) => {
                                  e.preventDefault();

                                  const stickerData = stickers.find(
                                    (s) => s.id === sticker.id,
                                  );
                                  const minZoom = getMinZoom(sticker);
                                  const newZoom = Math.max(
                                    minZoom,
                                    Math.min(3, (sticker.zoom ?? 1) + delta),
                                  );

                                  // Al actualizar el zoom, recalcula también la posición x, y
                                  // para evitar que la imagen quede "fuera" al cambiar el zoom
                                  const limit = limitarMovimiento(
                                    sticker.x,
                                    sticker.y,
                                    newZoom,
                                  );

                                  actualizarSticker(sticker.id, {
                                    zoom: newZoom,
                                    x: limit.x,
                                    y: limit.y,
                                  });
                                }}
                              >
                                <div
                                  className="absolute flex items-center justify-center"
                                  style={{
                                    transform: `translate(${sticker.x ?? 0}px, ${sticker.y ?? 0}px) scale(${sticker.zoom ?? 1})`,
                                    transformOrigin: "center",
                                  }}
                                >
                                  <img
                                    src={sticker.image}
                                    draggable={false}
                                    onDragStart={(e) => e.preventDefault()}
                                    className="max-w-full max-h-full object-contain select-none"
                                    onClick={() => {
                                      if (!movedRef.current) {
                                        setStickerSeleccionado(sticker);
                                        setBloquearDrag(true);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              /* SLOT VACÍO */
                              <div className="flex flex-col items-center justify-center select-none text-center p-0.5 pointer-events-none opacity-80">
                                <span
                                  className={`text-[8px] md:text-[9px] font-mono tracking-tighter uppercase font-bold ${
                                    esEspecial
                                      ? "text-amber-400"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {esEspecial ? "★ BRILL" : "CROMO"}
                                </span>
                                <span
                                  className={`text-xl md:text-3xl font-black tracking-tighter font-mono ${
                                    esEspecial
                                      ? "text-amber-300"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {slotId < 10 ? `0${slotId}` : slotId}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`absolute bottom-2 ${isLeftPage ? "left-4" : "right-4"} text-[10px] font-mono text-white/50 font-bold z-0 pointer-events-none`}
          >
            {item.titulo ? `PÁG. ${bookPages.indexOf(item)}` : ""}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-1 md:p-3 font-sans selection:bg-pink-500 overflow-y-auto overflow-x-hidden real-album-body flex flex-col">
      {toast && (
        <div className="fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl text-lg font-bold animate-pulse">
            {toast}
          </div>
        </div>
      )}
      <header className="max-w-5xl mx-auto text-center mb-2 select-none z-50">
        <span className="inline-block bg-gradient-to-r from-pink-500/10 to-amber-500/10 text-pink-400 text-[10px] md:text-xs font-bold tracking-widest uppercase px-3 py-0.5 rounded-full border border-pink-500/20 shadow-sm">
          Mi Álbum Virtual
        </span>
        <div className="flex flex-col items-center gap-3 mt-2">
          <input
            type="text"
            value={album?.titulo || ""}
            disabled
            placeholder="Título del álbum"
            className="bg-transparent text-center text-xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-rose-300 to-amber-300 bg-clip-text text-transparent outline-none border-b border-pink-500/20 px-2 py-1 max-w-[90vw]"
          />
        </div>
      </header>

      {/* BARRA DE HERRAMIENTAS - ARREGLO DEL DESBORDAMIENTO (CARRUSEL HORIZONTAL) */}
      <div className="w-full max-w-[1200px] mx-auto mb-3 min-h-[70px] relative flex items-center justify-center z-50">
        <div
          className={`absolute inset-0 bg-slate-900/95 border border-slate-700 rounded-2xl px-3 py-2 backdrop-blur-xl shadow-xl flex flex-nowrap items-center justify-start md:justify-center gap-3 w-full overflow-x-auto custom-scrollbar transition-all duration-300 ${isViewingCover ? "opacity-100 visible translate-y-0 z-10" : "opacity-0 invisible pointer-events-none -translate-y-4 -z-10"}`}
        >
          <input
            type="text"
            value={album?.titulo || ""}
            onChange={(e) => actualizarTitulo(e.target.value)}
            placeholder="Título del álbum"
            className="bg-slate-950 text-white px-3 py-1.5 rounded-xl text-sm outline-none border border-slate-700 shrink-0 w-[140px] sm:w-[150px]"
          />

          {/* AQUÍ ESTÁ EL ACCEPT="IMAGE/*" PARA LA PORTADA */}
          <label className="cursor-pointer bg-pink-600 hover:bg-pink-500 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
            Cambiar portada{" "}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => subirPortada(e.target.files?.[0])}
            />
          </label>

          <input
            type="color"
            value={configPortada.color}
            onChange={(e) =>
              setConfigPortada((prev) => ({ ...prev, color: e.target.value }))
            }
            className="w-8 h-8 rounded cursor-pointer shrink-0"
          />
          <input
            type="range"
            min="20"
            max="90"
            value={configPortada.size}
            onChange={(e) =>
              setConfigPortada((prev) => ({
                ...prev,
                size: Number(e.target.value),
              }))
            }
            className="w-[70px] shrink-0"
          />
          <select
            value={configPortada.font}
            onChange={(e) =>
              setConfigPortada((prev) => ({ ...prev, font: e.target.value }))
            }
            className="bg-slate-950 px-2 py-1.5 rounded text-xs shrink-0"
          >
            <option value="sans-serif">Sans</option>
            <option value="serif">Serif</option>
            <option value="monospace">Mono</option>
            <option value="cursive">Cursive</option>
          </select>
          <select
            value={configPortada.vertical}
            onChange={(e) =>
              setConfigPortada((prev) => ({
                ...prev,
                vertical: e.target.value,
              }))
            }
            className="bg-slate-950 px-2 py-1.5 rounded text-xs shrink-0"
          >
            <option value="top">Arriba</option>
            <option value="center">Centro</option>
            <option value="bottom">Abajo</option>
          </select>
          <select
            value={configPortada.horizontal}
            onChange={(e) =>
              setConfigPortada((prev) => ({
                ...prev,
                horizontal: e.target.value,
              }))
            }
            className="bg-slate-950 px-2 py-1.5 rounded text-xs shrink-0"
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>

        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${!isViewingCover ? "opacity-100 visible translate-y-0" : "opacity-0 invisible pointer-events-none -translate-y-4"}`}
        >
          <button
            onClick={() => setModalCrear(true)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 rounded-xl"
          >
            ＋ Nueva Hoja
          </button>
        </div>
      </div>

      {/* ======================= CONTENEDOR DEL LIBRO ======================= */}
      <div className="w-full max-w-[1100px] mx-auto flex flex-row items-center justify-center my-0 px-1 sm:px-12 relative min-h-[75vh] md:min-h-[600px] perspective-container">
        {/* BOTÓN IZQUIERDO */}
        {(isMobile ? currentIndex > 1 : currentIndex > 0) && (
          <button
            onClick={handlePrev}
            disabled={isAnimating}
            className="absolute left-1 sm:left-0 top-1/2 -translate-y-1/2 z-[9999] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-3xl font-light shadow-2xl border border-slate-600 transition-all disabled:opacity-50"
          >
            ‹
          </button>
        )}

        {/* EL LIBRO */}
        <div
          className={`w-full flex ${isMobile ? "max-w-[420px] flex-col" : "max-w-[1000px] flex-row"} h-[75vh] md:h-[650px] relative mx-auto rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.9)]`}
        >
          {/* LOMO CENTRAL (Solo Desktop) - AHORA CON z-[1000] PARA NO DESAPARECER */}
          {!isMobile && (
            <div className="absolute left-1/2 top-0 bottom-0 w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/60 to-transparent z-[1000] pointer-events-none mix-blend-multiply" />
          )}

          {/* PÁGINA IZQUIERDA (O única en móvil) */}
          <div
            className={`h-full relative ${
              isMobile
                ? "w-full rounded-xl border border-slate-700"
                : "w-1/2 rounded-l-xl border-y border-l border-slate-700 shadow-[inset_-25px_0_40px_rgba(0,0,0,0.6)]"
            } ${isMenuLeftOpen ? "z-[999]" : "z-20"} ${
              direction === "prev"
                ? isMobile
                  ? "mobile-turn-uniform"
                  : "page-turn-prev"
                : direction === "next"
                  ? isMobile
                    ? "mobile-turn-uniform"
                    : "page-fade-in"
                  : ""
            }`}
          >
            {renderItem(paginaIzquierda, true)}
          </div>

          {/* PÁGINA DERECHA (Desktop) */}
          {!isMobile && (
            <div
              className={`h-full w-1/2 relative rounded-r-xl border-y border-r border-slate-700 shadow-[inset_25px_0_40px_rgba(0,0,0,0.6)] ${isMenuRightOpen ? "z-[999]" : "z-10"} ${
                direction === "next"
                  ? "page-turn-next"
                  : direction === "prev"
                    ? "page-fade-in"
                    : ""
              }`}
            >
              {renderItem(paginaDerecha, false)}
            </div>
          )}
        </div>

        {/* BOTÓN DERECHO */}
        {(isMobile
          ? currentIndex < bookPages.length - 1
          : currentIndex < bookPages.length - 2) && (
          <button
            onClick={handleNext}
            disabled={isAnimating}
            className="absolute right-1 sm:right-0 top-1/2 -translate-y-1/2 z-[9999] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-3xl font-light shadow-2xl border border-slate-600 transition-all disabled:opacity-50"
          >
            ›
          </button>
        )}
      </div>

      <footer className="text-center py-4 text-[11px] text-slate-500 font-medium tracking-wide z-50">
        Álbum Virtual • Diseñado con Amor
      </footer>

      {/* MODAL CROMO AMPLIADO */}
      <Modal
        isOpen={!!stickerSeleccionado}
        onRequestClose={() => setStickerSeleccionado(null)}
        style={{
          overlay: {
            background: "rgba(2, 6, 23, 0.95)",
            backdropFilter: "blur(12px)",
            zIndex: 100,
          },
          content: {
            background: "transparent",
            border: "none",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            inset: "0px",
          },
        }}
      >
        {stickerSeleccionado && (
          <div className="flex flex-col items-center gap-5 max-w-[320px] w-full animate-in fade-in zoom-in-75 duration-200">
            <div className="p-3 bg-white rounded-2xl shadow-2xl transform rotate-1 border-4 border-slate-100">
              <img
                src={stickerSeleccionado.image}
                className="max-h-[60vh] object-contain rounded-xl"
                alt="Cromo ampliado"
              />
            </div>
            <div className="flex gap-3 w-full justify-center">
              <button
                onClick={async () => {
                  await eliminarSticker(stickerSeleccionado.id);
                  setStickerSeleccionado(null);
                  setBloquearDrag(false);
                }}
                className="bg-red-600 hover:bg-red-500 active:scale-95 px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl text-white"
              >
                Despegar
              </button>
              <button
                onClick={() => {
                  setStickerSeleccionado(null);
                  setBloquearDrag(false);
                }}
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-xl"
              >
                Cerrar
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(stickerSeleccionado.image);
                    const blob = await response.blob();

                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement("a");

                    link.href = url;
                    link.download = `cromo-${stickerSeleccionado.id}.jpg`;

                    document.body.appendChild(link);
                    link.click();

                    link.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error("Error al descargar:", error);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl text-white"
              >
                Descargar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modalCrear}
        onRequestClose={() => setModalCrear(false)}
        style={{
          overlay: { background: "rgba(0,0,0,0.85)" },
          content: {
            inset: 0,
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      >
        <div className="bg-slate-900 p-6 rounded-2xl w-[300px] flex flex-col gap-3 border border-slate-700">
          <h2 className="text-lg font-bold text-center">Nueva Hoja</h2>

          {/* NOMBRE */}
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre de la hoja"
            className="px-3 py-2 rounded bg-slate-800 outline-none"
          />

          {/* SELECTOR 1-9 */}
          <select
            value={nuevaCantidad}
            onChange={(e) => setNuevaCantidad(Number(e.target.value))}
            className="px-3 py-2 rounded bg-slate-800"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n} imágenes
              </option>
            ))}
          </select>

          {/* BOTONES */}
          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => setModalCrear(false)}
              className="px-3 py-2 bg-slate-700 rounded"
            >
              Cancelar
            </button>

            <button
              onClick={crearPaginaConfirmada}
              className="px-3 py-2 bg-emerald-600 rounded"
            >
              Crear
            </button>
          </div>
        </div>
      </Modal>
      {/* MOTOR CSS 3D */}
      <style>{`
        .real-album-body {
          background-color: #020617; 
          background-image: radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0);
          background-size: 24px 24px;
        }

        .book-texture {
          background-image: 
            repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000),
            repeating-linear-gradient(45deg, #000 25%, #1e293b 25%, #1e293b 75%, #000 75%, #000);
          background-position: 0 0, 10px 10px;
          background-size: 20px 20px;
        }
        
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.3); }

        /* ================= PERSPECTIVA Y ANIMACIONES ================= */
        .perspective-container {
          perspective: 2500px;
        }

        /* ANIMACIONES DESKTOP */
        .page-turn-next {
          transform-origin: left center;
          animation: flipNext 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
          backface-visibility: hidden;
          z-index: 50;
        }

        .page-turn-prev {
          transform-origin: right center;
          animation: flipPrev 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
          backface-visibility: hidden;
          z-index: 50;
        }

        .page-fade-in {
          animation: staticFade 0.5s ease-in-out forwards;
        }

        /* ANIMACIÓN MOBILE ÚNICA */
        .mobile-turn-uniform {
          transform-origin: center;
          animation: mobileFlipUniform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }

        @keyframes flipNext {
          0% { transform: rotateY(90deg) scale(0.98); filter: brightness(0.3); opacity: 0.5; }
          100% { transform: rotateY(0deg) scale(1); filter: brightness(1); opacity: 1; }
        }

        @keyframes flipPrev {
          0% { transform: rotateY(-90deg) scale(0.98); filter: brightness(0.3); opacity: 0.5; }
          100% { transform: rotateY(0deg) scale(1); filter: brightness(1); opacity: 1; }
        }

        @keyframes staticFade {
          0% { filter: brightness(0.5); }
          100% { filter: brightness(1); }
        }

        @keyframes mobileFlipUniform {
          0% { transform: rotateY(90deg) scale(0.95); opacity: 0; filter: blur(2px); }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; filter: blur(0); }
        }
          img {
  -webkit-user-drag: none;
  user-drag: none;
}
      `}</style>
    </div>
  );
}
