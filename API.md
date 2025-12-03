# 🔌 API Endpoints - OCTI Backend

Documentation des endpoints pour connecter votre frontend.

## Base URL

```
http://localhost:8080  (développement)
https://your-backend.com  (production)
```

---

## 📡 Endpoints HTTP

### GET /health

Vérifie que le serveur est opérationnel.

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "octi-realtime-backend"
}
```

**Exemple :**
```javascript
const response = await fetch('http://localhost:8080/health');
const data = await response.json();
console.log(data.status); // "ok"
```

---

### GET /api/session

Crée une session éphémère OpenAI Realtime. Retourne un `client_secret` pour connexion directe à OpenAI via WebRTC.

**Réponse :**
```json
{
  "object": "realtime.session",
  "id": "sess_xxx",
  "model": "gpt-realtime",
  "client_secret": {
    "value": "ek_xxx",
    "expires_at": 1234567890
  },
  "instructions": "...",
  "voice": "alloy",
  ...
}
```

**Exemple :**
```javascript
const response = await fetch('http://localhost:8080/api/session');
const session = await response.json();
const ephemeralKey = session.client_secret.value;
// Utiliser ephemeralKey pour se connecter à OpenAI via WebRTC
```

---

## 🔌 WebSocket Endpoint

### WS /ws/realtime

Endpoint WebSocket pour conversation directe avec OCTI.

**URL :**
```
ws://localhost:8080/ws/realtime  (développement)
wss://your-backend.com/ws/realtime  (production)
```

---

## 📤 Messages Frontend → Backend

### 1. Démarrer la conversation

```json
{ "type": "start_conversation" }
```

**Quand l'envoyer :** Au début de la conversation, après avoir reçu `ready`.

---

### 2. Envoyer un chunk audio

**Format :** Binaire (ArrayBuffer), PCM16, 24kHz, mono

```javascript
// Votre audio doit être en PCM16, 24kHz, mono
const pcm16Buffer = convertToPCM16(audioData); // Int16Array
ws.send(pcm16Buffer.buffer); // Envoyer l'ArrayBuffer
```

**Important :**
- Format : PCM16 (16-bit signed integers)
- Sample rate : 24000 Hz
- Channels : Mono (1 canal)
- Le backend convertit automatiquement en Base64 et l'envoie à OpenAI

---

### 3. Fin de la parole utilisateur (optionnel)

```json
{ "type": "user_audio_end" }
```

**Note :** Avec `semantic_vad` activé, ce message n'est généralement pas nécessaire car OpenAI détecte automatiquement la fin de parole.

---

### 4. Reset session

```json
{ "type": "reset_session" }
```

Réinitialise la session et en crée une nouvelle.

---

## 📥 Messages Backend → Frontend

### 1. Backend prêt

```json
{ "type": "ready" }
```

**Quand reçu :** Automatiquement après la connexion WebSocket, quand la session OpenAI est initialisée et confirmée.

**Action :** Vous pouvez maintenant envoyer `start_conversation` et commencer à envoyer de l'audio.

---

### 2. Chunk audio du bot

**Format :** Binaire (ArrayBuffer), PCM16, 24kHz, mono

```javascript
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // C'est de l'audio PCM16, 24kHz, mono
    const audioBuffer = event.data;
    playAudio(audioBuffer);
  }
};
```

**Important :**
- Format : PCM16 (16-bit signed integers)
- Sample rate : 24000 Hz
- Channels : Mono (1 canal)
- À jouer directement dans votre AudioContext

---

### 3. Fin de la réponse vocale

```json
{ "type": "bot_audio_end" }
```

**Quand reçu :** Quand le bot a fini de parler.

**Action :** Vous pouvez indiquer à l'utilisateur qu'il peut parler à nouveau.

---

### 4. Transcription texte (optionnel)

```json
{ "type": "transcript_delta", "text": "..." }
```

**Quand reçu :** Pendant que le bot parle, pour afficher la transcription en temps réel.

**Exemple :**
```javascript
if (message.type === 'transcript_delta') {
  transcriptElement.textContent += message.text;
}
```

---

### 5. Erreur

```json
{ "type": "error", "message": "..." }
```

**Quand reçu :** En cas d'erreur (connexion OpenAI, session, etc.)

**Action :** Afficher l'erreur à l'utilisateur.

---

## 💻 Exemple Complet Frontend

```javascript
// 1. Connexion WebSocket
const ws = new WebSocket('ws://localhost:8080/ws/realtime');

let isReady = false;

ws.onopen = () => {
  console.log('✅ Connecté au backend');
};

ws.onmessage = async (event) => {
  // Message JSON
  if (typeof event.data === 'string') {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'ready':
        isReady = true;
        console.log('✅ Backend prêt');
        // Démarrer la conversation
        ws.send(JSON.stringify({ type: 'start_conversation' }));
        break;
        
      case 'bot_audio_end':
        console.log('🔚 Bot a fini de parler');
        break;
        
      case 'transcript_delta':
        console.log('📝 Transcription:', message.text);
        updateTranscript(message.text);
        break;
        
      case 'error':
        console.error('❌ Erreur:', message.message);
        break;
    }
  } 
  // Audio binaire
  else if (event.data instanceof ArrayBuffer) {
    console.log('🔊 Audio reçu:', event.data.byteLength, 'bytes');
    await playAudio(event.data);
  }
};

ws.onerror = (error) => {
  console.error('❌ Erreur WebSocket:', error);
};

ws.onclose = () => {
  console.log('🔌 Connexion fermée');
  isReady = false;
};

// 2. Envoyer de l'audio (PCM16, 24kHz, mono)
function sendAudio(audioData) {
  if (!isReady || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  // Convertir en PCM16 si nécessaire
  const pcm16 = convertToPCM16(audioData); // Int16Array
  ws.send(pcm16.buffer); // Envoyer l'ArrayBuffer
}

// 3. Jouer l'audio reçu
async function playAudio(audioBuffer) {
  const audioContext = new AudioContext({ sampleRate: 24000 });
  const pcm16 = new Int16Array(audioBuffer);
  const float32 = new Float32Array(pcm16.length);
  
  // Convertir PCM16 vers Float32
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }
  
  const buffer = audioContext.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
}
```

---

## 📋 Spécifications Audio

### Format d'entrée (Frontend → Backend)
- **Format :** PCM16 (16-bit signed integers)
- **Sample rate :** 24000 Hz
- **Channels :** Mono (1 canal)
- **Encoding :** Little-endian

### Format de sortie (Backend → Frontend)
- **Format :** PCM16 (16-bit signed integers)
- **Sample rate :** 24000 Hz
- **Channels :** Mono (1 canal)
- **Encoding :** Little-endian

---

## 🔗 URLs de Connexion

### Développement
- WebSocket : `ws://localhost:8080/ws/realtime`
- HTTP : `http://localhost:8080`

### Production
- WebSocket : `wss://your-backend.com/ws/realtime`
- HTTP : `https://your-backend.com`

**Important :** Utilisez `wss://` (WebSocket Secure) en production avec HTTPS.

