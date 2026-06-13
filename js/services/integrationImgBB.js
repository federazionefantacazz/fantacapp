// js/services/integrationImgBB.js

const IMGBB_API_KEY = '1e2eac6e1d13e266ae521061a4972bc3'; // La tua chiave presa da api.imgbb.com

/**
 * Carica un file immagine sui server di ImgBB e restituisce il link diretto.
 * @param {File} file - Il file preso dall'input HTML (e.g., fileInput.files[0])
 * @returns {Promise<string>} - L'URL diretto dell'immagine (.png/.jpg)
 */
export async function uploadImageToImgBB(file) {
  if (!file) throw new Error("Nessun file selezionato per l'upload.");
  
  if (IMGBB_API_KEY === 'INSERISCI_QUI_LA_TUA_CHIAVE_API') {
    throw new Error("Configura la tua API Key di ImgBB nel file integrationImgBB.js!");
  }

  const formData = new FormData();
  formData.append('image', file);

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
      return resData.data.url; // Restituisce l'URL internet diretto
    } else {
      throw new Error("Il server ImgBB ha rifiutato il caricamento.");
    }
  } catch (error) {
    console.error("Errore in uploadImageToImgBB:", error);
    throw error;
  }
}