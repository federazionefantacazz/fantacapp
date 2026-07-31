// js/services/integrationImgBB.js

const IMGBB_API_KEY = 'fcd3975ed7db50a4affc107a580775c4'; // La tua chiave presa da api.imgbb.com

/**
 * Comprime l'immagine mantenendo il canale Alpha (Trasparenza).
 */
function compressImageWithAlpha(file, maxWidth = 400, maxHeight = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Mantiene le proporzioni (Aspect Ratio)
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Crea il Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Pulisce il Canvas per garantire trasparenza pura
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Proviamo a convertire in WebP (mantiene la trasparenza e pesa pochissimo)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              // Fallback a PNG se il browser non supporta la compressione WebP
              canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png');
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

/**
 * Carica un file immagine con trasparenza su ImgBB.
 */
export async function uploadImageToImgBB(file) {
  if (!file) throw new Error("Nessun file selezionato per l'upload.");

  if (IMGBB_API_KEY === 'INSERISCI_QUI_LA_TUA_CHIAVE_API') {
    throw new Error("Configura la tua API Key di ImgBB nel file integrationImgBB.js!");
  }

  try {
    // 1. Ridimensiona a max 400x400px mantenendo la trasparenza
    const compressedBlob = await compressImageWithAlpha(file, 400, 400, 0.85);

    // 2. Prepara il form data
    const formData = new FormData();
    // Cambiamo l'estensione del file in .webp per coerenza
    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    formData.append('image', compressedBlob, fileName);

    // 3. Invio a ImgBB
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Errore di rete durante l'upload: ${response.status}`);
    }

    const resData = await response.json();

    if (resData.success && resData.data && resData.data.url) {
      return resData.data.url;
    } else {
      throw new Error("Il server ImgBB ha rifiutato il caricamento.");
    }
  } catch (error) {
    console.error("Errore in uploadImageToImgBB:", error);
    throw error;
  }
}

/**
 * Carica uno SFONDO su ImgBB: ritaglia al centro in formato smartphone (9:19.5),
 * ridimensiona a 1080x2340px e applica una compressione JPEG leggera (qualità 90%).
 * 
 * @param {File} file - Il file preso dall'input HTML
 * @returns {Promise<string>} - L'URL diretto dell'immagine caricata
 */
export async function uploadBackgroundToImgBB(file) {
  if (!file) throw new Error("Nessun file selezionato per l'upload.");

  const TARGET_WIDTH = 1080;
  const TARGET_HEIGHT = 2340;
  const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT;

  // 1. Ritaglio centrale e ridimensionamento tramite Canvas
  const compressedBlob = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const imgRatio = img.width / img.height;
        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        // Ritaglio centrale (Center Crop) per adattare l'immagine alle proporzioni dello smartphone
        if (imgRatio > TARGET_RATIO) {
          sWidth = img.height * TARGET_RATIO;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = img.width / TARGET_RATIO;
          sy = (img.height - sHeight) / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;

        const ctx = canvas.getContext('2d');

        // Sfondo bianco di sicurezza per evitare trasparenze nere nel JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

        // Disegna la porzione ritagliata ridimensionandola al target
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

        // Genera il file JPEG con qualità 90%
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.90);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });

  // 2. Preparazione FormData e Invio a ImgBB usando la costante IMGBB_API_KEY già presente nel file
  const fileName = file.name.replace(/\.[^/.]+$/, "") + "_bg.jpg";
  const formData = new FormData();
  formData.append('image', compressedBlob, fileName);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Errore di rete durante l'upload: ${response.status}`);
    }

    const resData = await response.json();

    if (resData.success && resData.data && resData.data.url) {
      return resData.data.url;
    } else {
      throw new Error("Il server ImgBB ha rifiutato il caricamento.");
    }
  } catch (error) {
    console.error("Errore in uploadBackgroundToImgBB:", error);
    throw error;
  }
}
