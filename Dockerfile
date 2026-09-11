# Usa un'immagine base con Node.js e Python preinstallati
FROM node:20-slim

# Installa Python e strumenti di sistema necessari
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt-get/lists/*

# Imposta la cartella di lavoro
WORKDIR /usr/src/app

# Copia i file di configurazione
COPY package*.json ./

# Installa le dipendenze Node.js
RUN npm install

# Copia tutto il resto del codice
COPY . .

# Espone la porta del server HTTP
EXPOSE 10000

# Comando di avvio del server
CMD ["node", "sync.js"]
