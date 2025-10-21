# CustomBlocksRenderer - Variables Dinámicas Actualizadas

## Variables Disponibles

### 🌐 $fetch(URL, DEFAULT_VALUE?)
Hace una petición HTTP GET. **DEFAULT_VALUE es ahora opcional**.

```json
{
  "content": "Jugadores: $fetch('https://api.example.com/players')",
  "renderType": "text"
}
```

**Si falla la petición:** usa DEFAULT_VALUE, o "error" si no se proporciona.

### 📅 $date(FORMAT?)
Muestra fecha actual. **FORMAT es ahora opcional** (default: 'locale').

```json
{
  "content": "Hoy: $date() - Fecha completa: $date(medium)",
  "renderType": "text"
}
```

### ⏰ $time(FORMAT?)
Muestra hora actual. **FORMAT es ahora opcional** (default: 'locale').

```json
{
  "content": "Hora: $time() - 24h: $time(24h)",
  "renderType": "text"
}
```

### 🎲 $random(MIN, MAX?)
Genera número aleatorio. **MAX es ahora opcional** (default: MIN + 100).

```json
{
  "content": "Número: $random(1) - Dados: $random(1, 6)",
  "renderType": "text"
}
```

### 👤 $username(DEFAULT_VALUE?)
Muestra el nombre de usuario autenticado.

```json
{
  "content": "¡Hola $username(Invitado)!",
  "renderType": "text"
}
```

### 🎮 $mcAccountName(DEFAULT_VALUE?)
Muestra el nombre de usuario de la cuenta de Minecraft seleccionada en la instancia.

```json
{
  "content": "Cuenta MC: $mcAccountName(No vinculada)",
  "renderType": "text"
}
```

Requiere que el componente reciba la prop `instance` para acceder a la configuración de la instancia.

### 🔄 $counter(NAME, START?)
Contador persistente. **START es ahora opcional** (default: 0).

```json
{
  "content": "Visitas: $counter(visits)",
  "renderType": "text"
}
```

### 💰 $format(NUMBER, FORMAT?)
Formatea números. **FORMAT es ahora opcional** (default: 'locale').

```json
{
  "content": "Precio: $format(1234.56) - Euros: $format(1234.56, currency)",
  "renderType": "text"
}
```

### ❓ $if(CONDITION, TRUE_VALUE?, FALSE_VALUE?)
Condicional. **TRUE_VALUE y FALSE_VALUE son opcionales**.

```json
{
  "content": "$if($fetch('https://api.example.com/status'), Online, Offline)",
  "renderType": "text"
}
```

### 📏 $len(TEXT)
Longitud de texto (sin cambios).

```json
{
  "content": "Caracteres: $len('Hola Mundo')",
  "renderType": "text"
}
```

## 🎮 Ejemplo Completo: Sidebar de Minecraft

```json
{
  "logo": {
    "url": "https://saltouruguayserver.com/images/logo-scextremo.webp",
    "height": "160px",
    "position": {
      "top": "50%",
      "left": "50%",
      "transform": "translateX(-50%) translateY(-50%)"
    }
  },
  "background": {
    "videoUrl": [
      "https://cdn.pixabay.com/video/2018/08/21/178